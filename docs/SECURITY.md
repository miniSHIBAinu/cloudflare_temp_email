# SECURITY — Secrets & Bot scan protection

> Quy tắc bảo mật bắt buộc cho project này. Supabase / Firebase / Google có bot quét **rất gắt** — vi phạm có thể bị KHÓA tài khoản hoặc project.

---

## 1. Tuyệt đối KHÔNG commit

### Secrets / Credentials
- ❌ `.env`, `.env.local`, `.env.*.local`
- ❌ `BACKEND_TOML`, `FRONTEND_ENV`, `PAGE_TOML` (GH Actions secrets)
- ❌ `wrangler.toml` (file thật, KHÔNG phải template)
- ❌ `.dev.vars`
- ❌ `*.pem`, `*.key`, `*.cert`
- ❌ `service-account*.json`, `*-credentials.json`
- ❌ `secrets/` folder
- ❌ API keys, OAuth client secrets, GitHub PAT

### Build artifacts
- ❌ `node_modules/`
- ❌ `dist/`, `build/`, `.next/`, `out/`, `.nuxt/`
- ❌ `*.tsbuildinfo`
- ❌ `.wrangler/`

### Large binaries (Google bot scan)
- ❌ `*.apk`, `*.aab`, `*.ipa` (mobile)
- ❌ `*.exe`, `*.dll`, `*.so`, `*.dylib`
- ❌ `*.mp4`, `*.mov`, `*.avi`, `*.mkv`, `*.webm` (video)
- ❌ `*.zip`, `*.tar.gz`, `*.7z`, `*.rar`
- ❌ `*.pdf`, `*.psd`, `*.ai`, `*.fig`

### AI agent per-machine rác
- ❌ `.claude/memory/`, `.claude/cache/`, `.claude/logs/`, `.claude/scratch/`
- ❌ `.claude/settings.local.json`
- ❌ `.agents/logs/`, `.agents/cache/`, `.agents/memory/`
- ❌ `.gemini/logs/`, `.gemini/cache/`
- ❌ `.codex/sessions/`, `.codex/logs/`

---

## 2. ✅ PHẢI GIỮ LẠI (commit được)

### AI agent config (cho portability khi clone sang máy khác)
- ✅ `.agents/skills/` — skills + workflows
- ✅ `.agents/AGENTS.md` (nếu có)
- ✅ `.agents/workflows/`
- ✅ `.agents/rules/`
- ✅ `.claude/skills/` — Claude Code skills (mirror của `.agents/`)
- ✅ `.claude/CLAUDE.md`
- ✅ `.codex/AGENTS.md`, `.codex/config.toml`, `.codex/agents/`
- ✅ `.mcp.json` — MCP servers config (auto-wire khi clone)

### Project config
- ✅ `wrangler.toml.template` (template, KHÔNG phải file thật)
- ✅ `worker/wrangler.toml.template`
- ✅ `frontend/.env.example`, `smtp_proxy_server/.env.example` (template)
- ✅ `.github/workflows/*.yaml` (CI/CD)

---

## 3. Trước khi push — verify checklist

```powershell
# 1. Check secrets
git status
git diff --staged --name-only | Select-String -Pattern "\.env|wrangler\.toml$|\.dev\.vars|secrets" 
# → PHẢI rỗng

# 2. Check large files
git diff --staged --stat | Where-Object { $_ -match '\s(\d+)\s' | ForEach-Object { [int]$Matches[1] } } | Where-Object { $_ -gt 100000 }
# → PHẢI không có file > 100KB

# 3. Check binary extensions
git diff --staged --name-only | Select-String -Pattern "\.(apk|aab|ipa|exe|dll|so|mp4|mov|zip|pdf)$"
# → PHẢI rỗng

# 4. Check AI agent rác
git diff --staged --name-only | Select-String -Pattern "\.(claude|agents|gemini|codex)/(memory|cache|logs|scratch|sessions)"
# → PHẢI rỗng
```

---

## 4. Sau khi lộ secret (rotation)

Nếu vô tình commit/push secret lên GitHub:

### Bước 1: REVOKE token ngay
- Cloudflare: https://dash.cloudflare.com/profile/api-tokens → tìm token → Roll
- GitHub: Settings → Developer settings → PAT → Regenerate / Revoke
- Vercel: https://vercel.com/account/tokens → Revoke

### Bước 2: Tạo token mới
- Tạo token mới với scope tương tự
- Update `.env.local` ở local
- Verify scope (xem `docs/CONTEXT.md` section 4.3)

### Bước 3: Xóa secret khỏi GitHub history
```bash
# Dùng git-filter-repo (cài: pip install git-filter-repo)
git filter-repo --in-place --filename .env.local
git push origin --force --all
# Hoặc dùng BFG Repo-Cleaner (https://rtyley.github.io/bfg-repo-cleaner/)
```

### Bước 4: Notify Cloudflare / GitHub
- Nếu token CF có quyền cao, vào support và báo cáo
- GitHub tự động scan và có thể đã revoke

---

## 5. .gitignore đã cover

Đã thêm (xem `.gitignore`):
- `.env`, `.env.*.local` ✅
- `BACKEND_TOML`, `FRONTEND_ENV`, `PAGE_TOML` ✅
- `wrangler.toml`, `.dev.vars` ✅
- `*.pem`, `*.key`, `*.cert` ✅
- `service-account*.json`, `*-credentials.json` ✅
- `secrets/` folder ✅
- Large binaries (apk, mp4, zip, ...) ✅
- AI agent per-machine state ✅

**KHÔNG thêm ignore**:
- `.agents/skills/` → GIỮ để clone portable
- `.claude/skills/` → GIỮ
- `.mcp.json` → GIỮ
- `wrangler.toml.template` → GIỮ (template, không có secret)

---

## 6. Lưu ý đặc biệt cho mmailtemp

### Email Routing + Domain
- Domain `miraclelab.online` đã active trên Cloudflare
- **Catch-all** email routing sẽ forward tất cả mail tới Worker
- Worker sẽ xử lý và lưu vào D1
- ⚠️ Nếu domain bị compromise → attacker có thể nhận tất cả mail → cần bảo vệ token CF cẩn thận

### D1 có chứa mail
- D1 database `mail-miraclelab` chứa tất cả email của user
- Không mã hóa (Workers không có crypto API free)
- Ai có quyền D1 Edit → đọc được tất cả mail
- → Bảo vệ `CLOUDFLARE_API_TOKEN` là bảo vệ data người dùng

### Telegram Bot Token (nếu dùng)
- Cấu hình qua `TG_BOT_INFO` trong wrangler.toml
- Nếu commit nhầm → revoke token ngay trên @BotFather
