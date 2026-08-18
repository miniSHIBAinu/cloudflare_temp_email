# CONTRIBUTING — mmailtemp dev workflow

> Hướng dẫn workflow phát triển dự án: branch strategy, PR conventions, backup/restore/rollback.

---

## 1. Tổng quan

Project `mmailtemp` (= `cloudflare_temp_email` self-hosted) có **2 chế độ làm việc**:

| Mode | Khi nào | Có push GitHub? |
|---|---|---|
| **Local-only** (mặc định hiện tại) | Đại Ka chưa cần sync lên GitHub | ❌ Không |
| **Sync lên miniSHIBAinu fork** | Khi muốn backup code lên GitHub của Đại Ka | ✅ Có, dùng GITHUB_TOKEN đã có |

User đã chốt ngày 2026-08-17: **KHÔNG push lên `monet88/cloudflare_temp_email`** (vì đó là fork cá nhân user khác). Nếu muốn sync, push lên `miniSHIBAinu` (GitHub account của Đại Ka theo `GITHUB_TOKEN` trong `.env.local`).

---

## 2. Branch strategy

### Branches

| Branch | Vai trò | Ai push | Khi nào merge vào main |
|---|---|---|---|
| `main` | Source code ổn định, mirror upstream `dreamhunter2333/cloudflare_temp_email` | Ai cũng được, nhưng CẤM push trực tiếp lên main | – |
| `dev` | Branch tích hợp, nơi merge các feature branches | Maintainer | Khi đã test kỹ |
| `feat/<short-name>` | Tính năng mới (vd: `feat/ai-extract-vi`, `feat/custom-domain`) | Developer | Khi PR được review |
| `fix/<short-name>` | Bug fix (vd: `fix/d1-migration-error`) | Developer | Khi PR được review |
| `chore/<short-name>` | Tác vụ phụ (deps update, docs, refactor) | Developer | Khi PR được review |

### Quy tắc đặt tên branch

- Lowercase, dấu gạch ngang
- Tên ngắn gọn (≤ 50 chars)
- Không dùng ID ticket trừ khi có quy ước (`feat/JIRA-123-add-oauth`)

### Ví dụ

```bash
# Tạo feature branch mới
git checkout -b feat/custom-domain-mail-api

# Sau khi xong, push lên origin
git push -u origin feat/custom-domain-mail-api

# Mở PR trên GitHub: feat/custom-domain-mail-api → main
```

---

## 3. PR conventions

### Tiêu đề PR

`<type>(<scope>): <mô tả ngắn>`

Trong đó:
- **type**: `feat` | `fix` | `chore` | `docs` | `refactor` | `test`
- **scope** (optional): `worker` | `frontend` | `db` | `docs` | `ci`

Ví dụ:
- `feat(worker): thêm AI extract OTP tiếng Việt`
- `fix(frontend): hydration mismatch trên mobile`
- `chore(deps): bump wrangler lên 4.x`
- `docs: cập nhật CONTEXT.md sau khi deploy`

### Mô tả PR (template)

```markdown
## Mục đích
- Mô tả ngắn vấn đề/tính năng

## Thay đổi
- File 1: thêm X
- File 2: sửa Y
- ...

## Test
- [ ] Manual test
- [ ] E2E test
- [ ] Type check / lint

## Breaking changes
- Có / Không (nếu có, mô tả chi tiết + migration plan)

## Screenshot (nếu có UI changes)
```

### Review checklist

Trước khi merge, reviewer check:
- [ ] Logic đúng (đã test trên local)
- [ ] Không commit secrets / .env* / API key
- [ ] Không break existing tests
- [ ] Migration nếu có breaking change (DB schema, API contract)
- [ ] Docs updated (CONTEXT.md, README)

---

## 4. Backup / Restore / Rollback

### 4.1 Khi nào cần backup

- Trước khi refactor lớn (thay đổi schema, đổi structure)
- Trước khi upgrade dependency lớn (wrangler, Vue, Hono)
- Trước khi merge PR có nhiều files thay đổi
- Định kỳ (1 tuần/lần) nếu làm việc nhiều

### 4.2 Backup local (offline)

**Cách 1: Git tag** (khuyên dùng)
```bash
# Trước khi làm việc lớn
git tag backup-pre-<feature-name>-$(date +%Y%m%d)
git tag -l "backup-pre-*"   # xem danh sách backup

# Rollback về backup
git checkout backup-pre-feat-custom-domain-20260817
```

**Cách 2: Copy folder** (cho non-git backup)
```bash
# Windows PowerShell
Copy-Item -Path "G:\VIBE\mmailtemp\_clone_tmp" -Destination "G:\VIBE\mmailtemp_backup_$(Get-Date -Format 'yyyyMMdd')" -Recurse
```

### 4.3 Backup Cloudflare state

**Worker**: Cloudflare giữ lịch sử versions, có thể rollback qua Dashboard hoặc API
- Dashboard: Workers & Pages → mmailtemp → Deployments → chọn version → "Rollback"

**D1 database**: 
- Có 30-day backup tự động (Time Travel): Dashboard → D1 → mmailtemp → Time Travel → chọn timestamp
- Manual export: `wrangler d1 export mail-miraclelab --output=backup.sql`

**KV / R2**: Có versioning nhưng cần enable

### 4.4 Rollback quy trình

| Tình huống | Cách rollback |
|---|---|
| Code mới bị bug | `git revert <sha>` → commit → push |
| D1 migration lỗi | `wrangler d1 execute mail-miraclelab --file=rollback.sql` |
| Worker deploy bị lỗi | Dashboard → Workers → Deployments → Rollback |
| Mất local repo | Clone lại từ GitHub + restore D1 từ Time Travel |

### 4.5 ⚠️ KHÔNG BAO GIỜ làm

- ❌ `git reset --hard` + `git push --force` lên branch chung (phá shared history)
- ❌ Xóa D1 database khi không chắc (mất hết mail data)
- ❌ Sửa `wrangler.toml` rồi deploy mà không test local trước
- ❌ Commit `.env.local` lên git (token leak → khóa account)

---

## 5. Sync với upstream (dreamhunter2333)

```bash
# Fetch commits mới từ upstream
git fetch upstream

# Merge vào branch main (local) - KHÔNG push
git checkout main
git merge upstream/main

# Nếu có conflict, resolve manually
# Sau khi resolve:
git add .
git commit -m "chore: sync with upstream"
```

**Lưu ý**: Nếu đã có commit riêng trên main, sync sẽ phức tạp. Khuyên dùng:
- Tạo branch `dev` từ main ban đầu
- Commit riêng lên `dev`
- Merge upstream vào `main` (nhanh, ít conflict)
- Định kỳ rebase `dev` từ `main`

---

## 6. Quy trình deploy (wrangler CLI)

### Pre-deploy
1. Update `wrangler.toml.template` nếu thay đổi config
2. Test local: `pnpm --filter worker dev`
3. Test frontend local: `pnpm --filter frontend dev`
4. Pre-check xem có breaking change không

### Deploy worker
```powershell
$env:CLOUDFLARE_API_TOKEN = (Get-Content .env.local | Select-String "CLOUDFLARE_API_TOKEN=" | ForEach-Object { $_ -split "=" | Select-Object -Last 1 })
$env:CLOUDFLARE_ACCOUNT_ID = "4965aa306e33c826c1b7248640f6872b"
pnpm --filter worker run deploy
```

### Deploy frontend
```powershell
pnpm --filter frontend run build
# Upload dist/ qua Cloudflare Dashboard hoặc wrangler pages
npx wrangler pages deploy frontend/dist --project-name=mail-miraclelab
```

### Post-deploy
1. Verify: mở `https://mail.miraclelab.online` → check console errors
2. Test email routing: gửi mail tới `test@miraclelab.online` → check webhook fired
3. Update CONTEXT.md với thay đổi mới
4. Commit + (optional) push

---

## 7. Khi nào tạo PR mới (cần thiết)

| Tình huống | Tạo PR? |
|---|---|
| Đại Ka làm việc hoàn toàn local, không push | ❌ Không cần |
| Đại Ka push lên `miniSHIBAinu/mmailtemp` repo | ✅ Tạo PR `feat/x → main` để track changes |
| Contributor khác muốn contribute | ✅ Bắt buộc có PR (qua fork) |
| Auto-generated (vd sync upstream) | ❌ Direct merge OK, không cần PR |

**Hiện tại: KHÔNG cần tạo PR** vì user chốt local-only. Tạo branch chỉ khi sẵn sàng push lên GitHub.
