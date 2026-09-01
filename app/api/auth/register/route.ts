import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { hashPassword, createSession } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { name, username, password, location, inviteCode } = await req.json();

    if (!name || !username || !password) {
      return NextResponse.json(
        { error: "Name, username and password are required." },
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

    const uname = String(username).trim().toLowerCase();
    const existing = await db.query.users.findFirst({
      where: eq(users.username, uname),
    });
    if (existing) {
      return NextResponse.json(
        { error: "That username is already taken." },
        { status: 409 }
      );
    }

    const [user] = await db
      .insert(users)
      .values({
        name: String(name).trim(),
        username: uname,
        location: location ? String(location).trim() : null,
        passwordHash: await hashPassword(String(password)),
      })
      .returning();

    await createSession(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("register error", err);
    return NextResponse.json(
      { error: "Something went wrong creating your account." },
      { status: 500 }
    );
  }
}
