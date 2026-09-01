import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "./schema";

// The "Home Library" is a reserved system account that holds books that have
// been physically shifted to the central family library. Books "in the Home
// Library" are the ones this account holds.
export const HOME_LIBRARY_USERNAME = "home-library";

export async function getHomeLibrary() {
  const existing = await db.query.users.findFirst({
    where: eq(users.username, HOME_LIBRARY_USERNAME),
  });
  if (existing) return existing;

  try {
    const [created] = await db
      .insert(users)
      .values({
        username: HOME_LIBRARY_USERNAME,
        email: "home-library@system.local",
        name: "Home Library",
        role: "MEMBER",
        status: "ACTIVE",
        isSystem: true,
        passwordHash: null,
      })
      .returning();
    return created;
  } catch {
    // Another request created it first — fetch again.
    const again = await db.query.users.findFirst({
      where: eq(users.username, HOME_LIBRARY_USERNAME),
    });
    if (again) return again;
    throw new Error("Could not create Home Library account.");
  }
}

export async function getHomeLibraryId() {
  return (await getHomeLibrary()).id;
}
