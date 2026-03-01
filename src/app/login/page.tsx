"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <>
      {/* Fluid background (same as home) */}
      <div className="fluid-background">
        <div className="gradient-layer" />
        <svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <filter id="canvasNoise">
            <feTurbulence type="fractalNoise" baseFrequency="0.0015" numOctaves="3" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#canvasNoise)" />
          <path fill="#0d1025">
            <animate
              attributeName="d"
              dur="20s"
              repeatCount="indefinite"
              values="M0,500 C200,300 400,700 600,500 C800,300 1000,700 1000,500 L1000,1000 L0,1000 Z;M0,500 C200,700 400,300 600,500 C800,700 1000,300 1000,500 L1000,1000 L0,1000 Z;M0,500 C200,300 400,700 600,500 C800,300 1000,700 1000,500 L1000,1000 L0,1000 Z"
            />
          </path>
        </svg>
      </div>

      {/* Login card */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
        }}
      >
        <div
          style={{
            background: "rgba(20, 20, 50, 0.55)",
            backdropFilter: "blur(40px)",
            WebkitBackdropFilter: "blur(40px)",
            border: "1px solid rgba(100, 140, 255, 0.12)",
            borderRadius: 32,
            padding: "60px 50px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            maxWidth: 420,
            width: "90vw",
            boxShadow: "0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(100,140,255,0.08)",
          }}
        >
          {/* Logo */}
          <h1
            style={{
              fontSize: "2.2rem",
              fontWeight: 800,
              letterSpacing: "0.18em",
              background: "linear-gradient(135deg, #e0e7ff 0%, #6488ff 50%, #a78bfa 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginBottom: 0,
            }}
          >
            QUIZLY AI
          </h1>
          <div
            style={{
              fontSize: "0.6rem",
              letterSpacing: "0.35em",
              color: "rgba(100, 140, 255, 0.35)",
              fontWeight: 700,
              marginBottom: 30,
            }}
          >
            BYTE BUSTERS
          </div>

          <p
            style={{
              color: "rgba(180, 200, 255, 0.6)",
              fontSize: "0.85rem",
              letterSpacing: "0.05em",
              marginBottom: 30,
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            Sign in to start generating AI-powered quizzes
          </p>

          {error && (
            <div
              style={{
                padding: "10px 20px",
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 12,
                color: "#ef4444",
                fontSize: "0.75rem",
                marginBottom: 15,
                width: "100%",
                textAlign: "center",
              }}
            >
              {error === "OAuthAccountNotLinked"
                ? "This email is already associated with another sign-in method."
                : "Authentication failed. Please try again."}
            </div>
          )}

          {/* Google Sign In Button */}
          <button
            onClick={() => signIn("google", { callbackUrl: "/" })}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              width: "100%",
              padding: "14px 24px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 16,
              color: "#e0e7ff",
              fontSize: "0.85rem",
              fontWeight: 600,
              fontFamily: "Montserrat, sans-serif",
              letterSpacing: "0.08em",
              cursor: "pointer",
              transition: "all 0.3s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(100,140,255,0.12)";
              e.currentTarget.style.borderColor = "rgba(100,140,255,0.3)";
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 8px 30px rgba(100,140,255,0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            Continue with Google
          </button>

          <p
            style={{
              marginTop: 30,
              fontSize: "0.6rem",
              color: "rgba(100,130,255,0.25)",
              letterSpacing: "0.1em",
              textAlign: "center",
            }}
          >
            Powered by Groq LLaMA 3.3 70B
          </p>
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#050510" }}>
          <div className="loading-spinner" style={{ width: 40, height: 40 }} />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
