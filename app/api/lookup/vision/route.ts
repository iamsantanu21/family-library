import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { identifyCover, resolveFromGuess, visionConfigured } from "@/lib/books";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// POST { image: "data:image/jpeg;base64,...." }  ->  { book, guess }
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!visionConfigured()) {
    return NextResponse.json(
      {
        error:
          "Photo identification isn't set up. Add an AI API key in the environment, or type the book details by hand.",
      },
      { status: 501 }
    );
  }

  try {
    const { image } = await req.json();
    if (!image || typeof image !== "string") {
      return NextResponse.json({ error: "No image provided." }, { status: 400 });
    }

    const match = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!match) {
      return NextResponse.json(
        { error: "Image must be a base64 data URL." },
        { status: 400 }
      );
    }
    const mediaType = match[1];
    const base64 = match[2];

    const guess = await identifyCover(base64, mediaType);
    if (!guess || (!guess.title && !guess.isbn)) {
      return NextResponse.json(
        { error: "Couldn't read the cover. Try a clearer photo or type it in." },
        { status: 422 }
      );
    }

    const book = await resolveFromGuess(guess);
    return NextResponse.json({ book, guess });
  } catch (err) {
    console.error("vision lookup error", err);
    return NextResponse.json(
      { error: "Could not identify the book from the photo." },
      { status: 500 }
    );
  }
}
