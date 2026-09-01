import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { verifyPassword, createSession } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json(
        { error: "Enter your username and password." },
        { status: 400 }
      );
    }

    const uname = String(username).trim().toLowerCase();
    const user = await db.query.users.findFirst({
      where: eq(users.username, uname),
    });
    if (!user || !(await verifyPassword(String(password), user.passwordHash))) {
      return NextResponse.json(
        { error: "Wrong username or password." },
        { status: 401 }
      );
    }

    await createSession(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("login error", err);
    return NextResponse.json({ error: "Could not log you in." }, { status: 500 });
  }
}
