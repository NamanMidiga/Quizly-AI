import { NextResponse } from "next/server";
import { getAllQuizzes } from "@/lib/memoryDB";

export async function GET() {
  try {
    const quizzes = await getAllQuizzes();
    return NextResponse.json(quizzes, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
