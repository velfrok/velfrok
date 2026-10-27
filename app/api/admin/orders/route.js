
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
    return { error: fail("Please sign in again.", 401) };
  }

  const client = supabaseAdmin();

  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser(token);

  if (authError || !user) {
    return {
      error: fail("Your session is invalid. Please sign in again.", 401),
    };
  }

  const { data: admin, error: adminError } = await client
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminError || !admin) {
    return { error: fail("Administrator access required.", 403) };
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
    if (auth.error) return auth.error;

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
    if (auth.error) return auth.error;

    const limitError = await rateLimitSafe(request, auth.user);
    if (limitError) return limitError;

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

    if (
      paymentStatus !== undefined &&
      !["paid", "failed"].includes(paymentStatus)
    ) {
      return fail("Invalid payment status.", 400);
    }

    if (
      orderStatus !== undefined &&
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

    if (paymentStatus === undefined && orderStatus === undefined) {
      return fail("Nothing to update.", 400);
    }

    const { data: existingOrder, error: findError } = await auth.client
      .from("orders")
      .select("id, payment_status")
      .eq("id", id)
      .maybeSingle();

    if (findError) {
      console.error("Admin order lookup failed.");
      return fail("Unable to find the order.", 500);
    }

    if (!existingOrder) {
      return fail("Order not found.", 404);
    }

    if (
      paymentStatus === "failed" &&
      existingOrder.payment_status === "paid"
    ) {
      return fail("A paid order cannot be marked as failed.", 409);
    }

    if (paymentStatus === "paid") {
      const { error: rpcError } = await auth.client.rpc(
        "mark_order_paid_and_decrement_stock",
        { p_order_id: id }
      );

      if (rpcError) {
        console.error(
          "Atomic order payment and stock update failed."
        );

        return fail(
          "Payment approval was rejected. Confirm that a UTR was submitted and verify the payment in your bank or UPI account. Also check product stock and order items before retrying.",
          409
        );
      }
    }

    const patch = {};

    if (paymentStatus === "failed") {
      patch.payment_status = "failed";
    }

    if (orderStatus !== undefined) {
      patch.status = orderStatus;
    }

    if (Object.keys(patch).length > 0) {
      const { error: updateError } = await auth.client
        .from("orders")
        .update(patch)
        .eq("id", id);

      if (updateError) {
        console.error("Admin order status update failed.");

        return fail(
          "Payment processing may have succeeded, but the order status update failed. Reload the order before retrying.",
          500
        );
      }
    }

    await auditLog(auth.user.email, "order.update", {
      id,
      ...(paymentStatus !== undefined
        ? { payment_status: paymentStatus }
        : {}),
      ...(orderStatus !== undefined
        ? { status: orderStatus }
        : {}),
    });

    return NextResponse.json({ ok: true });
  } catch {
    console.error("Unexpected admin order update error.");
    return fail("Unable to update the order right now.", 500);
  }
}
