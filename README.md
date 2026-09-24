# 🧠 Quizly AI — Byte Busters

A full-stack Next.js web application that generates, administers, and grades quizzes using Groq LLaMA models.

## Architecture

```
User Input → Next.js API Route → Groq LLaMA → Validated JSON → Store → Return
```

## Features

- **Smart Quiz Generation** — Type natural prompts like "3 easy mcq and 2 hard subjective on physics"
- **Multi-Source Input** — Topic text, file upload (PDF/DOCX/PPTX/TXT), or YouTube links
- **Per-Type Difficulty Control** — Specify exact counts & difficulty per question type
- **Two Modes** — Normal (casual MCQs) and Test (full exam simulation with timer & negative marking)
- **AI Grading** — MCQs compared locally, subjective answers graded with rubrics and keyword analysis
- **Progressive Hints** — AI-generated hints that get stronger (each costs -1 mark)
- **AI Explanations** — Deep explanations with concept breakdowns, memory tips, and related topics
- **Dashboard Analytics** — AI-powered study recommendations and performance tracking
- **Speech Input** — Web Speech API for voice-based quiz generation
- **Image OCR** — Groq Vision extracts text from uploaded images
- **Multilingual** — Groq detects and generates in the input language

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env.local` with the authentication, storage, and `GROQ_API_KEY` variables listed in `.env.example`.

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
| AI | Groq SDK + LLaMA 3.3 70B Versatile |
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
│       │   ├── generate/route.ts   # Quiz generation (Groq)
│       │   ├── grade/route.ts      # Grading (MCQ local + subjective Groq)
│       │   ├── explain/route.ts    # AI explanations (Groq)
│       │   ├── hint/route.ts       # Progressive hints (Groq)
│       │   ├── analytics/route.ts  # Topic analytics (Groq)
│       │   ├── dashboard/route.ts  # Dashboard aggregation + AI recommendations
│       │   ├── list/route.ts       # List all quizzes
│       │   └── [id]/route.ts       # Get single quiz
│       ├── upload/route.ts         # File upload & text extraction
│       └── transcribe/route.ts     # YouTube URL → captions/metadata
├── lib/
│   ├── ai/groqClient.ts       # Central Groq entry point (typed, validated, retried)
│   ├── schemas.ts              # All Zod schemas
│   ├── promptBuilder.ts        # Prompt construction for all AI features
│   ├── analyticsService.ts     # Analytics via Groq
│   ├── fileExtractor.ts        # PDF/DOCX/PPTX/TXT/Image extraction
│   └── memoryDB.ts             # JSON file storage
```

## Intelligence Rule

> All dynamic quiz content is generated through the centralized Groq client and validated with Zod before storage or return.

## Team

**Byte Busters** 🚀
