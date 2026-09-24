import Groq from "groq-sdk";
import { z, ZodSchema } from "zod";

const MODEL = "llama-3.3-70b-versatile";
const TIMEOUT_MS = 60_000;

function getClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === "your_groq_api_key_here") {
    throw new Error("GROQ_API_KEY is not configured");
  }
  return new Groq({ apiKey });
}

export async function generateWithGroq<T>(
  prompt: string,
  schema: ZodSchema<T>,
  retries = 2
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
                "You are Quizly AI. Respond only with valid JSON matching the requested schema. Do not use markdown or code fences.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 8192,
          response_format: { type: "json_object" },
        },
        { signal: controller.signal as never }
      );

      const raw = completion.choices?.[0]?.message?.content;
      if (!raw) throw new Error("AI provider returned an empty response");

      const parsed = JSON.parse(raw) as unknown;
      const result = schema.safeParse(parsed);
      if (result.success) return result.data;
      throw new Error(`AI response failed schema validation: ${result.error.message}`);
    } catch (error) {
      if (attempt === retries) throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error("AI generation failed after all retries");
}