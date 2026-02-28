// GROQ INTELLIGENCE RULE:
// All dynamic quiz content must originate from Groq LLaMA 3.3 70B.
// Analytics must use Groq — no hardcoded recommendation logic.

import { generateWithGroq } from "./ai/groqClient";
import { AnalyticsResultSchema, AnalyticsResult, StoredQuiz } from "./schemas";
import { buildAnalyticsPrompt } from "./promptBuilder";

/**
 * TASK 6 — Analytics Must Use Groq
 * After calculating raw stats, sends to Groq for intelligent recommendations.
 */
export async function generateAnalytics(
  storedQuiz: StoredQuiz
): Promise<AnalyticsResult> {
  const latestAttempt = storedQuiz.attempts[storedQuiz.attempts.length - 1];
  if (!latestAttempt) {
    throw new Error("No attempts found for this quiz");
  }

  const gradeResult = latestAttempt.gradeResult;

  // Calculate raw topic stats
  const topicMap = new Map<string, { correct: number; total: number }>();

  for (const result of gradeResult.results) {
    const q = storedQuiz.quiz.questions.find(
      (q) => q.id === result.questionId
    );
    const topic = q?.topic || "General";
    const existing = topicMap.get(topic) || { correct: 0, total: 0 };
    existing.total += 1;
    if (result.isCorrect) existing.correct += 1;
    topicMap.set(topic, existing);
  }

  const topicBreakdown = Array.from(topicMap.entries()).map(
    ([topic, stats]) => ({
      topic,
      correct: stats.correct,
      total: stats.total,
    })
  );

  // Build prompt and send to Groq for intelligent analysis
  const prompt = buildAnalyticsPrompt(topicBreakdown, gradeResult.percentage);

  return generateWithGroq(prompt, AnalyticsResultSchema);
}
