"use client";

import { useState, useRef, useEffect, useCallback } from "react";

/* ─── Web Speech API type shim ─── */
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    onend: (() => void) | null;
  }
  interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
  }
  interface SpeechRecognitionResultList {
    readonly length: number;
    [index: number]: SpeechRecognitionResult;
  }
  interface SpeechRecognitionResult {
    readonly length: number;
    [index: number]: SpeechRecognitionAlternative;
  }
  interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
  }
}

/* ─── Types mirroring backend schemas ─── */
interface Question {
  id: number;
  type: "mcq" | "subjective";
  question: string;
  options?: string[];
  correctAnswer: string;
  difficulty: "easy" | "medium" | "hard";
  marks: number;
  negativeMark?: number;
  explanation?: string;
  topic?: string;
  expectedLength?: "short" | "medium" | "long";
  keywords?: string[];
  sampleAnswer?: string;
}

interface Quiz {
  title: string;
  description: string;
  questions: Question[];
  totalMarks: number;
  timeMinutes: number;
  language: string;
  examPattern?: string;
}

interface GradedAnswer {
  questionId: number;
  isCorrect: boolean;
  marksAwarded: number;
  feedback: string;
  rubric?: string;
  keywordsFound?: string[];
  keywordsMissed?: string[];
  qualityScore?: number;
  strengths?: string;
  improvements?: string;
}

interface GradeResult {
  results: GradedAnswer[];
  totalScore: number;
  maxScore: number;
  percentage: number;
  summary: string;
}

interface StoredQuiz {
  id: string;
  quiz: Quiz;
  createdAt: string;
  attempts: unknown[];
}

interface ExplanationResult {
  explanation: string;
  conceptBreakdown?: string[];
  whyCorrect?: string;
  whyOthersWrong?: string[];
  relatedTopics?: string[];
  memoryTip?: string;
}

/* ─── View states ─── */
type View = "home" | "loading" | "quiz" | "grading" | "results" | "analytics";

export default function Home() {
  /* ─── State ─── */
  const [view, setView] = useState<View>("home");
  const [inputValue, setInputValue] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Quiz generation options
  const [mode, setMode] = useState<"normal" | "test">("normal");

  // Quiz data
  const [quizId, setQuizId] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  // Grade / Results
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);

  // History
  const [quizHistory, setQuizHistory] = useState<StoredQuiz[]>([]);

  // Explanation
  const [explanationLoading, setExplanationLoading] = useState<number | null>(null);
  const [explanations, setExplanations] = useState<Record<number, ExplanationResult>>({});

  // Hints (test mode only)
  const [hints, setHints] = useState<Record<number, string[]>>({}); // questionId -> array of hint strings
  const [hintLoading, setHintLoading] = useState<number | null>(null);

  // File upload
  const [uploadedContent, setUploadedContent] = useState<string | null>(null);
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Error
  const [error, setError] = useState<string | null>(null);

  // Timer
  const [timeLeft, setTimeLeft] = useState<number>(0); // seconds remaining
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Speech recognition
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  /* ─── Load quiz history on mount ─── */
  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/quiz/list");
      if (res.ok) {
        const data = await res.json();
        setQuizHistory(data);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  /* ─── Timer ─── */
  const startTimer = useCallback((minutes: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(minutes * 60);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Auto-submit when timer runs out
  useEffect(() => {
    if (timeLeft === 0 && view === "quiz" && quiz) {
      submitQuiz();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  /* ─── Speech Recognition ─── */
  const toggleListening = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      setError("Speech recognition not supported in this browser.");
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setInputValue((prev) => (prev ? prev + " " + transcript : transcript));
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  /* ─── File Upload ─── */
  const handleFileUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setUploadedContent(data.text);
        setUploadedFilename(data.filename);
        setError(null);
      } else {
        setError(data.error || "Upload failed");
      }
    } catch {
      setError("Upload failed. Please try again.");
    }
  };

  /* ─── Generate Quiz ─── */
  const generateQuiz = async () => {
    const prompt = inputValue.trim();
    if (!prompt && !uploadedContent) {
      setError("Please enter a topic or upload content first.");
      return;
    }

    setView("loading");
    setError(null);

    // Normal mode: quick casual quiz (MCQ only, 5 questions, no negative marking, no strict timer)
    // Test mode: full exam simulation (mixed MCQ + subjective, 15 questions, negative marking, strict timer)
    const isTest = mode === "test";
    const numQuestions = isTest ? 15 : 5;
    const questionTypes: ("mcq" | "subjective")[] = isTest ? ["mcq", "subjective"] : ["mcq"];

    try {
      const res = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt || undefined,
          content: uploadedContent || undefined,
          numQuestions,
          questionTypes,
          difficulty: isTest ? "mixed" : "easy",
          timeMinutes: isTest ? 30 : 10,
          negativeMark: isTest ? 0.25 : 0,
          examPattern: isTest ? "exam" : undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setQuizId(data.quizId);
        setQuiz(data.quiz);
        setAnswers({});
        setGradeResult(null);
        setExplanations({});
        setHints({});
        setView("quiz");
        startTimer(data.quiz.timeMinutes || (isTest ? 30 : 10));
        setInputValue("");
        setUploadedContent(null);
        setUploadedFilename(null);
        loadHistory();
      } else {
        setError(data.error || data.message || "Quiz generation failed");
        setView("home");
      }
    } catch {
      setError("Network error. Please try again.");
      setView("home");
    }
  };

  /* ─── Submit Quiz ─── */
  const submitQuiz = async () => {
    if (!quizId || !quiz) return;

    stopTimer();
    setView("grading");
    setError(null);

    const answerPayload = quiz.questions.map((q) => ({
      questionId: q.id,
      answer: answers[q.id] || "",
      hintsUsed: (hints[q.id] || []).length,
    }));

    try {
      const res = await fetch("/api/quiz/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId, answers: answerPayload }),
      });

      const data = await res.json();

      if (res.ok) {
        setGradeResult(data);
        setView("results");
        loadHistory();
      } else {
        setError(data.error || "Grading failed");
        setView("quiz");
      }
    } catch {
      setError("Network error during grading.");
      setView("quiz");
    }
  };

  /* ─── Explain Question ─── */
  const explainQuestion = async (questionId: number) => {
    if (!quizId || explanations[questionId]) return;

    setExplanationLoading(questionId);

    try {
      const res = await fetch("/api/quiz/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId,
          questionId,
          studentAnswer: answers[questionId] || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setExplanations((prev) => ({ ...prev, [questionId]: data }));
      }
    } catch {
      // silently fail
    } finally {
      setExplanationLoading(null);
    }
  };

  /* ─── Request Hint (Test mode) ─── */
  const requestHint = async (questionId: number, maxMarks: number) => {
    if (!quizId) return;
    const currentHints = hints[questionId] || [];
    // Can't take more hints than marks - 1
    if (currentHints.length >= maxMarks - 1) return;

    setHintLoading(questionId);

    try {
      const res = await fetch("/api/quiz/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId,
          questionId,
          hintNumber: currentHints.length + 1,
          previousHints: currentHints,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setHints((prev) => ({
          ...prev,
          [questionId]: [...(prev[questionId] || []), data.hint],
        }));
      }
    } catch {
      // silently fail
    } finally {
      setHintLoading(null);
    }
  };

  /* ─── Load a past quiz ─── */
  const loadQuiz = (stored: StoredQuiz) => {
    setQuizId(stored.id);
    setQuiz(stored.quiz);
    setAnswers({});
    setGradeResult(null);
    setExplanations({});
    setHints({});
    startTimer(stored.quiz.timeMinutes || 10);
    setView("quiz");
    setSidebarOpen(false);
  };

  /* ─── Handle Enter key ─── */
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && inputValue.trim()) {
      generateQuiz();
    }
  };

  /* ─── Answer helpers ─── */
  const setAnswer = (questionId: number, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const answeredCount = quiz ? quiz.questions.filter((q) => answers[q.id]?.trim()).length : 0;

  /* ─── Render helpers ─── */

  const renderHome = () => (
    <>
      {/* Nav buttons */}
      <button className="nav-btn btn-menu" aria-label="Menu" onClick={() => setSidebarOpen(true)}>
        <i className="fa-solid fa-bars" />
      </button>
      <button className="nav-btn btn-profile" aria-label="Profile">
        <i className="fa-solid fa-user" />
      </button>

      {/* Glass Card */}
      <div className="glass-card">
        <h1 className="title-glow">QUIZLY AI</h1>
        <div className="subtitle">BYTE BUSTERS</div>

        {/* Upload indicator */}
        {uploadedFilename && (
          <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 8 }}>
            <i className="fa-solid fa-file" style={{ color: "#888" }} />
            <span style={{ color: "#aaa", fontSize: "0.8rem" }}>{uploadedFilename}</span>
            <button
              onClick={() => { setUploadedContent(null); setUploadedFilename(null); }}
              style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: "0.8rem" }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div style={{ marginTop: 15, padding: "10px 20px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, color: "#ef4444", fontSize: "0.8rem", maxWidth: 500 }}>
            {error}
          </div>
        )}

        {/* Input Bar */}
        <div className="input-bar">
          <div
            className="plus-btn"
            title="Upload File"
            onClick={() => fileInputRef.current?.click()}
          >
            <i className="fa-solid fa-plus" />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
          />
          <input
            type="text"
            className="input-field"
            placeholder={isListening ? "Listening..." : "Ask Quizly anything..."}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
          />

          <div className="input-controls">
            <div className="mode-toggle" onClick={() => setMode(mode === "normal" ? "test" : "normal")}>
              <div className={`mode-toggle-slider ${mode === "test" ? "active" : ""}`} />
              <span className={`mode-label ${mode === "normal" ? "selected" : ""}`}>NORMAL</span>
              <span className={`mode-label ${mode === "test" ? "selected" : ""}`}>TEST</span>
            </div>

            <div
              className={`soundwave ${isListening ? "active" : ""}`}
              onClick={toggleListening}
              title="Click to speak"
            >
              <span /><span /><span /><span /><span />
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const renderLoading = () => (
    <div className="glass-card" style={{ justifyContent: "center", alignItems: "center", gap: 20 }}>
      <div className="loading-spinner" style={{ width: 40, height: 40 }} />
      <p style={{ color: "#888", fontSize: "0.9rem", letterSpacing: 2 }}>GENERATING QUIZ...</p>
      <p style={{ color: "#555", fontSize: "0.7rem" }}>Powered by Groq LLaMA 3.3 70B</p>
    </div>
  );

  const renderQuiz = () => {
    if (!quiz) return null;
    const isUrgent = timeLeft > 0 && timeLeft <= 60;
    return (
      <div className="quiz-fullscreen">
        {/* Top bar with timer */}
        <div className="quiz-topbar">
          <button className="btn-close-inline" onClick={() => { stopTimer(); setView("home"); }}>
            <i className="fa-solid fa-xmark" />
          </button>
          <div className="quiz-topbar-info">
            <span style={{ fontSize: "0.75rem", color: "#888" }}>
              {answeredCount}/{quiz.questions.length} answered
            </span>
            <span style={{ fontSize: "0.7rem", color: "#555" }}>&bull;</span>
            <span style={{ fontSize: "0.75rem", color: "#888" }}>{quiz.totalMarks} marks</span>
          </div>
          <div className={`quiz-timer ${isUrgent ? "urgent" : ""}`}>
            <i className="fa-solid fa-clock" style={{ fontSize: "0.7rem" }} />
            {formatTime(timeLeft)}
          </div>
        </div>

        {/* Quiz title */}
        <div style={{ padding: "0 40px", marginBottom: 20 }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fdfaf0" }}>{quiz.title}</h2>
          <p style={{ fontSize: "0.7rem", color: "#555", marginTop: 4, letterSpacing: 1 }}>
            {quiz.description} {mode === "test" && " • TEST MODE"}
          </p>
        </div>

        {/* Scrollable questions */}
        <div className="quiz-scroll">
          {quiz.questions.map((q, idx) => {
            const questionHints = hints[q.id] || [];
            const hintsCount = questionHints.length;
            const effectiveMax = Math.max(1, q.marks - hintsCount);
            const canGetMoreHints = mode === "test" && hintsCount < q.marks - 1;

            return (
            <div className="quiz-question" key={q.id}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: "0.65rem", color: "#666" }}>
                  Q{idx + 1} &bull; {q.marks} marks
                  {hintsCount > 0 && (
                    <span style={{ color: "rgba(253,250,240,0.5)" }}> (max {effectiveMax} after {hintsCount} hint{hintsCount > 1 ? "s" : ""})</span>
                  )}
                </span>
                <span className={`badge-${q.difficulty}`}>{q.difficulty.toUpperCase()}</span>
              </div>
              <h3>{q.question}</h3>

              {q.type === "mcq" && q.options ? (
                q.options.map((opt, oi) => (
                  <div
                    key={oi}
                    className={`quiz-option ${answers[q.id] === opt ? "selected" : ""}`}
                    onClick={() => setAnswer(q.id, opt)}
                  >
                    <span style={{ width: 20, height: 20, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", flexShrink: 0 }}>
                      {String.fromCharCode(65 + oi)}
                    </span>
                    {opt}
                  </div>
                ))
              ) : (
                <textarea
                  className="subjective-input"
                  placeholder={`Write your answer here... (${q.expectedLength || "any"} length expected)`}
                  value={answers[q.id] || ""}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                />
              )}

              {/* Hints display */}
              {questionHints.length > 0 && (
                <div className="hints-container">
                  {questionHints.map((hint, hi) => (
                    <div key={hi} className="hint-bubble">
                      <i className="fa-solid fa-lightbulb hint-icon" />
                      <span>{hint}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Hint button (test mode only) */}
              {mode === "test" && (
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    className="btn-hint"
                    onClick={() => requestHint(q.id, q.marks)}
                    disabled={!canGetMoreHints || hintLoading === q.id}
                  >
                    {hintLoading === q.id ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span className="loading-spinner" /> Loading...
                      </span>
                    ) : (
                      <>
                        <i className="fa-solid fa-lightbulb" />
                        {canGetMoreHints
                          ? `HINT (-1 mark)`
                          : `NO MORE HINTS`}
                      </>
                    )}
                  </button>
                  {hintsCount > 0 && (
                    <span style={{ fontSize: "0.6rem", color: "#666" }}>
                      {hintsCount} used &bull; max marks: {effectiveMax}/{q.marks}
                    </span>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>

        {/* Bottom submit bar */}
        <div className="quiz-bottombar">
          <button className="btn-primary" onClick={submitQuiz}>
            SUBMIT QUIZ
          </button>
        </div>
      </div>
    );
  };

  const renderGrading = () => (
    <div className="quiz-overlay">
      <div className="quiz-panel" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
        <div className="loading-spinner" style={{ width: 40, height: 40 }} />
        <p style={{ color: "#888", fontSize: "0.9rem", letterSpacing: 2, marginTop: 20 }}>GRADING...</p>
      </div>
    </div>
  );

  const renderResults = () => {
    if (!gradeResult || !quiz) return null;
    return (
      <div className="quiz-overlay">
        <div className="quiz-panel">
          <button className="btn-close" onClick={() => setView("home")}>
            <i className="fa-solid fa-xmark" />
          </button>

          {/* Score header */}
          <div className="grade-result">
            <div className="grade-score">
              {gradeResult.totalScore} / {gradeResult.maxScore}
            </div>
            <div className="grade-percentage">{gradeResult.percentage.toFixed(1)}%</div>
            <p style={{ color: "#888", fontSize: "0.8rem", marginTop: 10, lineHeight: 1.6 }}>{gradeResult.summary}</p>
          </div>

          {/* Per-question feedback */}
          {gradeResult.results.map((r) => {
            const q = quiz.questions.find((qq) => qq.id === r.questionId);
            if (!q) return null;
            const expl = explanations[q.id];
            return (
              <div key={r.questionId} className={`feedback-item ${r.isCorrect ? "feedback-correct" : "feedback-incorrect"}`}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: "0.75rem", color: r.isCorrect ? "#22c55e" : "#ef4444", fontWeight: 700 }}>
                    {r.isCorrect ? "✓ Correct" : "✗ Incorrect"} — {r.marksAwarded} marks
                  </span>
                  <span className={`badge-${q.difficulty}`}>{q.difficulty}</span>
                </div>
                <p style={{ fontSize: "0.85rem", color: "#ddd", marginBottom: 8, lineHeight: 1.5 }}>{q.question}</p>
                <p style={{ fontSize: "0.75rem", color: "#aaa", lineHeight: 1.5 }}>{r.feedback}</p>

                {r.strengths && (
                  <p style={{ fontSize: "0.7rem", color: "#22c55e", marginTop: 5 }}>
                    <strong>Strengths:</strong> {r.strengths}
                  </p>
                )}
                {r.improvements && (
                  <p style={{ fontSize: "0.7rem", color: "rgba(253,250,240,0.6)", marginTop: 3 }}>
                    <strong>Improve:</strong> {r.improvements}
                  </p>
                )}

                {/* Explain button */}
                {!expl && (
                  <button
                    className="btn-secondary"
                    style={{ marginTop: 10 }}
                    onClick={() => explainQuestion(q.id)}
                    disabled={explanationLoading === q.id}
                  >
                    {explanationLoading === q.id ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="loading-spinner" /> Explaining...
                      </span>
                    ) : (
                      "EXPLAIN"
                    )}
                  </button>
                )}

                {/* Explanation display */}
                {expl && (
                  <div style={{ marginTop: 12, padding: 15, background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p style={{ fontSize: "0.8rem", color: "#ddd", lineHeight: 1.7 }}>{expl.explanation}</p>
                    {expl.whyCorrect && (
                      <p style={{ fontSize: "0.7rem", color: "#22c55e", marginTop: 8 }}>
                        <strong>Why correct:</strong> {expl.whyCorrect}
                      </p>
                    )}
                    {expl.memoryTip && (
                      <p style={{ fontSize: "0.7rem", color: "rgba(253,250,240,0.6)", marginTop: 5 }}>
                        <strong>💡 Tip:</strong> {expl.memoryTip}
                      </p>
                    )}
                    {expl.relatedTopics && expl.relatedTopics.length > 0 && (
                      <p style={{ fontSize: "0.65rem", color: "#666", marginTop: 5 }}>
                        Related: {expl.relatedTopics.join(", ")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ display: "flex", justifyContent: "center", gap: 15, marginTop: 25 }}>
            <button className="btn-secondary" onClick={() => setView("home")}>
              NEW QUIZ
            </button>
            <button className="btn-primary" onClick={() => {
              // Re-take same quiz
              if (quiz) {
                setAnswers({});
                setGradeResult(null);
                setExplanations({});
                setHints({});
                startTimer(quiz.timeMinutes || 10);
                setView("quiz");
              }
            }}>
              RETRY
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderSidebar = () => (
    <>
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <div className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <h2>Quiz History</h2>
        {quizHistory.length === 0 ? (
          <p style={{ color: "#555", fontSize: "0.75rem" }}>No quizzes yet. Generate one!</p>
        ) : (
          quizHistory.map((sq) => (
            <div key={sq.id} className="quiz-history-item" onClick={() => loadQuiz(sq)}>
              <div className="title">{sq.quiz.title}</div>
              <div className="meta">
                {sq.quiz.questions.length} questions &bull; {sq.quiz.totalMarks} marks &bull;{" "}
                {new Date(sq.createdAt).toLocaleDateString()}
                {sq.attempts.length > 0 && ` • ${sq.attempts.length} attempt(s)`}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );

  /* ─── Main Render ─── */
  return (
    <>
      {renderSidebar()}
      {view === "home" && renderHome()}
      {view === "loading" && renderLoading()}
      {view === "quiz" && renderQuiz()}
      {view === "grading" && renderGrading()}
      {view === "results" && renderResults()}
    </>
  );
}
