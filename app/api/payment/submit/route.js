
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
      !/^[0-9a-f-]{36}$/i.test(token)
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
      .select("token,user_id,order_id,status,expires_at")
      .eq("token", token)
      .eq("user_id", user.id)
      .maybeSingle();

    if (lookupError) {
      console.error("Payment intent lookup failed.");
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

    if (payment.expires_at && isExpired(payment)) {
      return Response.json(
        {
          error:
            "This payment page has expired. Please contact support.",
        },
        { status: 400 }
      );
    }

    // Record the UTR without declaring the payment paid.
    // The status condition prevents a second submission.
    const { data: updatedPayment, error: paymentError } =
      await db
        .from("payment_intents")
        .update({
          status: "utr_submitted",
          utr: transactionId,
        })
        .eq("token", payment.token)
        .eq("user_id", user.id)
        .eq("status", "opened")
        .select("token")
        .maybeSingle();

    if (paymentError) {
      console.error("Payment submission update failed.");
      return Response.json(
        { error: "Unable to submit payment details. Please try again." },
        { status: 500 }
      );
    }

    if (!updatedPayment) {
      return Response.json(
        {
          error:
            "This payment has already been submitted. Refresh the page.",
        },
        { status: 409 }
      );
    }

    const { data: updatedOrder, error: orderError } = await db
      .from("orders")
      .update({
        payment_status: "pending_verification",
      })
      .eq("id", payment.order_id)
      .eq("user_id", user.id)
      .eq("payment_status", "awaiting_payment")
      .select("id")
      .maybeSingle();

    if (orderError || !updatedOrder) {
      // The UTR may already be saved. Do not claim full success.
      console.error("Order payment status update failed.");
      return Response.json(
        {
          error:
            "Your UTR may have been recorded, but the order status could not be updated. Please contact support and do not submit it again.",
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

    console.error("Payment submission failed.");

    return Response.json(
      { error: "Server error while submitting payment" },
      { status: 500 }
    );
  }
}
