import { NextRequest, NextResponse } from "next/server";
import { getLoginLogs, logLogin } from "@/lib/memoryDB";

export async function GET() {
  try {
    const logs = await getLoginLogs();
    return NextResponse.json(logs);
  } catch (err) {
    console.error("[Quizly AI] Failed to fetch login logs:", err);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await logLogin({
      email: body.email || "unknown",
      name: body.name || "unknown",
      image: body.image || undefined,
      provider: body.provider || "unknown",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Quizly AI] Failed to log login:", err);
    return NextResponse.json({ error: "Failed to log" }, { status: 500 });
  }
}
