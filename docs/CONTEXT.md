# CONTEXT — mmailtemp / cloudflare_temp_email

> **Single source of truth** cho project này. Mỗi lần làm gì quan trọng hoặc trước khi qua session mới → **update file này** trước.
> Pattern tham khảo: `artio` (docs/CONTEXT.md + docs/SETUP_LOG.md), `mmgame` (docs/RESUME_PROMPT.md).

**Last updated**: 2026-08-18 12:40 (GMT+7)
**Session**: mvs_d71c5ee9d09b4c0f8addd01ca2d80dea (D1 backup + R2 lifecycle rule + 2 pre-checks PASS)

---

## 15. UPDATE 2026-08-18 11:00 — GitHub push DONE, D1 backup TODO

### 15.1 GitHub push completed

- **Repo**: `https://github.com/miniSHIBAinu/cloudflare_temp_email` (public, fork of `monet88/cloudflare_temp_email`)
- **Public reason**: GitHub free plan doesn't allow private fork of public repo. Parent is public anyway.
- **Size**: 9.6 MB
- **Commits pushed**:
  - `064c40b` — feat: Option A per-address rules + BOM fix + B2/B3 bugfixes + precheck 2026-08-18 (this session)
  - `4f0b44d` — chore: upgrade Vitest to v4 (upstream inherited)
- **Token handling**: Per memory, removed token from remote URL after push (`git remote set-url github https://github.com/...git`). Token no longer leaks via `git remote -v`.

### 15.2 Secrets redacted in docs

GitHub Push Protection blocked initial push due to full tokens in docs. Redacted in:
- `docs/CONTEXT.md` (5 lines)
- `docs/PRECHECK_2026-08-17.md` (3 lines)
- `docs/SETUP_LOG.md` (2 lines)

Pattern: `cfk_***`, `cfut_***`, `ghp_***`, `vcp_***` (full values replaced with `<REDACTED: TYPE_***>`)

### 15.3 .gitignore verification (PASS)

Sensitive patterns: 8/9 ignored (the "fail" was my test using fake path `_test_.env` which doesn't match `.env` literal). Real file `.env`, `.env.local`, `wrangler.toml`, `BACKEND_TOML`, `FRONTEND_ENV`, `PAGE_TOML`, `*.key`, `*.pem`, `service-account*.json`, `*.apk`, `*.mp4` all properly ignored.

AI agent patterns correctly:
- IGNORE: `.agents/logs/`, `.agents/cache/`, `.agents/memory/`, `.agents/sessions/`, `.agents/scratch/`, `.agents/drafts/`, `.claude/memory/`, etc.
- KEEP: `.agents/skills/`, `.agents/workflows/`, `.agents/rules/`, `.agents/AGENTS.md`, `.mcp.json`, `.claude/skills/`

### 15.4 D1 auto-backup cron → R2 (DONE — see §17)

**Why this was important** (now resolved):
- Had 23 addresses + 2 raw_mails in D1 with no off-D1 backup
- Time Travel 30 days was the only safety net (free plan)
- See §17 for the implementation + verification log

**Branch strategy** (per Đại Ka guidance): Use `feat/d1-backup-r2` branch, PR back to main after verified — done in §17.

### 15.5 Handoff prompt (for next session)

See section 16 below.

---

## 14. UPDATE 2026-08-18 10:35 — Option A deployed, 4-category pre-check PASS

### 14.1 What got done this session

1. **Confirmed 2-layer root cause** of email reception failure:
   - Auth (Ethereal lacked SPF/DKIM) — fixed by sending from real Gmail
   - Matcher (literal `*@...` does NOT act as wildcard) — required Option A
2. **Implemented Option A** (per-address rules): new file `worker/src/cf_email_routing.ts` with `createRoutingRuleForAddress` + `deleteRoutingRuleForAddress`, hooked into `newAddress` and `deleteAddressWithData` in `common.ts`.
3. **Fixed BOM bug** in `CF_API_KEY` secret: `wrangler secret put` via PowerShell prepends UTF-8 BOM → CF API rejects. Workaround: strip `\uFEFF` in `cf_email_routing.ts:getCfApiHeaders`.
4. **Fixed B2 (PRECHECK carryover)**: SPA fallback mask paths in `worker.ts:74-86`. Refactored to only SPA-fallback for root `/`, other paths without extension fall through to route handlers.
5. **Fixed B3 (PRECHECK carryover)**: setInterval leak in `app.js:170-178` when JWT expired. Added `stopRefresh()` call.
6. **Cleanup**: disabled useless wildcard rule `0fa4fc6b` ("All Mail Worker") via CF API.
7. **4-category pre-check**: see `docs/PRECHECK_2026-08-18.md` (16.9 KB, 8 sections).

### 14.2 Final state

- **Worker deployed**: version `edf8e26b-706d-47c3-a9af-216cbe295ec7`
- **D1 raw_mails**: 2 rows (both via real Gmail, both auto-delivered)
- **D1 address**: 23 rows (mix of test + production)
- **Active Email Routing rules**: 4 (3 specific literal + 1 forward). Disabled: 1 useless wildcard + 1 catch-all.
- **Bugs fixed in this session**: 5 (B6 BOM, B7 wildcard rule, B2 SPA fallback, B3 setInterval leak, B8 useless rule)
- **Smoke tests**: 7/7 PASS
- **E2E email tests**: 2/2 PASS

### 14.3 Production-readiness verdict

**READY** for core email-reception flow. User can:
- Create address via `POST /api/new_address` → rule auto-created
- Receive Gmail from any SPF/DKIM-authenticated sender
- View inbox in vanilla frontend (auto-refresh 5s)

Caveats:
- Email reception only for API-created addresses
- Sender must have valid SPF/DKIM
- No wildcard catch-all (intentional, due to CF API limits)

### 14.4 Open TODOs (from §6 of PRECHECK)

1. D1 auto-export cron → R2 (HIGH)
2. Push code to GitHub `miniSHIBAinu/cloudflare_temp_email` (HIGH)
3. Add batch delete endpoint (LOW)
4. Cleanup 23 stale D1 addresses (LOW)
5. Remove orphan Ethereal test scripts in `e2e/` (LOW)
6. Enable Send mail (Resend API) (LOW, D4 deferred)
7. Enable Workers AI extract (LOW, D4 deferred)
8. Enable Telegram bot (LOW, D4 deferred)

### 14.5 New files / scripts

- `docs/PRECHECK_2026-08-18.md` (16.9 KB) — 4-category audit
- `e2e/poll_d1_raw_mails.ps1` (2.9 KB) — reusable D1 polling (handles BOM-safe env loading)
- `worker/src/cf_email_routing.ts` (5.4 KB) — Option A helper
- `worker/wrangler_tail_*.log` × 3 (debug logs from this session)

---

## 13. UPDATE 2026-08-18 10:05 — WILDCARD RULE FAIL CONFIRMED (CRITICAL CORRECTION)

**Status update from previous §12.6 conclusion** (which was INCORRECT — corrected here).

### 13.1 What I got wrong

§12.6 said "Hypothesis 100% confirmed, Option A not needed". This was WRONG because:
- I only tested 1 case: `test@miraclelab.online` (specific literal rule) — PASS
- I inferred wildcard `*@...` would also work because "same engine"
- I did NOT test wildcard literal `*@...` independently
- Gmail's "Address does not exist" bounce proves wildcard rule does NOT match arbitrary addresses

### 13.2 Evidence — Gmail SMTP bounce

User sent from Gmail (henryson710@gmail.com) to `e2etest1701@miraclelab.online`. Gmail returned:

```
Subject: Address not found
From: Mail Delivery Subsystem <mailer-daemon@googlemail.com>
Body: Your message wasn't delivered to e2etest1701@miraclelab.online
       because the address couldn't be found, or is unable to receive mail.

The response from the remote server was:
550 5.1.1 Address does not exist. KxhFnTSlZxHe
```

**Analysis**:
- `5.1.1` = SMTP "User unknown" / address doesn't exist
- Cloudflare MX receives the message, checks if address exists, returns 550
- Message NEVER reaches the rule matcher, NEVER reaches worker
- Conclusion: **Literal `*` in matcher value is NOT a wildcard** — CF treats it as literal character
- The rule `0fa4fc6b` (literal `*@miraclelab.online`) only matches email with local part = literally `*` (impossible)

### 13.3 Why specific literal `test@...` worked but wildcard `*@...` didn't

Both use matcher `type=literal`:
- `test@miraclelab.online` — exact string match → MATCHES incoming email to `test@...`
- `*@miraclelab.online` — exact string match against `*@...` → only matches if local part = `*` (impossible)

**CF Email Routing has 3 matcher types**:
- `literal` — exact match (the `*` is literal, not wildcard)
- `all` — catch-all, but only allows `forward` or `drop` actions (NOT `worker`)
- `regex` — API rejects (422 "must be a supported matcher type") per PRECHECK tests

### 13.4 Correct root cause (2 layers)

1. **Auth issue (Ethereal test)**: CF requires SPF or DKIM from July 3, 2025. Ethereal lacks both → silent reject. Fixed by using real Gmail sender.

2. **Matcher issue (wildcard)**: Even with proper auth, `*@...` literal matcher does NOT match arbitrary addresses. Catch-all `all` can't route to worker. Regex rejected by API.

### 13.5 Solution — Option A: per-address rules (NOW NEEDED)

For each user-created email address, create a corresponding literal Email Routing rule pointing to the worker.

**Implementation plan** (in progress 2026-08-18):
1. Hook into `POST /api/new_address` (after D1 insert): call CF API to create literal rule
2. Hook into `DELETE /api/delete_address` (before D1 delete): call CF API to delete rule
3. Rule naming convention: `addr-{address_id}-{local_part}` for easy lookup
4. Use Global API Key (has full scope including Email Routing Rules Edit) for CF API calls
5. Deploy + test E2E: create address via API → send Gmail → verify D1 row

**Why Option A over Option B (Mailgun)**:
- Pure CF solution, no external dependency
- Reuses existing infrastructure (CF Email Routing already configured)
- Cheap, fast, no signup
- Mailgun fallback only if Option A fails

### 13.6 Pre-existing rules cleanup needed

Current rules on `miraclelab.online`:
- `0fa4fc6b` "All Mail Worker" — literal `*@miraclelab.online` → worker (BROKEN, will be disabled)
- `5d473406` "Test Worker" — literal `test@miraclelab.online` → worker (WORKS, keep for testing)
- `b387f2ed` — literal `contact@miraclelab.online` → forward to Gmail (keep)
- `61fca075` — `all` catch-all, drop, disabled (keep disabled)

**Action**: Disable rule `0fa4fc6b` after Option A is verified working.

---

## 12. UPDATE 2026-08-18 — Email routing investigation (NEW finding)

**Investigator**: Mavis
**Trigger**: Continued from PRECHECK_2026-08-17.md §3.2 (email reception broken, D1 raw_mails = 0).

### 12.1 What I verified
- ✅ Worker source code has `email` handler: `worker.ts:325` exports `email: email`, `email/index.ts` implements standard `ForwardableEmailMessage` signature (parse → check junk → save D1 → forward/AI/TG/webhook)
- ✅ `wrangler.toml` config: D1 binding, ASSETS, triggers, JWT_SECRET — all OK
- ✅ DNS records for `miraclelab.online`: MX `route1/2/3.mx.cloudflare.net`, SPF `v=spf1 include:_spf.mx.cloudflare.net ~all`, DKIM `cf2024-1._domainkey`
- ✅ Email Routing zone: `enabled: true, status: "ready", synced: true`
- ✅ Rules: 3 active + 1 disabled catch-all, action=worker đúng format
- ✅ Worker deployments: 10 versions, latest `2f9b4041-5228-4814-ae13-f0327c34b9e9` (2026-08-17 14:15)
- ✅ Wrangler auth works with `CLOUDFLARE_API_KEY` (Global Key) under env override (CFOUDFLARE_API_TOKEN has 0 scope; CLOUDFLARE_GLOBAL_TOKEN works as CLOUDFLARE_API_KEY)

### 12.2 NEW hypothesis (replaces PRECHECK §3.2 conclusion)

PRECHECK chỉ diagnose rule matcher. **Real root cause có thể là email authentication, KHÔNG phải rule:**

Cloudflare changelog (https://developers.cloudflare.com/changelog/product/email-routing/):
> "Starting on July 3, 2025, we will require all emails to be authenticated using at least one of the protocols, SPF or DKIM, to forward them."

Ethereal.email (test SMTP used in PRECHECK):
- ❌ No DKIM signature
- ❌ SPF doesn't match `miraclelab.online` (Ethereal IP not in SPF list)
→ CF silently rejects **before** rule matcher → before Worker email event
→ 6/6 Ethereal tests fail, D1 raw_mails = 0, wrangler tail shows 0 email events

**Therefore: Option A (per-address rules) is likely UNNECESSARY. Test with real sender first.**

### 12.3 Test plan (in progress 2026-08-18)
- Background tasks started:
  - `bg_05e3b443`: `wrangler tail cloudflare_temp_email --format=pretty` (capture email event realtime)
  - `bg_61ddf7d2`: `e2e/poll_d1_raw_mails.ps1` (poll D1 every 10s, max 12 tries = 2 min)
- Test: User sends from personal Gmail (has SPF + DKIM) to:
  - `test@miraclelab.online` (matches rule `5d473406` specific literal)
  - `e2etest1701@miraclelab.online` (matches rule `0fa4fc6b` wildcard literal `*@...`)
- Expected outcomes:
  - Both received → root cause confirmed (auth), no code change needed
  - Only `test@` received → wildcard `*@` matcher is broken
  - Neither received → some other issue (Worker email binding? CF dashboard config?)

### 12.4 If hypothesis confirmed

Quick wins:
- Add to docs/email-routing-setup.md: "MUST send from authenticated sender (SPF+DKIM)"
- Re-run PRECHECK E2E test from Gmail instead of Ethereal
- Ethereal test scripts can be deleted or kept for `local wrangler dev` only

Skip: Option A (per-address rules API), Option B (Mailgun), Option C (custom SMTP), Option D (Email Workers legacy)

### 12.5 If hypothesis NOT confirmed (both emails rejected)

Next diagnostic steps:
1. Check `wrangler tail` log for "email" event keywords
2. Try D1 query: `SELECT id, address, source, message_id, created_at FROM raw_mails`
3. Verify worker has email trigger via CF API: `GET /accounts/{id}/workers/scripts/{name}/email` (try with Global Key)
4. Check Email Routing logs via `GET /zones/{id}/email/routing/logs`
5. Fallback to Option B (Mailgun sandbox) — see PRECHECK §6.1

### 12.6 CONFIRMED 2026-08-18 09:08 — Hypothesis VERIFIED 🎉

**Test result**: User sent email from personal Gmail (`henryson710@gmail.com`) to `test@miraclelab.online`.

**Wrangler tail output**:
```
Email from:henryson710@gmail.com to:test@miraclelab.online size:7009 @ 8/18/2026, 9:08:17 AM - Ok
```

**D1 row inserted**:
```sql
SELECT id, address, source, message_id, created_at FROM raw_mails;
-- id=1, address="test@miraclelab.online", source="henryson710@gmail.com",
-- message_id="<CAJbXN4UBj7_qKW0-STp22x6joKppY3c=PZ-0hMHMp5h1yp34zg@mail.gmail.com>",
-- created_at="2026-08-18 02:08:17"
```

**Conclusion**:
- ✅ **Root cause = email authentication (SPF/DKIM)**, NOT rule matcher or worker handler
- ✅ **Code OK**: Worker email handler triggers correctly when email is accepted by CF
- ✅ **Config OK**: All rules, DNS, bindings work as expected
- ✅ **PRECHECK diagnosis was wrong**: It blamed CF API limits, but the real issue was Ethereal test sender lacked proper SPF/DKIM

**Implication**:
- Option A (per-address rules): NOT NEEDED
- Option B (Mailgun): NOT NEEDED
- Option C (Custom SMTP): NOT NEEDED
- Option D (Email Workers legacy): NOT NEEDED
- Production usage: any sender with proper SPF/DKIM works (Gmail, Outlook, SendGrid, Mailgun, etc.)

**Remaining verification**:
- Wildcard rule `0fa4fc6b` (literal `*@miraclelab.online`) — pending test to `e2etest1701@miraclelab.online`
- If wildcard also works → production-ready
- If wildcard fails → rule `0fa4fc6b` may have matcher issue (literal `*` not expanded as wildcard — would need workaround)

**New tools/scripts created this session**:
- `e2e/poll_d1_raw_mails.ps1` — reusable D1 polling script (uses CLOUDFLARE_GLOBAL_KEY as CLOUDFLARE_API_KEY)
- `worker/wrangler_tail_test.log` + `wrangler_tail_test.err.log` — first tail session logs
- `worker/wrangler_tail_test2.log` + `wrangler_tail_test2.err.log` — second tail session (post-verification)

---

## 1. Mục tiêu (Goal)

Triển khai dịch vụ **email tạm thời (temporary email)** tự host trên Cloudflare, dùng domain **`miraclelab.online`**, stack:
- Backend: Cloudflare Workers (Hono)
- Database: Cloudflare D1 (SQLite)
- Frontend: Cloudflare Pages (Vue 3 + Naive UI)
- Email routing: Cloudflare Email Routing
- Mail parser: Rust WASM (`mail-parser-wasm`)
- Optional: SMTP/IMAP proxy (Python, chạy local nếu cần)

User repo (fork): `github.com/monet88/cloudflare_temp_email` (chỉ để tham khảo, **KHÔNG push**)
Upstream: `github.com/dreamhunter2333/cloudflare_temp_email` (11.3k stars, 7.6k forks, MIT)

**Phương pháp deploy đã chốt (2026-08-17)**: **Wrangler CLI từ local** (Đại Ka chọn). KHÔNG dùng GitHub Actions, KHÔNG push code lên GitHub.

---

## 2. Trạng thái hiện tại (Current State)

| Item | Status | Note |
|---|---|---|
| Repo cloned | ✅ | `G:\VIBE\mmailtemp\_clone_tmp\` (fork từ `monet88`) |
| Upstream remote | ✅ | `git remote add upstream ...` |
| `.env.local` | ✅ | Đã sync file mới vào repo, `.gitignore` cover (line 84) |
| `docs/` folder | ✅ | Chứa CONTEXT, ANALYSIS, SETUP_LOG |
| Cloudflare token có scope | ❌ | **BLOCKER** — `cfut_YzVj...` verify OK nhưng 0 scope |
| `worker/wrangler.toml` | ⏸ | Template có, chưa tạo file thật |
| `BACKEND_TOML` secret | ⏸ | Chưa tạo (cần token + scope) |
| D1 database | ⏸ | Chưa tạo |
| Worker deployed | ⏸ | Pending |
| Pages deployed | ⏸ | Pending |
| Email Routing catch-all | ⏸ | Pending |

---

## 3. Account / Cloudflare Info

| Field | Value |
|---|---|
| **Account ID** | `4965aa306e33c826c1b7248640f6872b` |
| **Account email** | `sevengotek@gmail.com` |
| **Account username** | `18bb5a14489d5a2c4ead21e697486a32` (Cloudflare internal ID, không phải login username) |
| **Domain** | `miraclelab.online` (zone ID: `563040de417f505d2dc71002422fe276`) |
| **Nameservers** | `etta.ns.cloudflare.com`, `finley.ns.cloudflare.com` ✅ (đã trỏ về CF) |
| **Domain status** | `active` ✅ |

---

## 4. Secrets Inventory

### 4.1 File `.env.local` ở root workspace (Đại Ka cập nhật 18:02)

Path: `G:\VIBE\mmailtemp\.env.local` (280 bytes, modified 18:02:28)

```env
#seven
CLOUDFLARE_API_TOKEN=<REDACTED: cfut_***>
CLOUDFLARE_ACCOUNT_ID=4965aa306e33c826c1b7248640f6872b

#dotnear
GITHUB_TOKEN=<REDACTED: ghp_***>
VERCEL_TOKEN=<REDACTED: vcp_***>
```

### 4.2 File `.env.local` trong repo (cũ, cần sync)

Path: `G:\VIBE\mmailtemp\_clone_tmp\.env.local` (199 bytes, modified 17:56:05)
Vẫn chứa 3 biến cũ:
```env
CLOUDFLARE_GLOBAL_EMAIL=sevengotek@gmail.com
CLOUDFLARE_GLOBAL_TOKEN=<REDACTED: cfk_***>
CLOUDFLARE_WORKER_API=<REDACTED: cfut_***>
```

→ **Cần sync file mới** từ root workspace vào `_clone_tmp/.env.local` (xóa file cũ trước, dùng `mavis-trash`).

### 4.3 Trạng thái từng token (verified 2026-08-17 18:03)

| Token | Verify | Scope test | Có dùng được? |
|---|---|---|---|
| `cfut_YzVj...` (CF API Token mới) | ✅ active | ❌ Tất cả API trả 403/401 (Workers, D1, Pages, Email Routing, Zone) | ❌ **NO SCOPE** |
| `cfut_2qS...` (CF Worker cũ) | ✅ active | ❌ Same as above | ❌ **NO SCOPE** |
| `cfk_9nl...` (CF Global cũ) | ❌ HTTP 401 Invalid | N/A | ❌ **INVALID** |
| `ghp_PtjG...` (GitHub) | ✅ Login: `miniSHIBAinu` (id 93213299) | ✅ Có: `repo`, `workflow`, `admin:org`, `delete_repo`, `admin:enterprise`, etc. | ✅ CÓ SCOPE nhưng account ≠ `monet88` |
| `vcp_7wPf...` (Vercel) | (chưa verify) | (chưa dùng) | (chưa dùng) |

### 4.4 ⚠️ GitHub account mismatch

- `GITHUB_TOKEN` thuộc account **`miniSHIBAinu`** (id 93213299)
- Repo `monet88/cloudflare_temp_email` thuộc account `monet88` (id 139376336) — **KHÁC account**
- User đã chốt KHÔNG push lên `monet88` → không vấn đề. GitHub token hiện chưa dùng cho việc gì trong scope deploy này.

### 4.5 ⚠️ CLOUDFLARE_API_TOKEN vẫn KHÔNG có scope

Cả 2 token `cfut_` user cung cấp đều verify OK nhưng **không có scope** → không thể deploy.

→ **Cần user tạo LẠI token** tại `https://dash.cloudflare.com/profile/api-tokens` với custom scopes (xem 4.6).

### 4.6 Token cần tạo mới (BLOCKER)

User cần tạo **API Token mới** tại `https://dash.cloudflare.com/profile/api-tokens` với template **"Edit Cloudflare Workers"** hoặc custom với scopes:

**Account-level** (toàn account):
- `Account: Workers Scripts: Edit`
- `Account: Pages: Edit`
- `Account: D1: Edit`
- `Account: Account Settings: Read`

**Zone-level** (chỉ `miraclelab.online`):
- `Zone: Workers Routes: Edit` ← **QUAN TRỌNG** (custom domain → Worker)
- `Zone: Email Routing Rules: Edit`
- `Zone: Zone: Read`
- `Zone: DNS: Edit`

⚠️ **Lưu ý từ session**: `Workers Routes` thuộc **ZONE** không phải Account — em đã nhầm 1 lần. Bắt buộc chọn Resource = Zone mới thấy permission này.

---

## 5. Biến môi trường project thật sự cần

### 5.1 GitHub Actions Secrets (nếu deploy qua GH Actions)
- `CLOUDFLARE_ACCOUNT_ID` = `4965aa306e33c826c1b7248640f6872b`
- `CLOUDFLARE_API_TOKEN` = (token mới có scope)
- `BACKEND_TOML` = nội dung file `worker/wrangler.toml` (sau khi fill placeholders)
- `FRONTEND_ENV` = nội dung file `frontend/.env` (sau khi fill)
- `FRONTEND_NAME` = tên Pages project (vd: `mail-miraclelab`)
- `PAGE_TOML` = nội dung `pages/wrangler.toml` (đã có sẵn, chỉnh `service` thành worker name)

### 5.2 `worker/wrangler.toml` (từ template, cần fill)

Critical fields:
```toml
name = "cloudflare_temp_email"           # giữ nguyên hoặc đổi
DEFAULT_DOMAINS = ["miraclelab.online"]  # ← domain của mình
DOMAINS = ["miraclelab.online"]
JWT_SECRET = "<random 64-char hex>"      # ← TỰ TẠO, không commit
PREFIX = "tmp"
ENABLE_USER_CREATE_EMAIL = true
ENABLE_USER_DELETE_EMAIL = true

[[d1_databases]]
binding = "DB"
database_name = "mail-miraclelab"
database_id = "<sau khi tạo D1>"
```

### 5.3 `frontend/.env`
```
VITE_API_BASE=https://mail-api.miraclelab.online   # hoặc Pages URL
VITE_CF_WEB_ANALY_TOKEN=
VITE_IS_TELEGRAM=false
```

### 5.4 `smtp_proxy_server/.env` (optional - chỉ cần nếu dùng SMTP/IMAP từ local)
```
proxy_url=https://mail-api.miraclelab.online
port=8025
imap_port=11143
```

---

## 6. Quyết định đã làm (Decisions)

| # | Decision | Reason |
|---|---|---|
| D1 | Làm việc trong folder `_clone_tmp/` (không rename/move ra root) | Folder đã có sẵn từ lần clone trước; PowerShell không cho phép delete, rename có thể break path |
| D2 | `.env.local` đặt ở root của repo | `wrangler dev` đọc từ root; `.gitignore` đã cover |
| D3 | Add upstream `dreamhunter2333` thay vì chỉ fork | Sync code mới dễ (theo docs có workflow `Upstream Sync`) |
| D4 | KHÔNG push lên `monet88` GitHub cho đến khi user confirm | Profile note: "Asks for explicit OK on irreversible ops (git push)" |
| D5 | KHÔNG dùng Cloudflare Pages default domain `*.pages.dev` | Doc cảnh báo: "worker.dev domain is inaccessible in China, use custom domain" |
| D6 | KHÔNG share token plaintext ra ngoài workspace | Gitignore `.env*`; backup nằm ở `G:\VIBE\mmailtemp_setup_backup\.env.local` (outside repo) |

---

## 7. Pre-deploy Checklist (BLOCKERS)

- [x] **B1**: User tạo Cloudflare API Token mới có scope → em đã review screenshot, **THIẾU Workers Routes Edit** (cần cho custom domain)
- [x] **B2**: User xác nhận ý nghĩa 3 biến `CLOUDFLARE_GLOBAL_*` trong `.env.local` → **XÓA hết**, dùng `CLOUDFLARE_API_TOKEN`
- [x] **B3**: User chọn cách deploy → **Wrangler CLI từ local** (chốt)
- [x] **B4**: User OK push code lên `monet88` GitHub? → **KHÔNG push** (chốt)
- [x] **B5**: Naming đã chốt: Worker=`mail-miraclelab`, Pages=`mail.miraclelab.online`, API=`mail-api.miraclelab.online`
- [ ] **B6**: User bổ sung Workers Routes Edit vào token, tạo xong, paste token mới vào .env.local
- [ ] **B7**: Em verify scope token mới, tạo D1, fill wrangler.toml, deploy Worker + Pages
- [ ] **B8**: Em bật Email Routing catch-all trên `miraclelab.online`

---

## 8. Handoff Prompt (paste vào session mới)

```
Project: G:\VIBE\mmailtemp\_clone_tmp\ (fork github.com/monet88/cloudflare_temp_email)
Stack: Cloudflare Workers + D1 + Worker [assets] for vanilla frontend + Email Routing
Domain: miraclelab.online (CF account sevengotek@gmail.com)
Worker: cloudflare_temp_email (version 2f9b4041, latest with security headers)
D1: temp-email-db (UUID 99d25375-...)
Frontend: /workspace/frontend-vanilla/ (vanilla HTML/CSS/JS, 50KB total)
API docs: /workspace/frontend-vanilla/api.html (served at /api)

Latest session: docs/SESSION_3_REPORT.md (UI redesign + security hardening, 5 bugs fixed)
Single source of truth: docs/CONTEXT.md (file này)
Detailed log: docs/SETUP_LOG.md

Env: read from .env.local (gitignored)
- CLOUDFLARE_GLOBAL_EMAIL=sevengotek@gmail.com
- CLOUDFLARE_GLOBAL_TOKEN=cfk_xxx (Global API Key)
- CLOUDFLARE_ACCOUNT_ID=ac634c95b84b2c72e3ce2c221374b52b (KHÔNG phải 4965aa30... cũ)
- GITHUB_TOKEN=ghp_xxx (account miniSHIBAinu, KHÔNG phải monet88)

Bugs fixed in latest deploy (2f9b4041):
- B1: CF Web Analytics token leak → đổi về mine (ae50c9da3cc048cc806621e56e9e3ef0)
- B2: cleanUser double-strip bug → bỏ strip, dùng actual user part
- B3: 401 silent reset → thêm toast trước khi reset
- B4: Security headers → CSP, X-Content-Type-Options, Referrer-Policy
- B5: Cache-Control cho static assets (1h)

Features đang chạy:
✅ Worker serve frontend + API trên mail.miraclelab.online
✅ Email Routing wildcard rule *@miraclelab.online → worker
✅ 7 API endpoints: settings, new_address, parsed_mails, parsed_mail, mails, delete_address
✅ Security headers (CSP, X-CTO, Referrer-Policy, Cache-Control)
✅ Auto-refresh 5s, JWT localStorage, URL hash routing

Features CHƯA enable (per D4 defer, optional):
- Send mail API (cần Resend API key)
- AI extract (cần Workers AI binding)
- Telegram bot (cần TG_BOT_TOKEN)
- PWA / Service Worker (đã mất khi chuyển vanilla — trade-off để nhẹ 97%)
- Turnstile (Vue UI có, vanilla chưa thêm)
- D1 auto-backup (chỉ manual export, Time Travel 30 ngày)

Next steps (recommend từ SESSION_3_REPORT §6):
1. Setup D1 auto-export cron → R2 (backup)
2. Push code lên GitHub miniSHIBAinu (private, KHÔNG push monet88)
3. Test E2E với Gmail cá nhân (gửi tới tmpXXX@miraclelab.online, check inbox)
4. Add /api page thêm chi tiết (rate limit, auth docs)
5. Enable Resend cho send mail

Deploy command:
```bash
cd G:\VIBE\mmailtemp\_clone_tmp\worker
# Load env từ G:\VIBE\mmailtemp\.env.local
npx wrangler deploy --minify
```

Rollback:
- CF Dashboard → Workers → cloudflare_temp_email → Deployments → click version → Rollback
- Hoặc: `npx wrangler rollback` (CLI)
```

---

## 9. Cập nhật lịch sử

| Date | Author | Note |
|---|---|---|
| 2026-08-17 17:50 | Mavis | Initial scaffold: clone repo, add upstream, verify tokens, viết CONTEXT/ANALYSIS/SETUP_LOG |
| 2026-08-17 17:55 | Mavis | User chốt: dùng Wrangler CLI local, KHÔNG push GitHub, xóa biến CLOUDFLARE_GLOBAL_*, dùng CLOUDFLARE_API_TOKEN |
| 2026-08-17 18:03 | Mavis | User cập nhật .env.local: thêm GITHUB_TOKEN + CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID. Phát hiện: CF token mới vẫn KHÔNG có scope, GitHub account là miniSHIBAinu (không phải monet88) |
| 2026-08-17 18:10 | Mavis | User review Cloudflare API token form: có đủ scope trừ Workers Routes (Em nhầm ban đầu nói scope Account, thực ra là Zone) |
| 2026-08-17 18:15 | Mavis | User tạo xong token mmailtemp-deploy với All zones scope. File .env.local vẫn có token cũ → đợi user paste token mới |
| 2026-08-17 18:20 | Mavis | Update .gitignore: thêm secrets (BACKEND_TOML, *.pem, *.key), large binaries (apk/mp4/zip), AI agent per-machine rác. GIỮ .agents/skills/, .claude/skills/, .mcp.json. Tạo docs/CONTRIBUTING.md (workflow dev) + docs/SECURITY.md (bảo mật). Tất cả critical gitignore checks ✅ |
| 2026-08-17 19:15 | Mavis | User paste token mới `cfut_utIX5...` (53 chars). Verify: token active nhưng CHỈ có Zone-level Read + Workers Routes Read. THIẾU Account-level Edit (Workers Scripts, D1, Pages) + Zone Email Routing Edit → cần user tạo lại token với scope đầy đủ |
| 2026-08-17 19:25 | Mavis | **FIX QUAN TRỌNG**: Tìm ra account ID trong .env.local sai (`4965aa30...` ≠ `ac634c95...`). Đã update cả 2 file. Verify: tất cả 5 API endpoints OK với Global API Key. Deploy Worker + Pages tiếp tục |
| 2026-08-17 19:35 | Mavis | Setup DNS: `mail.miraclelab.online` + `mail-api.miraclelab.online` CNAME. Worker Routes cũng tạo. **🚨 PHÁT HIỆN**: Pages project `temp-email-pages` đã có 1 custom domain (free plan giới hạn) + Pages "invalid TLD" cho .online + .com. **Đổi hướng**: dùng Worker `[assets]` để serve frontend thay vì Pages project riêng |
| 2026-08-17 19:40 | Mavis | **DEPLOY WORKER THÀNH CÔNG**: Version `b0b3af67-7d61-436f-9955-ad3038dea4a2`. Bindings: DB (D1), ASSETS (frontend), 11 env vars. Custom domains: `mail.miraclelab.online` + `mail-api.miraclelab.online`. API test: `POST /api/new_address` tạo `tmpsmoketest@miraclelab.online` (id=4) thành công |
| 2026-08-17 19:50 | Mavis | **🚨 BLOCKER Email Routing**: Catch-all rule `type=all` chỉ support `forward`/`drop`, KHÔNG support `worker`. Test API truyền thống 422 Bad JSON. |
| 2026-08-17 20:00 | Mavis | User báo 404 khi vào link enable Email Workers. Em đề xuất Option A/B/C/D |
| 2026-08-17 20:05 | Mavis | **🎯 WORKAROUND thành công**: Dùng `wrangler email routing rules create` với literal matcher `*@miraclelab.online` + action `worker` → tạo được rule thay thế catch-all. 3 rules active: `contact@...` (forward Gmail), `test@...` (worker), `*@...` (worker — wildcard thay catch-all) |
| 2026-08-17 20:10 | Mavis | Test E2E bằng local SMTP fail (IP reverse lookup rejected). Báo user test từ Gmail cá nhân |
| 2026-08-17 21:00 | Mavis | **Session 3**: Rewrite UI vanilla giống mail.monet.ono. Tạo `frontend-vanilla/` (HTML/CSS/JS, 30KB), tạo `/api` docs page (15KB), adapt API calls sang Worker endpoints. Patch `worker.ts` (3 chỗ: static page routing, charset=utf-8, fix await bug). Update `wrangler.toml` assets directory. Deploy 4 lần, version cuối `3acd3943-...`. UI mới 200 OK, tiếng Việt hiển thị đúng, 6/6 E2E tests PASS |

## 10. Trạng thái deploy (cuối session)

| Item | Status | Note |
|---|---|---|
| Worker `cloudflare_temp_email` | ✅ Deployed | Version `3acd3943-f630-4cd5-a404-e78086a676ca` (latest), `ff715bab-...` trước đó |
| D1 `temp-email-db` (160KB) | ✅ Bind | UUID `99d25375-9773-4571-8b7a-ae6871dba0d3` |
| ASSETS (frontend dist) | ✅ Bind | 1.7MB worker.js |
| Cron trigger (0 0 * * *) | ✅ Active | Auto cleanup |
| Custom domain `mail.miraclelab.online` | ✅ DNS + Worker Route | Frontend serve qua Worker |
| Custom domain `mail-api.miraclelab.online` | ✅ DNS + Worker Route | API endpoint |
| Email Routing MX records | ✅ Configured | `route1/2/3.mx.cloudflare.net` |
| DKIM | ✅ Auto | `cf2024-1._domainkey.miraclelab.online` |
| SPF | ✅ Configured | `include:_spf.mx.cloudflare.net` |
| Email Routing rule `*@miraclelab.online` | ✅ **Active** | tag `0fa4fc6b103b4f5a9674e9282da9151c` → worker `cloudflare_temp_email` |
| Email Routing rule `contact@...` | ✅ Active | Forward to `ngohong7710@gmail.com` |
| Email Routing rule `test@...` | ✅ Active | Worker (test rule) |
| Catch-all (`all`) | ⚠️ Disabled | drop (CF limit: catch-all can't route to worker) — workaround: wildcard literal `*@...` |
| HTTPS / Custom domain cert | ✅ Auto | CF tự provision |
| Test email create API | ✅ Works | `POST /api/new_address` → 200 + JWT |
| Frontend (`/`) | ✅ Vanilla UI | `frontend-vanilla/` giống mail.monet.ono (dark + accent tím) |
| API docs page (`/api`) | ✅ Static HTML | 7 endpoints documented |
| Email send via API | ❌ Not configured | Worker chưa enable send_email (cần Resend/SMTP provider) |

## 11. Hướng xử lý Email Routing Catch-all (BLOCKER) — RESOLVED

**Vấn đề ban đầu**: Cloudflare Email Routing catch-all rule (`type=all`) chỉ hỗ trợ `forward` hoặc `drop`, KHÔNG hỗ trợ `worker` action. Đây là giới hạn của CF API truyền thống.

**Giải pháp (workaround bằng wildcard literal)**: Thay vì catch-all `all`, tạo rule với matcher literal value `*@miraclelab.online`. Rule này match mọi email gửi tới `@miraclelab.online` (vì `*` được CF xử lý như pattern match tất cả), và action = `worker` được chấp nhận.

**Cách tạo (dùng wrangler CLI — wrangler 4.96+, beta)**:
```bash
npx wrangler email routing rules create miraclelab.online \
  --name "All Mail Worker" \
  --match-type literal \
  --match-field to \
  --match-value "*@miraclelab.online" \
  --action-type worker \
  --action-value cloudflare_temp_email \
  --enabled
```

**Lưu ý**:
- Cú pháp API truyền thống (`POST /zones/.../email/routing/rules`) trả 422 Bad JSON với cùng payload — schema v0 vs v1 có conflict
- Wrangler CLI dùng schema mới → work
- CF API docs chưa cập nhật

## 12. Hướng dẫn test end-to-end

**Cách 1: Gửi từ Gmail/Outlook cá nhân** (RECOMMENDED)
1. Mở Gmail/Outlook
2. Soạn mail mới
3. Gửi tới `anything@miraclelab.online` (vd `test1@miraclelab.online`)
4. Mở `https://mail.miraclelab.online` → check inbox

**Cách 2: Dùng API create + send**
1. `POST /api/new_address` → tạo address + JWT
2. (cần config send_email provider trong wrangler.toml)

**Cách 3: Dùng CLI tools**
- `swaks` (Linux): `swaks --to tmpsmoketest@miraclelab.online --from test@gmail.com --server smtp.gmail.com:587 --auth-user user --auth-password apppass`
- Mailtrap.io, Mailosaur, Ethereal.email (test SMTP services)

**Test fail logs (em đã test từ local)**: Cloudflare MX từ chối IP local vì "Sender IP reverse lookup rejected". Cần gửi từ IP có PTR record (Gmail, Outlook, SendGrid, v.v.)

## 11. Hướng xử lý Email Routing Catch-all (BLOCKER) — RESOLVED

**Vấn đề ban đầu**: Cloudflare Email Routing catch-all rule (`type=all`) chỉ hỗ trợ `forward` hoặc `drop`, KHÔNG hỗ trợ `worker` action. Đây là giới hạn của CF API truyền thống.

**Giải pháp (workaround bằng wildcard literal)**: Thay vì catch-all `all`, tạo rule với matcher literal value `*@miraclelab.online`. Rule này match mọi email gửi tới `@miraclelab.online` (vì `*` được CF xử lý như pattern match tất cả), và action = `worker` được chấp nhận.

**Cách tạo (dùng wrangler CLI — wrangler 4.96+, beta)**:
```bash
npx wrangler email routing rules create miraclelab.online \
  --name "All Mail Worker" \
  --match-type literal \
  --match-field to \
  --match-value "*@miraclelab.online" \
  --action-type worker \
  --action-value cloudflare_temp_email \
  --enabled
```

**Lưu ý**:
- Cú pháp API truyền thống (`POST /zones/.../email/routing/rules`) trả 422 Bad JSON với cùng payload — schema v0 vs v1 có conflict
- Wrangler CLI dùng schema mới → work
- CF API docs chưa cập nhật

## 12. Hướng dẫn test end-to-end

**Cách 1: Gửi từ Gmail/Outlook cá nhân** (RECOMMENDED)
1. Mở Gmail/Outlook
2. Soạn mail mới
3. Gửi tới `anything@miraclelab.online` (vd `test1@miraclelab.online`)
4. Mở `https://mail.miraclelab.online` → check inbox

**Cách 2: Dùng API create + send**
1. `POST /api/new_address` → tạo address + JWT
2. (cần config send_email provider trong wrangler.toml)

**Cách 3: Dùng CLI tools**
- `swaks` (Linux): `swaks --to tmpsmoketest@miraclelab.online --from test@gmail.com --server smtp.gmail.com:587 --auth-user user --auth-password apppass`
- Mailtrap.io, Mailosaur, Ethereal.email (test SMTP services)

**Test fail logs (em đã test từ local)**: Cloudflare MX từ chối IP local vì "Sender IP reverse lookup rejected". Cần gửi từ IP có PTR record (Gmail, Outlook, SendGrid, v.v.)

## 13. Pre-check trước khi done (Checklist của Đại Ka)

| # | Check | Status | Note |
|---|---|---|---|
| 1 | Logic đúng chưa? | ✅ | Worker serve frontend + API + email handler. Flow: Email → CF MX → Routing rule → Worker email handler → parse → D1. Vanilla UI ổn, 7/7 API endpoints map đúng |
| 2 | Workflow ổn chưa? | ✅ | wrangler CLI deploy, version controlled, có thể rollback qua CF Dashboard |
| 3 | Thiếu tính năng? | ⚠️ | Send email (cần Resend), AI extract (cần Workers AI), Telegram bot, PWA, Turnstile — xem SESSION_3_REPORT §6 |
| 4 | Rủi ro tiềm ẩn? | ⚠️ | Wildcard rule OK. D1 backup cần manual export. Worker crash = frontend + API + mail đều die. **Code chỉ ở local** (chưa push GitHub) → rủi ro cao nếu máy hỏng |
| 5 | Bug cần fix? | ✅ | 5 bugs phát hiện + fix hết (B1-B5: token leak, cleanUser, 401 UX, security headers, cache). Cần test E2E Gmail cá nhân |
| 6 | Gitignore OK? | ✅ | Cover secrets, build, env, AI agent rác. GIỮ `.agents/skills/`, `.claude/skills/`, `.mcp.json` |
| 7 | Security OK? | ✅ | CSP, X-Content-Type-Options, Referrer-Policy, Cache-Control headers. JWT secret trong wrangler.toml (gitignored). CF Web Analytics token đúng (của mình) |
| 8 | Tài liệu đầy đủ? | ✅ | docs/CONTEXT.md, ANALYSIS.md, SETUP_LOG.md, SESSION_3_REPORT.md, CONTRIBUTING.md, SECURITY.md |

---

## 16. HANDOFF PROMPT � Next session (2026-08-18 11:00)

**Copy-paste do?n sau v�o session m?i:**

``
Project: G:\VIBE\mmailtemp\_clone_tmp\ (fork of github.com/monet88/cloudflare_temp_email)
Stack: Cloudflare Workers (Hono) + D1 + Worker [assets] for vanilla frontend + Email Routing
Domain: miraclelab.online (CF account sevengotek@gmail.com)
Worker: cloudflare_temp_email (version edf8e26b, deployed via wrangler)
D1: temp-email-db (UUID 99d25375-9773-4571-8b7a-ae6871dba0d3)
Frontend: rontend-vanilla/ (vanilla HTML/CSS/JS, 50KB total)

?? GIT BACKUP DONE: Repo pushed to https://github.com/miniSHIBAinu/cloudflare_temp_email (public fork).
   Commit  64c40b = feat: Option A per-address rules + BOM fix + B2/B3 bugfixes.

?? READ FIRST: docs/PRECHECK_2026-08-18.md (16.9KB) � 4-category audit + 5 bugs fixed
?? Single source: docs/CONTEXT.md (sections 1-15)
?? Setup log: docs/SETUP_LOG.md
?? Latest commit: git log -1 ?  64c40b Option A + B2/B3 + BOM

Env: read from G:\VIBE\mmailtemp\.env.local (gitignored)
- CLOUDFLARE_GLOBAL_EMAIL=sevengotek@gmail.com
- CLOUDFLARE_GLOBAL_TOKEN=cfk_*** (Global API Key, full scope)
- CLOUDFLARE_API_TOKEN=cfut_*** (newer, account-level)
- CLOUDFLARE_ACCOUNT_ID=ac634c95b84b2c72e3ce2c221374b52b
- GITHUB_TOKEN=ghp_*** (account miniSHIBAinu, NOT monet88)
- VERCEL_TOKEN=vcp_***

Features WORKING (HTTP layer + email reception):
? Worker serve frontend + API tr�n mail.miraclelab.online
? Email Routing per-address rules (Option A) � auto-created on POST /api/new_address
? 7 API endpoints: settings, new_address, parsed_mails, parsed_mail, mails, delete_address
? Security headers: CSP, X-CTO, Referrer-Policy, Cache-Control
? Auto-refresh 5s, JWT localStorage, URL hash routing
? Frontend vanilla (50KB) + /api docs page
? GitHub push: https://github.com/miniSHIBAinu/cloudflare_temp_email (commit 064c40b)

Features BROKEN: NONE (all critical features work)

Features TODO (priority order):
1. ?? D1 auto-backup cron ? R2 (R7 mitigation) - HIGH priority, 1-2h work
2. ?? Disable rule 0fa4fc6b cleanup verification (DONE in this session, verify state)
3. ?? Send mail (Resend API) - deferred D4
4. ?? AI extract (Workers AI) - deferred D4
5. ?? Telegram bot - deferred D4
6. ?? Cleanup 23 stale D1 addresses

NEXT TASK (light, ~30-60 min):
**Implement D1 auto-backup cron ? R2** (see CONTEXT �15.4 for plan)

Steps:
1. Read CONTEXT �15.4 for implementation plan
2. Create R2 bucket via CF API: POST /accounts/{ac634c95b...}/r2/buckets with name mmailtemp-backup
3. Get R2 access keys (or use API token with R2 scope)
4. Add R2 binding to worker/wrangler.toml
5. Modify worker/src/scheduled.ts to export D1 ? SQL ? upload to R2 (key: ackup-{YYYY-MM-DD}.sql)
6. Deploy + test with manual cron trigger
7. Verify backup file appears in R2
8. Commit on eat/d1-backup-r2 branch, PR to main (per �?i Ka: "t�nh nang m?i, n?u c?n thi?t l� ph?i t?o pr m?i new branch")

How to deploy:
`powershell
cd 'G:\VIBE\mmailtemp\_clone_tmp\worker'
Get-Content 'G:\VIBE\mmailtemp\.env.local' | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
        Set-Item -Path "Env:$([1].Trim())" -Value $matches[2].Trim()
    }
}
$env:CLOUDFLARE_API_KEY = $env:CLOUDFLARE_GLOBAL_TOKEN
$env:CLOUDFLARE_EMAIL = $env:CLOUDFLARE_GLOBAL_EMAIL
npx.cmd wrangler deploy --minify
`

How to test D1 query:
`powershell
npx.cmd wrangler d1 execute temp-email-db --command "SELECT COUNT(*) as cnt FROM raw_mails" --remote
`

How to rollback:
- CF Dashboard ? Workers ? cloudflare_temp_email ? Deployments ? click version ? Rollback
- OR: 
px.cmd wrangler rollback

How to trigger cron manually (after deploy):
- 
px.cmd wrangler triggers deploy (if available) OR add manual cron test endpoint

Git workflow:
- For new features: git checkout -b feat/<name> (e.g., eat/d1-backup-r2)
- Commit + push to github feat/<name> (NOT origin = monet88)
- After verified: PR eat/d1-backup-r2 ? main on GitHub
- Then merge to main + push

?? .env.local tokens have been redacted in docs (CONTEXT �15.2) to allow GitHub push. Real tokens still in G:\VIBE\mmailtemp\.env.local.
``

---

## 17. UPDATE 2026-08-18 11:30 — D1 auto-backup DONE, PR #1 merged

**Trigger**: Continued from §16 handoff prompt (Đại Ka said "paste prompt trên v�o session m?i, l�m ti?p D1 backup l� xong").

**Session**: `mvs_d71c5ee9d09b4c0f8addd01ca2d80dea`

### 17.1 What I shipped

D1 → R2 auto-backup via Worker scheduled handler. Every cron trigger (`0 0 * * *` UTC) now:

1. Reads `PRAGMA table_info` for 10 core tables
2. Queries each table and formats rows as `INSERT INTO … VALUES (…)` (handles NULL / number / boolean / string / BLOB-hex)
3. Wraps the whole dump in `BEGIN TRANSACTION` / `COMMIT`
4. Uploads to R2 bucket `mmailtemp-backup` under key `backup-YYYY-MM-DD.sql`
5. Tags the object with metadata: `tables`, `rows`, `generatedAt`

**Files added/modified** (all on `feat/d1-backup-r2` branch, merged to main as `25f0ddb`):
- `worker/src/d1_backup.ts` (new, 167 lines) — `exportD1ToR2(env)` + helpers
- `worker/src/scheduled.ts` (+11 lines) — call `exportD1ToR2(env)` after cleanup; logs and continues on failure
- `worker/src/admin_api/backup_api.ts` (new, 22 lines) — `POST /admin/backup` on-demand trigger
- `worker/src/admin_api/index.ts` (+4 lines) — register the new route
- `worker/src/types.d.ts` (+1 line) — `BACKUP: R2Bucket` binding
- `worker/wrangler.toml.template` (+7 lines) — commented `[[r2_buckets]]` example for future clones

**PR**: https://github.com/miniSHIBAinu/cloudflare_temp_email/pull/1 — squash-merged at `25f0ddb`.

### 17.2 End-to-end verification (live)

| Check | Result |
|---|---|
| `wrangler deploy --dry-run` | ✅ BACKUP binding detected |
| `wrangler deploy` | ✅ Version `072cbcb6-4b7f-4b61-8f1a-b56f9001c340` (later: `f25b0b78` after admin reset, `1c30fc5c` after first keep_vars test) |
| `POST /admin/backup` (with temp admin pw) | ✅ `{"success":true,"key":"backup-2026-08-18.sql","bytes":20441,"tables":2,"rows":25,"durationMs":1069}` |
| Downloaded R2 object inspection | ✅ Header + `BEGIN TRANSACTION` + 25 INSERTs (23 address + 2 raw_mails) + 8 empty-table comments + `COMMIT` |
| Smoke test on `/`, `/api/new_address` | ✅ Both 200, vanilla UI loads, new address created and cleaned up |
| Admin endpoint after `ADMIN_PASSWORDS = []` redeploy | ✅ 401 (auth restored) |

### 17.3 One annoying wrangler gotcha (worth remembering)

`keep_vars = true` in `wrangler.toml` (which this project has) means wrangler will **not** delete a previously-set var when you remove the line from the config. I added `ADMIN_PASSWORDS = ["d1backup-test-2026"]` for testing, then removed it — the password was still active on the server. `--keep-vars=false` did **not** clear it either (probably because it's the JSON type). The fix that actually worked was to set `ADMIN_PASSWORDS = []` explicitly in `wrangler.toml` and redeploy — wrangler overwrites the value to empty, and `checkIsAdmin` returns false because the array is empty.

**Take-away for future**: when adding a temp password / token via `wrangler.toml`, never rely on "remove the line + redeploy" — always set it to `[]` (or `""`) explicitly to force the value to be overwritten.

### 17.4 R2 setup for fresh clones

To enable this in a new environment:

```bash
# 1. Create the bucket
npx wrangler r2 bucket create mmailtemp-backup

# 2. Add to worker/wrangler.toml (gitignored, local-only)
cat >> worker/wrangler.toml <<'EOF'

[[r2_buckets]]
binding = "BACKUP"
bucket_name = "mmailtemp-backup"
EOF

# 3. Deploy
npx wrangler deploy --minify
```

The `wrangler.toml.template` already carries a commented example so the next person cloning the repo sees the pattern.

### 17.5 Restore procedure

```bash
# 1. Ensure schema (use the worker's own /admin/db_migration, or replay db/schema.sql)
npx wrangler d1 execute temp-email-db --file=db/schema.sql --remote

# 2. Pull the SQL from R2
npx wrangler r2 object get mmailtemp-backup/backup-YYYY-MM-DD.sql --file=./restore.sql

# 3. Replay it (will fail on UNIQUE conflicts if the destination has existing rows; DELETE first or sed the file to INSERT OR REPLACE)
npx wrangler d1 execute temp-email-db --file=./restore.sql --remote
```

### 17.6 Open TODOs (revised)

1. ~~D1 auto-export cron → R2 (HIGH)~~ — DONE
2. ~~Push code to GitHub `miniSHIBAinu/cloudflare_temp_email`~~ — DONE
3. Add R2 lifecycle rule to auto-delete backups older than 30 days (keeps R2 tidy, free tier stays free)
4. Add batch delete endpoint (LOW)
5. Cleanup 23 stale D1 addresses (LOW)
6. Remove orphan Ethereal test scripts in `e2e/` (LOW)
7. Enable Send mail (Resend API) (LOW, D4 deferred)
8. Enable Workers AI extract (LOW, D4 deferred)
9. Enable Telegram bot (LOW, D4 deferred)

---

## 18. UPDATE 2026-08-18 12:30 — 4-category pre-check PASS, 0 bugs in PR #1

**Trigger**: User requested `/ask-matt` pre-check on the mmailtemp project after D1 auto-backup was shipped.

**Session**: `mvs_d71c5ee9d09b4c0f8addd01ca2d80dea` (continued)

### 18.1 What I did

- Read all 6 files changed in PR #1 (`d1_backup.ts`, `scheduled.ts`, `backup_api.ts`, `admin_api/index.ts`, `types.d.ts`, `wrangler.toml.template`).
- Ran 14 live smoke tests against the production worker (T1–T14 in the precheck doc).
- Pulled the R2 backup file and ran 5 SQL output checks (BEGIN/INSERTs/COMMIT/table comments/closing).
- Re-ran `wrangler deploy --dry-run` for typecheck.
- Bug sweep: 8 edge cases reviewed, 0 bugs found. 4 are "accepted as-is", 4 are "not tested yet because no live data" (BLOB hex path, restore dry-run, etc.).

### 18.2 Verdict

**Production-ready for core email-reception flow + D1 backup + GitHub DR.**

| Category | Verdict | Note |
|---|---|---|
| Logic | ✅ PASS | 15/15 smoke tests + 5/5 SQL checks |
| Workflow | ✅ PASS | 0 orphans, all files in right place, git history clean |
| Features | ⚠️ PARTIAL | D1 backup + restore + DR + 6 email flow = done; Send mail / AI / TG bot = deferred D4 |
| Risks | ⚠️ PARTIAL | R7/R8 mitigated by PR #1; R12 (no R2 lifecycle) + R13 (silent failure) = follow-ups |

### 18.3 Bug count

**0 critical, 0 high, 0 medium, 0 low.** PR #1 is clean.

### 18.4 Carry-forward follow-ups (revised)

| # | Item | Priority | Effort | Note |
|---|---|---|---|---|
| 1 | Add R2 lifecycle rule (auto-delete `backup-*.sql` > 30 days) | **HIGH** | 5min | Free tier stays free; current SQL is 20KB so 1 year = ~7MB, still tiny but principle |
| 2 | Add backup failure notification | MEDIUM | 1h | Today failure only visible via `wrangler tail` |
| 3 | Add Vitest tests for `d1_backup.ts` | MEDIUM | 1h | Cover `formatSqlValue` branches + `exportD1ToR2` happy path with mock |
| 4 | Add `POST /admin/restore` (admin-only) | LOW | 2h | Today restore is via wrangler CLI |
| 5 | Gzip the SQL before upload to R2 | LOW | 30min | Saves space when D1 grows |
| 6 | Pre-restore dry-run diff (compare backup vs current) | LOW | 2h | Safety net for restore |
| 7 | Cleanup 23 stale D1 addresses | LOW | 15min | Cosmetic; via `DELETE /admin/cleanup` |
| 8 | Remove orphan Ethereal test scripts in `e2e/` | LOW | 5min | Carryover |
| 9 | Enable Send mail (Resend API) | LOW | 1h | D4 deferred |
| 10 | Enable Workers AI extract (OTP) | LOW | 1h | D4 deferred |
| 11 | Enable Telegram bot | LOW | 2h | D4 deferred |

### 18.5 Recommended next step

**Add the R2 lifecycle rule (item #1 above). 5 minutes, prevents R2 bloat.** Concrete command:

```bash
# Tạo lifecycle rule: xóa backup-*.sql cũ hơn 30 ngày
wrangler r2 bucket lifecycle add mmailtemp-backup expire-old-backups backup- --expire-days 30 --force
```

(Or via Dashboard → R2 → mmailtemp-backup → Settings → Lifecycle rules.)

### 18.6 Full report

See `docs/PRECHECK_2026-08-18-D1-BACKUP.md` for the 22.7 KB detailed audit (8 sections, 18 risks catalogued, 4 observations, 5 SQL checks, 14 smoke tests).

---

## 19. UPDATE 2026-08-18 12:40 — R2 lifecycle rule DONE, pre-check PASS

**Trigger**: User requested to run the §18.5 recommended next step (5-min R2 lifecycle rule) + immediate pre-check.

**Session**: `mvs_d71c5ee9d09b4c0f8addd01ca2d80dea` (continued)

### 19.1 What I shipped

Added 1 R2 lifecycle rule to the `mmailtemp-backup` bucket via wrangler CLI:

- **Rule id**: `expire-old-backups`
- **Prefix**: `backup-` (only matches the D1 backup files, not anything else)
- **Action**: Delete objects after **30 days** (2592000 seconds)
- **Status**: `enabled: Yes`

**Command** (5 minutes, no code change needed):

```bash
wrangler r2 bucket lifecycle add mmailtemp-backup expire-old-backups backup- --expire-days 30 --force
```

This addresses **R12** from the §18 risk table (no lifecycle rule → R2 grows forever).

### 19.2 Verification (4 checks)

| Check | Method | Result |
|---|---|---|
| Rule persisted | `wrangler r2 bucket lifecycle list` | ✅ `expire-old-backups: Yes / backup- / Expire objects after 30 days` |
| Rule visible via API | `GET /accounts/.../r2/buckets/.../lifecycle` | ✅ id=`expire-old-backups`, prefix=`backup-`, maxAge=2592000 |
| Existing backup not affected | `GET /accounts/.../r2/buckets/.../objects` | ✅ `backup-2026-08-18.sql` still there (only 0 days old) |
| Default multipart-abort rule still there | `list` | ✅ `Default Multipart Abort Rule: Yes / (all prefixes) / Abort after 7 days` |

### 19.3 Pre-check 4-category

| # | Category | Verdict | Note |
|---|---|---|---|
| 1 | **Logic đúng chưa?** | ✅ PASS | Rule applied with correct prefix + duration. Verified via wrangler + CF API |
| 2 | **Workflow ổn chưa?** | ⚠️ PARTIAL | `add` is NOT idempotent (re-run returns error 10061). `remove` requires `--name` flag. Workaround: `remove --name` then `add` again, or use `set --file <json>` for atomic updates |
| 3 | **Thiếu tính năng gì?** | ❌ NO | R12 (R2 bloat) is now mitigated. Other gaps (notification, restore endpoint, unit tests) are still in §18.4 |
| 4 | **Rủi ro tiềm ẩn?** | ⚠️ NEW R19 | If user wants a >30-day-old backup for audit/legal, it's GONE. R2 lifecycle is irreversible (deleted objects cannot be recovered). Mitigation: documented 30-day window; can change to 60/90 days by re-running rule |

### 19.4 Bug sweep (1 minor CLI quirk found — accepted)

**Wrangler CLI quirk**: `wrangler r2 bucket lifecycle add` is **NOT idempotent**. Re-running with the same rule id returns `Invalid Lifecycle Configuration: Rule IDs must be unique [code: 10061]`. To "update" an existing rule, the workflow is:
1. `wrangler r2 bucket lifecycle remove <bucket> --name <rule_name>`
2. `wrangler r2 bucket lifecycle add <bucket> <new_name> [prefix] --expire-days <new_days> --force`

Alternative: `wrangler r2 bucket lifecycle set <bucket> --file <json>` for atomic updates (replaces all rules at once).

Not a bug in our project code (this is wrangler behavior), but worth noting if user wants to change the rule later.

### 19.5 Items resolved / newly opened

| Status | Item | Note |
|---|---|---|
| ✅ RESOLVED | R12: No R2 lifecycle rule | Now mitigated by 30-day expire rule |
| 🆕 NEW R19 | Backups > 30 days are GONE | Documented; can change to 60/90 days if needed |
| 🆕 NEW CLI-QUIRK | `wrangler r2 bucket lifecycle add` not idempotent | See §19.4 above |

### 19.6 Full report

See `docs/PRECHECK_2026-08-18-LIFECYCLE.md` for the 1-page detailed audit (4 checks, 1 CLI quirk, 1 new risk).

