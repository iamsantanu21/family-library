// Email notifications via Resend's HTTP API (no SDK/dependency needed).
//
// Everything here is best-effort and SAFE: if RESEND_API_KEY is not set, every
// function is a no-op, and any send error is swallowed (logged only) so a failed
// email can never break the user action that triggered it.
//
// Env:
//   RESEND_API_KEY   your Resend key (emails are disabled until this is set)
//   EMAIL_FROM       sender, e.g. "Family Library <library@yourdomain.com>"
//                    (defaults to Resend's test sender onboarding@resend.dev)

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

const FROM = () =>
  process.env.EMAIL_FROM || "Family Library <onboarding@resend.dev>";

type Send = { to: string[]; subject: string; text: string };

async function sendEmail({ to, subject, text }: Send): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const recipients = Array.from(new Set(to.filter(Boolean)));
  if (!key || recipients.length === 0) return;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from: FROM(), to: recipients, subject, text }),
    });
    if (!res.ok) {
      console.error("email send failed", res.status, await res.text());
    }
  } catch (err) {
    console.error("email send error", err);
  }
}

const footer = (base: string) =>
  `\n\n— Family Library\n${base}`;

// ---- notification builders (each fetches nothing; callers pass the data) ----

// A borrow was requested. `groups` = one entry per holder whose book(s) were
// requested, so each holder gets a single tidy email.
export async function notifyBorrowRequested(
  base: string,
  requesterName: string,
  groups: { holderEmail: string | null; holderName: string; titles: string[] }[]
): Promise<void> {
  await Promise.all(
    groups.map((g) => {
      if (!g.holderEmail) return Promise.resolve();
      const list = g.titles.map((t) => `• ${t}`).join("\n");
      const many = g.titles.length > 1;
      return sendEmail({
        to: [g.holderEmail],
        subject: `${requesterName} wants to borrow ${
          many ? `${g.titles.length} of your books` : `“${g.titles[0]}”`
        }`,
        text:
          `Hi ${g.holderName},\n\n${requesterName} asked to borrow:\n${list}\n\n` +
          `Open Requests to approve and send.${footer(base + "/requests")}`,
      });
    })
  );
}

export async function notifyRequestApproved(
  base: string,
  requesterEmail: string | null,
  requesterName: string,
  holderName: string,
  title: string
): Promise<void> {
  await sendEmail({
    to: requesterEmail ? [requesterEmail] : [],
    subject: `${holderName} approved your request for “${title}”`,
    text:
      `Hi ${requesterName},\n\n${holderName} approved your request for “${title}”. ` +
      `They'll send it your way soon.${footer(base + "/requests")}`,
  });
}

export async function notifyRequestDeclined(
  base: string,
  requesterEmail: string | null,
  requesterName: string,
  holderName: string,
  title: string
): Promise<void> {
  await sendEmail({
    to: requesterEmail ? [requesterEmail] : [],
    subject: `Update on your request for “${title}”`,
    text:
      `Hi ${requesterName},\n\n${holderName} can't lend “${title}” right now, ` +
      `so this request was declined.${footer(base + "/requests")}`,
  });
}

export async function notifyRequestShipped(
  base: string,
  requesterEmail: string | null,
  requesterName: string,
  holderName: string,
  title: string
): Promise<void> {
  await sendEmail({
    to: requesterEmail ? [requesterEmail] : [],
    subject: `“${title}” is on its way to you`,
    text:
      `Hi ${requesterName},\n\n${holderName} marked “${title}” as sent. ` +
      `When it arrives, open Requests and tap “I got it”.${footer(base + "/requests")}`,
  });
}

export async function notifyRequestReturned(
  base: string,
  ownerEmail: string | null,
  ownerName: string,
  title: string
): Promise<void> {
  await sendEmail({
    to: ownerEmail ? [ownerEmail] : [],
    subject: `“${title}” has been returned to you`,
    text: `Hi ${ownerName},\n\n“${title}” is marked returned and is back with you.${footer(
      base + "/my-books"
    )}`,
  });
}

// A book was handed directly to a member via My Books (immediate send).
export async function notifySentToMember(
  base: string,
  toEmail: string | null,
  toName: string,
  fromName: string,
  titles: string[],
  details: { courier?: string | null; tracking?: string | null; note?: string | null }
): Promise<void> {
  if (!toEmail) return;
  const list = titles.map((t) => `• ${t}`).join("\n");
  const bits = [
    details.courier ? `Courier: ${details.courier}` : null,
    details.tracking ? `Tracking: ${details.tracking}` : null,
    details.note ? `Note: “${details.note}”` : null,
  ].filter(Boolean);
  const many = titles.length > 1;
  await sendEmail({
    to: [toEmail],
    subject: `${fromName} sent you ${many ? `${titles.length} books` : `“${titles[0]}”`}`,
    text:
      `Hi ${toName},\n\n${fromName} sent you:\n${list}\n` +
      (bits.length ? `\n${bits.join("\n")}\n` : "") +
      `\nThey're now in your collection.${footer(base + "/my-books")}`,
  });
}

// A new wishlist item — tell the rest of the family.
export async function notifyWishlistAdded(
  base: string,
  adderName: string,
  title: string,
  authors: string | null,
  recipientEmails: (string | null)[]
): Promise<void> {
  const by = authors ? ` by ${authors}` : "";
  await sendEmail({
    to: recipientEmails.filter((e): e is string => !!e),
    subject: `${adderName} added “${title}” to the family wishlist`,
    text:
      `${adderName} would like the family to have “${title}”${by}.\n\n` +
      `See the full wishlist (and whether we already own it).${footer(base + "/wishlist")}`,
  });
}
