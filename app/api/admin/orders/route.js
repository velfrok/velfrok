
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getAdminSession } from "@/lib/admin-session";
import { auditLog } from "@/lib/audit";
import { clean } from "@/lib/sanitize";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

function fail(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function applySession(response, auth) {
  if (auth?.clearCookies) {
    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    };

    response.cookies.set("sb-access-token", "", options);
    response.cookies.set("sb-refresh-token", "", options);
    response.cookies.set("admin-otp-session", "", {
      ...options,
      sameSite: "strict",
    });
    response.cookies.set("admin-otp-refresh-session", "", {
      ...options,
      sameSite: "strict",
    });
  } else if (auth?.setCookies) {
    return auth.setCookies(response);
  }

  return response;
}

function reply(auth, body, status = 200) {
  return applySession(NextResponse.json(body, { status }), auth);
}

async function checkAdminCookie(request) {
  let session;

  try {
    session = await getAdminSession(request);
  } catch {
    console.error("Admin orders authentication check failed.");
    return {
      error: fail("Unable to verify administrator access.", 503),
    };
  }

  if (!session.user) {
    return {
      error: applySession(
        fail("Your session is invalid. Please sign in again.", 401),
        session
      ),
    };
  }

  return {
    user: session.user,
    session,
    client: supabaseAdmin(),
  };
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
  let auth;

  try {
    auth = await checkAdminCookie(request);
    if (auth.error) return auth.error;

    const { data, error } = await auth.client
      .from("orders")
      .select("*, payment_intents(token,status,utr,expires_at)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("Admin orders lookup failed.");
      return reply(auth.session, { error: "Unable to load orders." }, 500);
    }

    return reply(auth.session, { orders: data || [] });
  } catch {
    console.error("Unexpected admin orders lookup error.");
    return reply(auth?.session, {
      error: "Unable to load orders right now.",
    }, 500);
  }
}

export async function PATCH(request) {
  let auth;

  try {
    auth = await checkAdminCookie(request);
    if (auth.error) return auth.error;

    const limitError = await rateLimitSafe(request, auth.user);
    if (limitError) return applySession(limitError, auth.session);

    let body;

    try {
      body = await request.json();
    } catch {
      return reply(auth.session, { error: "Invalid request data." }, 400);
    }

    const { orderId, paymentStatus, orderStatus } = body || {};
    const id = clean(String(orderId || ""), 40);

    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return reply(auth.session, { error: "Bad order ID." }, 400);
    }

    if (
      paymentStatus !== undefined &&
      !["paid", "failed"].includes(paymentStatus)
    ) {
      return reply(auth.session, { error: "Invalid payment status." }, 400);
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
      return reply(auth.session, { error: "Invalid order status." }, 400);
    }

    if (paymentStatus === undefined && orderStatus === undefined) {
      return reply(auth.session, { error: "Nothing to update." }, 400);
    }

    if (paymentStatus !== undefined && orderStatus !== undefined) {
      return reply(
        auth.session,
        {
          error: "Update payment status and order status in separate requests.",
        },
        400
      );
    }

    const { data: existingOrder, error: findError } = await auth.client
      .from("orders")
      .select("id, payment_status, status")
      .eq("id", id)
      .maybeSingle();

    if (findError) {
      console.error("Admin order lookup failed.");
      return reply(auth.session, { error: "Unable to find the order." }, 500);
    }

    if (!existingOrder) {
      return reply(auth.session, { error: "Order not found." }, 404);
    }

    if (
      paymentStatus === "failed" &&
      existingOrder.payment_status === "paid"
    ) {
      return reply(
        auth.session,
        { error: "A paid order cannot be marked as failed." },
        409
      );
    }

    if (paymentStatus === "paid") {
      if (existingOrder.payment_status === "paid") {
        return reply(
          auth.session,
          { error: "This order is already marked as paid." },
          409
        );
      }

      const { error: rpcError } = await auth.client.rpc(
        "mark_order_paid_and_decrement_stock",
        { p_order_id: id }
      );

      if (rpcError) {
        console.error("Atomic order payment and stock update failed.");

        return reply(
          auth.session,
          {
            error:
              "Payment approval was rejected. Verify the bank/UPI receipt, confirm a UTR was submitted, and check stock and order items.",
          },
          409
        );
      }
    } else if (paymentStatus === "failed") {
      const { data: updatedOrder, error: updateError } = await auth.client
        .from("orders")
        .update({ payment_status: "failed" })
        .eq("id", id)
        .eq("payment_status", existingOrder.payment_status)
        .select("id")
        .maybeSingle();

      if (updateError) {
        console.error("Order payment status update failed.");
        return reply(
          auth.session,
          { error: "Unable to update payment status." },
          500
        );
      }

      if (!updatedOrder) {
        return reply(
          auth.session,
          {
            error:
              "The payment status changed. Reload the order before retrying.",
          },
          409
        );
      }
    } else if (orderStatus !== undefined) {
      const allowedTransitions = {
        placed: ["packed", "cancelled"],
        packed: ["dispatched", "cancelled"],
        dispatched: ["delivered"],
        delivered: [],
        cancelled: [],
      };

      if (
        !allowedTransitions[existingOrder.status]?.includes(orderStatus)
      ) {
        return reply(
          auth.session,
          {
            error: `Cannot change order status from "${existingOrder.status}" to "${orderStatus}".`,
          },
          409
        );
      }

      if (
        orderStatus === "packed" &&
        existingOrder.payment_status !== "paid"
      ) {
        return reply(
          auth.session,
          { error: "Only a paid order can be accepted and packed." },
          409
        );
      }

      const { data: updatedOrder, error: updateError } = await auth.client
        .from("orders")
        .update({ status: orderStatus })
        .eq("id", id)
        .eq("status", existingOrder.status)
        .select("id")
        .maybeSingle();

      if (updateError) {
        console.error("Admin order status update failed.");
        return reply(
          auth.session,
          {
            error:
              "The status update was rejected. Reload the order and verify its current status.",
          },
          409
        );
      }

      if (!updatedOrder) {
        return reply(
          auth.session,
          {
            error:
              "The order status changed. Reload the order before retrying.",
          },
          409
        );
      }
    }

    await auditLog(auth.user.email, "order.update", {
      id,
      ...(paymentStatus !== undefined
        ? { payment_status: paymentStatus }
        : {}),
      ...(orderStatus !== undefined ? { status: orderStatus } : {}),
    });

    return reply(auth.session, { ok: true });
  } catch {
    console.error("Unexpected admin order update error.");
    return reply(
      auth?.session,
      { error: "Unable to update the order right now." },
      500
    );
  }
}
