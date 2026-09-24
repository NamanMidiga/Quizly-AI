import { generateWithGroq } from "./ai/groqClient";
import { AnalyticsResultSchema, AnalyticsResult, StoredQuiz } from "./schemas";
import { buildAnalyticsPrompt } from "./promptBuilder";

export async function generateAnalytics(
  storedQuiz: StoredQuiz
): Promise<AnalyticsResult> {
  const latestAttempt = storedQuiz.attempts[storedQuiz.attempts.length - 1];
  if (!latestAttempt) throw new Error("No attempts found for this quiz");

  const topicMap = new Map<string, { correct: number; total: number }>();
  for (const result of latestAttempt.gradeResult.results) {
    const question = storedQuiz.quiz.questions.find((item) => item.id === result.questionId);
    const topic = question?.topic || "General";
    const stats = topicMap.get(topic) || { correct: 0, total: 0 };
    stats.total += 1;
    if (result.isCorrect) stats.correct += 1;
    topicMap.set(topic, stats);
  }

  const topicBreakdown = Array.from(topicMap.entries()).map(([topic, stats]) => ({
    topic,
    correct: stats.correct,
    total: stats.total,
  }));
  return generateWithGroq(
    buildAnalyticsPrompt(topicBreakdown, latestAttempt.gradeResult.percentage),
    AnalyticsResultSchema
  );
}