import { NextResponse } from "next/server";
import { getLoginLogs } from "@/lib/memoryDB";

export async function GET() {
  try {
    const logs = await getLoginLogs();
    return NextResponse.json(logs);
  } catch (err) {
    console.error("[Quizly AI] Failed to fetch login logs:", err);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
