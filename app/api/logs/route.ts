import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getAllExecutionLogs, getExecutionLogsByWorkflow } from "@/lib/services/execution.service";

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get("workflowId");
    const limit = parseInt(searchParams.get("limit") || "50");

    let logs;
    if (workflowId) {
      logs = await getExecutionLogsByWorkflow(workflowId, limit);
    } else {
      logs = await getAllExecutionLogs(limit);
    }

    return NextResponse.json(logs);
  } catch (error) {
    console.error("Error fetching logs:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Logs" },
      { status: 500 }
    );
  }
}
