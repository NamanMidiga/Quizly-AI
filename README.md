# 🧠 Quizly AI v5.0 — Groq-Centric Intelligence Edition

A full-stack Next.js web application that generates, administers, and grades quizzes using **Groq LLaMA 3.3 70B**. Zero local intelligence — every question, answer, rubric, and recommendation originates from Groq.

## Architecture

```
User Input → Next.js API Route → Groq LLaMA 3.3 70B → Validated JSON → Store → Return
```

## Features

- **Multi-Source Quiz Generation** — from topic, pasted content, or YouTube URL
- **Competitive Exam Patterns** — JEE, NEET, UPSC, CAT, GATE, SAT, GRE
- **Difficulty Tiering** — Easy/Medium/Hard with AI-enforced tagging
- **AI Grading** — MCQs compared locally, subjective answers graded by Groq with rubrics
- **Topic Analytics** — Groq-powered weak topic analysis & improvement plans
- **Multilingual** — Groq detects and generates in the input language
- **Download Results** — With AI-generated explanations

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set your Groq API key in `.env.local`:
   ```
   GROQ_API_KEY=gsk_your_key_here
   ```

3. Run the dev server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| AI | Groq SDK + LLaMA 3.3 70B |
| Validation | Zod |
| Styling | Tailwind CSS v4 |
| Storage | File-based JSON (memory_db.json) |

## Project Structure

```
src/
├── app/
│   ├── api/quiz/
│   │   ├── generate/route.ts   # Quiz generation (Groq)
│   │   ├── grade/route.ts      # Quiz grading (MCQ local + subjective Groq)
│   │   ├── analytics/route.ts  # AI analytics (Groq)
│   │   ├── list/route.ts       # List all quizzes
│   │   └── [id]/route.ts       # Get single quiz
│   ├── quiz/[id]/page.tsx      # Take quiz UI
│   ├── results/[id]/page.tsx   # Results + analytics UI
│   ├── history/page.tsx        # Quiz history UI
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Home / Generate UI
│   └── globals.css
├── lib/
│   ├── ai/groqClient.ts       # SINGLE Groq entry point
│   ├── schemas.ts              # Zod schemas
│   ├── promptBuilder.ts        # Prompt construction
│   ├── analyticsService.ts     # Analytics via Groq
│   └── memoryDB.ts             # JSON file storage
```

## Intelligence Rule

> All dynamic quiz content must originate from Groq LLaMA 3.3 70B. No local question generators. No static fallback content. Fail safely if Groq fails.
