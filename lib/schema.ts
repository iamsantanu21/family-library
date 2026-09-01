import { randomUUID } from "crypto";
import {
  pgTable,
  pgEnum,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID());

// ---- enums ----
export const copyStatus = pgEnum("copy_status", [
  "AVAILABLE",
  "LENT",
  "READING",
]);
export const requestStatus = pgEnum("request_status", [
  "PENDING",
  "APPROVED",
  "SHIPPED",
  "RECEIVED",
  "RETURNED",
  "DECLINED",
  "CANCELLED",
]);
export const readStatus = pgEnum("read_status", [
  "WANT",
  "READING",
  "FINISHED",
]);

// ---- tables ----
export const users = pgTable("users", {
  id: id(),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  location: text("location"),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: id(),
  token: text("token").notNull().unique(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const books = pgTable(
  "books",
  {
    id: id(),
    title: text("title").notNull(),
    authors: text("authors"),
    isbn13: text("isbn13").unique(),
    isbn10: text("isbn10"),
    publisher: text("publisher"),
    publishedDate: text("published_date"),
    description: text("description"),
    pageCount: integer("page_count"),
    categories: text("categories"),
    language: text("language"),
    coverUrl: text("cover_url"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({ titleIdx: index("books_title_idx").on(t.title) })
);

export const copies = pgTable("copies", {
  id: id(),
  bookId: text("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  holderId: text("holder_id")
    .notNull()
    .references(() => users.id),
  status: copyStatus("status").notNull().default("AVAILABLE"),
  condition: text("condition"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const loanRequests = pgTable("loan_requests", {
  id: id(),
  copyId: text("copy_id")
    .notNull()
    .references(() => copies.id, { onDelete: "cascade" }),
  requesterId: text("requester_id")
    .notNull()
    .references(() => users.id),
  status: requestStatus("status").notNull().default("PENDING"),
  message: text("message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const readingLogs = pgTable(
  "reading_logs",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    status: readStatus("status").notNull().default("READING"),
    rating: integer("rating"),
    review: text("review"),
    finishedAt: timestamp("finished_at"),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    userBook: uniqueIndex("reading_logs_user_book").on(t.userId, t.bookId),
  })
);

// ---- relations (enable db.query ... { with }) ----
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  ownedCopies: many(copies, { relationName: "ownerCopies" }),
  heldCopies: many(copies, { relationName: "holderCopies" }),
  requests: many(loanRequests, { relationName: "requesterReqs" }),
  readingLogs: many(readingLogs),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const booksRelations = relations(books, ({ many }) => ({
  copies: many(copies),
  readingLogs: many(readingLogs),
}));

export const copiesRelations = relations(copies, ({ one, many }) => ({
  book: one(books, { fields: [copies.bookId], references: [books.id] }),
  owner: one(users, {
    fields: [copies.ownerId],
    references: [users.id],
    relationName: "ownerCopies",
  }),
  holder: one(users, {
    fields: [copies.holderId],
    references: [users.id],
    relationName: "holderCopies",
  }),
  requests: many(loanRequests),
}));

export const loanRequestsRelations = relations(loanRequests, ({ one }) => ({
  copy: one(copies, {
    fields: [loanRequests.copyId],
    references: [copies.id],
  }),
  requester: one(users, {
    fields: [loanRequests.requesterId],
    references: [users.id],
    relationName: "requesterReqs",
  }),
}));

export const readingLogsRelations = relations(readingLogs, ({ one }) => ({
  user: one(users, {
    fields: [readingLogs.userId],
    references: [users.id],
  }),
  book: one(books, {
    fields: [readingLogs.bookId],
    references: [books.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type Book = typeof books.$inferSelect;
export type Copy = typeof copies.$inferSelect;
