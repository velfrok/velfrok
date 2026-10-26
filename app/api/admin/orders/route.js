
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { auditLog } from "@/lib/audit";
import { clean } from "@/lib/sanitize";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

function fail(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function checkAdminCookie(request) {
  const token = request.cookies.get("sb-access-token")?.value;

  if (!token) {
    return {
      error: fail("Please sign in again.", 401),
    };
  }

  const client = supabaseAdmin();

  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser(token);

  if (authError || !user) {
    return {
      error: fail(
        "Your session is invalid. Please sign in again.",
        401
      ),
    };
  }

  const { data: admin, error: adminError } = await client
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminError || !admin) {
    return {
      error: fail("Administrator access required.", 403),
    };
  }

  return { user, client };
}


async function rateLimitSafe(request, user) {
  try {
    await rateLimit(
      `admin-orders:${user.id}:${clientIp(request)}`,
      10,
      60
    );

    return null;
  } catch (error) {
    if (error instanceof Response && error.status === 429) {
      return error;
    }

    console.error("Admin orders rate limit check failed.");

    return NextResponse.json(
      { error: "Temporarily unable to process this request." },
      { status: 503 }
    );
  }
}


export async function GET(request) {
  try {
    const auth = await checkAdminCookie(request);

    if (auth.error) {
      return auth.error;
    }

    const { data, error } = await auth.client
      .from("orders")
      .select("*, payment_intents(token,status,utr,expires_at)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("Admin orders lookup failed.");

      return fail("Unable to load orders.", 500);
    }

    return NextResponse.json({ orders: data || [] });
  } catch {
    console.error("Unexpected admin orders lookup error.");

    return fail("Unable to load orders right now.", 500);
  }
}

export async function PATCH(request) {
  try {
    const auth = await checkAdminCookie(request);

    if (auth.error) {
      return auth.error;
    }

    const limitError = await rateLimitSafe(request, auth.user);

    if (limitError) {
      return limitError;
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return fail("Invalid request data.", 400);
    }

    const { orderId, paymentStatus, orderStatus } = body;
    const id = clean(String(orderId || ""), 40);

    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return fail("Bad order ID.", 400);
    }

    const patch = {};

    if (paymentStatus !== undefined) {
      if (!["paid", "failed"].includes(paymentStatus)) {
        return fail("Invalid payment status.", 400);
      }

      patch.payment_status = paymentStatus;
    }

    if (orderStatus !== undefined) {
      if (
        ![
          "placed",
          "packed",
          "dispatched",
          "delivered",
          "cancelled",
        ].includes(orderStatus)
      ) {
        return fail("Invalid order status.", 400);
      }

      patch.status = orderStatus;
    }

    if (!Object.keys(patch).length) {
      return fail("Nothing to update.", 400);
    }

    const { data: existingOrder, error: findError } =
      await auth.client
        .from("orders")
        .select("id, items, payment_status")
        .eq("id", id)
        .maybeSingle();

    if (findError) {
      console.error("Admin order lookup failed.");
      return fail("Unable to find the order.", 500);
    }

    if (!existingOrder) {
      return fail("Order not found.", 404);
    }

    const { error: updateError } = await auth.client
      .from("orders")
      .update(patch)
      .eq("id", id);

    if (updateError) {
      console.error("Admin order update failed.");
      return fail("Unable to update the order.", 500);
    }

    if (
      patch.payment_status === "paid" &&
      existingOrder.payment_status !== "paid"
    ) {
      const { error: paymentError } = await auth.client
        .from("payment_intents")
        .update({ status: "paid" })
        .eq("order_id", id);

      if (paymentError) {
        console.error("Payment intent update failed.");
        return fail(
          "Order updated, but payment status synchronization failed.",
          500
        );
      }

      // Stock is decremented only when transitioning to paid.
      // This assumes the database RPC is designed to be atomic.
      const items = Array.isArray(existingOrder.items)
        ? existingOrder.items
        : [];

      for (const item of items) {
        if (
          !item ||
          typeof item.sku !== "string" ||
          !Number.isSafeInteger(item.qty) ||
          item.qty <= 0
        ) {
          console.error("Invalid order item encountered.");
          return fail(
            "Order updated, but stock synchronization needs review.",
            500
          );
        }

        const { error: stockError } = await auth.client.rpc(
          "decrement_stock",
          {
            p_sku: item.sku,
            p_qty: item.qty,
          }
        );

        if (stockError) {
          console.error("Stock decrement failed.");
          return fail(
            "Order updated, but stock synchronization failed.",
            500
          );
        }
      }
    }

    await auditLog(auth.user.email, "order.update", {
      id,
      ...patch,
    });

    return NextResponse.json({ ok: true });
  } catch {
    console.error("Unexpected admin order update error.");

    return fail("Unable to update the order right now.", 500);
  }
}
