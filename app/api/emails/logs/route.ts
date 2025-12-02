import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getEmailLogs } from "@/lib/services/email-log.service";

export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get limit from query params (default: 100)
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    const logs = await getEmailLogs(userId, limit);

    return NextResponse.json(logs);
  } catch (error) {
    console.error("Error fetching email logs:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
