import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { logLogin } from "@/lib/memoryDB";

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
      try {
        await logLogin({
          email: user.email || "unknown",
          name: user.name || "unknown",
          image: user.image || undefined,
          provider: account?.provider || "unknown",
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
