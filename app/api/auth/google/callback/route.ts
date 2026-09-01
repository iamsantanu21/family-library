import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { createSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = cookies().get("g_state")?.value;

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(new URL("/login?error=google-failed", origin));
  }
  cookies().delete("g_state");

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/login?error=google-not-configured", origin)
    );
  }

  try {
    const redirectUri = `${origin}/api/auth/google/callback`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) throw new Error("token exchange failed");
    const tokens = (await tokenRes.json()) as { access_token?: string };

    const profRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { authorization: `Bearer ${tokens.access_token}` } }
    );
    if (!profRes.ok) throw new Error("userinfo failed");
    const prof = (await profRes.json()) as { email?: string; name?: string };

    const email = String(prof.email || "").toLowerCase();
    if (!email) throw new Error("no email from Google");
    const name = prof.name || email.split("@")[0];

    let user = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (!user) {
      const existingCount = await db.$count(users, eq(users.isSystem, false));
      const isFirst = existingCount === 0;
      const [created] = await db
        .insert(users)
        .values({
          email,
          name,
          role: isFirst ? "ADMIN" : "MEMBER",
          status: isFirst ? "ACTIVE" : "PENDING",
        })
        .returning();
      user = created;
    }

    if (user.status === "PENDING") {
      return NextResponse.redirect(new URL("/login?notice=pending", origin));
    }
    if (user.status === "REJECTED") {
      return NextResponse.redirect(new URL("/login?error=disabled", origin));
    }

    await createSession(user.id);
    return NextResponse.redirect(new URL("/", origin));
  } catch (err) {
    console.error("google callback error", err);
    return NextResponse.redirect(new URL("/login?error=google-failed", origin));
  }
}
