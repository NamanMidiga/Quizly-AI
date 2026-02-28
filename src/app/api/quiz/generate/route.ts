// GROQ INTELLIGENCE RULE:
// All dynamic quiz content must originate from Groq LLaMA 3.3 70B.
// Do not implement local question generators.
// Do not add static fallback content.
// Fail safely if Groq fails.

// All question content must be generated via generateWithGroq()
// No local generation allowed.

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

    const req = parsed.data;
    const prompt = buildGeneratePrompt(req);

    // TASK 2 — Enforce Groq Generation
    // If no Groq response → return error. Do not fallback to local mock content.
    let quiz;
    try {
      quiz = await generateWithGroq(prompt, QuizSchema);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Groq generation failed";
      return NextResponse.json(
        {
          error: "AI generation failed",
          message,
          hint: "Ensure GROQ_API_KEY is set in .env.local",
        },
        { status: 502 }
      );
    }

    // TASK 4 — Validate difficulty tags exist
    const missingDifficulty = quiz.questions.some((q) => !q.difficulty);
    if (missingDifficulty) {
      // Retry once
      try {
        quiz = await generateWithGroq(
          prompt + "\n\nCRITICAL: Every question MUST include a 'difficulty' field (easy/medium/hard). You missed it last time.",
          QuizSchema
        );
      } catch {
        return NextResponse.json(
          { error: "Generated questions missing difficulty tags after retry" },
          { status: 502 }
        );
      }

      const stillMissing = quiz.questions.some((q) => !q.difficulty);
      if (stillMissing) {
        return NextResponse.json(
          { error: "Generated questions missing required difficulty tags" },
          { status: 502 }
        );
      }
    }

    // Save to memory DB
    const quizId = uuidv4();
    const stored = await saveQuiz(quizId, quiz);

    return NextResponse.json({ quizId: stored.id, quiz }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
