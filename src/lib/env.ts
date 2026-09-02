/**
 * Env validation — fail fast on boot if required vars are missing.
 * Call `validateEnv()` in instrumentation or top of server entry if desired.
 */

export function validateEnv() {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "KIRA_API_KEY",
    "GOFILE_API_TOKEN",
  ] as const;

  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `[env] Missing required environment variables: ${missing.join(", ")}. ` +
        "Check your .env.local against .env.example"
    );
  }
}
