import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { copies, loanRequests } from "@/lib/schema";

export const dynamic = "force-dynamic";

// POST { copyId, message? } -> ask to borrow a specific copy.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { copyId, message } = await req.json();
    if (!copyId) {
      return NextResponse.json({ error: "copyId required." }, { status: 400 });
    }

    const copy = await db.query.copies.findFirst({
      where: eq(copies.id, copyId),
    });
    if (!copy) {
      return NextResponse.json({ error: "Copy not found." }, { status: 404 });
    }
    if (copy.holderId === user.id) {
      return NextResponse.json(
        { error: "You already have this copy." },
        { status: 400 }
      );
    }

    const active = await db.query.loanRequests.findFirst({
      where: and(
        eq(loanRequests.copyId, copyId),
        inArray(loanRequests.status, ["PENDING", "APPROVED", "SHIPPED", "RECEIVED"])
      ),
    });
    if (active) {
      return NextResponse.json(
        { error: "This copy already has an active request." },
        { status: 409 }
      );
    }

    const [request] = await db
      .insert(loanRequests)
      .values({
        copyId,
        requesterId: user.id,
        message: message ? String(message) : null,
      })
      .returning();

    return NextResponse.json({ ok: true, requestId: request.id });
  } catch (err) {
    console.error("create request error", err);
    return NextResponse.json({ error: "Could not send request." }, { status: 500 });
  }
}
