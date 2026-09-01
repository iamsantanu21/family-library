"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CopyStatusToggle({
  copyId,
  status,
}: {
  copyId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const next = status === "READING" ? "AVAILABLE" : "READING";

  async function toggle() {
    setBusy(true);
    const res = await fetch("/api/copies", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ copyId, status: next }),
    });
    if (res.ok) router.refresh();
    setBusy(false);
  }

  return (
    <button onClick={toggle} disabled={busy} className="btn-ghost text-xs">
      {status === "READING" ? "Mark available" : "I'm reading this"}
    </button>
  );
}
