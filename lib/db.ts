import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  client?: ReturnType<typeof postgres>;
};

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  // Don't throw at import time (keeps `next build` working); the first query
  // will surface a clear error instead.
  console.warn("DATABASE_URL is not set — database queries will fail.");
}

// Reuse one postgres client across hot reloads / serverless invocations.
// The placeholder is intentionally non-connecting; a real DATABASE_URL is
// always provided in every environment (local .env and hosted).
const client =
  globalForDb.client ??
  postgres(connectionString ?? "postgres://unset", {
    max: 1,
    prepare: false, // friendlier to serverless / connection poolers
  });

if (process.env.NODE_ENV !== "production") globalForDb.client = client;

export const db = drizzle(client, { schema });
export { schema };
