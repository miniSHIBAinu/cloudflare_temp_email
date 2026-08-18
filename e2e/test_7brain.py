"""
Test if 7brain.online's catch-all → worker rule actually works.
Sends to test@7brain.online and checks D1 for arrival.
"""
import smtplib
import urllib.request
import json
import time
import sys
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formatdate, make_msgid

def log(t, m):
    print(f"[{t}] {m}", flush=True)

def http_json(method, url, body=None, headers=None):
    data = json.dumps(body).encode("utf-8") if body else None
    h = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    }
    if headers: h.update(headers)
    req = urllib.request.Request(url, method=method, data=data, headers=h)
    try:
        resp = urllib.request.urlopen(req, timeout=20)
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")

def main():
    # Get Ethereal account
    code, eth = http_json("POST", "https://api.nodemailer.com/user",
                          {"requestor": "Mavis-Test-7brain", "version": "1.0"})
    log("ETH", f"  user={eth['user']}")

    # Create a temp address at miraclelab.online first (need a JWT to read D1)
    code, addr = http_json("POST", "https://mail.miraclelab.online/api/new_address",
                            {"name": "check7brain" + str(int(time.time())), "domain": "miraclelab.online"})
    log("ADDR", f"  created {addr['address']}")

    subject = f"7BRAIN-TEST {int(time.time())}"
    text_body = "Test for 7brain.online catch-all → worker"
    html_body = "<h1>7brain test</h1>"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Test <{eth['user']}>"
    msg["To"] = "test@7brain.online"
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="ethereal.email")
    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    log("SEND", f"  sending to test@7brain.online ...")
    smtp = smtplib.SMTP(eth["smtp"]["host"], int(eth["smtp"]["port"]), timeout=20)
    smtp.starttls()
    smtp.login(eth["user"], eth["pass"])
    smtp.sendmail(eth["user"], ["test@7brain.online"], msg.as_string())
    smtp.quit()
    log("SEND", f"  sent: {msg['Message-ID']}")

    # Wait 30s
    log("WAIT", "  waiting 30s ...")
    time.sleep(30)
    log("WAIT", "  done waiting, check D1 externally")

if __name__ == "__main__":
    main()
