// memory_db.json — stores generated quizzes, attempts, scores, analytics.
// It does NOT generate anything. All intelligence comes from Groq.
// Uses file-based JSON storage instead of Supabase (which is banned in India).

import { promises as fs } from "fs";
import path from "path";
import { StoredQuiz, QuizAttempt, Quiz } from "./schemas";

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

/* ─── Quizzes ─── */

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

/* ─── User Stats ─── */

export async function getUserStats() {
  const db = await readDB();
  const logs = db.loginLogs || [];

  if (logs.length === 0) return { totalLogins: 0, uniqueUsers: 0, users: [], recentLogins: [], activeToday: 0, activeLast7Days: 0, activeLast30Days: 0 };

  // Unique users by email
  const userMap = new Map<string, { email: string; name: string; image: string | null; loginCount: number; firstLogin: string; lastLogin: string }>();
  for (const log of logs) {
    const existing = userMap.get(log.email);
    if (existing) {
      existing.loginCount++;
      if (log.timestamp < existing.firstLogin) existing.firstLogin = log.timestamp;
      if (log.timestamp > existing.lastLogin) existing.lastLogin = log.timestamp;
    } else {
      userMap.set(log.email, {
        email: log.email,
        name: log.name,
        image: log.image || null,
        loginCount: 1,
        firstLogin: log.timestamp,
        lastLogin: log.timestamp,
      });
    }
  }

  const users = Array.from(userMap.values()).sort((a, b) => b.loginCount - a.loginCount);

  // Active in last 24h / 7d / 30d
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const uniqueIn = (ms: number) => {
    const cutoff = new Date(now - ms).toISOString();
    const emails = new Set(logs.filter(l => l.timestamp >= cutoff).map(l => l.email));
    return emails.size;
  };

  return {
    totalLogins: logs.length,
    uniqueUsers: users.length,
    activeToday: uniqueIn(day),
    activeLast7Days: uniqueIn(7 * day),
    activeLast30Days: uniqueIn(30 * day),
    users,
    recentLogins: logs.slice(0, 20),
  };
}
