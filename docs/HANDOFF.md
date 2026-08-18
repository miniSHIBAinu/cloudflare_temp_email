# HANDOFF — mmailtemp deployment

> **Session này dài rồi → cần handover sang session mới.** Paste section "Prompt cho session mới" vào đầu message session mới.

## Tóm tắt 1 phút

- **Project**: `G:\VIBE\mmailtemp\_clone_tmp\` (fork github.com/monet88/cloudflare_temp_email)
- **Stack**: Cloudflare Workers + D1 + Pages Email Routing (front-end serve qua Worker assets)
- **Domain**: `miraclelab.online` (đã hosted trên CF, account `sevengotek@gmail.com`)
- **Custom domains**:
  - `https://mail.miraclelab.online` — Frontend + API (single domain, gọi API qua `/api/...`)
  - `https://mail-api.miraclelab.online` — dự phòng, có thể bỏ
- **Worker**: `cloudflare_temp_email` (Version mới nhất: `ff715bab-a73c-43fe-a4d1-91d4d6adb79b`)
- **D1**: `temp-email-db` (UUID `99d25375-9773-4571-8b7a-ae6871dba0d3`, 160KB data sẵn)
- **Email Routing**:
  - `*@miraclelab.online` → worker (wildcard rule, workaround cho catch-all)
  - `contact@miraclelab.online` → forward `ngohong7710@gmail.com`
  - Catch-all (`all`) → disabled (CF giới hạn: catch-all không support worker)
- **Auth**: dùng `CLOUDFLARE_GLOBAL_TOKEN` (Global API Key) trong `.env.local` (X-Auth-Email + X-Auth-Key)

## Trạng thái hiện tại (verified 2026-08-17 20:15)

| Item | Status |
|---|---|
| Worker deployed | ✅ |
| D1 connected | ✅ |
| Frontend serve qua Worker | ✅ |
| API work trên `mail.miraclelab.online/api/...` | ✅ |
| API work trên `mail-api.miraclelab.online/api/...` | ✅ |
| CORS preflight | ✅ 204 |
| DNS MX + DKIM + SPF | ✅ |
| Email Routing wildcard rule | ✅ |
| Cron cleanup | ✅ |

## Files quan trọng

| File | Mô tả |
|---|---|
| `G:\VIBE\mmailtemp\_clone_tmp\.env.local` | Tokens (gitignored) |
| `G:\VIBE\mmailtemp\_clone_tmp\worker\wrangler.toml` | Worker config (đã fill) |
| `G:\VIBE\mmailtemp\_clone_tmp\frontend\.env` | VITE_API_BASE = `https://mail.miraclelab.online` |
| `G:\VIBE\mmailtemp\_clone_tmp\docs\CONTEXT.md` | Single source of truth |
| `G:\VIBE\mmailtemp\_clone_tmp\docs\SETUP_LOG.md` | Chi tiết từng bước |
| `G:\VIBE\mmailtemp\_clone_tmp\docs\ANALYSIS.md` | Phân tích repo + đối thủ |
| `G:\VIBE\mmailtemp\_clone_tmp\docs\CONTRIBUTING.md` | Workflow dev + branch strategy |
| `G:\VIBE\mmailtemp\_clone_tmp\docs\SECURITY.md` | Bảo mật + bot scan protection |
| `G:\VIBE\mmailtemp\_clone_tmp\docs\HANDOFF.md` | File này |

## Công việc còn lại (TODO cho session mới)

### Cấu hình thêm (optional)
- [ ] **Enable send mail API** (cần Resend API key hoặc SMTP provider) — bỏ comment `send_email = [{ name = "SEND_MAIL" }]` trong wrangler.toml
- [ ] **Enable AI extract** (cần Workers AI) — bỏ comment `[ai] binding = "AI"`
- [ ] **Enable Telegram bot** (cần TG_BOT_TOKEN) — set trong wrangler.toml vars
- [ ] **Cleanup mail-api.miraclelab.online** (nếu không dùng): xóa CNAME + Worker Route
- [ ] **Setup D1 backup tự động** (Time Travel có sẵn, manual export qua `wrangler d1 export`)

### Test thực tế
- [ ] User gửi mail thật từ Gmail tới `*@miraclelab.online` → check `https://mail.miraclelab.online` có mail không
- [ ] Test gửi mail qua API (`/api/send_mail`) sau khi config Resend/SMTP
- [ ] Test tất cả tính năng trong frontend: tạo address, đọc mail, delete, v.v.

### Monitor
- [ ] Check Cloudflare Workers logs: `npx wrangler tail`
- [ ] Check D1 metrics: `npx wrangler d1 info temp-email-db`
- [ ] Setup uptime monitoring (uptimerobot, statuscake, v.v.)

## Prompt cho session mới (paste đầu message)

```
Project: G:\VIBE\mmailtemp\_clone_tmp\ (fork github.com/monet88/cloudflare_temp_email)
Stack: Cloudflare Workers + D1 + Worker [assets] for frontend + Email Routing
Domain: miraclelab.online
Worker: cloudflare_temp_email (đã deploy, version ff715bab)
D1: temp-email-db (99d25375-...)

Đọc các file sau để hiểu context:
1. docs\CONTEXT.md (single source of truth)
2. docs\HANDOFF.md (file này — session trước đã làm gì)
3. docs\SETUP_LOG.md (chi tiết từng bước)
4. docs\ANALYSIS.md (phân tích repo)
5. docs\CONTRIBUTING.md (workflow dev)
6. docs\SECURITY.md (bảo mật)

Biến môi trường: đọc từ .env.local (đã gitignored):
- CLOUDFLARE_GLOBAL_EMAIL = sevengotek@gmail.com
- CLOUDFLARE_GLOBAL_TOKEN = cfk_xxx (Global API Key)
- CLOUDFLARE_ACCOUNT_ID = ac634c95b84b2c72e3ce2c221374b52b (account Sevengotek)
- GITHUB_TOKEN = ghp_xxx (account miniSHIBAinu)
- VERCEL_TOKEN = vcp_xxx

Đã chạy được:
- Worker deployed, frontend + API trên mail.miraclelab.online
- Email Routing wildcard rule *@miraclelab.online → worker
- API test create address OK

Cần làm tiếp: (tùy yêu cầu user mới)
- Enable send mail API (Resend)
- Enable AI extract
- Enable Telegram bot
- Test end-to-end với Gmail
- Cleanup mail-api subdomain
- Setup monitoring
```

## Commands nhanh cần dùng

```powershell
# Set env (sau khi cd vào repo)
$envVars = @{}
Get-Content .env.local | ForEach-Object {
  if ($_ -match '^([A-Z_]+)=(.+)$') { $envVars[$Matches[1]] = $Matches[2] }
}
[System.Environment]::SetEnvironmentVariable("CLOUDFLARE_API_KEY", $envVars['CLOUDFLARE_GLOBAL_TOKEN'], "Process")
[System.Environment]::SetEnvironmentVariable("CLOUDFLARE_EMAIL", $envVars['CLOUDFLARE_GLOBAL_EMAIL'], "Process")
[System.Environment]::SetEnvironmentVariable("CLOUDFLARE_ACCOUNT_ID", $envVars['CLOUDFLARE_ACCOUNT_ID'], "Process")

# Build frontend
cd frontend
pnpm run build

# Deploy worker (includes new assets)
cd ../worker
npx wrangler deploy --minify

# Check email routing
npx wrangler email routing rules list miraclelab.online

# Check worker status
npx wrangler tail
```
