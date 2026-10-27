
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { cleanUtr } from "@/lib/sanitize";
import { isExpired } from "@/lib/payment-token";

async function verifyCaptcha(token) {
  const secret = process.env.HCAPTCHA_SECRET;

  if (!secret || !token) return false;

  try {
    const response = await fetch(
      "https://api.hcaptcha.com/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          secret,
          response: token,
        }),
      }
    );

    if (!response.ok) return false;

    const result = await response.json();
    return result.success === true;
  } catch {
    return false;
  }
}

export async function POST(req) {
  try {
    const { user, error } = await requireUser(req);
    if (error) return error;

    await rateLimit(`utr:${clientIp(req)}`, 5, 300);

    let body;

    try {
      body = await req.json();
    } catch {
      return Response.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { token, utr, captcha } = body || {};

    if (
      typeof token !== "string" ||
      token.length > 100 ||
      !token.trim()
    ) {
      return Response.json(
        { error: "Invalid or expired payment page" },
        { status: 400 }
      );
    }

    if (!(await verifyCaptcha(captcha))) {
      return Response.json(
        { error: "CAPTCHA verification failed. Please try again." },
        { status: 400 }
      );
    }

    const transactionId = cleanUtr(utr);

    if (transactionId.length < 6) {
      return Response.json(
        { error: "Enter a valid UPI transaction ID (UTR)" },
        { status: 400 }
      );
    }

    const db = supabaseAdmin();

    const { data: payment, error: lookupError } = await db
      .from("payment_intents")
      .select(
        "id,token,user_id,order_id,status,expires_at,utr"
      )
      .eq("token", token)
      .eq("user_id", user.id)
      .maybeSingle();

    if (lookupError) {
      console.error(
        "Payment intent lookup failed:",
        lookupError.message
      );

      return Response.json(
        { error: "Unable to verify payment session" },
        { status: 500 }
      );
    }

    if (!payment || payment.status !== "opened") {
      return Response.json(
        { error: "Invalid or already submitted payment page" },
        { status: 400 }
      );
    }

    if (
      payment.expires_at &&
      isExpired(payment)
    ) {
      return Response.json(
        { error: "This payment page has expired. Please contact support." },
        { status: 400 }
      );
    }

    // Do not mark an order as paid here.
    // An administrator must verify the UTR first.
    const { data: updatedPayment, error: paymentError } = await db
      .from("payment_intents")
      .update({
        status: "utr_submitted",
        utr: transactionId,
      })
      .eq("id", payment.id)
      .eq("user_id", user.id)
      .eq("status", "opened")
      .select("id")
      .maybeSingle();

    if (paymentError) {
      console.error(
        "Payment submission update failed:",
        paymentError.message
      );

      return Response.json(
        { error: "Unable to submit payment details. Please try again." },
        { status: 500 }
      );
    }

    if (!updatedPayment) {
      return Response.json(
        { error: "This payment has already been submitted. Refresh the page." },
        { status: 409 }
      );
    }

    const { error: orderError } = await db
      .from("orders")
      .update({
        payment_status: "pending_verification",
      })
      .eq("id", payment.order_id)
      .eq("user_id", user.id);

    if (orderError) {
      console.error(
        "Order payment status update failed:",
        orderError.message
      );

      // The payment submission is already saved.
      // Report the partial failure instead of claiming full success.
      return Response.json(
        {
          error:
            "Your UTR was recorded, but the order status could not be updated. Please contact support and do not submit it again.",
        },
        { status: 500 }
      );
    }

    return Response.json({
      ok: true,
      message: "Payment submitted for verification",
    });
  } catch (error) {
    if (error instanceof Response) return error;

    console.error(
      "Payment submission failed:",
      error?.message || "Unknown error"
    );

    return Response.json(
      { error: "Server error while submitting payment" },
      { status: 500 }
    );
  }
}
