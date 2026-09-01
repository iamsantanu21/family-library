// Create the `wishlist` table (books family members want the library to have).
// Idempotent — safe to run repeatedly.
// Usage:
//   DATABASE_URL="postgres://..." node scripts/add-wishlist.mjs
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL first.");
  process.exit(1);
}
const sql = postgres(url, { prepare: false });

try {
  await sql`
    CREATE TABLE IF NOT EXISTS "wishlist" (
      "id" text PRIMARY KEY NOT NULL,
      "user_id" text NOT NULL,
      "title" text NOT NULL,
      "authors" text,
      "isbn13" text,
      "note" text,
      "cover_url" text,
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `;
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wishlist_user_id_users_id_fk') THEN
        ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_user_id_users_id_fk"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
      END IF;
    END $$;
  `;
  console.log("✅ wishlist table is ready.");
} catch (e) {
  console.error("Error:", e.message);
  process.exit(1);
} finally {
  await sql.end();
}
