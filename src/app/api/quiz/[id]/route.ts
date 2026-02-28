import { NextRequest, NextResponse } from "next/server";
import { getQuiz } from "@/lib/memoryDB";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const storedQuiz = await getQuiz(id);

    if (!storedQuiz) {
      return NextResponse.json(
        { error: `Quiz ${id} not found` },
        { status: 404 }
      );
    }

    return NextResponse.json(storedQuiz, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
