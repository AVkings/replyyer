// Repllyer widget.js — drop in any site
// <script src="https://replyyer.vercel.app/widget.js" data-org="ORG_ID" data-api-key="API_KEY" data-title="Support"></script>
(function() {
  const script = document.currentScript;
  if (!script) return;
  const org = script.getAttribute("data-org") || script.getAttribute("data-organization-id");
  const apiKey = script.getAttribute("data-api-key") || script.getAttribute("data-apikey");
  const title = script.getAttribute("data-title") || "Repllyer Support";
  if (!org) { console.warn("[Repllyer] data-org missing"); return; }
  const src = "https://replyyer.vercel.app/embed/" + encodeURIComponent(org) + (apiKey ? "?api_key=" + encodeURIComponent(apiKey) : "");
  const iframe = document.createElement("iframe");
  iframe.src = src;
  iframe.width = "400";
  iframe.height = "560";
  iframe.style.border = "0";
  iframe.style.borderRadius = "28px";
  iframe.style.overflow = "hidden";
  iframe.style.position = "fixed";
  iframe.style.bottom = "20px";
  iframe.style.right = "20px";
  iframe.style.zIndex = "9999";
  iframe.style.boxShadow = "0 20px 60px rgba(0,0,0,0.5)";
  iframe.allow = "clipboard-read; clipboard-write";
  document.body.appendChild(iframe);
  console.log("[Repllyer] widget injected for", org);
})();
