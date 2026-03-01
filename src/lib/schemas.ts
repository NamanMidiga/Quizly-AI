// GROQ INTELLIGENCE RULE:
// All dynamic quiz content must originate from Groq LLaMA 3.3 70B.

import { z } from "zod";

/* ─── Single Question ─── */
export const QuestionSchema = z.object({
  id: z.number(),
  type: z.enum(["mcq", "subjective"]),
  question: z.string().min(1),
  options: z.array(z.string()).optional(), // MCQ only
  correctAnswer: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
  marks: z.number().min(0),
  negativeMark: z.number().min(0).default(0),
  explanation: z.string().optional(),
  topic: z.string().optional(),
  // Subjective-specific fields
  expectedLength: z.enum(["short", "medium", "long"]).optional(),     // hint for answer length
  keywords: z.array(z.string()).optional(),                            // key concepts to cover
  sampleAnswer: z.string().optional(),                                 // model answer for grading reference
});

export type Question = z.infer<typeof QuestionSchema>;

/* ─── Full Quiz ─── */
export const QuizSchema = z.object({
  title: z.string(),
  description: z.string(),
  questions: z.array(QuestionSchema).min(1),
  totalMarks: z.number(),
  timeMinutes: z.number(),
  language: z.string().default("English"),
  examPattern: z.string().optional(),
});

export type Quiz = z.infer<typeof QuizSchema>;

/* ─── Generate Request ─── */
export const GenerateRequestSchema = z.object({
  prompt: z.string().optional(),              // natural language prompt from user
  topic: z.string().optional(),
  content: z.string().optional(),             // raw text / pasted content
  youtubeUrl: z.string().url().optional(),
  numQuestions: z.number().min(1).max(50).default(10),
  questionTypes: z
    .array(z.enum(["mcq", "subjective"]))
    .default(["mcq", "subjective"]),
  difficulty: z
    .enum(["easy", "medium", "hard", "mixed"])
    .default("mixed"),
  language: z.string().default("English"),
  examPattern: z.string().optional(),         // e.g. "JEE", "NEET", "UPSC"
  negativeMark: z.number().min(0).default(0),
  timeMinutes: z.number().min(1).default(30),
  mcqCount: z.number().min(0).optional(),           // exact number of MCQ questions requested
  subjectiveCount: z.number().min(0).optional(),     // exact number of subjective questions requested
  mcqDifficulty: z.enum(["easy", "medium", "hard"]).optional(),         // specific difficulty for MCQ questions
  subjectiveDifficulty: z.enum(["easy", "medium", "hard"]).optional(),  // specific difficulty for subjective questions
});

export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

/* ─── Grading ─── */
export const AnswerSubmission = z.object({
  questionId: z.number(),
  answer: z.string(),
  hintsUsed: z.number().min(0).default(0), // number of hints taken for this question
});

export const GradeRequestSchema = z.object({
  quizId: z.string(),
  answers: z.array(AnswerSubmission),
});

export type GradeRequest = z.infer<typeof GradeRequestSchema>;

export const GradedAnswerSchema = z.object({
  questionId: z.number(),
  isCorrect: z.boolean(),
  marksAwarded: z.number(),
  feedback: z.string(),
  rubric: z.string().optional(),
  // Enhanced subjective grading fields
  keywordsFound: z.array(z.string()).optional(),       // which keywords student covered
  keywordsMissed: z.array(z.string()).optional(),      // which keywords student missed
  qualityScore: z.number().min(0).max(100).optional(), // 0-100 quality assessment
  strengths: z.string().optional(),                     // what the student did well
  improvements: z.string().optional(),                  // what could be improved
});

export type GradedAnswer = z.infer<typeof GradedAnswerSchema>;

export const GradeResultSchema = z.object({
  results: z.array(GradedAnswerSchema),
  totalScore: z.number(),
  maxScore: z.number(),
  percentage: z.number(),
  summary: z.string(),
});

export type GradeResult = z.infer<typeof GradeResultSchema>;

/* ─── Analytics ─── */
export const AnalyticsRequestSchema = z.object({
  quizId: z.string(),
});

export const TopicAnalysisSchema = z.object({
  topic: z.string(),
  correctCount: z.number(),
  totalCount: z.number(),
  accuracy: z.number(),
});

export const AnalyticsResultSchema = z.object({
  weakTopics: z.array(z.string()),
  strongTopics: z.array(z.string()),
  topicBreakdown: z.array(TopicAnalysisSchema),
  improvementPlan: z.string(),
  suggestedNextFocus: z.string(),
  overallAnalysis: z.string(),
});

export type AnalyticsResult = z.infer<typeof AnalyticsResultSchema>;

/* ─── AI Explanation ─── */
export const ExplanationResultSchema = z.object({
  explanation: z.string(),
  conceptBreakdown: z.array(z.string()).optional(),    // key concepts explained
  whyCorrect: z.string().optional(),                    // why the correct answer is right
  whyOthersWrong: z.array(z.string()).optional(),       // why other options (MCQ) are wrong
  relatedTopics: z.array(z.string()).optional(),        // topics to study further
  difficulty: z.string().optional(),                     // why this difficulty was assigned
  memoryTip: z.string().optional(),                      // mnemonic or tip to remember
});

export type ExplanationResult = z.infer<typeof ExplanationResultSchema>;

/* ─── Quiz Attempt (stored in memory_db) ─── */
export interface QuizAttempt {
  id: string;
  quizId: string;
  answers: { questionId: number; answer: string }[];
  gradeResult: GradeResult;
  timestamp: string;
}

/* ─── Stored Quiz ─── */
export interface StoredQuiz {
  id: string;
  quiz: Quiz;
  createdAt: string;
  attempts: QuizAttempt[];
}
