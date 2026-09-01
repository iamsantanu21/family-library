"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type BookForm = {
  title: string;
  authors: string;
  isbn13: string;
  isbn10: string;
  publisher: string;
  publishedDate: string;
  pageCount: string;
  categories: string;
  language: string;
  description: string;
  coverUrl: string;
};

const EMPTY: BookForm = {
  title: "",
  authors: "",
  isbn13: "",
  isbn10: "",
  publisher: "",
  publishedDate: "",
  pageCount: "",
  categories: "",
  language: "",
  description: "",
  coverUrl: "",
};

type DupInfo = {
  exists: boolean;
  copies: { ownerName: string; holderName: string; holderLocation: string | null }[];
};

export default function AddPage() {
  const router = useRouter();
  const [form, setForm] = useState<BookForm>(EMPTY);
  const [prefilled, setPrefilled] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [condition, setCondition] = useState("good");
  const [notes, setNotes] = useState("");
  const [dup, setDup] = useState<DupInfo | null>(null);

  // barcode scanning
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [scanning, setScanning] = useState(false);

  function update(key: keyof BookForm, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function applyBook(b: any) {
    setForm({
      title: b.title || "",
      authors: b.authors || "",
      isbn13: b.isbn13 || "",
      isbn10: b.isbn10 || "",
      publisher: b.publisher || "",
      publishedDate: b.publishedDate || "",
      pageCount: b.pageCount ? String(b.pageCount) : "",
      categories: b.categories || "",
      language: b.language || "",
      description: b.description || "",
      coverUrl: b.coverUrl || "",
    });
    setPrefilled(true);
    const isbn = b.isbn13 || b.isbn10;
    if (isbn) checkDuplicate(isbn);
  }

  async function checkDuplicate(isbn: string) {
    try {
      const res = await fetch(`/api/books?isbn=${encodeURIComponent(isbn)}`);
      const data = await res.json();
      if (data.exists && data.book) {
        setDup({
          exists: true,
          copies: (data.book.copies || []).map((c: any) => ({
            ownerName: c.owner?.name || "someone",
            holderName: c.holder?.name || "someone",
            holderLocation: c.holder?.location || null,
          })),
        });
      } else {
        setDup(null);
      }
    } catch {
      setDup(null);
    }
  }

  // ---- Identify by ISBN ----
  async function lookupIsbn(isbn: string) {
    setBusy(true);
    setStatus("Looking up ISBN…");
    try {
      const res = await fetch(`/api/lookup/isbn?isbn=${encodeURIComponent(isbn)}`);
      const data = await res.json();
      if (res.ok && data.book) {
        applyBook(data.book);
        setStatus("Found it ✅  Check the details and save.");
      } else {
        update("isbn13", isbn);
        setPrefilled(true);
        setStatus(data.error || "Not found — type the details in.");
      }
    } finally {
      setBusy(false);
    }
  }

  // ---- Identify by cover photo (Vision AI) ----
  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus("Reading the cover with AI…");
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await fetch("/api/lookup/vision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = await res.json();
      if (res.ok && data.book) {
        applyBook(data.book);
        setStatus("Identified from the photo ✅  Please double-check and save.");
      } else if (res.ok && data.guess) {
        applyBook({ title: data.guess.title, authors: data.guess.authors });
        setStatus("Read the cover but couldn't match a record — please fill gaps.");
      } else {
        setPrefilled(true);
        setStatus(data.error || "Couldn't identify the cover.");
      }
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  // ---- Text search ----
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  async function search() {
    if (!query.trim()) return;
    setBusy(true);
    setStatus("Searching…");
    try {
      const res = await fetch(`/api/lookup/isbn?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.results || []);
      setStatus(data.results?.length ? null : "No matches — try different words.");
    } finally {
      setBusy(false);
    }
  }

  // ---- Barcode scanning (live camera) ----
  async function startScan() {
    setScanning(true);
    setStatus("Point the camera at the barcode on the back of the book…");
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current!,
        (result, _err, ctrl) => {
          if (result) {
            const code = result.getText().replace(/[^0-9Xx]/g, "");
            ctrl.stop();
            controlsRef.current = null;
            setScanning(false);
            if (code) lookupIsbn(code);
          }
        }
      );
      controlsRef.current = controls;
    } catch (err) {
      console.error(err);
      setStatus("Couldn't open the camera. Use 'Upload cover photo' or type the ISBN.");
      setScanning(false);
    }
  }

  function stopScan() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
    setStatus(null);
  }

  // ---- Save ----
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/books", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          book: { ...form, pageCount: form.pageCount || null },
          condition,
          notes,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(`/books/${data.bookId}`);
        router.refresh();
      } else {
        setStatus(data.error || "Could not save.");
        setSaving(false);
      }
    } catch {
      setStatus("Could not save.");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Add a book you bought 📷</h1>
        <p className="text-sm text-slate-500">
          Scan the barcode, snap the cover, or search — then check the details and
          save. It joins the shared shelf as your copy.
        </p>
      </div>

      {/* Identify options */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card space-y-2">
          <div className="font-medium">1 · Scan barcode</div>
          <p className="text-xs text-slate-500">Fastest &amp; most accurate.</p>
          {!scanning ? (
            <button className="btn w-full" onClick={startScan} disabled={busy}>
              Start camera
            </button>
          ) : (
            <button className="btn-ghost w-full" onClick={stopScan}>
              Stop
            </button>
          )}
        </div>

        <div className="card space-y-2">
          <div className="font-medium">2 · Cover photo (AI)</div>
          <p className="text-xs text-slate-500">No barcode? Snap the front.</p>
          <label className="btn w-full cursor-pointer">
            Upload cover photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onPhoto}
              disabled={busy}
            />
          </label>
        </div>

        <div className="card space-y-2">
          <div className="font-medium">3 · Search by name</div>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="title / author"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
            />
            <button className="btn-ghost" onClick={search} disabled={busy}>
              Go
            </button>
          </div>
        </div>
      </div>

      {scanning && (
        <div className="card">
          <video ref={videoRef} className="mx-auto max-h-72 w-full rounded-lg" />
        </div>
      )}

      {status && (
        <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
          {status}
        </p>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Pick a match:</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {results.map((b, i) => (
              <button
                key={i}
                className="card flex gap-3 text-left hover:border-brand-300"
                onClick={() => {
                  applyBook(b);
                  setResults([]);
                  setStatus("Loaded ✅  Check and save.");
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={b.coverUrl || "/book-placeholder.svg"}
                  alt=""
                  className="h-16 w-11 flex-shrink-0 rounded object-cover"
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{b.title}</div>
                  <div className="truncate text-xs text-slate-500">{b.authors}</div>
                  <div className="text-xs text-slate-400">{b.publishedDate}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Duplicate warning */}
      {dup?.exists && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ⚠️ <strong>This book is already in the family library.</strong>{" "}
          {dup.copies.length > 0 && (
            <>
              {dup.copies.length} copy(ies) exist — held by{" "}
              {dup.copies
                .map(
                  (c) =>
                    `${c.holderName}${
                      c.holderLocation ? ` (${c.holderLocation})` : ""
                    }`
                )
                .join(", ")}
              .{" "}
            </>
          )}
          You can still add yours, but you might not need to buy it again.
        </div>
      )}

      {/* Editable form */}
      {prefilled && (
        <form onSubmit={save} className="card space-y-4">
          <div className="flex items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={form.coverUrl || "/book-placeholder.svg"}
              alt=""
              className="h-28 w-20 flex-shrink-0 rounded object-cover"
            />
            <div className="flex-1 space-y-3">
              <div>
                <label className="label">Title *</label>
                <input
                  className="input"
                  value={form.title}
                  onChange={(e) => update("title", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Author(s)</label>
                <input
                  className="input"
                  value={form.authors}
                  onChange={(e) => update("authors", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">ISBN-13</label>
              <input
                className="input"
                value={form.isbn13}
                onChange={(e) => update("isbn13", e.target.value)}
                onBlur={(e) => e.target.value && checkDuplicate(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Publisher</label>
              <input
                className="input"
                value={form.publisher}
                onChange={(e) => update("publisher", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Published</label>
              <input
                className="input"
                value={form.publishedDate}
                onChange={(e) => update("publishedDate", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Pages</label>
              <input
                className="input"
                value={form.pageCount}
                onChange={(e) => update("pageCount", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Categories</label>
              <input
                className="input"
                value={form.categories}
                onChange={(e) => update("categories", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Cover image URL</label>
              <input
                className="input"
                value={form.coverUrl}
                onChange={(e) => update("coverUrl", e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              className="input min-h-[80px]"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </div>

          <hr />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Condition of your copy</label>
              <select
                className="input"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
              >
                <option value="new">New</option>
                <option value="good">Good</option>
                <option value="worn">Worn</option>
              </select>
            </div>
            <div>
              <label className="label">Notes (optional)</label>
              <input
                className="input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="signed copy, hardcover…"
              />
            </div>
          </div>

          <button className="btn w-full" disabled={saving}>
            {saving ? "Saving…" : "Add to the family library"}
          </button>
        </form>
      )}
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
