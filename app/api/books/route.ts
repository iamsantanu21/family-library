import { NextResponse } from "next/server";
import { or, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { books, copies } from "@/lib/schema";

export const dynamic = "force-dynamic";

// GET /api/books?isbn=...  -> is this title already in the family library?
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const isbn = searchParams.get("isbn");
  if (!isbn) return NextResponse.json({ error: "Provide isbn." }, { status: 400 });

  const book = await db.query.books.findFirst({
    where: or(eq(books.isbn13, isbn), eq(books.isbn10, isbn)),
    with: {
      copies: { with: { owner: true, holder: true } },
    },
  });

  return NextResponse.json({ exists: !!book, book: book ?? null });
}

// POST -> add a copy of a book you bought (dedupes the title by ISBN).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const b = body.book || {};
    if (!b.title || !String(b.title).trim()) {
      return NextResponse.json({ error: "A title is required." }, { status: 400 });
    }

    const isbn13: string | null = b.isbn13 ? String(b.isbn13) : null;
    const isbn10: string | null = b.isbn10 ? String(b.isbn10) : null;

    let book =
      isbn13 || isbn10
        ? await db.query.books.findFirst({
            where: or(
              ...(isbn13 ? [eq(books.isbn13, isbn13)] : []),
              ...(isbn10 ? [eq(books.isbn10, isbn10)] : [])
            ),
          })
        : undefined;

    if (!book) {
      const [created] = await db
        .insert(books)
        .values({
          title: String(b.title).trim(),
          authors: b.authors || null,
          isbn13,
          isbn10,
          publisher: b.publisher || null,
          publishedDate: b.publishedDate || null,
          description: b.description || null,
          pageCount: b.pageCount ? Number(b.pageCount) : null,
          categories: b.categories || null,
          language: b.language || null,
          coverUrl: b.coverUrl || null,
        })
        .returning();
      book = created;
    }

    const [copy] = await db
      .insert(copies)
      .values({
        bookId: book.id,
        ownerId: user.id,
        holderId: user.id,
        status: "AVAILABLE",
        condition: body.condition || null,
        notes: body.notes || null,
      })
      .returning();

    return NextResponse.json({ ok: true, bookId: book.id, copyId: copy.id });
  } catch (err) {
    console.error("create book error", err);
    return NextResponse.json({ error: "Could not save the book." }, { status: 500 });
  }
}
