import { db } from '../lib/db';
import { bookings } from '../lib/db/schema';
import { desc, like, or, eq } from 'drizzle-orm';

async function main() {
  // Check specific emails
  const results = await db.select({
    email: bookings.email,
    startTime: bookings.startTime,
    reminder1hSentAt: bookings.reminder1hSentAt,
    reminder24hSentAt: bookings.reminder24hSentAt,
    status: bookings.status,
    createdAt: bookings.createdAt
  }).from(bookings).where(
    or(
      like(bookings.email, '%sonnenfolger%'),
      like(bookings.email, '%im-leads%')
    )
  ).orderBy(desc(bookings.createdAt));

  console.log('Bookings for sonnenfolger and im-leads:');
  results.forEach(b => {
    console.log(`${b.email} | start: ${b.startTime} | 1h: ${b.reminder1hSentAt || 'pending'} | status: ${b.status}`);
  });
}

main().catch(console.error);
