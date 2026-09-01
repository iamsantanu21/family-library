"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Two-step delete button. `kind` picks the endpoint:
//  - "copy":  DELETE /api/copies         { copyId }
//  - "title": DELETE /api/books/:bookId
export default function DeleteButton({
  kind,
  copyId,
  bookId,
  label = "Delete",
  confirmText = "Delete?",
  redirectTo,
}: {
  kind: "copy" | "title";
  copyId?: string;
  bookId?: string;
  label?: string;
  confirmText?: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    const res =
      kind === "copy"
        ? await fetch("/api/copies", {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ copyId }),
          })
        : await fetch(`/api/books/${bookId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    } else {
      setErr(data.error || "Failed.");
      setArmed(false);
    }
  }

  if (!armed) {
    return (
      <span className="inline-flex items-center gap-2">
        <button
          onClick={() => setArmed(true)}
          className="btn-ghost text-xs text-red-600"
        >
          {label}
        </button>
        {err && <span className="text-xs text-red-600">{err}</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-xs text-slate-600">{confirmText}</span>
      <button
        onClick={run}
        disabled={busy}
        className="btn text-xs bg-red-600 hover:bg-red-700"
      >
        {busy ? "…" : "Yes, delete"}
      </button>
      <button
        onClick={() => setArmed(false)}
        disabled={busy}
        className="btn-ghost text-xs"
      >
        Cancel
      </button>
    </span>
  );
}
