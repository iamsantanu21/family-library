import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { lookupByIsbn, searchGoogleBooks } from "@/lib/books";

export const dynamic = "force-dynamic";

// GET /api/lookup/isbn?isbn=...   or   ?q=free text search
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const isbn = searchParams.get("isbn");
  const q = searchParams.get("q");

  try {
    if (isbn) {
      const info = await lookupByIsbn(isbn);
      if (!info) {
        return NextResponse.json(
          { error: "No book found for that ISBN. You can still add it by hand." },
          { status: 404 }
        );
      }
      return NextResponse.json({ book: info });
    }
    if (q) {
      const results = await searchGoogleBooks(q, 6);
      return NextResponse.json({ results });
    }
    return NextResponse.json({ error: "Provide isbn or q." }, { status: 400 });
  } catch (err) {
    console.error("isbn lookup error", err);
    return NextResponse.json({ error: "Lookup failed." }, { status: 500 });
  }
}
