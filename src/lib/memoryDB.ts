// Supabase-backed storage for quizzes, attempts, and login logs.
// All intelligence comes from Groq — this only stores data.

import { getSupabase } from "./supabase";
import { StoredQuiz, QuizAttempt, Quiz } from "./schemas";

/* ─── Quizzes ─── */

export async function saveQuiz(id: string, quiz: Quiz): Promise<StoredQuiz> {
  const stored: StoredQuiz = {
    id,
    quiz,
    createdAt: new Date().toISOString(),
    attempts: [],
  };
  const { error } = await getSupabase()
    .from("quizzes")
    .insert({ id, data: stored, created_at: stored.createdAt });
  if (error) console.error("[Quizly AI] saveQuiz error:", error.message);
  return stored;
}

export async function getQuiz(id: string): Promise<StoredQuiz | undefined> {
  const { data, error } = await getSupabase()
    .from("quizzes")
    .select("data")
    .eq("id", id)
    .single();
  if (error || !data) return undefined;
  return data.data as StoredQuiz;
}

export async function getAllQuizzes(): Promise<StoredQuiz[]> {
  const { data, error } = await getSupabase()
    .from("quizzes")
    .select("data")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => row.data as StoredQuiz);
}

export async function saveAttempt(
  quizId: string,
  attempt: QuizAttempt
): Promise<void> {
  const { data, error: fetchError } = await getSupabase()
    .from("quizzes")
    .select("data")
    .eq("id", quizId)
    .single();
  if (fetchError || !data) throw new Error(`Quiz ${quizId} not found`);

  const stored = data.data as StoredQuiz;
  stored.attempts.push(attempt);

  const { error } = await getSupabase()
    .from("quizzes")
    .update({ data: stored })
    .eq("id", quizId);
  if (error) console.error("[Quizly AI] saveAttempt error:", error.message);
}

export async function deleteQuiz(id: string): Promise<boolean> {
  const { error, count } = await getSupabase()
    .from("quizzes")
    .delete()
    .eq("id", id);
  if (error) return false;
  return (count ?? 0) > 0;
}

/* ─── Login Logs ─── */

interface LoginLog {
  email: string;
  name: string;
  image?: string;
  timestamp: string;
  provider: string;
}

export async function logLogin(entry: {
  email: string;
  name: string;
  image?: string;
  provider: string;
}): Promise<void> {
  const { error } = await getSupabase()
    .from("login_logs")
    .insert({
      email: entry.email,
      name: entry.name,
      image: entry.image || null,
      provider: entry.provider,
      timestamp: new Date().toISOString(),
    });
  if (error) console.error("[Quizly AI] logLogin error:", error.message);
}

export async function getLoginLogs(): Promise<LoginLog[]> {
  const { data, error } = await getSupabase()
    .from("login_logs")
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(500);
  if (error || !data) return [];
  return data as LoginLog[];
}

/* ─── User Stats ─── */

export async function getUserStats() {
  const { data: logs, error } = await getSupabase()
    .from("login_logs")
    .select("*")
    .order("timestamp", { ascending: false });

  if (error || !logs) return { totalLogins: 0, uniqueUsers: 0, users: [], recentLogins: [] };

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
