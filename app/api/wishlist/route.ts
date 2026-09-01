import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { wishlist } from "@/lib/schema";

export const dynamic = "force-dynamic";

// POST { title, authors?, isbn13?, note?, coverUrl? } -> add a book you want.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const b = (await req.json()) as {
      title?: string;
      authors?: string;
      isbn13?: string;
      note?: string;
      coverUrl?: string;
    };
    if (!b.title || !String(b.title).trim()) {
      return NextResponse.json({ error: "A title is required." }, { status: 400 });
    }

    const [item] = await db
      .insert(wishlist)
      .values({
        userId: user.id,
        title: String(b.title).trim(),
        authors: b.authors?.trim() || null,
        isbn13: b.isbn13?.replace(/[^0-9Xx]/g, "") || null,
        note: b.note?.trim() || null,
        coverUrl: b.coverUrl?.trim() || null,
      })
      .returning();

    return NextResponse.json({ ok: true, id: item.id });
  } catch (err) {
    console.error("wishlist add error", err);
    return NextResponse.json(
      { error: "Could not add to wishlist." },
      { status: 500 }
    );
  }
}

// DELETE { id } -> remove a wishlist item (its owner, or an admin).
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = (await req.json()) as { id: string };
    if (!id) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

    const item = await db.query.wishlist.findFirst({ where: eq(wishlist.id, id) });
    if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });

    if (item.userId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only the person who added it (or an admin) can remove it." },
        { status: 403 }
      );
    }

    await db.delete(wishlist).where(eq(wishlist.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("wishlist delete error", err);
    return NextResponse.json(
      { error: "Could not remove item." },
      { status: 500 }
    );
  }
}
