// GROQ INTELLIGENCE RULE:
// Analytics must use Groq — no hardcoded recommendation logic.

import { NextRequest, NextResponse } from "next/server";
import { AnalyticsRequestSchema } from "@/lib/schemas";
import { getQuiz } from "@/lib/memoryDB";
import { generateAnalytics } from "@/lib/analyticsService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = AnalyticsRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { quizId } = parsed.data;
    const storedQuiz = await getQuiz(quizId);

    if (!storedQuiz) {
      return NextResponse.json(
        { error: `Quiz ${quizId} not found` },
        { status: 404 }
      );
    }

    if (storedQuiz.attempts.length === 0) {
      return NextResponse.json(
        { error: "No attempts found — take the quiz first" },
        { status: 400 }
      );
    }

    const analytics = await generateAnalytics(storedQuiz);
    return NextResponse.json(analytics, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Analytics generation failed", message },
      { status: 502 }
    );
  }
}
