# Repllyer — Vercel CLI Deployment Guide

Deploy **Repllyer** (Next.js 16 App Router) to Vercel via CLI — no GitHub auto-deploy needed. Covers install, login, env vars, deploy, and troubleshooting for `AVkings/replyyer`.

---

## 1. Install Vercel CLI

**Global (recommended):**
```bash
npm install -g vercel
vercel --version  # check >= 35.x
```

**Or per-project:**
```bash
npm install -D vercel
npx vercel --version
```

**Update:**
```bash
npm update -g vercel
```

---

## 2. Login & Deploy

### A. Login (once)
```bash
vercel login
# Opens browser → Login with GitHub (AVkings) → Authorize
# Verify:
vercel whoami
# Should show AVkings
```

### B. Link Project (first time in `E:\repllyer`)
```bash
cd E:\repllyer
vercel link
# ? Set up and deploy “E:\repllyer”? [Y/n] Y
# ? Which scope should contain your project? AVkings
# ? Link to existing project? Y
# ? What’s the name of your existing project? replyyer
# (or N to create new: repllyer/replyyer)
# Creates .vercel/project.json (gitignored)
```

### C. Deploy
```bash
# Preview deploy (unique URL: replyyer-xxx-avkings.vercel.app)
vercel

# Production deploy (replyyer.vercel.app + custom domain)
vercel --prod

# Skip prompts, force production:
vercel --prod --yes

# Specify build output (not needed, Vercel runs `npm run build` automatically):
# vercel --prod --build-env NEXT_PUBLIC_APP_URL=https://replyyer.vercel.app
```

**After deploy:** Vercel outputs `✅ Production: https://replyyer.vercel.app` — open it.

**Pull deployed envs locally (optional):**
```bash
vercel pull --yes --environment production
# Creates .vercel/.env.*.local
```

---

## 3. Add Environment Variables (Required)

All vars from `.env.example` / `.env.local` must be in Vercel. `.env.local` is gitignored → Vercel never sees it.

### Required vars for Repllyer
| Variable | Value | Encrypted? |
|----------|-------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://evytmgnrrumlstuymiue.supabase.co` | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_YKKoDBTzpnQEGdrssQQ-dQ_8BFczQqM` | No |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbG...` (from Supabase Dashboard → API → service_role) | **Yes** |
| `KIRA_API_KEY` | `kira_b5f025e2cbfca91514aeb0eeabc99e71` | **Yes** |
| `KIRA_BASE_URL` | `https://kiraai.vn/api/v1` | No |
| `KIRA_MODEL` | `hy3` | No |
| `GOFILE_API_TOKEN` | `zgtXMeKR7XbLBIIdizoHdUg4EtMDWFKY` | **Yes** |
| `GOFILE_FOLDER_ID` | `ea98413c-c5e6-424d-aba6-9f5fea215fca` | No |
| `NEXT_PUBLIC_APP_URL` | `https://replyyer.vercel.app` (or custom domain; was `https://repllyer.pages.dev` for Pages) | No |

### Add via CLI (one by one — interactive)
```bash
# Production + Preview + Development (all envs):
vercel env add NEXT_PUBLIC_SUPABASE_URL
# Paste: https://evytmgnrrumlstuymiue.supabase.co
# ? Which Environments? → Production, Preview, Development (space to select, enter)

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add KIRA_API_KEY
vercel env add KIRA_BASE_URL
vercel env add KIRA_MODEL
vercel env add GOFILE_API_TOKEN
vercel env add GOFILE_FOLDER_ID
vercel env add NEXT_PUBLIC_APP_URL
```

**Batch add from .env.local:**
```bash
# Pull .env.local into Vercel (creates from local file):
vercel env pull .env.local --environment production --yes
# Or add via stdin (PowerShell):
Get-Content .env.local | ForEach-Object {
  if ($_ -match '^([^#=]+)=(.+)$') {
    $key=$matches[1]; $val=$matches[2]
    Write-Host "Adding $key"
    echo $val | vercel env add $key --force
  }
}
```

### Manage vars
```bash
vercel env ls                    # list
vercel env pull .env.local       # pull from cloud to local
vercel env rm NEXT_PUBLIC_APP_URL --yes  # remove
vercel env add NEXT_PUBLIC_APP_URL --force  # re-add
```

### Important:
- `NEXT_PUBLIC_*` are exposed to browser → **Do not** put secrets there.
- Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `KIRA_API_KEY`, `GOFILE_API_TOKEN`) must be **Encrypted** in Vercel Dashboard → Settings → Environment Variables → Add → Sensitive.
- After adding/changing vars, **redeploy**: `vercel --prod --force` or Dashboard → Deployments → Redeploy.

---

## 4. Troubleshooting

| Error | Fix |
|-------|-----|
| `Error: ENOENT: open '/vercel/path0/.next/next-server.js.nft.json'` | You have `output: 'standalone'` in `next.config.mjs`. **Remove it for Vercel** (Vercel handles tracing). Your `next.config.mjs` is already fixed: `const nextConfig = {};` — keep it. |
| `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.` | Non-blocking warning (Next 16). Your `src/middleware.ts` still works as `Proxy`. To silence: `npx @next/codemod@canary middleware-to-proxy .` → renames to `src/proxy.ts` (don't keep both). |
| `Failed to fetch` CORS from `file://` | Your `src/app/api/chat/route.ts` & `upload/route.ts` already have `Access-Control-Allow-Origin: *` + `OPTIONS 204`. If still blocked, check Vercel env `NEXT_PUBLIC_APP_URL` matches your deployed URL, and your HTML uses `https://replyyer.vercel.app/api/chat` (not localhost). |
| `Unauthorized` / Supabase 401 | Check `NEXT_PUBLIC_SUPABASE_URL` + `ANON_KEY` are set in Vercel (not just `.env.local`). `vercel env ls` → should show. Pull: `vercel env pull`. |
| `Worker exceeded 3 MiB` | You deployed Workers (`opennextjs-cloudflare`) to Pages — wrong target. For Vercel, just `vercel --prod` (no `wrangler`, no `open-next`). Delete `.open-next/`, `.vercel/output` if confused. |
| `Must specify directory` / `does not support "assets"` with `wrangler` | You're mixing Cloudflare Pages (`wrangler pages deploy`) with Vercel. For Vercel, **don't use `wrangler`** at all. Delete `wrangler.toml`, use `vercel` only. |
| `vercel login` opens wrong account | `vercel logout` → `vercel login` → choose correct GitHub scope `AVkings`. Check `vercel whoami`. |
| `Project not found` | `vercel link` → choose existing `replyyer`, or `vercel --prod` will prompt to create. Ensure `APkings/replyyer` exists on GitHub (pushed `main` at `ab729e6`+). |
| `.env.local` not on Vercel | Expected — `.env.local` is gitignored. **Must add vars via `vercel env add` or Dashboard** → Settings → Environment Variables. |
| Build slow / hangs on Windows | Next `opennextjs-cloudflare build` is slow on Windows (40s). For Vercel, just `npm run build` locally is 5s; Vercel builds remotely (faster). Use `vercel --prod` which builds on Vercel, not locally. |
| `.vercel` folder committed | `.gitignore` already has `.vercel` (line 42). If you see it in `git status`, run `git rm -r --cached .vercel` |

### Quick reset
```bash
# Clean + rebuild
Remove-Item -Recurse -Force .next, .vercel, .open-next -ErrorAction SilentlyContinue
npm run build
vercel --prod --force
```

### Useful commands
```bash
vercel logs replyyer.vercel.app          # tail logs
vercel ls                                # list deployments
vercel inspect replyyer.vercel.app --logs
vercel domains ls
vercel --help
```

---

**Current repo:** `https://github.com/AVkings/replyyer` (`main` @ `40df6e7` + CORS + Vercel clean) — ready for `vercel --prod`.
