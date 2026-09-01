"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function WishlistForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [isbn, setIsbn] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function add() {
    setErr(null);
    setMsg(null);
    if (!title.trim()) {
      setErr("A title is required.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/wishlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, authors, isbn13: isbn, note }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setMsg("Added to the wishlist ✅");
      setTitle("");
      setAuthors("");
      setIsbn("");
      setNote("");
      router.refresh();
    } else {
      setErr(data.error || "Could not add.");
    }
  }

  return (
    <div className="card space-y-3">
      <div className="font-medium">Add a book you&apos;d like the family to have</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Title *</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. The Midnight Library"
            className="input"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Author (optional)</span>
          <input
            value={authors}
            onChange={(e) => setAuthors(e.target.value)}
            placeholder="e.g. Matt Haig"
            className="input"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">ISBN (optional)</span>
          <input
            value={isbn}
            onChange={(e) => setIsbn(e.target.value)}
            placeholder="helps spot duplicates"
            className="input"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Note (optional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. paperback is fine"
            className="input"
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={add} disabled={busy} className="btn">
          {busy ? "Adding…" : "Add to wishlist"}
        </button>
        {msg && <span className="text-xs text-green-700">{msg}</span>}
        {err && <span className="text-xs text-red-600">{err}</span>}
      </div>
    </div>
  );
}
