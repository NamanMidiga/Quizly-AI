export { auth as middleware } from "@/auth";

export const config = {
  // Protect everything except login page, API auth routes, static files, and images
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
