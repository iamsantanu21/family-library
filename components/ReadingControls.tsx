"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReadingControls({
  bookId,
  currentStatus,
  currentRating,
}: {
  bookId: string;
  currentStatus?: string | null;
  currentRating?: number | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus || "");
  const [rating, setRating] = useState(currentRating || 0);
  const [busy, setBusy] = useState(false);

  async function save(next: string, nextRating = rating) {
    setBusy(true);
    setStatus(next);
    const res = await fetch("/api/reading", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookId, status: next, rating: nextRating || null }),
    });
    if (res.ok) router.refresh();
    setBusy(false);
  }

  const opts = [
    { key: "WANT", label: "Want to read" },
    { key: "READING", label: "Reading" },
    { key: "FINISHED", label: "Finished" },
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {opts.map((o) => (
          <button
            key={o.key}
            disabled={busy}
            onClick={() => save(o.key)}
            className={
              status === o.key
                ? "rounded-lg bg-brand-600 px-3 py-1 text-xs font-medium text-white"
                : "rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100"
            }
          >
            {o.label}
          </button>
        ))}
      </div>
      {status === "FINISHED" && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-500">Your rating:</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              disabled={busy}
              onClick={() => {
                setRating(n);
                save("FINISHED", n);
              }}
              className="text-lg leading-none"
              aria-label={`${n} stars`}
            >
              {n <= rating ? "★" : "☆"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
