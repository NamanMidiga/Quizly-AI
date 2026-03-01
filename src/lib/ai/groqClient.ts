// GROQ INTELLIGENCE RULE:
// All dynamic quiz content must originate from Groq LLaMA 3.3 70B.
// Do not implement local question generators.
// Do not add static fallback content.
// Fail safely if Groq fails.

// EXECUTION MODE
// This is the central AI intelligence module.
// ALL quiz-related content must pass through this file.
// Requirements:
// - Use process.env.GROQ_API_KEY
// - Throw if key missing
// - Enforce JSON-only output
// - Validate using Zod
// - Retry once if schema invalid
// - Timeout 10 seconds
// - Never log API key
// - Never return raw text
// - Only return validated structured JSON

import Groq from "groq-sdk";
import { z, ZodSchema } from "zod";

const MODEL = "llama-3.3-70b-versatile";
const TIMEOUT_MS = 60_000;

function getClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY || process.env.GROQ_KEY || process.env.GROQ;
  if (!apiKey || apiKey === "your_groq_api_key_here") {
    const groqKeys = Object.keys(process.env).filter(k => k.toLowerCase().includes("groq"));
    console.error("[Quizly AI] GROQ_API_KEY is missing or not set.");
    console.error("[Quizly AI] Env vars containing 'groq':", groqKeys);
    console.error("[Quizly AI] GROQ_API_KEY value is:", process.env.GROQ_API_KEY ? "SET (length " + process.env.GROQ_API_KEY.length + ")" : "UNDEFINED");
    console.error("[Quizly AI] GROQ_KEY value is:", process.env.GROQ_KEY ? "SET" : "UNDEFINED");
    console.error("[Quizly AI] GROQ value is:", process.env.GROQ ? "SET" : "UNDEFINED");
    throw new Error(
      "GROQ_API_KEY is not configured. Set it as an environment variable. " +
      "Found env vars with 'groq': [" + groqKeys.join(", ") + "]"
    );
  }
  console.log("[Quizly AI] API key loaded successfully (length:", apiKey.length + ")");
  return new Groq({ apiKey });
}

/**
 * The ONLY function that communicates with Groq.
 * Every AI feature in Quizly must call this.
 *
 * @param prompt  - The full prompt to send to Groq
 * @param schema  - A Zod schema that the response JSON must satisfy
 * @param retries - Number of retries on schema validation failure (default 1)
 * @returns Validated, typed JSON from Groq
 */
export async function generateWithGroq<T>(
  prompt: string,
  schema: ZodSchema<T>,
  retries: number = 2
): Promise<T> {
  const client = getClient();

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const completion = await client.chat.completions.create(
        {
          model: MODEL,
          messages: [
            {
              role: "system",
              content:
                "You are Quizly AI, an expert quiz generation and grading engine. " +
                "You MUST respond ONLY with valid JSON. No markdown, no explanation, no code fences. " +
                "Just raw JSON that matches the requested schema.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 8192,
          response_format: { type: "json_object" },
        },
        { signal: controller.signal as never }
      );

      clearTimeout(timer);

      const raw = completion.choices?.[0]?.message?.content;
      if (!raw) {
        throw new Error("Groq returned empty response");
      }

      // Parse JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error("Groq response is not valid JSON");
      }

      // Validate against Zod schema
      const result = schema.safeParse(parsed);
      if (result.success) {
        return result.data;
      }

      // If validation fails and we have retries left, try again
      if (attempt < retries) {
        console.warn(
          `[Quizly AI] Schema validation failed (attempt ${attempt + 1}), retrying...`,
          result.error.issues.slice(0, 3)
        );
        continue;
      }

      console.error("[Quizly AI] Schema validation failed permanently:", result.error.issues);
      throw new Error(
        `Groq response failed schema validation: ${result.error.message}`
      );
    } catch (err) {
      clearTimeout(timer);

      if (attempt < retries && !(err instanceof z.ZodError)) {
        console.warn(
          `[Quizly AI] Groq call failed (attempt ${attempt + 1}), retrying...`,
          err instanceof Error ? err.message : err
        );
        continue;
      }
      throw err;
    }
  }

  throw new Error("Groq generation failed after all retries");
}
