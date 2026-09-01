"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type HeldItem = {
  copyId: string;
  bookId: string;
  title: string;
  authors: string | null;
  coverUrl: string | null;
  status: string;
  borrowed: boolean; // held but owned by someone else
};

export type MemberOption = { id: string; name: string; location: string | null };

export default function MyBooksManager({
  items,
  members,
}: {
  items: HeldItem[];
  members: MemberOption[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [target, setTarget] = useState("home");
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((k) => selected[k]),
    [selected]
  );
  const allChecked = items.length > 0 && selectedIds.length === items.length;

  function toggle(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }
  function toggleAll() {
    if (allChecked) setSelected({});
    else setSelected(Object.fromEntries(items.map((i) => [i.copyId, true])));
  }

  async function send() {
    setErr(null);
    setMsg(null);
    if (selectedIds.length === 0) {
      setErr("Tick at least one book first.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/copies/transfer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        copyIds: selectedIds,
        target,
        courier,
        tracking,
        note,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      const where =
        target === "home"
          ? "the Home Library"
          : members.find((m) => m.id === target)?.name || "the member";
      setMsg(`Sent ${data.moved} book${data.moved === 1 ? "" : "s"} to ${where}.`);
      setSelected({});
      setCourier("");
      setTracking("");
      setNote("");
      router.refresh();
    } else {
      setErr(data.error || "Could not send.");
    }
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        You&apos;re not holding any books right now. Add one, or take a book from
        the Home Library.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={toggleAll} className="btn-ghost text-xs">
          {allChecked ? "Clear selection" : "Select all"}
        </button>
        <span className="text-xs text-slate-500">
          {selectedIds.length} selected
        </span>
      </div>

      <div className="space-y-2">
        {items.map((it) => (
          <label
            key={it.copyId}
            className={`card flex cursor-pointer items-center gap-3 ${
              selected[it.copyId] ? "border-brand-400 bg-brand-50" : ""
            }`}
          >
            <input
              type="checkbox"
              checked={!!selected[it.copyId]}
              onChange={() => toggle(it.copyId)}
              className="h-4 w-4 flex-shrink-0"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={it.coverUrl || "/book-placeholder.svg"}
              alt=""
              className="h-14 w-10 flex-shrink-0 rounded object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{it.title}</div>
              <div className="truncate text-xs text-slate-500">{it.authors}</div>
              <div className="mt-1 flex gap-1">
                {it.borrowed && (
                  <span className="badge bg-amber-100 text-amber-800">
                    borrowed
                  </span>
                )}
                <span className="badge bg-slate-100 text-slate-600">
                  {it.status.toLowerCase()}
                </span>
              </div>
            </div>
          </label>
        ))}
      </div>

      {/* Send panel */}
      <div className="card space-y-3">
        <div className="font-medium">Send selected books</div>

        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Send to</span>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="input"
          >
            <option value="home">🏠 Home Library</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.location ? ` (${m.location})` : ""}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Courier (optional)</span>
            <input
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
              placeholder="e.g. India Post, Blue Dart"
              className="input"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">
              Tracking # (optional)
            </span>
            <input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="tracking number"
              className="input"
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Note (optional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. handed to Dad / shipping Monday"
            className="input"
          />
        </label>

        <div className="flex items-center gap-3">
          <button onClick={send} disabled={busy} className="btn">
            {busy ? "Sending…" : `Send ${selectedIds.length || ""} →`}
          </button>
          {msg && <span className="text-xs text-green-700">{msg}</span>}
          {err && <span className="text-xs text-red-600">{err}</span>}
        </div>
        <p className="text-xs text-slate-400">
          Books change hands immediately. The recipient (or the Home Library)
          becomes the new holder right away, and the sending details are saved to
          the book&apos;s history.
        </p>
      </div>
    </div>
  );
}
