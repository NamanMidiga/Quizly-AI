// GROQ INTELLIGENCE RULE:
// Dashboard analytics must use Groq for study recommendations.

import { NextResponse } from "next/server";
import { getAllQuizzes } from "@/lib/memoryDB";
import { generateWithGroq } from "@/lib/ai/groqClient";
import { z } from "zod";

const DashboardRecommendationSchema = z.object({
  studyPlan: z.string(),
  priorityTopics: z.array(z.string()),
  dailyGoal: z.string(),
  motivationalNote: z.string(),
  predictedImprovement: z.string(),
});

export async function GET() {
  try {
    const allQuizzes = await getAllQuizzes();

    // Aggregate all attempts across all quizzes
    const allAttempts: {
      quizTitle: string;
      date: string;
      percentage: number;
      totalScore: number;
      maxScore: number;
      topics: { topic: string; correct: number; total: number }[];
      difficulty: string;
      mode: string;
    }[] = [];

    const topicMap = new Map<string, { correct: number; total: number; attempts: number }>();
    const trendData: { date: string; percentage: number }[] = [];
    let totalQuizzesTaken = 0;
    let totalQuestionsAnswered = 0;
    let totalCorrect = 0;

    for (const sq of allQuizzes) {
      for (const attempt of sq.attempts) {
        totalQuizzesTaken++;
        const gr = attempt.gradeResult;

        // Build topic breakdown for this attempt
        const attemptTopics: { topic: string; correct: number; total: number }[] = [];
        for (const r of gr.results) {
          totalQuestionsAnswered++;
          if (r.isCorrect) totalCorrect++;

          const q = sq.quiz.questions.find((qq) => qq.id === r.questionId);
          const topic = q?.topic || "General";

          // Per-attempt topic
          const existing = attemptTopics.find((t) => t.topic === topic);
          if (existing) {
            existing.total++;
            if (r.isCorrect) existing.correct++;
          } else {
            attemptTopics.push({ topic, correct: r.isCorrect ? 1 : 0, total: 1 });
          }

          // Global topic map
          const global = topicMap.get(topic) || { correct: 0, total: 0, attempts: 0 };
          global.total++;
          if (r.isCorrect) global.correct++;
          global.attempts++;
          topicMap.set(topic, global);
        }

        allAttempts.push({
          quizTitle: sq.quiz.title,
          date: attempt.timestamp,
          percentage: gr.percentage,
          totalScore: gr.totalScore,
          maxScore: gr.maxScore,
          topics: attemptTopics,
          difficulty: sq.quiz.questions[0]?.difficulty || "mixed",
          mode: sq.quiz.timeMinutes > 15 ? "test" : "normal",
        });

        trendData.push({
          date: attempt.timestamp,
          percentage: gr.percentage,
        });
      }
    }

    // Sort trend data by date
    trendData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate topic mastery
    const topicMastery = Array.from(topicMap.entries()).map(([topic, data]) => ({
      topic,
      correct: data.correct,
      total: data.total,
      accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
      attempts: data.attempts,
    }));

    // Weak topics (< 50% accuracy)
    const weakTopics = topicMastery
      .filter((t) => t.accuracy < 50)
      .sort((a, b) => a.accuracy - b.accuracy);

    // Strong topics (>= 75% accuracy)
    const strongTopics = topicMastery
      .filter((t) => t.accuracy >= 75)
      .sort((a, b) => b.accuracy - a.accuracy);

    // Medium topics
    const mediumTopics = topicMastery
      .filter((t) => t.accuracy >= 50 && t.accuracy < 75)
      .sort((a, b) => a.accuracy - b.accuracy);

    // Overall stats
    const overallAccuracy = totalQuestionsAnswered > 0
      ? Math.round((totalCorrect / totalQuestionsAnswered) * 100)
      : 0;

    // Calculate improvement trend (compare first half vs second half of attempts)
    let improvementTrend = "not_enough_data";
    if (trendData.length >= 2) {
      const mid = Math.floor(trendData.length / 2);
      const firstHalf = trendData.slice(0, mid);
      const secondHalf = trendData.slice(mid);
      const firstAvg = firstHalf.reduce((s, t) => s + t.percentage, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((s, t) => s + t.percentage, 0) / secondHalf.length;
      const diff = secondAvg - firstAvg;
      if (diff > 5) improvementTrend = "improving";
      else if (diff < -5) improvementTrend = "declining";
      else improvementTrend = "stable";
    }

    // AI-powered study recommendations (only if we have data)
    let aiRecommendations = null;
    if (totalQuizzesTaken > 0) {
      try {
        const topicSummary = topicMastery
          .map((t) => `${t.topic}: ${t.accuracy}% (${t.correct}/${t.total})`)
          .join("\n");

        const recentScores = trendData.slice(-5).map((t) => `${t.percentage}%`).join(", ");

        const prompt = `You are an AI study coach. Analyze this student's quiz performance and give personalized recommendations.

STUDENT DATA:
- Total quizzes taken: ${totalQuizzesTaken}
- Overall accuracy: ${overallAccuracy}%
- Improvement trend: ${improvementTrend}
- Recent scores: ${recentScores || "N/A"}

TOPIC PERFORMANCE:
${topicSummary || "No topic data yet"}

WEAK AREAS: ${weakTopics.map((t) => t.topic).join(", ") || "None identified"}
STRONG AREAS: ${strongTopics.map((t) => t.topic).join(", ") || "None identified"}

INSTRUCTIONS:
- Create a concise study plan (2-3 sentences).
- List top 3 priority topics to focus on.
- Suggest a daily study goal.
- Write a short motivational note (1 sentence).
- Predict improvement if student follows the plan (1 sentence).

Return ONLY valid JSON:
{
  "studyPlan": "string",
  "priorityTopics": ["string", "string", "string"],
  "dailyGoal": "string",
  "motivationalNote": "string",
  "predictedImprovement": "string"
}`;

        aiRecommendations = await generateWithGroq(prompt, DashboardRecommendationSchema);
      } catch {
        // AI recommendations are optional
      }
    }

    return NextResponse.json({
      overview: {
        totalQuizzes: totalQuizzesTaken,
        totalQuestions: totalQuestionsAnswered,
        totalCorrect,
        overallAccuracy,
        improvementTrend,
      },
      topicMastery,
      weakTopics,
      strongTopics,
      mediumTopics,
      trendData,
      recentAttempts: allAttempts.slice(-10).reverse(),
      aiRecommendations,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Dashboard data failed", message },
      { status: 500 }
    );
  }
}
