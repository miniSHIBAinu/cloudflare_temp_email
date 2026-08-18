/* TempMail — vanilla UI for cloudflare_temp_email worker
 * Backend: https://mail.miraclelab.online
 * API contract: {success: true, data: ...} | {success: false, error: {code, message}}
 */
const S = { email: '', user: '', domain: '', domains: [], jwt: '', messages: [], refreshTimer: null, page: 1, pageSize: 20, selectedId: '', openRequest: 0 };
const $ = id => document.getElementById(id);
const LS_KEY = 'tempmail_miraclelab_v1';

/* ---------- Toast / error ---------- */
const toast = msg => {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
};
const showError = msg => {
  const e = $('inline-error');
  e.textContent = msg;
  e.classList.add('show');
  setTimeout(() => e.classList.remove('show'), 3000);
};
const copyText = (text, done = 'Đã sao chép!') => {
  if (!text) { toast('Không có gì để sao chép'); return; }
  navigator.clipboard.writeText(text).then(() => toast(done)).catch(() => {
    const i = document.createElement('input');
    i.value = text;
    document.body.appendChild(i);
    i.select();
    document.execCommand('copy');
    document.body.removeChild(i);
    toast(done);
  });
};
const fmtDate = d => {
  try {
    return new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return String(d || ''); }
};

/* ---------- API adapter ----------
 * Worker backend uses:
 *   - GET  /open_api/settings                    → {domains, defaultDomains, ...}
 *   - POST /api/new_address  body: {name,domain} → {jwt, address, password, address_id}
 *   - GET  /api/parsed_mails?limit=N&offset=0    → {results:[...], count}     (auth: Bearer)
 *   - GET  /api/parsed_mail/:id                  → {sender, subject, text, html, ...} (auth: Bearer)
 *   - DELETE /api/mails/:id                      → {success:true}              (auth: Bearer)
 *   - DELETE /api/delete_address                 → {success:true}              (auth: Bearer)
 *   - GET  /api/settings                         → {address, send_balance}     (auth: Bearer)
 *
 * Public contract exposed to UI: {success, data} | {success, error}
 */
const api = async (method, path, body = null, auth = false) => {
  const opts = { method, headers: { 'content-type': 'application/json' } };
  if (auth && S.jwt) opts.headers['Authorization'] = 'Bearer ' + S.jwt;
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(path, opts);
  let d;
  try { d = await r.json(); } catch { d = null; }
  if (!r.ok) {
    const msg = (d && d.error) ? (typeof d.error === 'string' ? d.error : (d.error.message || r.statusText)) : r.statusText;
    throw new Error(msg || ('HTTP ' + r.status));
  }
  return d;
};

/* Wrap Worker response into the {success, data} envelope used by this UI.
 * Worker often returns the payload directly (e.g. {jwt, address, address_id}) or {results, count}. */
const ok = data => ({ success: true, data });
const wrap = (raw) => raw && raw.success !== undefined ? raw : ok(raw);

/* ---------- Storage ---------- */
const persist = () => {
  if (S.email && S.jwt) {
    localStorage.setItem(LS_KEY, JSON.stringify({ email: S.email, user: S.user, domain: S.domain, jwt: S.jwt }));
  } else {
    localStorage.removeItem(LS_KEY);
  }
};

const setEmail = (email, user, domain, jwt) => {
  S.email = email;
  S.user = user;
  S.domain = domain;
  S.jwt = jwt || S.jwt;
  $('current-email').textContent = email || 'Chưa có địa chỉ';
  $('email-badge').textContent = email || '';
  $('username-input').value = user || '';
  const urlEl = $('url-email');
  if (email) {
    const url = location.origin + '/#' + encodeURIComponent(email);
    urlEl.textContent = url;
    urlEl.href = url;
    urlEl.title = 'Bấm để sao chép link hộp thư';
    history.replaceState(null, '', '/#' + encodeURIComponent(email));
  } else {
    urlEl.textContent = '';
    urlEl.removeAttribute('href');
    history.replaceState(null, '', '/');
  }
  persist();
};

const clearMessageDetail = () => {
  S.selectedId = '';
  $('message-detail').style.display = 'none';
  $('detail-body').replaceChildren();
};

/* ---------- Render ---------- */
const normalizeMessage = m => ({
  id: m.id,
  from: m.sender || m.source || '(unknown)',
  subject: m.subject || '(không có tiêu đề)',
  receivedAt: m.created_at || m.receivedAt || Date.now(),
  otp: null,
  size: 0,
  _raw: m,
});

const renderMessages = msgs => {
  S.messages = msgs;
  $('inbox-count').textContent = msgs.length;
  $('unread-count').textContent = msgs.length;
  const empty = $('empty-state'), tableWrap = $('message-table-wrap'), pager = $('message-pager');
  if (!msgs.length) { empty.style.display = 'flex'; tableWrap.style.display = 'none'; pager.style.display = 'none'; clearMessageDetail(); return; }
  if (S.selectedId && !msgs.some(m => m.id === S.selectedId)) clearMessageDetail();
  empty.style.display = 'none'; tableWrap.style.display = 'block'; pager.style.display = 'flex';
  const totalPages = Math.max(1, Math.ceil(msgs.length / S.pageSize));
  if (S.page > totalPages) S.page = totalPages;
  const start = (S.page - 1) * S.pageSize;
  const pageItems = msgs.slice(start, start + S.pageSize);
  $('pager-status').textContent = 'Hiển thị ' + (start + 1) + '-' + (start + pageItems.length) + ' / ' + msgs.length + ' email';
  $('pager-page').textContent = S.page;
  $('prev-page').disabled = S.page <= 1;
  $('next-page').disabled = S.page >= totalPages;
  $('inbox-body').replaceChildren(...pageItems.map(m => {
    const tr = document.createElement('tr');
    if (m.id === S.selectedId) tr.className = 'selected';
    tr.innerHTML = '<td class="from-cell"></td><td class="subject-cell"></td><td class="date-cell"></td><td class="actions-cell"></td>';
    tr.children[0].textContent = m.from;
    tr.children[1].textContent = m.subject;
    tr.children[2].textContent = fmtDate(m.receivedAt);
    const read = document.createElement('button');
    read.className = 'btn-read';
    read.textContent = 'View';
    read.onclick = () => openMessage(m.id);
    const del = document.createElement('button');
    del.className = 'btn-del';
    del.textContent = 'Delete';
    del.onclick = () => deleteOne(m.id);
    tr.children[3].append(read, del);
    return tr;
  }));
};

/* ---------- Mail ops ---------- */
const loadOtp = async () => {
  // Worker doesn't expose a dedicated /otp endpoint yet. Hide the section gracefully.
  $('otp-section').style.display = 'none';
  $('otp-code').textContent = '—';
};

const loadMessages = async () => {
  if (!S.jwt || !S.user) return;
  try {
    const raw = await api('GET', '/api/parsed_mails?limit=50&offset=0', null, true);
    const list = (raw && raw.results) ? raw.results : [];
    renderMessages(list.map(normalizeMessage));
    await loadOtp();
  } catch (e) {
    const msg = String(e.message).toLowerCase();
    if (msg.includes('expired') || msg.includes('401') || msg.includes('credential')) {
      // JWT invalid → reset + show toast so user understands
      showError('Phiên đã hết hạn, vui lòng tạo email mới');
      setEmail('', '', '', '');
      stopRefresh();   // stop the auto-refresh interval to avoid leaking timer after JWT invalidation
    } else {
      showError(e.message);
    }
  }
};

const openMessage = async id => {
  const requestId = ++S.openRequest;
  const mailboxKey = S.domain + '/' + S.user;
  try {
    const raw = await api('GET', '/api/parsed_mail/' + id, null, true);
    if (requestId !== S.openRequest || mailboxKey !== S.domain + '/' + S.user) return;
    S.selectedId = id;
    $('detail-from').textContent = raw.sender || raw.source || '';
    $('detail-subject').textContent = raw.subject || '(không có tiêu đề)';
    $('detail-date').textContent = fmtDate(raw.created_at || Date.now());
    const bodyEl = $('detail-body');
    if (raw.html) {
      const iframe = document.createElement('iframe');
      iframe.className = 'detail-iframe';
      iframe.srcdoc = raw.html;
      iframe.setAttribute('sandbox', '');
      bodyEl.replaceChildren(iframe);
    } else {
      const pre = document.createElement('pre');
      pre.className = 'detail-text';
      pre.textContent = raw.text || '(không có nội dung)';
      bodyEl.replaceChildren(pre);
    }
    $('message-detail').style.display = 'block';
    renderMessages(S.messages);
    $('message-detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (e) {
    showError(e.message);
  }
};

const deleteOne = async id => {
  try {
    await api('DELETE', '/api/mails/' + id, null, true);
    if (S.selectedId === id) clearMessageDetail();
    await loadMessages();
    toast('Đã xóa');
  } catch (e) { showError(e.message); }
};

const generate = async () => {
  const user = $('username-input').value.trim();
  const domain = $('domain-select').value;
  if (!domain) { showError('Chưa có domain'); return; }
  try {
    const raw = await api('POST', '/api/new_address', { name: user || undefined, domain });
    const email = raw.address;
    // Use the ACTUAL user part from the returned address (worker may have added PREFIX).
    // Don't strip — if user typed "tmpfoo" and PREFIX is "tmp", server creates "tmptmpfoo"
    // and we keep that as the real user. The input field shows what user typed for clarity.
    const actualUser = email.split('@')[0];
    const actualDomain = email.split('@')[1] || domain;
    setEmail(email, actualUser, actualDomain, raw.jwt);
    S.messages = []; S.page = 1; renderMessages([]);
    toast('Đã tạo: ' + email);
    startRefresh();
  } catch (e) { showError(e.message); }
};

const startRefresh = () => {
  stopRefresh();
  if ($('auto-refresh-toggle').checked) S.refreshTimer = setInterval(loadMessages, 5000);
};
const stopRefresh = () => { if (S.refreshTimer) { clearInterval(S.refreshTimer); S.refreshTimer = null; } };

const loadDomains = async () => {
  const r = await api('GET', '/open_api/settings');
  const d = wrap(r).data || r;
  return d.domains || d.defaultDomains || [];
};

const init = async () => {
  try {
    const domains = await loadDomains();
    S.domains = domains;
    $('domain-count').textContent = domains.length;
    const sel = $('domain-select');
    sel.replaceChildren(...domains.map(dom => {
      const o = document.createElement('option');
      o.value = dom; o.textContent = dom; return o;
    }));
    // restore from localStorage / URL hash
    const hashEmail = location.hash ? decodeURIComponent(location.hash.slice(1)) : '';
    const saved = localStorage.getItem(LS_KEY);
    let restored = null;
    if (hashEmail && hashEmail.includes('@')) {
      const [u, dom] = hashEmail.split('@');
      if (domains.includes(dom)) restored = { email: hashEmail, user: u, domain: dom };
    }
    if (!restored && saved) {
      try {
        const p = JSON.parse(saved);
        if (domains.includes(p.domain) && p.jwt) restored = p;
      } catch { }
    }
    if (restored) {
      setEmail(restored.email, restored.user, restored.domain, restored.jwt);
      sel.value = restored.domain;
      await loadMessages();
    }
    startRefresh();
  } catch (e) { showError('Không thể tải danh sách domain: ' + e.message); }
};

/* ---------- Wire up ---------- */
$('generate-btn').onclick = generate;
$('copy-btn').onclick = () => copyText(S.email, 'Đã sao chép địa chỉ!');
$('url-email').onclick = e => { e.preventDefault(); copyText($('url-email').textContent, 'Đã sao chép link hộp thư!'); };
$('page-size').onchange = e => { S.pageSize = Number(e.target.value); S.page = 1; renderMessages(S.messages); };
$('prev-page').onclick = () => { S.page = Math.max(1, S.page - 1); renderMessages(S.messages); };
$('next-page').onclick = () => { S.page += 1; renderMessages(S.messages); };
$('delete-all-btn').onclick = async () => {
  if (!S.email || !S.jwt) return;
  if (!confirm('Xóa tất cả email trong hộp thư này?')) return;
  try {
    // delete all messages in inbox (iterate delete — no batch endpoint for user)
    for (const m of S.messages.slice()) {
      await api('DELETE', '/api/mails/' + m.id, null, true);
    }
    renderMessages([]);
    toast('Đã xóa hộp thư');
  } catch (e) { showError(e.message); }
};
$('auto-refresh-toggle').onchange = () => $('auto-refresh-toggle').checked ? startRefresh() : stopRefresh();
$('copy-otp-btn').onclick = () => {
  const code = $('otp-code').textContent;
  if (!code || code === '—') return;
  copyText(code, 'Đã sao chép mã OTP!');
};

init();
