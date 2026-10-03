// Load .env.local for CLI scripts (Next.js loads it on its own for the app).
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local; defaults apply.
}
