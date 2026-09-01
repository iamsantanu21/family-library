import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { verifyPassword, createSession } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json(
        { error: "Enter your email and password." },
        { status: 400 }
      );
    }

    const mail = String(email).trim().toLowerCase();
    const user = await db.query.users.findFirst({
      where: eq(users.email, mail),
    });
    if (
      !user ||
      user.isSystem ||
      !user.passwordHash ||
      !(await verifyPassword(String(password), user.passwordHash))
    ) {
      return NextResponse.json(
        { error: "Wrong email or password." },
        { status: 401 }
      );
    }

    if (user.status === "PENDING") {
      return NextResponse.json(
        { error: "Your account is waiting for an admin to approve it. 🕓" },
        { status: 403 }
      );
    }
    if (user.status === "REJECTED") {
      return NextResponse.json(
        { error: "Your access to this library has been turned off. Please contact the family admin." },
        { status: 403 }
      );
    }

    await createSession(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("login error", err);
    return NextResponse.json({ error: "Could not log you in." }, { status: 500 });
  }
}
