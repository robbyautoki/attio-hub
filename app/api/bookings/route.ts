import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getBookingsByUser } from "@/lib/services/booking.service";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bookings = await getBookingsByUser(userId);

    return NextResponse.json(bookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Buchungen" },
      { status: 500 }
    );
  }
}
