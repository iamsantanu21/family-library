"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function WishlistRemoveButton({
  id,
  label = "Remove",
}: {
  id: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/wishlist", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) router.refresh();
    else setErr(data.error || "Failed.");
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button onClick={run} disabled={busy} className="btn-ghost text-xs text-red-600">
        {busy ? "…" : label}
      </button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </span>
  );
}
