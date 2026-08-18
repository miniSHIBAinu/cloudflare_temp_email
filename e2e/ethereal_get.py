import json
import urllib.request
import sys
import os

# Get Ethereal account using proper API
body = json.dumps({"requestor": "Mavis-PreCheck", "version": "1.0"}).encode("utf-8")
req = urllib.request.Request(
    "https://api.nodemailer.com/user",
    method="POST",
    data=body,
    headers={"Content-Type": "application/json"},
)
try:
    resp = urllib.request.urlopen(req, timeout=20)
    data = json.loads(resp.read())
    print("SUCCESS")
    print(json.dumps(data, indent=2))
except urllib.error.HTTPError as e:
    print(f"HTTPError: {e.code} {e.reason}")
    print(e.read().decode("utf-8"))
    sys.exit(1)
