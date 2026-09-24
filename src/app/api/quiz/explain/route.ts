import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getQuiz } from "@/lib/memoryDB";

const ExplainRequestSchema = z.object({
  quizId: z.string(),
  questionId: z.number(),
  studentAnswer: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ExplainRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { quizId, questionId } = parsed.data;
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

    return NextResponse.json(
      { error: "AI explanations are temporarily unavailable while the AI provider is being replaced." },
      { status: 503 }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Explanation generation failed";
    return NextResponse.json(
      { error: "AI explanation failed", message },
      { status: 502 }
    );
  }
}
