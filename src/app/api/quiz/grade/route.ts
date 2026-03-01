// GROQ INTELLIGENCE RULE:
// Subjective answers must be sent to Groq for evaluation.
// No local grading allowed for subjective questions.
// MCQs graded locally (comparison logic only).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateWithGroq } from "@/lib/ai/groqClient";
import {
  GradeRequestSchema,
  GradedAnswer,
  GradedAnswerSchema,
  GradeResult,
  GradeResultSchema,
  QuizAttempt,
} from "@/lib/schemas";
import { getQuiz, saveAttempt } from "@/lib/memoryDB";
import { buildGradePrompt } from "@/lib/promptBuilder";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = GradeRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { quizId, answers } = parsed.data;
    const storedQuiz = await getQuiz(quizId);

    if (!storedQuiz) {
      return NextResponse.json(
        { error: `Quiz ${quizId} not found` },
        { status: 404 }
      );
    }

    const quiz = storedQuiz.quiz;
    const results: GradedAnswer[] = [];
    let totalScore = 0;
    let maxScore = 0;

    for (const question of quiz.questions) {
      maxScore += question.marks;
      const submission = answers.find((a) => a.questionId === question.id);
      const hintsUsed = submission?.hintsUsed || 0;
      // Each hint reduces max achievable marks by 1 (minimum 1 mark remaining)
      const effectiveMaxMarks = Math.max(1, question.marks - hintsUsed);

      if (!submission || !submission.answer.trim()) {
        results.push({
          questionId: question.id,
          isCorrect: false,
          marksAwarded: 0,
          feedback: "No answer provided." + (hintsUsed > 0 ? ` (${hintsUsed} hint(s) used)` : ""),
        });
        continue;
      }

      if (question.type === "mcq") {
        // MCQ — robust comparison that handles various formats Groq might return
        const studentAnswer = submission.answer.trim().toLowerCase();
        const correctRaw = question.correctAnswer.trim().toLowerCase();
        const options = question.options || [];

        // Find which option index the student selected
        const studentOptionIndex = options.findIndex(
          (opt) => opt.trim().toLowerCase() === studentAnswer
        );
        // Find which option index matches the correct answer
        // Check multiple formats: exact match, letter match ("a","b","c","d"), letter-dot match ("a.","b."), or substring
        const correctOptionIndex = options.findIndex((opt, i) => {
          const optLower = opt.trim().toLowerCase();
          const letter = String.fromCharCode(97 + i); // 'a','b','c','d'
          return (
            optLower === correctRaw ||
            correctRaw === letter ||
            correctRaw === letter + "." ||
            correctRaw === `${letter}) ${optLower}` ||
            correctRaw === `${letter}. ${optLower}` ||
            correctRaw.startsWith(`${letter}.`) && correctRaw.includes(optLower) ||
            correctRaw.startsWith(`${letter})`) && correctRaw.includes(optLower) ||
            optLower.includes(correctRaw) ||
            correctRaw.includes(optLower)
          );
        });

        // Check correctness: either exact text match, or both point to the same option index
        const isCorrect =
          studentAnswer === correctRaw ||
          (studentOptionIndex >= 0 && studentOptionIndex === correctOptionIndex) ||
          studentAnswer.includes(correctRaw) ||
          correctRaw.includes(studentAnswer);

        const rawMarks = isCorrect
          ? Math.min(question.marks, effectiveMaxMarks)
          : -(question.negativeMark || 0);
        totalScore += rawMarks;
        const hintNote = hintsUsed > 0 ? ` (${hintsUsed} hint(s) used — max marks capped to ${effectiveMaxMarks})` : "";
        results.push({
          questionId: question.id,
          isCorrect,
          marksAwarded: Math.max(0, rawMarks),
          feedback: isCorrect
            ? `Correct!${hintNote}`
            : `Incorrect. The correct answer is: ${question.correctAnswer}${hintNote}`,
        });
      } else {
        // TASK 5 — Subjective grading MUST call Groq
        try {
          const prompt = buildGradePrompt(
            question.question,
            question.correctAnswer,
            submission.answer,
            question.marks,
            question.keywords,
            question.sampleAnswer,
            question.expectedLength
          );

          const SingleGradeSchema = z.object({
            questionId: z.number(),
            isCorrect: z.boolean(),
            marksAwarded: z.number(),
            feedback: z.string(),
            rubric: z.string().optional(),
            keywordsFound: z.array(z.string()).optional(),
            keywordsMissed: z.array(z.string()).optional(),
            qualityScore: z.number().min(0).max(100).optional(),
            strengths: z.string().optional(),
            improvements: z.string().optional(),
          });

          const graded = await generateWithGroq(prompt, SingleGradeSchema);
          graded.questionId = question.id;
          // Cap marks based on hints used
          if (hintsUsed > 0) {
            graded.marksAwarded = Math.min(graded.marksAwarded, effectiveMaxMarks);
            graded.feedback += ` (${hintsUsed} hint(s) used — max marks capped to ${effectiveMaxMarks})`;
          }
          totalScore += graded.marksAwarded;
          results.push(graded);
        } catch (err) {
          // Fail safely — do not grade locally
          return NextResponse.json(
            {
              error: "Subjective grading failed — Groq unavailable",
              message:
                err instanceof Error ? err.message : "AI grading failed",
            },
            { status: 502 }
          );
        }
      }
    }

    const percentage =
      maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    const gradeResult: GradeResult = {
      results,
      totalScore: Math.max(0, totalScore),
      maxScore,
      percentage,
      summary: `Scored ${Math.max(0, totalScore)}/${maxScore} (${percentage}%)`,
    };

    // Save attempt
    const attempt: QuizAttempt = {
      id: uuidv4(),
      quizId,
      answers,
      gradeResult,
      timestamp: new Date().toISOString(),
    };
    await saveAttempt(quizId, attempt);

    return NextResponse.json(gradeResult, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
