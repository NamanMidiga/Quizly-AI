// This file handles local text extraction from supported document formats.

import mammoth from "mammoth";
import { extractText } from "unpdf";
import JSZip from "jszip";

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
    default:
      throw new Error(
        `Unsupported file type: .${ext}. Supported: PDF, DOCX, PPTX, TXT`
      );
  }
}
