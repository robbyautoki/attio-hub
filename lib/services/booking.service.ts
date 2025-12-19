import { db } from "@/lib/db";
import { bookings, type Booking } from "@/lib/db/schema";
import { eq, and, lte, gte, isNull, desc } from "drizzle-orm";

export interface CreateBookingData {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  startTime: Date;
  endTime?: Date | null;
  meetingLink?: string | null;
  eventType?: string | null;
  calcomBookingId?: string | null;
  calcomEventUid?: string | null;
  userId: string;
  workflowId?: string | null;
}

/**
 * Creates a new booking
 */
export async function createBooking(data: CreateBookingData): Promise<Booking> {
  const id = crypto.randomUUID();
  const now = new Date();

  const [booking] = await db
    .insert(bookings)
    .values({
      id,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      startTime: data.startTime,
      endTime: data.endTime,
      meetingLink: data.meetingLink,
      eventType: data.eventType,
      calcomBookingId: data.calcomBookingId,
      calcomEventUid: data.calcomEventUid,
      userId: data.userId,
      workflowId: data.workflowId,
      status: "confirmed",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return booking;
}

/**
 * Gets a booking by Cal.com booking ID
 */
export async function getBookingByCalcomId(calcomBookingId: string): Promise<Booking | null> {
  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.calcomBookingId, calcomBookingId));

  return booking || null;
}

/**
 * Gets bookings that need 24h reminder
 * - Start time is within 23h50min - 24h10min from now (±10 min around 24h mark)
 * - 24h reminder not sent yet
 * - Status is confirmed
 */
export async function getBookingsNeedingReminder24h(): Promise<Booking[]> {
  const now = new Date();
  const in23h50min = new Date(now.getTime() + (23 * 60 + 50) * 60 * 1000);
  const in24h10min = new Date(now.getTime() + (24 * 60 + 10) * 60 * 1000);

  return db
    .select()
    .from(bookings)
    .where(
      and(
        gte(bookings.startTime, in23h50min),
        lte(bookings.startTime, in24h10min),
        isNull(bookings.reminder24hSentAt),
        eq(bookings.status, "confirmed")
      )
    );
}

/**
 * Gets bookings that need 1h reminder
 * - Start time is within 50-70 minutes from now (±10 min around 1h mark)
 * - 1h reminder not sent yet
 * - Status is confirmed
 */
export async function getBookingsNeedingReminder1h(): Promise<Booking[]> {
  const now = new Date();
  const in50min = new Date(now.getTime() + 50 * 60 * 1000);
  const in70min = new Date(now.getTime() + 70 * 60 * 1000);

  return db
    .select()
    .from(bookings)
    .where(
      and(
        gte(bookings.startTime, in50min),
        lte(bookings.startTime, in70min),
        isNull(bookings.reminder1hSentAt),
        eq(bookings.status, "confirmed")
      )
    );
}

/**
 * Marks confirmation as sent
 */
export async function markConfirmationSent(bookingId: string): Promise<void> {
  await db
    .update(bookings)
    .set({
      confirmationSentAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, bookingId));
}

/**
 * Marks 24h reminder as sent
 */
export async function markReminder24hSent(bookingId: string): Promise<void> {
  await db
    .update(bookings)
    .set({
      reminder24hSentAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, bookingId));
}

/**
 * Marks 1h reminder as sent
 */
export async function markReminder1hSent(bookingId: string): Promise<void> {
  await db
    .update(bookings)
    .set({
      reminder1hSentAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, bookingId));
}

/**
 * Updates booking status (e.g., cancelled)
 */
export async function updateBookingStatus(
  bookingId: string,
  status: "confirmed" | "cancelled" | "completed"
): Promise<void> {
  await db
    .update(bookings)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, bookingId));
}

/**
 * Cancels a booking by Cal.com booking ID
 */
export async function cancelBookingByCalcomId(calcomBookingId: string): Promise<void> {
  await db
    .update(bookings)
    .set({
      status: "cancelled",
      updatedAt: new Date(),
    })
    .where(eq(bookings.calcomBookingId, calcomBookingId));
}

/**
 * Gets all bookings for a user
 */
export async function getBookingsByUser(userId: string, limit = 50): Promise<Booking[]> {
  return db
    .select()
    .from(bookings)
    .where(eq(bookings.userId, userId))
    .limit(limit);
}

/**
 * Gets the most recent booking by email
 */
export async function getBookingByEmail(email: string): Promise<Booking | null> {
  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.email, email))
    .orderBy(desc(bookings.createdAt))
    .limit(1);

  return booking || null;
}

/**
 * Marks a booking as no-show
 */
export async function markBookingAsNoShow(bookingId: string): Promise<void> {
  await db
    .update(bookings)
    .set({
      status: "no_show",
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, bookingId));
}
