// Server-side temp bot key — not exposed to client
// Store in Vercel env TEMP_BOT_API_KEY if you want to override without redeploy
export const TEMP_BOT_API_KEY =
  process.env.TEMP_BOT_API_KEY || "rply_live_d3865c9877e364ee04d694b405cac87ec7e43630d179e6d3";

export const TEMP_BOT_BASE = process.env.NEXT_PUBLIC_APP_URL || "https://repllyer.vercel.app";
