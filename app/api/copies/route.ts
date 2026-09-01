import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { copies } from "@/lib/schema";

export const dynamic = "force-dynamic";

// PATCH { copyId, status } -> the holder marks their copy AVAILABLE / READING.
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { copyId, status } = await req.json();
    if (!copyId || !["AVAILABLE", "READING"].includes(status)) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }
    const copy = await db.query.copies.findFirst({ where: eq(copies.id, copyId) });
    if (!copy) return NextResponse.json({ error: "Not found." }, { status: 404 });
    if (copy.holderId !== user.id) {
      return NextResponse.json(
        { error: "Only the current holder can change this." },
        { status: 403 }
      );
    }
    await db.update(copies).set({ status }).where(eq(copies.id, copyId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("copy patch error", err);
    return NextResponse.json({ error: "Could not update copy." }, { status: 500 });
  }
}
