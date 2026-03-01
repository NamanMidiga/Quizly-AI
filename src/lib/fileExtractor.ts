// GROQ INTELLIGENCE RULE:
// This file handles text extraction from files and images.
// Documents (PDF, DOCX, TXT) are extracted locally (text parsing, no intelligence).
// Images use Groq vision model for fast OCR.

import mammoth from "mammoth";
import { extractText } from "unpdf";
import Groq from "groq-sdk";
import JSZip from "jszip";

const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

function getGroqClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured");
  return new Groq({ apiKey });
}

/**
 * Extract text from a PDF buffer using unpdf (local, fast).
 */
export async function extractFromPDF(buffer: Buffer): Promise<string> {
  const { text } = await extractText(new Uint8Array(buffer));
  const joined = Array.isArray(text) ? text.join("\n") : String(text);
  const cleaned = joined.trim();
  if (!cleaned) throw new Error("Could not extract text from PDF — the file may be image-only");
  return cleaned;
}

/**
 * Extract text from a DOCX buffer using mammoth (local, fast).
 */
export async function extractFromDOCX(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value?.trim();
  if (!text) throw new Error("Could not extract text from DOCX");
  return text;
}

/**
 * Extract text from a TXT buffer (local).
 */
export function extractFromTXT(buffer: Buffer): string {
  const text = buffer.toString("utf-8").trim();
  if (!text) throw new Error("TXT file is empty");
  return text;
}

/**
 * Extract text from an image using Groq vision (fast, ~1-2s).
 */
export async function extractFromImage(buffer: Buffer, mimeType: string): Promise<string> {
  const client = getGroqClient();
  const base64 = buffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const completion = await client.chat.completions.create({
    model: VISION_MODEL,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: dataUrl },
          },
          {
            type: "text",
            text: "Extract ALL text from this image. Return ONLY the extracted text, nothing else. Preserve the original formatting, paragraphs, and structure as much as possible. If there are tables, reproduce them. If there is no text, respond with 'NO_TEXT_FOUND'.",
          },
        ],
      },
    ],
    temperature: 0,
    max_tokens: 8192,
  });

  const text = completion.choices?.[0]?.message?.content?.trim();
  if (!text || text === "NO_TEXT_FOUND") {
    throw new Error("Could not extract text from image");
  }
  return text;
}

/**
 * Extract text from a PPTX buffer by parsing the XML slides inside the ZIP archive.
 */
export async function extractFromPPTX(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slideTexts: string[] = [];

  // PPTX slides are stored as ppt/slides/slide1.xml, slide2.xml, etc.
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)?.[1] || "0");
      const numB = parseInt(b.match(/slide(\d+)/)?.[1] || "0");
      return numA - numB;
    });

  for (const slidePath of slideFiles) {
    const xml = await zip.files[slidePath].async("text");
    // Extract all text content from <a:t> tags (PowerPoint text runs)
    const texts = xml.match(/<a:t>([^<]*)<\/a:t>/g);
    if (texts) {
      const slideText = texts
        .map((t) => t.replace(/<\/?a:t>/g, "").trim())
        .filter(Boolean)
        .join(" ");
      if (slideText) {
        const slideNum = slidePath.match(/slide(\d+)/)?.[1] || "?";
        slideTexts.push(`[Slide ${slideNum}] ${slideText}`);
      }
    }
  }

  const fullText = slideTexts.join("\n\n");
  if (!fullText.trim()) {
    throw new Error("Could not extract text from PPTX — slides may be image-only");
  }
  return fullText;
}

/**
 * Get MIME type from file extension.
 */
function getMimeType(ext: string): string {
  const mimeMap: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    bmp: "image/bmp",
    gif: "image/gif",
  };
  return mimeMap[ext] || "image/png";
}

/**
 * Detect file type and extract text accordingly.
 */
export async function extractTextFromFile(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const ext = filename.toLowerCase().split(".").pop();

  switch (ext) {
    case "pdf":
      return extractFromPDF(buffer);
    case "docx":
      return extractFromDOCX(buffer);
    case "pptx":
    case "ppt":
      return extractFromPPTX(buffer);
    case "txt":
      return extractFromTXT(buffer);
    case "png":
    case "jpg":
    case "jpeg":
    case "webp":
    case "bmp":
    case "gif":
      return extractFromImage(buffer, getMimeType(ext!));
    default:
      throw new Error(
        `Unsupported file type: .${ext}. Supported: PDF, DOCX, PPTX, TXT, PNG, JPG, JPEG, WEBP`
      );
  }
}
