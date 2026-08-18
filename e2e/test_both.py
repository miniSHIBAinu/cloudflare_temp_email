"""
Test: send to both specific (test@) and wildcard-generated addresses.
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
TEST_DOMAIN = "miraclelab.online"

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

def send_email(eth, to_addr, subject):
    text_body = "Test body at " + time.strftime("%Y-%m-%d %H:%M:%S")
    html_body = f"<h1>Test</h1><p>Sent to {to_addr} at {time.strftime('%Y-%m-%d %H:%M:%S')}</p>"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Test Sender <{eth['user']}>"
    msg["To"] = to_addr
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="ethereal.email")
    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    smtp = smtplib.SMTP(eth["smtp"]["host"], int(eth["smtp"]["port"]), timeout=20)
    smtp.starttls()
    smtp.login(eth["user"], eth["pass"])
    smtp.sendmail(eth["user"], [to_addr], msg.as_string())
    smtp.quit()
    return msg["Message-ID"]

def wait_for_email(jwt, subject, timeout=30):
    deadline = time.time() + timeout
    while time.time() < deadline:
        code, r = http_json("GET", f"{WORKER_BASE}/api/parsed_mails?limit=20&offset=0",
                            headers={"Authorization": f"Bearer {jwt}"})
        if code == 200 and r.get("results"):
            for m in r["results"]:
                if m.get("subject") == subject:
                    return m
        time.sleep(3)
    return None

def main():
    # Get one Ethereal account
    code, eth = http_json("POST", "https://api.nodemailer.com/user",
                          {"requestor": "Mavis-PreCheck", "version": "1.0"})
    if code != 200:
        log("FAIL", f"ethereal: {eth}")
        return 1
    log("ETH", f"  user={eth['user']}")

    # Test 1: send to test@miraclelab.online (has its own rule)
    subject1 = f"TEST-SPECIFIC {int(time.time())}"
    log("TEST1", f"Sending to test@miraclelab.online ...")
    msg_id1 = send_email(eth, "test@miraclelab.online", subject1)
    log("TEST1", f"  sent: {msg_id1}")

    # Test 2: send to a wildcard address
    prefix = "wildcard" + str(int(time.time()))
    code, addr = http_json("POST", f"{WORKER_BASE}/api/new_address",
                            {"name": prefix, "domain": TEST_DOMAIN})
    if code != 200:
        log("FAIL", f"create wildcard: {addr}")
        return 1
    log("TEST2", f"Created address {addr['address']} (id={addr['address_id']})")

    subject2 = f"TEST-WILDCARD {int(time.time())}"
    log("TEST2", f"Sending to {addr['address']} ...")
    msg_id2 = send_email(eth, addr["address"], subject2)
    log("TEST2", f"  sent: {msg_id2}")

    # Wait for both
    log("WAIT", "Polling wildcard address inbox (only it has a JWT)...")
    found2 = wait_for_email(addr["jwt"], subject2, timeout=30)
    if found2:
        log("PASS", f"  WILDCARD email arrived: {found2['subject']}")
    else:
        log("FAIL", "  WILDCARD email did NOT arrive")

    # For test@ we have no JWT — but we can ask CF for raw_mails via wrangler d1
    # Just print what we sent
    log("INFO", f"  For SPECIFIC (test@), need JWT from a previous test@ session or wrangler d1 to verify")

    return 0 if found2 else 1

if __name__ == "__main__":
    sys.exit(main() or 0)
