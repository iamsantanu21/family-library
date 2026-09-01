import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { copies } from "@/lib/schema";
import { getHomeLibraryId } from "@/lib/homeLibrary";

export const dynamic = "force-dynamic";

type Action = "reading" | "available" | "sendHome" | "takeHome";

// PATCH { copyId, action }
//  - reading/available: the holder marks their own copy
//  - sendHome: the holder shifts the book to the Home Library
//  - takeHome: any member takes a book that's in the Home Library
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { copyId, action } = (await req.json()) as {
      copyId: string;
      action: Action;
    };
    if (!copyId || !action) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }

    const copy = await db.query.copies.findFirst({ where: eq(copies.id, copyId) });
    if (!copy) return NextResponse.json({ error: "Not found." }, { status: 404 });

    switch (action) {
      case "reading":
      case "available": {
        if (copy.holderId !== user.id || copy.atHome) {
          return NextResponse.json(
            { error: "Only the current holder can change this." },
            { status: 403 }
          );
        }
        await db
          .update(copies)
          .set({ status: action === "reading" ? "READING" : "AVAILABLE" })
          .where(eq(copies.id, copyId));
        break;
      }
      case "sendHome": {
        if (copy.holderId !== user.id || copy.atHome) {
          return NextResponse.json(
            { error: "You can only send a book you currently hold." },
            { status: 403 }
          );
        }
        const homeId = await getHomeLibraryId();
        await db
          .update(copies)
          .set({ atHome: true, holderId: homeId, status: "AVAILABLE" })
          .where(eq(copies.id, copyId));
        break;
      }
      case "takeHome": {
        if (!copy.atHome) {
          return NextResponse.json(
            { error: "That book isn't in the Home Library." },
            { status: 400 }
          );
        }
        await db
          .update(copies)
          .set({ atHome: false, holderId: user.id, status: "READING" })
          .where(eq(copies.id, copyId));
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("copy patch error", err);
    return NextResponse.json({ error: "Could not update copy." }, { status: 500 });
  }
}
