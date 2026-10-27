
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { clean, cleanPhone } from "@/lib/sanitize";
import { newPaymentToken } from "@/lib/payment-token";

export async function POST(req) {
  try {
    const { user, error } = await requireUser(req);
    if (error) return error;

    await rateLimit(`order:${user.id}`, 5, 600);

    let body;

    try {
      body = await req.json();
    } catch {
      return Response.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return Response.json(
        { error: "Cart empty" },
        { status: 400 }
      );
    }

    if (body.items.length > 100) {
      return Response.json(
        { error: "Too many cart items" },
        { status: 400 }
      );
    }

    // Validate and combine duplicate SKUs before checking stock.
    const quantities = new Map();

    for (const item of body.items) {
      const sku = clean(item?.sku, 40);
      const qty = Number(item?.qty);

      if (
        !sku ||
        !Number.isInteger(qty) ||
        qty < 1 ||
        qty > 10
      ) {
        return Response.json(
          { error: "Invalid product or quantity" },
          { status: 400 }
        );
      }

      const combinedQty = (quantities.get(sku) || 0) + qty;

      if (combinedQty > 10) {
        return Response.json(
          { error: `Maximum quantity exceeded for ${sku}` },
          { status: 400 }
        );
      }

      quantities.set(sku, combinedQty);
    }

    const address = {
      name: clean(body.name, 80),
      phone: cleanPhone(body.phone),
      line1: clean(body.line1, 200),
      city: clean(body.city, 60),
      pincode: clean(body.pincode, 6),
      state: clean(body.state, 40),
    };

    if (
      !address.name ||
      address.phone.length !== 10 ||
      !address.line1 ||
      !address.city ||
      !address.state ||
      !/^\d{6}$/.test(address.pincode)
    ) {
      return Response.json(
        { error: "Invalid address" },
        { status: 400 }
      );
    }

    const db = supabaseAdmin();
    const skus = [...quantities.keys()];

    // Never trust prices or product names supplied by the browser.
    const { data: products, error: productError } = await db
      .from("products")
      .select("sku,name,price_inr,stock")
      .in("sku", skus)
      .eq("is_active", true);

    if (productError) {
      console.error("Order product lookup failed:", productError.message);

      return Response.json(
        { error: "Unable to verify products. Please try again." },
        { status: 500 }
      );
    }

    const productMap = new Map(
      (products || []).map((product) => [product.sku, product])
    );

    let subtotal = 0;
    const lineItems = [];

    for (const [sku, qty] of quantities) {
      const product = productMap.get(sku);

      if (!product) {
        return Response.json(
          { error: `Product ${sku} is unavailable` },
          { status: 400 }
        );
      }

      const price = Number(product.price_inr);
      const stock = Number(product.stock);

      if (
        !Number.isFinite(price) ||
        price < 0 ||
        !Number.isFinite(stock) ||
        stock < qty
      ) {
        return Response.json(
          { error: `${sku} is out of stock or unavailable` },
          { status: 409 }
        );
      }

      subtotal += price * qty;

      lineItems.push({
        sku: product.sku,
        name: product.name,
        price,
        qty,
      });
    }

    if (!Number.isSafeInteger(subtotal) || subtotal < 0) {
      return Response.json(
        { error: "Unable to calculate order total" },
        { status: 400 }
      );
    }

    // Validate coupons on the server.
    let discount = 0;
    let couponCode = null;

    if (body.coupon) {
      const code = clean(body.coupon, 20).toUpperCase();

      if (code) {
        const { data: coupon, error: couponError } = await db
          .from("coupons")
          .select("code,discount_pct")
          .eq("code", code)
          .eq("is_active", true)
          .gte("expires_at", new Date().toISOString())
          .maybeSingle();

        if (couponError) {
          console.error(
            "Order coupon lookup failed:",
            couponError.message
          );

          return Response.json(
            { error: "Unable to validate coupon. Please try again." },
            { status: 500 }
          );
        }

        if (coupon) {
          const percentage = Number(coupon.discount_pct);

          if (
            !Number.isFinite(percentage) ||
            percentage < 0 ||
            percentage > 100
          ) {
            return Response.json(
              { error: "Coupon configuration is invalid" },
              { status: 500 }
            );
          }

          discount = Math.round((subtotal * percentage) / 100);
          couponCode = coupon.code;
        }
      }
    }

    const orderCode =
      `VFK-${Date.now().toString(36).toUpperCase()}`;

    const { data: order, error: orderError } = await db
      .from("orders")
      .insert({
        order_code: orderCode,
        user_id: user.id,
        items: lineItems,
        subtotal_inr: subtotal,
        discount_inr: discount,
        total_inr: subtotal - discount,
        coupon_code: couponCode,
        shipping_address: address,
      })
      .select("id,order_code,total_inr")
      .single();

    if (orderError || !order) {
      console.error(
        "Order insertion failed:",
        orderError?.message || "No order returned"
      );

      return Response.json(
        { error: "Unable to create your order. Please try again." },
        { status: 500 }
      );
    }

    // Create a unique payment token for the newly created order.
    const token = newPaymentToken();

    const { error: paymentError } = await db
      .from("payment_intents")
      .insert({
        token,
        order_id: order.id,
        user_id: user.id,
        amount_inr: order.total_inr,
      });

    if (paymentError) {
      console.error(
        "Payment intent creation failed:",
        paymentError.message
      );

      // Best-effort cleanup: avoid leaving an unusable new order.
      const { error: cleanupError } = await db
        .from("orders")
        .delete()
        .eq("id", order.id)
        .eq("user_id", user.id);

      if (cleanupError) {
        console.error(
          "Order cleanup failed after payment intent error:",
          cleanupError.message
        );
      }

      return Response.json(
        {
          error:
            "Unable to prepare payment for this order. Please check your orders before trying again.",
        },
        { status: 500 }
      );
    }

    return Response.json({
      ok: true,
      orderCode: order.order_code,
      token,
    });
  } catch (error) {
    if (error instanceof Response) return error;

    console.error("Order creation failed:", error?.message || "Unknown error");

    return Response.json(
      { error: "Server error while creating your order" },
      { status: 500 }
    );
  }
}

export async function GET(req) {
  try {
    const { user, error } = await requireUser(req);
    if (error) return error;

    const { data, error: ordersError } = await supabaseAdmin()
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (ordersError) {
      console.error("Order history lookup failed:", ordersError.message);

      return Response.json(
        { error: "Unable to load your orders" },
        { status: 500 }
      );
    }

    return Response.json({ orders: data || [] });
  } catch (error) {
    if (error instanceof Response) return error;

    console.error(
      "Order history request failed:",
      error?.message || "Unknown error"
    );

    return Response.json(
      { error: "Server error while loading orders" },
      { status: 500 }
    );
  }
}
