import { NextRequest, NextResponse } from "next/server";
import { generateWithGroq } from "@/lib/ai/groqClient";
import { GenerateRequestSchema, QuizSchema } from "@/lib/schemas";
import { buildGeneratePrompt } from "@/lib/promptBuilder";
import { saveQuiz } from "@/lib/memoryDB";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = GenerateRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const quiz = await generateWithGroq(
      buildGeneratePrompt(parsed.data),
      QuizSchema
    );
    const missingDifficulty = quiz.questions.some((question) => !question.difficulty);
    if (missingDifficulty) {
      return NextResponse.json(
        { error: "Generated questions are missing required difficulty tags" },
        { status: 502 }
      );
    }

    const stored = await saveQuiz(uuidv4(), quiz);
    return NextResponse.json({ quizId: stored.id, quiz }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
