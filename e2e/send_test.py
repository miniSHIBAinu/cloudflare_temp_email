"""
Send 1 real email via Ethereal SMTP and verify it lands in D1.
"""
import smtplib
import urllib.request
import json
import time
import sys
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formatdate, make_msgid

WORKER_BASE = "https://mail.miraclelab.online"
TEST_PREFIX = "e2eprecheck" + str(int(time.time()))
TEST_DOMAIN = "miraclelab.online"
# Also test a fixed known address (test@miraclelab.online) to verify specific rules work
TEST_FIXED_ADDR = "test@miraclelab.online"

def log(tag, msg):
    print(f"[{tag}] {msg}", flush=True)

def http_json(method, url, body=None, headers=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    h = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    }
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, method=method, data=data, headers=h)
    try:
        resp = urllib.request.urlopen(req, timeout=20)
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace")
        return e.code, body_text

def main():
    # 1) Create address
    log("STEP2", f"Creating temp address {TEST_PREFIX}@{TEST_DOMAIN}...")
    code, addr_info = http_json("POST", f"{WORKER_BASE}/api/new_address",
                                 {"name": TEST_PREFIX, "domain": TEST_DOMAIN})
    if code != 200:
        log("FAIL", f"  create returned {code}: {addr_info}")
        return 1
    log("STEP2", f"  address={addr_info['address']}  id={addr_info['address_id']}")

    # 2) Get Ethereal account
    log("STEP1", "Creating Ethereal SMTP account...")
    code, eth = http_json("POST", "https://api.nodemailer.com/user",
                          {"requestor": "Mavis-PreCheck", "version": "1.0"})
    if code != 200:
        log("FAIL", f"  ethereal returned {code}: {eth}")
        return 1
    log("STEP1", f"  user={eth['user']}  smtp={eth['smtp']['host']}:{eth['smtp']['port']}")

    # 3) Send email
    subject = f"E2E Pre-check {int(time.time())}"
    text_body = "Hello from Mavis pre-check!\nTimestamp: " + time.strftime("%Y-%m-%d %H:%M:%S")
    html_body = f"<h1>Hello from Mavis pre-check</h1><p>Sent at {time.strftime('%Y-%m-%d %H:%M:%S')}.</p>"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Pre-Check Tester <{eth['user']}>"
    msg["To"] = addr_info["address"]
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="ethereal.email")
    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    log("STEP3", f"Sending via Ethereal to {addr_info['address']}...")
    smtp = smtplib.SMTP(eth["smtp"]["host"], int(eth["smtp"]["port"]), timeout=20)
    smtp.starttls()
    smtp.login(eth["user"], eth["pass"])
    smtp.sendmail(eth["user"], [addr_info["address"]], msg.as_string())
    smtp.quit()
    log("STEP3", f"  sent message-id={msg['Message-ID']}")

    # 4) Poll D1
    log("STEP4", "Polling D1 for the email (max 60s)...")
    deadline = time.time() + 60
    polls = 0
    found = None
    while time.time() < deadline:
        polls += 1
        code, r = http_json("GET", f"{WORKER_BASE}/api/parsed_mails?limit=10&offset=0",
                            headers={"Authorization": f"Bearer {addr_info['jwt']}"})
        if code == 200 and r.get("results"):
            for m in r["results"]:
                if m.get("subject") == subject:
                    found = m
                    break
            if found:
                break
        time.sleep(5)
    log("STEP4", f"  {polls} polls over {int(time.time() - (deadline - 60))}s")

    if not found:
        log("FAIL", f"Email did NOT arrive in D1 within 60s")
        log("HINT", f"  Preview at: https://ethereal.email/message/{msg['Message-ID']}")
        log("HINT", f"  Ethereal login: user={eth['user']} pass={eth['pass']}")
        return 1

    log("PASS", "E2E flow works end-to-end!")
    log("PASS", f"  mail_id={found['id']}")
    log("PASS", f"  subject={found['subject']}")
    log("PASS", f"  sender={found.get('sender', '(missing)')}")
    log("PASS", f"  created_at={found.get('created_at', '(missing)')}")

    # 5) Fetch full mail body to confirm HTML preserved
    code, full = http_json("GET", f"{WORKER_BASE}/api/parsed_mail/{found['id']}",
                            headers={"Authorization": f"Bearer {addr_info['jwt']}"})
    if code == 200:
        has_html = bool(full.get("html"))
        has_text = bool(full.get("text"))
        log("PASS", f"  body: html={has_html} text={has_text}")
        if has_html and "Mavis pre-check" in full["html"]:
            log("PASS", "  HTML body content verified")
    else:
        log("WARN", f"  Could not fetch full mail: {code}")

    return 0

if __name__ == "__main__":
    sys.exit(main() or 0)
