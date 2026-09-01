import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { books } from "@/lib/schema";

export const dynamic = "force-dynamic";

// DELETE /api/books/:id
// Remove a title from the catalog entirely, along with every copy of it.
// Admins only — this wipes the book for the whole family.
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only an admin can delete a whole title." },
      { status: 403 }
    );
  }

  const book = await db.query.books.findFirst({ where: eq(books.id, params.id) });
  if (!book) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Copies (and their requests, transfers) and reading logs cascade on delete.
  await db.delete(books).where(eq(books.id, params.id));
  return NextResponse.json({ ok: true });
}
