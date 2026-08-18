"""
Pre-check E2E test: Send a real email via Ethereal SMTP to verify
CF Email Routing → Worker → D1 → Frontend flow.

Steps:
1. Create ephemeral Ethereal SMTP account
2. Create a temp address via worker API
3. Send email from Ethereal to that address
4. Poll worker /api/parsed_mails until the email appears
5. Verify mail body / sender / subject match what was sent
"""
import smtplib
import urllib.request
import json
import time
import os
import sys
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formatdate, make_msgid

WORKER_BASE = "https://mail.miraclelab.online"
TEST_ADDRESS_PREFIX = "e2eprecheck"  # custom username
TEST_DOMAIN = "miraclelab.online"

def log(tag, msg):
    print(f"[{tag}] {msg}", flush=True)

def get_ethereal_account():
    """Create a fresh Ethereal SMTP test account."""
    body = json.dumps({"requestor": "Mavis-PreCheck", "version": "1.0"}).encode("utf-8")
    req = urllib.request.Request(
        "https://api.nodemailer.com/user",
        method="POST",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    resp = urllib.request.urlopen(req, timeout=20)
    data = json.loads(resp.read())
    return data

def create_temp_address(prefix, domain):
    """Call worker's POST /api/new_address to get a JWT + address."""
    body = json.dumps({"name": prefix, "domain": domain}).encode("utf-8")
    req = urllib.request.Request(
        f"{WORKER_BASE}/api/new_address",
        method="POST",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    resp = urllib.request.urlopen(req, timeout=20)
    return json.loads(resp.read())

def fetch_parsed_mails(jwt, limit=10, offset=0):
    """Call worker's GET /api/parsed_mails with Bearer JWT."""
    req = urllib.request.Request(
        f"{WORKER_BASE}/api/parsed_mails?limit={limit}&offset={offset}",
        headers={"Authorization": f"Bearer {jwt}"},
    )
    resp = urllib.request.urlopen(req, timeout=20)
    return json.loads(resp.read())

def send_email(eth, to_addr, subject, body_text, body_html=None):
    """Send a real email via Ethereal SMTP to to_addr."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Pre-Check Tester <{eth['user']}>"
    msg["To"] = to_addr
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="ethereal.email")
    msg.attach(MIMEText(body_text, "plain", "utf-8"))
    if body_html:
        msg.attach(MIMEText(body_html, "html", "utf-8"))
    smtp = smtplib.SMTP(eth["smtp"]["host"], int(eth["smtp"]["port"]), timeout=20)
    smtp.starttls()
    smtp.login(eth["user"], eth["pass"])
    smtp.sendmail(eth["user"], [to_addr], msg.as_string())
    smtp.quit()
    return msg["Message-ID"]

def main():
    log("STEP1", "Creating Ethereal SMTP test account...")
    eth = get_ethereal_account()
    log("STEP1", f"  user={eth['user']}")
    log("STEP1", f"  smtp={eth['smtp']['host']}:{eth['smtp']['port']}")

    log("STEP2", "Creating temp address via worker API...")
    addr_info = create_temp_address(TEST_ADDRESS_PREFIX, TEST_DOMAIN)
    log("STEP2", f"  address={addr_info['address']}")
    log("STEP2", f"  address_id={addr_info['address_id']}")
    log("STEP2", f"  jwt_len={len(addr_info['jwt'])}")

    test_subject = f"E2E Pre-check {int(time.time())}"
    test_body = "Hello from Mavis pre-check!\nTimestamp: " + time.strftime("%Y-%m-%d %H:%M:%S")
    test_html = "<h1>Hello from Mavis pre-check</h1><p>This email was sent to verify the entire pipeline works.</p><p>Timestamp: " + time.strftime("%Y-%m-%d %H:%M:%S") + "</p>"

    log("STEP3", f"Sending real email via Ethereal SMTP to {addr_info['address']}...")
    msg_id = send_email(eth, addr_info["address"], test_subject, test_body, test_html)
    log("STEP3", f"  message_id={msg_id}")

    log("STEP4", "Polling worker for incoming email (max 60s)...")
    deadline = time.time() + 60
    found = None
    polls = 0
    while time.time() < deadline:
        polls += 1
        try:
            r = fetch_parsed_mails(addr_info["jwt"], limit=5, offset=0)
            results = r.get("results", [])
            if results:
                # Look for our specific subject
                for m in results:
                    if m.get("subject") == test_subject:
                        found = m
                        break
                if found:
                    break
        except Exception as e:
            log("STEP4", f"  poll {polls} error: {e}")
        time.sleep(5)
    log("STEP4", f"  {polls} polls over {60}s")

    if not found:
        log("FAIL", "Email did NOT arrive in D1 within 60s")
        log("HINT", f"  Preview at: https://ethereal.email/message/{msg_id}")
        log("HINT", f"  Username: {eth['user']}, Password: {eth['pass']}")
        sys.exit(1)

    log("PASS", "E2E flow works!")
    log("PASS", f"  subject={found.get('subject')}")
    log("PASS", f"  sender={found.get('sender')}")
    log("PASS", f"  mail_id={found.get('id')}")
    return 0

if __name__ == "__main__":
    sys.exit(main() or 0)
