import Link from "next/link";
import { redirect } from "next/navigation";
import { or, ilike, asc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { books } from "@/lib/schema";

export const dynamic = "force-dynamic";

type View = "all" | "mine" | "others" | "home";

const TABS: { key: View; label: string }[] = [
  { key: "all", label: "All books" },
  { key: "mine", label: "With me" },
  { key: "others", label: "With others" },
  { key: "home", label: "🏠 Home Library" },
];

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: { q?: string; view?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const q = (searchParams.q || "").trim();
  const like = `%${q}%`;
  const view = (
    ["all", "mine", "others", "home"].includes(searchParams.view || "")
      ? searchParams.view
      : "all"
  ) as View;

  const all = await db.query.books.findMany({
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

  const list = all.filter((b) => {
    switch (view) {
      case "mine":
        return b.copies.some((c) => c.holderId === user.id && !c.atHome);
      case "others":
        return b.copies.some((c) => c.holderId !== user.id && !c.atHome);
      case "home":
        return b.copies.some((c) => c.atHome);
      default:
        return true;
    }
  });

  const tabHref = (v: View) =>
    `/catalog?view=${v}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

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
        <input type="hidden" name="view" value={view} />
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by title, author, or ISBN…"
          className="input"
        />
        <button className="btn">Search</button>
      </form>

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            className={`rounded-t px-3 py-2 text-sm ${
              view === t.key
                ? "border-b-2 border-brand-600 font-medium text-brand-700"
                : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-slate-500">
          {q
            ? "No books match that."
            : view === "mine"
            ? "You're not holding any books right now."
            : view === "home"
            ? "The Home Library is empty."
            : view === "others"
            ? "No books are with other members right now."
            : "The shelf is empty — add the first book!"}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((b) => {
            const available = b.copies.filter((c) => c.status === "AVAILABLE");
            const holders = Array.from(
              new Set(
                b.copies.map((c) =>
                  c.atHome
                    ? "🏠 Home Library"
                    : `${c.holder.name}${
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
