import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  debug: process.env.NODE_ENV === "development",
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      // Log login via API route (avoids Edge Runtime issues with MongoDB)
      try {
        const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
        await fetch(`${baseUrl}/api/auth/logs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: user.email || "unknown",
            name: user.name || "unknown",
            image: user.image || undefined,
            provider: account?.provider || "unknown",
          }),
        });
      } catch (err) {
        console.error("[Quizly AI] Failed to log login:", err);
      }
      return true;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith("/login");

      if (isOnLogin) {
        // If already logged in, redirect to home
        if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
        return true; // allow access to login page
      }

      // For all other pages, require login
      return isLoggedIn;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
