// GROQ INTELLIGENCE RULE:
// All dynamic quiz content must originate from Groq LLaMA 3.3 70B.
// Do not implement local question generators.
// Do not add static fallback content.
// Fail safely if Groq fails.

import { GenerateRequest } from "./schemas";

/**
 * Builds the full prompt sent to Groq for quiz generation.
 * Parses the user's natural language prompt for any overrides.
 * Always generates a mix of MCQ and subjective by default.
 */
export function buildGeneratePrompt(req: GenerateRequest): string {
  const lines: string[] = [];

  lines.push("Generate a quiz with the following requirements:\n");

  // User's natural language prompt (highest priority — AI should parse it)
  if (req.prompt) {
    lines.push(
      `USER INSTRUCTIONS (HIGHEST PRIORITY — follow these exactly):\n"""\n${req.prompt}\n"""\n` +
      `Parse the above for any mentioned: number of questions, marks per question, total marks, ` +
      `difficulty preference, question types (mcq/subjective/both), time limit, or any other quiz settings. ` +
      `If the user specifies these, USE their values. If not, use the defaults below.`
    );
  }

  // Topic / Content
  if (req.topic && req.topic !== req.prompt) {
    lines.push(`Topic: ${req.topic}`);
  }
  if (req.content) {
    lines.push(`Source Content:\n"""\n${req.content}\n"""`);
  }
  if (req.youtubeUrl) {
    lines.push(`YouTube Reference: ${req.youtubeUrl}`);
  }

  // Defaults (user prompt can override these)
  lines.push(`\nDEFAULT SETTINGS (use these ONLY if the user prompt above doesn't specify):`);
  lines.push(`Number of questions: ${req.numQuestions}`);
  lines.push(`Question types: ${req.questionTypes.join(", ")}`);
  lines.push(`Time limit: ${req.timeMinutes} minutes`);

  // Question type rules — respect the requested types
  const onlyMcq = req.questionTypes.length === 1 && req.questionTypes[0] === "mcq";
  const onlySubjective = req.questionTypes.length === 1 && req.questionTypes[0] === "subjective";

  if (onlyMcq) {
    lines.push(
      `\nQUESTION TYPE RULES:` +
      `\n- Generate ONLY MCQ questions. Do NOT generate any subjective questions.` +
      `\n- ALL ${req.numQuestions} questions must be type "mcq" with 4 options each.` +
      `\n- MCQ questions should typically be 1-2 marks each.`
    );
  } else if (onlySubjective) {
    lines.push(
      `\nQUESTION TYPE RULES:` +
      `\n- Generate ONLY subjective questions. Do NOT generate any MCQ questions.` +
      `\n- ALL ${req.numQuestions} questions must be type "subjective".` +
      `\n- Subjective questions MUST vary: include short-answer (2-3 marks), explain-type (5 marks), ` +
      `compare-contrast, analytical, and long-answer questions (8-10 marks).` +
      `\n- Subjective questions should have marks proportional to their expected answer length.`
    );
  } else {
    // Check if exact counts were provided
    const mcqCount = req.mcqCount;
    const subjCount = req.subjectiveCount;
    if (mcqCount != null && subjCount != null && (mcqCount + subjCount) > 0) {
      const mcqDiff = req.mcqDifficulty;
      const subjDiff = req.subjectiveDifficulty;
      let difficultyRule = "";
      if (mcqDiff && subjDiff) {
        difficultyRule =
          `\n- ALL ${mcqCount} MCQ questions MUST be difficulty "${mcqDiff}".` +
          `\n- ALL ${subjCount} subjective questions MUST be difficulty "${subjDiff}".` +
          `\n- Do NOT mix difficulties unless specified. Follow these EXACTLY.`;
      } else if (mcqDiff) {
        difficultyRule = `\n- ALL ${mcqCount} MCQ questions MUST be difficulty "${mcqDiff}".`;
      } else if (subjDiff) {
        difficultyRule = `\n- ALL ${subjCount} subjective questions MUST be difficulty "${subjDiff}".`;
      }
      lines.push(
        `\nQUESTION TYPE RULES (STRICT — follow these counts and difficulties EXACTLY):` +
        `\n- Generate EXACTLY ${mcqCount} MCQ question${mcqCount !== 1 ? "s" : ""} and EXACTLY ${subjCount} subjective question${subjCount !== 1 ? "s" : ""}.` +
        `\n- Total questions MUST be ${mcqCount + subjCount}. No more, no less.` +
        difficultyRule +
        `\n- MCQ questions must have 4 options each and typically be 1-2 marks each.` +
        `\n- Subjective questions MUST vary: include short-answer (2-3 marks), explain-type (5 marks), ` +
        `compare-contrast, analytical, and long-answer questions (8-10 marks).` +
        `\n- Subjective questions should have marks proportional to their expected answer length.`
      );
    } else {
      lines.push(
        `\nQUESTION TYPE RULES:` +
        `\n- Generate a MIX of MCQ and subjective questions.` +
        `\n- Default split: roughly 50% MCQ, 50% subjective.` +
        `\n- Subjective questions MUST vary: include short-answer (2-3 marks), explain-type (5 marks), ` +
        `compare-contrast, analytical, and long-answer questions (8-10 marks).` +
        `\n- If the user mentions specific marks per question, use those marks.` +
        `\n- MCQ questions should typically be 1-2 marks each.` +
        `\n- Subjective questions should have marks proportional to their expected answer length.`
      );
    }
  }

  // Difficulty tiering — handle three cases:
  // 1. Per-type difficulty (mcqDifficulty / subjectiveDifficulty) — already handled above
  // 2. Standalone difficulty counts (easyCount / mediumCount / hardCount) — "7 hard 3 easy"
  // 3. General difficulty (easy / medium / hard / mixed)
  const hasPerTypeDifficulty = req.mcqDifficulty || req.subjectiveDifficulty;
  const hasDifficultyCounts = (req.easyCount != null && req.easyCount > 0) ||
                               (req.mediumCount != null && req.mediumCount > 0) ||
                               (req.hardCount != null && req.hardCount > 0);

  if (!hasPerTypeDifficulty && hasDifficultyCounts) {
    // Standalone difficulty counts — spread across all question types
    const parts: string[] = [];
    if (req.easyCount && req.easyCount > 0) parts.push(`exactly ${req.easyCount} EASY`);
    if (req.mediumCount && req.mediumCount > 0) parts.push(`exactly ${req.mediumCount} MEDIUM`);
    if (req.hardCount && req.hardCount > 0) parts.push(`exactly ${req.hardCount} HARD`);
    lines.push(
      `\nDIFFICULTY DISTRIBUTION (STRICT — follow these counts EXACTLY):` +
      `\n- Generate ${parts.join(" and ")} questions.` +
      `\n- Spread the difficulties across ALL question types (MCQ and subjective).` +
      `\n- Do NOT make all MCQs one difficulty and all subjective another difficulty.` +
      `\n- Mix the difficulties across both types. For example, if 7 hard and 3 easy out of 5 MCQ + 5 subjective:` +
      `\n  some MCQs should be hard AND some subjective should be hard, some MCQs should be easy AND some subjective should be easy.` +
      `\n- The TOTAL count of each difficulty MUST match exactly: ${parts.join(", ")}.` +
      `\n- Every question MUST have its "difficulty" field set correctly.`
    );
  } else if (!hasPerTypeDifficulty) {
    if (req.difficulty === "mixed") {
      lines.push(
        "\nDifficulty distribution: generate a balanced mix of easy, medium, and hard questions. " +
          "Tag EACH question with its difficulty level. The distribution should be roughly: " +
          "30% easy, 40% medium, 30% hard."
      );
    } else {
      lines.push(`\nDifficulty: ALL questions must be ${req.difficulty}`);
    }
  }

  // Exam pattern
  if (req.examPattern) {
    lines.push(
      `\nEXAM PATTERN RULES (${req.examPattern}):` +
        `\n- Structure questions per the ${req.examPattern} exam pattern.` +
        `\n- Apply the standard marking scheme for ${req.examPattern}.` +
        `\n- Distribute sections and difficulty tiers as per the official pattern.` +
        `\n- Include negative marking of ${req.negativeMark} marks per wrong answer if applicable.`
    );
  } else if (req.negativeMark > 0) {
    lines.push(`Negative marking: ${req.negativeMark} marks per wrong answer`);
  }

  // Language
  lines.push(
    `\nLANGUAGE INSTRUCTION:` +
      `\nDetect the language of the topic/content provided.` +
      `\nIf the user input is in "${req.language}", generate output strictly in "${req.language}".` +
      `\nIf the input is in another language, generate output strictly in that detected language.` +
      `\nAll questions, options, answers, and explanations must be in the same language.`
  );

  // Output format
  lines.push(
    `\nOUTPUT FORMAT — Return ONLY valid JSON matching this schema:
{
  "title": "string — quiz title",
  "description": "string — short description",
  "questions": [
    {
      "id": number,
      "type": "mcq" | "subjective",
      "question": "string",
      "options": ["A", "B", "C", "D"] (for MCQ only),
      "correctAnswer": "string — the correct option text or subjective answer",
      "difficulty": "easy" | "medium" | "hard",
      "marks": number,
      "negativeMark": number (0 if no negative marking),
      "explanation": "string — why this answer is correct",
      "topic": "string — subtopic this tests",
      "expectedLength": "short" | "medium" | "long" (for subjective only — short: 1-2 sentences, medium: 3-5 sentences, long: 1-2 paragraphs),
      "keywords": ["string"] (for subjective only — 3-6 key concepts the answer must cover),
      "sampleAnswer": "string" (for subjective only — a detailed model answer that serves as grading reference)
    }
  ],
  "totalMarks": number,
  "timeMinutes": ${req.timeMinutes},
  "language": "string — detected language",
  "examPattern": "${req.examPattern || "general"}"
}`
  );

  lines.push(
    "\nIMPORTANT: Every question MUST have the 'difficulty' field. " +
      "Every question MUST have 'explanation'. " +
      "Every question MUST have 'topic'. " +
      "For SUBJECTIVE questions: MUST include 'expectedLength', 'keywords' (array of 3-6 key terms), and 'sampleAnswer' (detailed model answer). " +
      "Subjective questions should test understanding, analysis, and application — not just recall. " +
      "Vary subjective questions between short-answer, explain-type, compare-contrast, and analytical questions. " +
      "Do NOT omit any field."
  );

  return lines.join("\n");
}

/**
 * Builds prompt for subjective answer grading.
 */
export function buildGradePrompt(
  question: string,
  correctAnswer: string,
  studentAnswer: string,
  marks: number,
  keywords?: string[],
  sampleAnswer?: string,
  expectedLength?: string
): string {
  const keywordSection = keywords && keywords.length > 0
    ? `\nExpected Keywords/Concepts: ${keywords.join(", ")}`
    : "";
  const sampleSection = sampleAnswer
    ? `\nDetailed Sample Answer: ${sampleAnswer}`
    : "";
  const lengthSection = expectedLength
    ? `\nExpected Answer Length: ${expectedLength} (short: 1-2 sentences, medium: 3-5 sentences, long: 1-2 paragraphs)`
    : "";

  return `Grade this subjective answer with detailed analysis.

Question: ${question}
Model Answer: ${correctAnswer}${sampleSection}${keywordSection}${lengthSection}
Student Answer: ${studentAnswer}
Maximum Marks: ${marks}

GRADING INSTRUCTIONS:
- Generate a detailed rubric for this question based on the model answer and keywords.
- Check which keywords/concepts the student covered and which they missed.
- Evaluate accuracy, completeness, clarity, and depth of understanding.
- Award partial marks fairly (0 to ${marks}) — do not be all-or-nothing.
- Consider the expected answer length — penalize slightly if answer is too short for "long" type or unnecessarily verbose.
- Provide specific, constructive feedback highlighting strengths and areas for improvement.
- Identify what the student did well (strengths) and what they can improve.
- Give a quality score from 0-100 representing overall answer quality.
- Detect the language of the question and respond in the SAME language.

Return ONLY valid JSON:
{
  "questionId": 0,
  "isCorrect": boolean (true if marksAwarded >= ${Math.ceil(marks * 0.7)}),
  "marksAwarded": number (0 to ${marks}, supports decimals like 1.5),
  "feedback": "string — detailed, constructive feedback explaining the grade",
  "rubric": "string — the rubric criteria used for grading",
  "keywordsFound": ["string"] — keywords/concepts the student correctly covered,
  "keywordsMissed": ["string"] — keywords/concepts the student missed,
  "qualityScore": number (0-100),
  "strengths": "string — what the student did well",
  "improvements": "string — specific suggestions for improvement"
}`;
}

/**
 * Builds prompt for topic analytics and recommendations.
 */
export function buildAnalyticsPrompt(
  topicBreakdown: { topic: string; correct: number; total: number }[],
  overallPercentage: number
): string {
  const breakdown = topicBreakdown
    .map((t) => `  - ${t.topic}: ${t.correct}/${t.total} correct`)
    .join("\n");

  return `Analyze this student's quiz performance and provide recommendations.

Overall Score: ${overallPercentage}%

Topic-wise Performance:
${breakdown}

INSTRUCTIONS:
- Identify weak topics (below 50% accuracy).
- Identify strong topics (above 75% accuracy).
- Create a focused improvement plan.
- Suggest what the next quiz should focus on.
- Provide an overall analysis paragraph.

Return ONLY valid JSON:
{
  "weakTopics": ["string"],
  "strongTopics": ["string"],
  "topicBreakdown": [{"topic": "string", "correctCount": number, "totalCount": number, "accuracy": number}],
  "improvementPlan": "string",
  "suggestedNextFocus": "string",
  "overallAnalysis": "string"
}`;
}

/**
 * Builds prompt for generating a rich AI explanation for any question.
 */
export function buildExplanationPrompt(
  question: string,
  correctAnswer: string,
  questionType: string,
  options?: string[],
  studentAnswer?: string,
  topic?: string,
  difficulty?: string
): string {
  const optionsSection = options && options.length > 0
    ? `\nOptions:\n${options.map((o, i) => `  ${String.fromCharCode(65 + i)}. ${o}`).join("\n")}`
    : "";
  const studentSection = studentAnswer
    ? `\nStudent's Answer: ${studentAnswer}`
    : "";
  const topicSection = topic ? `\nTopic: ${topic}` : "";
  const difficultySection = difficulty ? `\nDifficulty: ${difficulty}` : "";

  return `Provide a comprehensive, educational explanation for this quiz question.

Question: ${question}${optionsSection}
Correct Answer: ${correctAnswer}
Question Type: ${questionType}${studentSection}${topicSection}${difficultySection}

INSTRUCTIONS:
- Provide a clear, thorough explanation of WHY the correct answer is right.
- Break down the key concepts involved in understanding this question.
- For MCQ: explain why EACH incorrect option is wrong (be specific).
- For Subjective: explain the key points that make a complete answer.
- If a student answer is provided, explain what they got right/wrong.
- Suggest related topics the student should study to master this concept.
- Provide a memory tip or mnemonic to help remember the concept.
- Explain why this question has its assigned difficulty level.
- Detect the question language and respond in the SAME language.

Return ONLY valid JSON:
{
  "explanation": "string — comprehensive explanation of the answer",
  "conceptBreakdown": ["string"] — list of 2-5 key concepts tested by this question,
  "whyCorrect": "string — detailed reasoning why the correct answer is right",
  "whyOthersWrong": ["string"] — for MCQ: why each wrong option is incorrect (one string per wrong option). For subjective: common misconceptions,
  "relatedTopics": ["string"] — 2-4 related topics to study further,
  "difficulty": "string — explanation of why this question is easy/medium/hard",
  "memoryTip": "string — a helpful mnemonic, tip, or trick to remember this concept"
}`;
}

/**
 * Builds prompt for generating progressive hints for a question.
 * Each subsequent hint reveals more but NEVER gives the answer directly.
 */
export function buildHintPrompt(
  question: string,
  correctAnswer: string,
  questionType: string,
  options?: string[],
  topic?: string,
  difficulty?: string,
  hintNumber: number = 1,
  previousHints: string[] = []
): string {
  const optionsSection = options && options.length > 0
    ? `\nOptions:\n${options.map((o, i) => `  ${String.fromCharCode(65 + i)}. ${o}`).join("\n")}`
    : "";
  const topicSection = topic ? `\nTopic: ${topic}` : "";
  const difficultySection = difficulty ? `\nDifficulty: ${difficulty}` : "";
  const prevHintsSection = previousHints.length > 0
    ? `\nPrevious hints already given (DO NOT repeat these):\n${previousHints.map((h, i) => `  Hint ${i + 1}: ${h}`).join("\n")}`
    : "";

  return `Generate hint #${hintNumber} for this quiz question. The student is stuck and needs help.

Question: ${question}${optionsSection}
Correct Answer (HIDDEN from student — DO NOT reveal): ${correctAnswer}
Question Type: ${questionType}${topicSection}${difficultySection}${prevHintsSection}

HINT LEVEL RULES:
- Hint 1: Very subtle — point the student toward the right topic/concept area. Be vague.
- Hint 2: Moderate — narrow down the possibilities. For MCQ: eliminate 1 wrong option. For subjective: mention a key concept.
- Hint 3: Strong — give a significant clue. For MCQ: eliminate 2 wrong options. For subjective: outline the main points needed.
- Hint 4+: Very strong — almost give it away but still don't state the answer directly.

CRITICAL RULES:
- NEVER state the correct answer directly.
- NEVER say "The answer is..." or "The correct option is..."
- Each hint must be NEW information — do not repeat previous hints.
- Keep hints concise (1-2 sentences max).
- Detect the question language and respond in the SAME language.

This is hint #${hintNumber}. Generate at the appropriate level.

Return ONLY valid JSON:
{
  "hint": "string — the hint text",
  "hintLevel": ${hintNumber}
}`;
}
