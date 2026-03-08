// memory_db.json — stores generated quizzes, attempts, scores, analytics.
// It does NOT generate anything. All intelligence comes from Groq.

import { promises as fs } from "fs";
import path from "path";
import { StoredQuiz, QuizAttempt, Quiz, GradeResult } from "./schemas";

const DB_PATH = process.env.NODE_ENV === "production"
  ? path.join("/tmp", "memory_db.json")
  : path.join(process.cwd(), "memory_db.json");

interface LoginLog {
  email: string;
  name: string;
  image?: string;
  timestamp: string;
  provider: string;
}

interface DB {
  quizzes: StoredQuiz[];
  loginLogs?: LoginLog[];
}

async function readDB(): Promise<DB> {
  try {
    const raw = await fs.readFile(DB_PATH, "utf-8");
    const data = JSON.parse(raw) as DB;
    if (!data.loginLogs) data.loginLogs = [];
    return data;
  } catch {
    return { quizzes: [], loginLogs: [] };
  }
}

async function writeDB(db: DB): Promise<void> {
  try {
    await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("[Quizly AI] Failed to write DB:", err instanceof Error ? err.message : err);
    // Don't throw — allow the request to continue even if DB write fails
  }
}

export async function saveQuiz(id: string, quiz: Quiz): Promise<StoredQuiz> {
  const db = await readDB();
  const stored: StoredQuiz = {
    id,
    quiz,
    createdAt: new Date().toISOString(),
    attempts: [],
  };
  db.quizzes.push(stored);
  await writeDB(db);
  return stored;
}

export async function getQuiz(id: string): Promise<StoredQuiz | undefined> {
  const db = await readDB();
  return db.quizzes.find((q) => q.id === id);
}

export async function getAllQuizzes(): Promise<StoredQuiz[]> {
  const db = await readDB();
  return db.quizzes;
}

export async function saveAttempt(
  quizId: string,
  attempt: QuizAttempt
): Promise<void> {
  const db = await readDB();
  const quiz = db.quizzes.find((q) => q.id === quizId);
  if (!quiz) throw new Error(`Quiz ${quizId} not found`);
  quiz.attempts.push(attempt);
  await writeDB(db);
}

export async function deleteQuiz(id: string): Promise<boolean> {
  const db = await readDB();
  const idx = db.quizzes.findIndex((q) => q.id === id);
  if (idx === -1) return false;
  db.quizzes.splice(idx, 1);
  await writeDB(db);
  return true;
}

/* ─── Login Logs ─── */

export async function logLogin(entry: {
  email: string;
  name: string;
  image?: string;
  provider: string;
}): Promise<void> {
  const db = await readDB();
  if (!db.loginLogs) db.loginLogs = [];
  db.loginLogs.push({
    ...entry,
    timestamp: new Date().toISOString(),
  });
  await writeDB(db);
}

export async function getLoginLogs(): Promise<LoginLog[]> {
  const db = await readDB();
  return (db.loginLogs || []).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
