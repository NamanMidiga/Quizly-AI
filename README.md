# 🧠 Quizly AI — Byte Busters

A full-stack Next.js web application that generates, administers, and grades quizzes with an external AI provider. The provider integration is currently being replaced.

## Architecture

```
User Input → Next.js API Route → AI Provider → Validated JSON → Store → Return
```

## Features

- **Smart Quiz Generation** — Type natural prompts like "3 easy mcq and 2 hard subjective on physics"
- **Multi-Source Input** — Topic text, file upload (PDF/DOCX/PPTX/TXT), or YouTube links
- **Per-Type Difficulty Control** — Specify exact counts & difficulty per question type
- **Two Modes** — Normal (casual MCQs) and Test (full exam simulation with timer & negative marking)
- **Grading** — MCQs compared locally; subjective grading is awaiting the replacement provider
- **Progressive Hints** — Awaiting the replacement AI provider
- **Explanations** — Awaiting the replacement AI provider
- **Dashboard Analytics** — Local performance tracking with provider recommendations temporarily disabled
- **Speech Input** — Web Speech API for voice-based quiz generation
- **Document Input** — PDF, DOCX, PPTX, and TXT text extraction

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env.local` with the authentication and storage variables listed in `.env.example`.

3. Run the dev server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5.9 |
| AI | Replacement provider pending |
| Validation | Zod v4 |
| Styling | Tailwind CSS v4 + Custom Glassmorphism |
| Storage | File-based JSON (memory_db.json) |

## Project Structure

```
src/
├── app/
│   ├── page.tsx                # Main SPA (home, quiz, results, dashboard)
│   ├── layout.tsx              # Root layout
│   ├── globals.css             # Full glassmorphism theme
│   └── api/
│       ├── quiz/
│       │   ├── generate/route.ts   # Quiz generation (provider pending)
│       │   ├── grade/route.ts      # Grading (MCQ local + provider pending)
│       │   ├── explain/route.ts    # AI explanations (provider pending)
│       │   ├── hint/route.ts       # Progressive hints (provider pending)
│       │   ├── analytics/route.ts  # Topic analytics (provider pending)
│       │   ├── dashboard/route.ts  # Dashboard aggregation
│       │   ├── list/route.ts       # List all quizzes
│       │   └── [id]/route.ts       # Get single quiz
│       ├── upload/route.ts         # File upload & text extraction
│       └── transcribe/route.ts     # YouTube URL → captions/metadata
├── lib/
│   ├── schemas.ts              # All Zod schemas
│   ├── promptBuilder.ts        # Prompt construction for all AI features
│   ├── analyticsService.ts     # Analytics helpers
│   ├── fileExtractor.ts        # PDF/DOCX/PPTX/TXT extraction
│   └── memoryDB.ts             # JSON file storage
```

## Provider Status

> The previous AI provider integration has been removed. Provider-dependent endpoints return `503` until the replacement integration is added.

## Team

**Byte Busters** 🚀
