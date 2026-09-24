import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getQuiz } from "@/lib/memoryDB";

const HintRequestSchema = z.object({
  quizId: z.string(),
  questionId: z.number(),
  hintNumber: z.number().min(1).max(5), // which hint (1st, 2nd, 3rd...)
  previousHints: z.array(z.string()).default([]),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = HintRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { quizId, questionId, hintNumber } = parsed.data;
    const storedQuiz = await getQuiz(quizId);

    if (!storedQuiz) {
      return NextResponse.json(
        { error: `Quiz ${quizId} not found` },
        { status: 404 }
      );
    }

    const question = storedQuiz.quiz.questions.find(
      (q) => q.id === questionId
    );

    if (!question) {
      return NextResponse.json(
        { error: `Question ${questionId} not found in quiz` },
        { status: 404 }
      );
    }

    // Don't allow more hints than marks - 1 (must keep at least 1 mark)
    if (hintNumber >= question.marks) {
      return NextResponse.json(
        { error: "Maximum hints reached for this question" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "AI hints are temporarily unavailable while the AI provider is being replaced." },
      { status: 503 }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Hint generation failed";
    return NextResponse.json(
      { error: "AI hint generation failed", message },
      { status: 502 }
    );
  }
}
