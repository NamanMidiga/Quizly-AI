// GROQ INTELLIGENCE RULE:
// Uploaded file content is extracted and sent to Groq for quiz generation.
// No local question generation allowed.

import { NextRequest, NextResponse } from "next/server";
import { extractTextFromFile } from "@/lib/fileExtractor";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 50MB." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractTextFromFile(buffer, file.name);

    // Truncate if too long (Groq context limit)
    const truncated = text.length > 12000 ? text.slice(0, 12000) + "\n\n[Content truncated...]" : text;

    return NextResponse.json(
      {
        text: truncated,
        filename: file.name,
        originalLength: text.length,
        truncated: text.length > 12000,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "File extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
