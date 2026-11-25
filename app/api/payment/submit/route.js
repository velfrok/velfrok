
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { cleanUtr } from "@/lib/sanitize";

async function verifyCaptcha(captchaToken) {
  const secret = process.env.HCAPTCHA_SECRET;

  if (
    typeof captchaToken !== "string" ||
    !captchaToken.trim() ||
    !secret
  ) {
    return false;
  }

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
          response: captchaToken,
        }),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return false;
    }

    const result = await response.json();
    return result.success === true;
  } catch {
    return false;
  }
}

export async function POST(req) {
  try {
    // 1. Require an authenticated customer.
    const { user, error: authError } = await requireUser(req);

    if (authError) {
      return authError;
    }

    if (!user?.id) {
      return Response.json(
        { error: "Please sign in before submitting payment details." },
        { status: 401 }
      );
    }

    // 2. Rate-limit submissions.
    await rateLimit(`utr:${clientIp(req)}`, 5, 300);

    // 3. Parse and validate the request.
    let body;

    try {
      body = await req.json();
    } catch {
      return Response.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const { token, utr, captcha } = body || {};

    if (
      typeof token !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(token)
    ) {
      return Response.json(
        { error: "Invalid payment session." },
        { status: 400 }
      );
    }

    if (typeof utr !== "string") {
      return Response.json(
        { error: "Enter a valid UPI transaction reference." },
        { status: 400 }
      );
    }

    const transactionId = cleanUtr(utr);

    if (
      typeof transactionId !== "string" ||
      transactionId.length < 6 ||
      transactionId.length > 30
    ) {
      return Response.json(
        { error: "Enter a valid UPI transaction reference." },
        { status: 400 }
      );
    }

    // 4. Verify CAPTCHA before making database changes.
    if (!(await verifyCaptcha(captcha))) {
      return Response.json(
        {
          error: "CAPTCHA verification failed. Please try again.",
        },
        { status: 400 }
      );
    }

    const db = supabaseAdmin();

    // 5. Verify payment-session ownership.
    // This lookup does not modify the database.
    const {
      data: payment,
      error: lookupError,
    } = await db
      .from("payment_intents")
      .select("token, status")
      .eq("token", token)
      .eq("user_id", user.id)
      .maybeSingle();

    if (lookupError) {
      console.error(
        "Payment session lookup failed:",
        lookupError.code
      );

      return Response.json(
        { error: "Unable to verify payment session." },
        { status: 500 }
      );
    }

    if (!payment) {
      return Response.json(
        { error: "Payment session not found." },
        { status: 404 }
      );
    }

    if (payment.status !== "opened") {
      return Response.json(
        {
          error:
            "This payment session is no longer open. Refresh the page to check its status.",
        },
        { status: 409 }
      );
    }

    // 6. Update the payment intent and order atomically.
    // The database function must lock and revalidate both records.
    // If either update fails, both changes must roll back.
    const {
      data: result,
      error: submitError,
    } = await db.rpc("submit_payment_utr_atomic", {
      p_token: token,
      p_user_id: user.id,
      p_utr: transactionId,
    });

    if (submitError) {
      console.error(
        "Atomic UTR submission failed:",
        submitError.code
      );

      if (submitError.code === "P0002") {
        return Response.json(
          { error: "Payment session or order not found." },
          { status: 404 }
        );
      }

      if (submitError.code === "22023") {
        return Response.json(
          { error: "Enter a valid UPI transaction reference." },
          { status: 400 }
        );
      }

      if (submitError.code === "P0001") {
        const message = String(
          submitError.message || ""
        ).toLowerCase();

        if (message.includes("expired")) {
          return Response.json(
            {
              error:
                "This payment session has expired. Please contact support.",
            },
            { status: 400 }
          );
        }

        return Response.json(
          {
            error:
              "The payment session or order has changed. Refresh the page and check its status.",
          },
          { status: 409 }
        );
      }

      // Do not retry the database operation automatically.
      // A client can refresh the payment status before deciding
      // what to do next.
      return Response.json(
        {
          error:
            "Unable to confirm UTR submission. Refresh the payment page to check its current status before trying again.",
        },
        { status: 500 }
      );
    }

    // 7. Confirm only that the UTR was submitted.
    // Actual payment approval remains a separate manual admin action.
    return Response.json({
      ok: true,
      message:
        result?.message ||
        "Payment submitted for verification.",
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error("Payment submission request failed.");

    return Response.json(
      { error: "Unable to submit payment details right now." },
      { status: 500 }
    );
  }
}
