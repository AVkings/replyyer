// Standalone client test — run with `node scripts/test-client.js`
// Base URL as requested: https://repllyer.vercel.app
// No email needed — guest session

const BASE = "https://repllyer.vercel.app";
const API_KEY = process.env.RPLY_KEY || "rply_live_replace_with_yours";

async function main() {
  console.log("Testing Repllyer API at", BASE);

  // 1. Init session as guest (no name/email)
  console.log("\n1. POST /api/v1/session/init (guest)...");
  const initRes = await fetch(`${BASE}/api/v1/session/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({}), // empty = guest, bot will ask for email if needed
  });
  const initData = await initRes.json();
  console.log("Status:", initRes.status, initData);
  if (!initRes.ok) {
    console.error("Init failed — check API key and credits");
    return;
  }

  const sessionId = initData.session_id;

  // 2. Chat — urgent case should be prioritized
  console.log("\n2. POST /api/v1/chat (refund not received)...");
  const chatRes = await fetch(`${BASE}/api/v1/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ session_id: sessionId, message: "refund not received, payment deducted but order not confirmed?" }),
  });
  const chatData = await chatRes.json();
  console.log("Status:", chatRes.status, chatData);

  // 3. Chat with email retrieval
  console.log("\n3. POST /api/v1/chat (providing email)...");
  const chat2Res = await fetch(`${BASE}/api/v1/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ session_id: sessionId, message: "my email is test@example.com and name is Aarav" }),
  });
  const chat2Data = await chat2Res.json();
  console.log("Status:", chat2Res.status, chat2Data);

  console.log("\nDone. Check dashboard CRM for human ticket if status=human_required");
}

main().catch(console.error);
