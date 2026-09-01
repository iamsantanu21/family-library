import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { inArray } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { loanRequests } from "@/lib/schema";

export const metadata: Metadata = {
  title: "Family Library",
  description: "A shared library for books our family owns, reads, and swaps.",
};

// How many requests are waiting on THIS user to do something:
//  - as the holder: someone asked to borrow (PENDING) or you approved but
//    haven't sent (APPROVED)
//  - as the borrower: it's been sent and you haven't confirmed receipt (SHIPPED)
async function actionableCount(userId: string): Promise<number> {
  try {
    const active = await db.query.loanRequests.findMany({
      where: inArray(loanRequests.status, ["PENDING", "APPROVED", "SHIPPED"]),
      with: { copy: true },
    });
    return active.filter((r) =>
      r.status === "SHIPPED"
        ? r.requesterId === userId
        : r.copy.holderId === userId
    ).length;
  } catch {
    return 0;
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const pending = user ? await actionableCount(user.id) : 0;

  return (
    <html lang="en">
      <body>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-bold text-brand-700">
              📚 Family Library
            </Link>
            {user ? (
              <nav className="flex items-center gap-1 text-sm">
                <Link className="rounded px-2 py-1 hover:bg-slate-100" href="/catalog">
                  Catalog
                </Link>
                <Link className="rounded px-2 py-1 hover:bg-slate-100" href="/my-books">
                  My books
                </Link>
                <Link className="rounded px-2 py-1 hover:bg-slate-100" href="/add">
                  Add book
                </Link>
                <Link className="rounded px-2 py-1 hover:bg-slate-100" href="/wishlist">
                  Wishlist
                </Link>
                <Link
                  className="relative rounded px-2 py-1 hover:bg-slate-100"
                  href="/requests"
                >
                  Requests
                  {pending > 0 && (
                    <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
                      {pending}
                    </span>
                  )}
                </Link>
                <Link className="rounded px-2 py-1 hover:bg-slate-100" href="/members">
                  Members
                </Link>
                {user.role === "ADMIN" && (
                  <Link
                    className="rounded px-2 py-1 font-medium text-brand-700 hover:bg-slate-100"
                    href="/admin"
                  >
                    Admin
                  </Link>
                )}
                <span className="ml-2 hidden text-slate-400 sm:inline">|</span>
                <span className="ml-1 hidden text-slate-600 sm:inline">
                  {user.name}
                </span>
                <form action="/api/auth/logout" method="post">
                  <button className="ml-1 rounded px-2 py-1 text-slate-500 hover:bg-slate-100">
                    Log out
                  </button>
                </form>
              </nav>
            ) : (
              <nav className="flex items-center gap-2 text-sm">
                <Link className="btn-ghost" href="/login">
                  Log in
                </Link>
                <Link className="btn" href="/register">
                  Join
                </Link>
              </nav>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 py-8 text-center text-xs text-slate-400">
          Family Library · one shelf, wherever we live
        </footer>
      </body>
    </html>
  );
}
