import { NextRequest, NextResponse } from "next/server";
import {
  GradeRequestSchema,
  GradedAnswer,
  GradedAnswerSchema,
  GradeResult,
  GradeResultSchema,
  QuizAttempt,
} from "@/lib/schemas";
import { getQuiz, saveAttempt } from "@/lib/memoryDB";
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
        // MCQ comparison handles both answer text and option-letter formats.
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
        return NextResponse.json(
          { error: "Subjective grading is temporarily unavailable while the AI provider is being replaced." },
          { status: 503 }
        );
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
