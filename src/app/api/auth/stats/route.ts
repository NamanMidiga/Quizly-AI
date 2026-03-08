import { NextResponse } from "next/server";
import { getUserStats } from "@/lib/memoryDB";

export async function GET() {
  try {
    const stats = await getUserStats();
    return NextResponse.json(stats);
  } catch (err) {
    console.error("[Quizly AI] Failed to fetch user stats:", err);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
