import { db } from "@/lib/db";
import { emailLogs, EmailLog, NewEmailLog } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";

export type EmailType =
  | "confirmation"
  | "reminder_24h"
  | "reminder_1h"
  | "no_show"
  | "meeting_running"
  | "thank_you_discovery"
  | "thank_you_strategie"
  | "test";

export interface CreateEmailLogData {
  emailType: EmailType;
  to: string;
  subject: string;
  from: string;
  htmlContent?: string;
  status: "sent" | "failed" | "scheduled";
  resendId?: string;
  errorMessage?: string;
  bookingId?: string;
  userId: string;
}

/**
 * Create a new email log entry
 */
export async function createEmailLog(data: CreateEmailLogData): Promise<EmailLog> {
  const now = new Date();
  const id = nanoid();

  const newLog: NewEmailLog = {
    id,
    emailType: data.emailType,
    to: data.to,
    subject: data.subject,
    from: data.from,
    status: data.status,
    resendId: data.resendId || null,
    errorMessage: data.errorMessage || null,
    bookingId: data.bookingId || null,
    userId: data.userId,
    sentAt: now,
    createdAt: now,
  };

  await db.insert(emailLogs).values(newLog);

  return {
    ...newLog,
    sentAt: now,
    createdAt: now,
  } as EmailLog;
}

/**
 * Get all email logs for a user
 */
export async function getEmailLogs(userId: string, limit = 100): Promise<EmailLog[]> {
  return db
    .select()
    .from(emailLogs)
    .where(eq(emailLogs.userId, userId))
    .orderBy(desc(emailLogs.sentAt))
    .limit(limit);
}

/**
 * Get email logs for a specific booking
 */
export async function getEmailLogsByBooking(bookingId: string): Promise<EmailLog[]> {
  return db
    .select()
    .from(emailLogs)
    .where(eq(emailLogs.bookingId, bookingId))
    .orderBy(desc(emailLogs.sentAt));
}

/**
 * Helper function to extract Resend ID from API response
 */
export function extractResendId(response: unknown): string | undefined {
  if (response && typeof response === "object" && "id" in response) {
    return (response as { id: string }).id;
  }
  return undefined;
}
