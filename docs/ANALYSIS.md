# ANALYSIS — Repo `cloudflare_temp_email`

> Phân tích chi tiết repo `monet88/cloudflare_temp_email` (fork từ `dreamhunter2333/cloudflare_temp_email`).
> Repo gốc có **11.3k stars, 7.6k forks** trên GitHub.

---

## 1. Repo làm gì?

Dịch vụ **email tạm thời (temporary email)** tự host trên Cloudflare. User tạo hàng loạt địa chỉ `@your-domain.com`, nhận/gửi mail, xem trên web UI, tích hợp Telegram Bot, Webhook, SMTP/IMAP, AI extract OTP.

**Demo public**: https://mail.awsl.uk/

**Tính năng chính**:
- Gửi + nhận email (DKIM support)
- AI extract OTP từ email (Cloudflare Workers AI)
- Random subdomain: `xxx@your-domain.com`
- Telegram Bot + Telegram Mini App
- Webhook
- SMTP/IMAP proxy (Python)
- OAuth2 (GitHub, Authentik), Passkey login
- Admin console: tạo mailbox, cleanup policy, blacklist
- Đa ngôn ngữ (zh/en/ja)
- Shadow DOM chống CSS leak
- Skill cho AI agent: `cf-temp-mail-agent-mail`

---

## 2. Tech stack

| Layer | Tech |
|---|---|
| Frontend | Vue 3 + Vite + TypeScript + Naive UI |
| Backend | TypeScript + Hono + Cloudflare Workers |
| Email parser | Rust → WASM (`mail-parser-wasm`) |
| Database | Cloudflare D1 (SQLite) |
| Storage | Cloudflare KV + R2 (optional S3) |
| Email nhận | Cloudflare Email Routing |
| Email gửi | SMTP hoặc Resend (multi-provider) |
| Optional proxy | Python SMTP/IMAP server |

**Hard requirement**: 1 domain hosted trên Cloudflare DNS, bật Email Routing.

---

## 3. Cấu trúc project (theo CLAUDE.md)

| Folder | Vai trò | Dev | Build | Deploy |
|---|---|---|---|---|
| `worker/` | Backend Workers API | `pnpm dev` | `pnpm build` | `pnpm deploy` |
| `frontend/` | Vue 3 app | `pnpm dev` | `pnpm build` | `pnpm deploy` |
| `pages/` | Pages middleware (forward API → Worker) | – | – | – |
| `mail-parser-wasm/` | Rust → WASM parser | – | `wasm-pack build --release` | – |
| `smtp_proxy_server/` | Python SMTP/IMAP proxy | `python main.py` | – | – |
| `db/` | SQL migrations cho D1 | – | – | – |
| `vitepress-docs/` | Docs site (zh + en) | `pnpm dev` | `pnpm build` | – |
| `e2e/` | Playwright tests trong Docker | – | – | – |

---

## 4. Cần API không? Local hay VPS? Cần GPU?

| Câu hỏi | Trả lời |
|---|---|
| Cần API mua ngoài? | ❌ Không |
| Cần server/VPS? | ❌ Không — chạy 100% trên Cloudflare free tier |
| Cần domain? | ✅ **Bắt buộc** (~10 USD/năm, Đại Ka đã có `miraclelab.online`) |
| Cần GPU? | ❌ Không — Workers AI dùng CPU inference của Cloudflare |
| Cần Docker? | ❌ Không (chỉ cần cho e2e tests) |
| Cần Node.js? | ✅ Có, version mới (project dùng `pnpm`) |
| Cần Rust? | ⚠️ Chỉ khi build lại mail-parser WASM (download prebuilt từ release thì không cần) |

---

## 5. Triển khai — 3 cách

### Cách A: GitHub Actions (khuyên dùng)
- Fork repo về `monet88`
- Set GitHub Secrets: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `BACKEND_TOML`, `FRONTEND_ENV`, `FRONTEND_NAME`, `PAGE_TOML`
- Enable workflow: `Deploy Backend` + `Deploy Frontend with page function`
- Enable `Upstream Sync` để auto-sync code mới
- 5–15 phút từ fork tới demo chạy

### Cách B: Wrangler CLI
```bash
pnpm install
pnpm db:remote          # tạo D1
pnpm deploy:worker      # deploy worker
pnpm deploy:pages       # deploy frontend
```
Cần `BACKEND_TOML` ở `worker/wrangler.toml`, `FRONTEND_ENV` ở `frontend/.env`.

### Cách C: Cloudflare UI (no code)
- Download `worker.js` + `frontend.zip` từ GitHub Releases
- Cloudflare Dashboard → Workers → upload `worker.js`
- Pages → upload `frontend.zip`
- Email Routing → bật catch-all → trỏ về Worker

**Note quan trọng**: `*.workers.dev` không truy cập được từ Việt Nam, **phải dùng custom domain**.

---

## 6. Ưu điểm

1. **Free thật sự** (chỉ tốn domain)
2. **Không quản server** — Cloudflare lo hết
3. **Nhiều tính năng** hơn temp-mail truyền thống (AI, Telegram, OAuth, Passkey)
4. **Domain riêng** → không bị chặn
5. **Cộng đồng lớn** (11.3k stars)
6. **AI agent friendly** — có sẵn skill
7. **Open source MIT**
8. **Rust WASM parser** nhanh + chịu mail "bẩn"

---

## 7. Nhược điểm

1. **Phụ thuộc Cloudflare** (vendor lock-in)
2. **Cần domain** (10–15 USD/năm)
3. **Free tier giới hạn**: 100k request/day, 10ms CPU time
4. **Workers AI quota** giới hạn (cần track)
5. **Cloudflare Email Sending API ngừng free 30/06/2024** → phải dùng Resend/SMTP riêng
6. **DKIM/SPF setup khó** cho người mới
7. **Một số dịch vụ chặn subdomain random** — cần reputation tốt
8. **Repo `monet88` không khác upstream** (chỉ là fork mirror)

---

## 8. Đối thủ cạnh tranh

| Tên | Stack | Host | Điểm mạnh |
|---|---|---|---|
| **Moemail** (beilunyang/moemail) | Next.js + CF | CF | UI đẹp |
| **vmail** (oiov/vmail) | – | CF | Đơn giản |
| **smail** (akazwz/smail) | CF Worker | CF | Custom build |
| **mail2telegram** (TBXark) | CF Email + Telegram | CF | Forward mail → Telegram |
| **TempFastMail** (kasteckis) | FrankenPHP + Docker | Self-host | Full control |
| **tempmail** (elbunuelo) | Docker | Self-host | Docker đơn giản |
| **Mailcow** | Full mail server | Self-host | Đầy đủ tính năng, nặng |
| **Mail-in-a-Box** | Full mail server | Self-host | Tự host full mail, quá nặng |

**So sánh trực tiếp**:
- Miễn phí + ít quản lý + nhiều tính năng → **cloudflare_temp_email** (chính cái này)
- UI đẹp nhất → Moemail
- Self-host 100% → TempFastMail / tempmail
- Alias dài hạn → SimpleLogin / AnonAddy

---

## 9. Đối tượng phù hợp

✅ Dev/QA cần test email, AI agent workflow, privacy-conscious user, marketer/SEO, Telegram power user, hobby self-host.
❌ Doanh nghiệp cần email chính thức, người cần self-host 100% không vendor, người không có domain.
