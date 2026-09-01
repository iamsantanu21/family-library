import Link from "next/link";
import { redirect } from "next/navigation";
import { or, ilike, asc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { books } from "@/lib/schema";

export const dynamic = "force-dynamic";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const q = (searchParams.q || "").trim();
  const like = `%${q}%`;

  const list = await db.query.books.findMany({
    where: q
      ? or(
          ilike(books.title, like),
          ilike(books.authors, like),
          ilike(books.isbn13, like)
        )
      : undefined,
    with: { copies: { with: { holder: true, owner: true } } },
    orderBy: asc(books.title),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Family catalog 🔎</h1>
        <p className="text-sm text-slate-500">
          Everything the family owns. Search here before buying so we don&apos;t
          get duplicates.
        </p>
      </div>

      <form className="flex gap-2" action="/catalog" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by title, author, or ISBN…"
          className="input"
        />
        <button className="btn">Search</button>
      </form>

      {list.length === 0 ? (
        <p className="text-sm text-slate-500">
          {q ? "No books match that." : "The shelf is empty — add the first book!"}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((b) => {
            const available = b.copies.filter((c) => c.status === "AVAILABLE");
            const holders = Array.from(
              new Set(
                b.copies.map(
                  (c) =>
                    `${c.holder.name}${
                      c.holder.location ? ` (${c.holder.location})` : ""
                    }`
                )
              )
            );
            return (
              <Link
                key={b.id}
                href={`/books/${b.id}`}
                className="card flex gap-3 hover:border-brand-300"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={b.coverUrl || "/book-placeholder.svg"}
                  alt=""
                  className="h-24 w-16 flex-shrink-0 rounded object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium leading-tight">{b.title}</div>
                  <div className="truncate text-xs text-slate-500">{b.authors}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="badge bg-slate-100 text-slate-600">
                      {b.copies.length} copy{b.copies.length === 1 ? "" : "ies"}
                    </span>
                    {available.length > 0 ? (
                      <span className="badge bg-green-100 text-green-700">
                        {available.length} available
                      </span>
                    ) : (
                      <span className="badge bg-slate-100 text-slate-500">
                        all out
                      </span>
                    )}
                  </div>
                  {holders.length > 0 && (
                    <div className="mt-1 truncate text-xs text-slate-400">
                      with {holders.join(", ")}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
