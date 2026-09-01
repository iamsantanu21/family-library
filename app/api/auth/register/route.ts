import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { hashPassword, createSession } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const { name, email, password, location, inviteCode } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email and password are required." },
        { status: 400 }
      );
    }
    if (!EMAIL_RE.test(String(email))) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }
    if (String(password).length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const required = process.env.FAMILY_INVITE_CODE;
    if (required && String(inviteCode || "").trim() !== required) {
      return NextResponse.json(
        { error: "That family invite code is not correct." },
        { status: 403 }
      );
    }

    const mail = String(email).trim().toLowerCase();
    const existing = await db.query.users.findFirst({
      where: eq(users.email, mail),
    });
    if (existing) {
      return NextResponse.json(
        { error: "An account with that email already exists." },
        { status: 409 }
      );
    }

    // First real (non-system) member becomes the admin and is active now.
    const existingCount = await db.$count(users, eq(users.isSystem, false));
    const isFirst = existingCount === 0;

    const [user] = await db
      .insert(users)
      .values({
        name: String(name).trim(),
        email: mail,
        location: location ? String(location).trim() : null,
        passwordHash: await hashPassword(String(password)),
        role: isFirst ? "ADMIN" : "MEMBER",
        status: isFirst ? "ACTIVE" : "PENDING",
      })
      .returning();

    if (isFirst) {
      await createSession(user.id);
      return NextResponse.json({ ok: true, role: "ADMIN" });
    }
    return NextResponse.json({ ok: true, pending: true });
  } catch (err) {
    console.error("register error", err);
    return NextResponse.json(
      { error: "Something went wrong creating your account." },
      { status: 500 }
    );
  }
}
