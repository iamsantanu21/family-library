import Link from "next/link";
import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { wishlist } from "@/lib/schema";
import WishlistForm from "@/components/WishlistForm";
import WishlistRemoveButton from "@/components/WishlistRemoveButton";

export const dynamic = "force-dynamic";

const norm = (s: string | null | undefined) =>
  (s || "").toLowerCase().replace(/\s+/g, " ").trim();

export default async function WishlistPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [items, books] = await Promise.all([
    db.query.wishlist.findMany({
      with: { user: true },
      orderBy: desc(wishlist.createdAt),
    }),
    db.query.books.findMany({
      with: { copies: { with: { holder: true } } },
    }),
  ]);

  // Index catalog by ISBN and by normalized title to flag "already owned".
  const byIsbn = new Map<string, (typeof books)[number]>();
  const byTitle = new Map<string, (typeof books)[number]>();
  for (const b of books) {
    if (b.isbn13) byIsbn.set(b.isbn13, b);
    byTitle.set(norm(b.title), b);
  }
  const matchOf = (i: (typeof items)[number]) =>
    (i.isbn13 && byIsbn.get(i.isbn13)) || byTitle.get(norm(i.title)) || null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Wishlist ⭐</h1>
        <p className="text-sm text-slate-500">
          Books the family would like to have. Check here before buying so we fill
          gaps instead of doubling up.
        </p>
      </div>

      <WishlistForm />

      {items.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nothing on the wishlist yet — add the first book above.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((i) => {
            const owned = matchOf(i);
            const mine = i.userId === user.id;
            return (
              <div
                key={i.id}
                className="card flex flex-wrap items-center gap-x-4 gap-y-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{i.title}</div>
                  <div className="text-xs text-slate-500">
                    {i.authors ? `${i.authors} · ` : ""}
                    wanted by {mine ? "you" : i.user.name}
                    {i.isbn13 ? ` · ISBN ${i.isbn13}` : ""}
                  </div>
                  {i.note && (
                    <div className="text-xs text-slate-400">“{i.note}”</div>
                  )}
                  {owned && (
                    <div className="mt-1 text-xs">
                      <Link
                        href={`/books/${owned.id}`}
                        className="text-emerald-700 hover:underline"
                      >
                        ✓ Already on the family shelf
                      </Link>
                      <span className="text-slate-400">
                        {" "}
                        · with{" "}
                        {Array.from(
                          new Set(
                            owned.copies.map((c) =>
                              c.atHome ? "🏠 Home Library" : c.holder.name
                            )
                          )
                        ).join(", ") || "no copies"}
                      </span>
                    </div>
                  )}
                </div>

                {owned ? (
                  <span className="badge bg-emerald-100 text-emerald-700">
                    owned
                  </span>
                ) : (
                  <span className="badge bg-amber-100 text-amber-800">wanted</span>
                )}

                {(mine || user.role === "ADMIN") && (
                  <WishlistRemoveButton id={i.id} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
