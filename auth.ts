// Google sign-in (Auth.js). Only the address(es) in ALLOWED_EMAIL get in; everyone else is
// turned away at Google's callback. Sessions are signed, encrypted cookies (no database table).
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isAllowedEmail } from "@/lib/auth-config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/signin", error: "/signin" },
  // Behind Vercel's or Tailscale's proxy, the request host is the public one.
  trustHost: true,
  callbacks: {
    signIn({ account, profile }) {
      return account?.provider === "google" && profile?.email_verified === true && isAllowedEmail(profile.email);
    },
  },
});
