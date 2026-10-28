
import { supabaseAdmin } from "@/lib/supabase";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await rateLimit(`pstat:${clientIp(req)}`, 60, 60);

    const token = new URL(req.url).searchParams.get("token");

    if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
      return Response.json(
        { error: "Invalid payment token." },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();

    const { data: pi, error: queryError } = await supabase
      .from("payment_intents")
      .select("status, amount_inr, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (queryError) {
      console.error("Payment status query failed:", queryError);

      return Response.json(
        { error: "Unable to check payment status." },
        { status: 500 }
      );
    }

    if (!pi) {
      return Response.json(
        { error: "Payment session not found." },
        { status: 404 }
      );
    }

    // Expire only sessions that are still opened.
    // The status condition prevents overwriting a concurrent
    // admin verification or another status update.
    if (pi.status === "opened") {
      const expiryTime = Date.parse(pi.expires_at);

      if (!Number.isFinite(expiryTime)) {
        console.error("Invalid payment expiry date:", pi.expires_at);

        return Response.json(
          { error: "Unable to verify payment expiry." },
          { status: 500 }
        );
      }

      if (expiryTime <= Date.now()) {
        const { data: updated, error: updateError } = await supabase
          .from("payment_intents")
          .update({ status: "abandoned" })
          .eq("token", token)
          .eq("status", "opened")
          .select("status, amount_inr")
          .maybeSingle();

        if (updateError) {
          console.error("Payment expiry update failed:", updateError);

          return Response.json(
            { error: "Unable to update payment status." },
            { status: 500 }
          );
        }

        // If another process changed the status first, read the
        // current status rather than reporting an incorrect expiry.
        if (updated) {
          return Response.json({
            status: "expired",
            amount: updated.amount_inr,
          });
        }

        const { data: current, error: refreshError } = await supabase
          .from("payment_intents")
          .select("status, amount_inr")
          .eq("token", token)
          .maybeSingle();

        if (refreshError || !current) {
          console.error(
            "Could not refresh payment status:",
            refreshError
          );

          return Response.json(
            { error: "Unable to refresh payment status." },
            { status: 500 }
          );
        }

        return Response.json({
          status: current.status,
          amount: current.amount_inr,
        });
      }
    }

    return Response.json({
      status: pi.status,
      amount: pi.amount_inr,
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error("Payment status API error:", error);

    return Response.json(
      { error: "Unable to check payment status." },
      { status: 500 }
    );
  }
}
