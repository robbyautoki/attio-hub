import { db } from '../lib/db';
import { bookings } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  // Mark am@sonnenfolger.de as sent to prevent further emails
  const result = await db.update(bookings)
    .set({
      reminder1hSentAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(bookings.email, 'am@sonnenfolger.de'))
    .returning();

  console.log('Updated:', result.length, 'bookings');
  console.log(result);
}

main().catch(console.error);
