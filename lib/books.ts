// Book metadata helpers: Google Books lookup + Vision-AI cover identification.

export type BookInfo = {
  title: string;
  authors: string | null;
  isbn13: string | null;
  isbn10: string | null;
  publisher: string | null;
  publishedDate: string | null;
  description: string | null;
  pageCount: number | null;
  categories: string | null;
  language: string | null;
  coverUrl: string | null;
};

type GoogleVolume = {
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    pageCount?: number;
    categories?: string[];
    language?: string;
    industryIdentifiers?: { type: string; identifier: string }[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
};

function normalizeVolume(v: GoogleVolume): BookInfo | null {
  const info = v.volumeInfo;
  if (!info || !info.title) return null;

  const ids = info.industryIdentifiers || [];
  const isbn13 = ids.find((i) => i.type === "ISBN_13")?.identifier || null;
  const isbn10 = ids.find((i) => i.type === "ISBN_10")?.identifier || null;

  // Prefer https for cover thumbnails.
  let coverUrl =
    info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || null;
  if (coverUrl) coverUrl = coverUrl.replace("http://", "https://");

  const title = info.subtitle ? `${info.title}: ${info.subtitle}` : info.title;

  return {
    title,
    authors: info.authors?.join(", ") || null,
    isbn13,
    isbn10,
    publisher: info.publisher || null,
    publishedDate: info.publishedDate || null,
    description: info.description || null,
    pageCount: info.pageCount ?? null,
    categories: info.categories?.join(", ") || null,
    language: info.language || null,
    coverUrl,
  };
}

const GOOGLE_BASE = "https://www.googleapis.com/books/v1/volumes";

function withKey(url: string): string {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  return key ? `${url}&key=${key}` : url;
}

export async function lookupByIsbn(isbnRaw: string): Promise<BookInfo | null> {
  const isbn = isbnRaw.replace(/[^0-9Xx]/g, "");
  if (!isbn) return null;
  const url = withKey(`${GOOGLE_BASE}?q=isbn:${encodeURIComponent(isbn)}`);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { items?: GoogleVolume[] };
  const item = data.items?.[0];
  if (!item) return null;
  const info = normalizeVolume(item);
  // Make sure the ISBN we searched is recorded even if Google omits it.
  if (info && !info.isbn13 && isbn.length === 13) info.isbn13 = isbn;
  if (info && !info.isbn10 && isbn.length === 10) info.isbn10 = isbn;
  return info;
}

export async function searchGoogleBooks(
  query: string,
  limit = 6
): Promise<BookInfo[]> {
  if (!query.trim()) return [];
  const url = withKey(
    `${GOOGLE_BASE}?q=${encodeURIComponent(query)}&maxResults=${limit}`
  );
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: GoogleVolume[] };
  return (data.items || [])
    .map(normalizeVolume)
    .filter((b): b is BookInfo => b !== null);
}

// ---- Vision AI: read title/author (and ISBN if visible) from a cover photo ----

export type VisionGuess = {
  title: string | null;
  authors: string | null;
  isbn: string | null;
};

const VISION_PROMPT = `You are looking at a photograph of a book cover (or its back).
Extract the book's details. Respond with ONLY a compact JSON object, no markdown, of the form:
{"title": "...", "authors": "...", "isbn": "..."}
Use null for any field you cannot read. "authors" is a comma-separated list.
"isbn" is only the digits if a barcode/ISBN number is visible, otherwise null.`;

async function visionAnthropic(
  base64: string,
  mediaType: string
): Promise<VisionGuess | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: VISION_PROMPT },
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic vision failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { content?: { text?: string }[] };
  const text = data.content?.map((c) => c.text || "").join("") || "";
  return parseVisionJson(text);
}

async function visionOpenAI(
  base64: string,
  mediaType: string
): Promise<VisionGuess | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: VISION_PROMPT },
            {
              type: "image_url",
              image_url: { url: `data:${mediaType};base64,${base64}` },
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI vision failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content || "";
  return parseVisionJson(text);
}

function parseVisionJson(text: string): VisionGuess | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]);
    return {
      title: obj.title ?? null,
      authors: obj.authors ?? null,
      isbn: obj.isbn ? String(obj.isbn).replace(/[^0-9Xx]/g, "") : null,
    };
  } catch {
    return null;
  }
}

export function visionConfigured(): boolean {
  const provider = (process.env.VISION_PROVIDER || "anthropic").toLowerCase();
  if (provider === "openai") return !!process.env.OPENAI_API_KEY;
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function identifyCover(
  base64: string,
  mediaType: string
): Promise<VisionGuess | null> {
  const provider = (process.env.VISION_PROVIDER || "anthropic").toLowerCase();
  if (provider === "openai") return visionOpenAI(base64, mediaType);
  return visionAnthropic(base64, mediaType);
}

// Given a vision guess, resolve to the best full BookInfo via Google Books.
export async function resolveFromGuess(
  guess: VisionGuess
): Promise<BookInfo | null> {
  if (guess.isbn) {
    const byIsbn = await lookupByIsbn(guess.isbn);
    if (byIsbn) return byIsbn;
  }
  const q = [guess.title, guess.authors].filter(Boolean).join(" ");
  if (!q) return null;
  const results = await searchGoogleBooks(q, 1);
  if (results[0]) return results[0];
  // Fall back to just what vision saw, so the user can still edit + save.
  if (guess.title) {
    return {
      title: guess.title,
      authors: guess.authors,
      isbn13: guess.isbn && guess.isbn.length === 13 ? guess.isbn : null,
      isbn10: guess.isbn && guess.isbn.length === 10 ? guess.isbn : null,
      publisher: null,
      publishedDate: null,
      description: null,
      pageCount: null,
      categories: null,
      language: null,
      coverUrl: null,
    };
  }
  return null;
}
