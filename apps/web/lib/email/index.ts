import { Resend } from "resend";

let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY!);
  }
  return resend;
}

export const EMAIL_FROM = process.env.EMAIL_FROM ?? "noreply@primitive.io";

/** True when Resend is configured — otherwise emails are only logged to the console. */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send an email via Resend. When RESEND_API_KEY is not set (local dev),
 * logs the email to the console instead so the app still works.
 */
export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  if (!process.env.RESEND_API_KEY) {
    const urls = [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
    console.log(`\n[email] To: ${to}\n[email] Subject: ${subject}`);
    if (urls.length) console.log(`[email] Links:\n${urls.map((u) => `  ${u}`).join("\n")}`);
    console.log(`[email] (set RESEND_API_KEY to send for real)\n`);
    return;
  }
  const res = await getResend().emails.send({ from: EMAIL_FROM, to, subject, html });
  if (res?.error) { console.error("[email] Resend error:", res.error); throw new Error(res.error.message ?? "Resend rejected the email"); }
}

export interface BatchMessage { to: string; subject: string; html: string; from?: string }
export interface BatchResult { to: string; ok: boolean; id?: string; error?: string }

/**
 * Send up to 100 distinct emails in one Resend batch call. Returns a result per
 * message (aligned to input). Without RESEND_API_KEY, logs and returns ok.
 */
export async function sendBatch(messages: BatchMessage[]): Promise<BatchResult[]> {
  if (messages.length === 0) return [];
  if (!process.env.RESEND_API_KEY) {
    for (const m of messages) console.log(`[email] (dev) To: ${m.to} — ${m.subject}`);
    return messages.map((m) => ({ to: m.to, ok: true, id: "dev" }));
  }
  try {
    const res = await getResend().batch.send(
      messages.map((m) => ({ from: m.from ?? EMAIL_FROM, to: m.to, subject: m.subject, html: m.html }))
    );
    const ids = (res?.data?.data ?? []) as Array<{ id?: string }>;
    if (res?.error) {
      return messages.map((m) => ({ to: m.to, ok: false, error: res.error?.message ?? "Batch send failed" }));
    }
    return messages.map((m, i) => ({ to: m.to, ok: true, id: ids[i]?.id }));
  } catch (err) {
    const error = err instanceof Error ? err.message : "Batch send failed";
    return messages.map((m) => ({ to: m.to, ok: false, error }));
  }
}
