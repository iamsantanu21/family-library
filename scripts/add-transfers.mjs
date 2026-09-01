// Create the `transfers` table (the "sending details" log for handing books
// to the Home Library or another member). Idempotent — safe to run repeatedly.
// Usage:
//   DATABASE_URL="postgres://..." node scripts/add-transfers.mjs
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL first.");
  process.exit(1);
}
const sql = postgres(url, { prepare: false });

try {
  await sql`
    CREATE TABLE IF NOT EXISTS "transfers" (
      "id" text PRIMARY KEY NOT NULL,
      "copy_id" text NOT NULL,
      "from_user_id" text NOT NULL,
      "to_user_id" text,
      "to_home" boolean DEFAULT false NOT NULL,
      "courier" text,
      "tracking" text,
      "note" text,
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `;

  // Foreign keys (added guarded so re-runs don't error).
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transfers_copy_id_copies_id_fk') THEN
        ALTER TABLE "transfers" ADD CONSTRAINT "transfers_copy_id_copies_id_fk"
          FOREIGN KEY ("copy_id") REFERENCES "copies"("id") ON DELETE cascade;
      END IF;
    END $$;
  `;
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transfers_from_user_id_users_id_fk') THEN
        ALTER TABLE "transfers" ADD CONSTRAINT "transfers_from_user_id_users_id_fk"
          FOREIGN KEY ("from_user_id") REFERENCES "users"("id");
      END IF;
    END $$;
  `;
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transfers_to_user_id_users_id_fk') THEN
        ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_user_id_users_id_fk"
          FOREIGN KEY ("to_user_id") REFERENCES "users"("id");
      END IF;
    END $$;
  `;

  console.log("✅ transfers table is ready.");
} catch (e) {
  console.error("Error:", e.message);
  process.exit(1);
} finally {
  await sql.end();
}
