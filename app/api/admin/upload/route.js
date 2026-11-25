
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-session";
import { supabaseAdmin } from "@/lib/supabase";
import { auditLog } from "@/lib/audit";

export const runtime = "nodejs";

const ALLOWED = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX = 2 * 1024 * 1024;

function respond(body, status, session) {
  const response = NextResponse.json(body, { status });

  if (session?.clearCookies) {
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
  } else if (session?.setCookies) {
    session.setCookies(response);
  }

  return response;
}

export async function POST(req) {
  let session;

  try {
    session = await getAdminSession(req);
  } catch {
    console.error("Admin upload authentication check failed.");
    return NextResponse.json(
      { error: "Unable to verify administrator access." },
      { status: 503 }
    );
  }

  if (!session.user) {
    return respond(
      { error: "Please sign in again." },
      401,
      session
    );
  }

  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return respond({ error: "No file provided." }, 400, session);
    }

    if (!ALLOWED[file.type]) {
      return respond(
        { error: "Only JPG, PNG, and WebP images are allowed." },
        415,
        session
      );
    }

    if (file.size > MAX) {
      return respond({ error: "Maximum file size is 2MB." }, 413, session);
    }

    const head = new Uint8Array(
      await file.slice(0, 12).arrayBuffer()
    );

    const isJpg = head[0] === 0xff && head[1] === 0xd8;
    const isPng = head[0] === 0x89 && head[1] === 0x50;
    const isWebp =
      head[0] === 0x52 &&
      head[1] === 0x49 &&
      head[2] === 0x46 &&
      head[3] === 0x46 &&
      head[8] === 0x57 &&
      head[9] === 0x45 &&
      head[10] === 0x42 &&
      head[11] === 0x50;

    if (!(isJpg || isPng || isWebp)) {
      return respond(
        { error: "File content is not a valid supported image." },
        415,
        session
      );
    }

    const ext = ALLOWED[file.type];
    const path = `${crypto.randomUUID()}.${ext}`;
    const storage = supabaseAdmin().storage.from("product-images");

    const { error: uploadError } = await storage.upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      console.error("Product image upload failed.");
      return respond(
        { error: "Unable to upload the image. Check storage permissions." },
        500,
        session
      );
    }

    const { data, error: signedUrlError } = await storage.createSignedUrl(
      path,
      60 * 60 * 24 * 365
    );

    if (signedUrlError || !data?.signedUrl) {
      console.error("Product image signed URL creation failed.");
      return respond(
        { error: "Image uploaded, but its secure URL could not be created." },
        500,
        session
      );
    }

    await auditLog(session.user.email, "file.upload", { path });

    return respond({ url: data.signedUrl }, 200, session);
  } catch {
    console.error("Unexpected admin image upload error.");
    return respond(
      { error: "Unable to upload the image right now." },
      500,
      session
    );
  }
}
