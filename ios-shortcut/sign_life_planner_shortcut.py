"""Sign the Life Planner Expense Shortcut template through HubSign.

The unsigned source contains placeholders only; never use this script on a file
that already includes a live device token or personal transaction data.
"""
import json
import plistlib
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
INPUT_PATH = ROOT / "Life Planner Expense.unsigned.shortcut"
OUTPUT_PATH = ROOT / "Life Planner Expense.shortcut"
HUBSIGN_URL = "https://hubsign.routinehub.services/sign"
HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": "cherri/1.0",
    "Origin": "https://routinehub.co",
    "Referer": "https://routinehub.co/",
}

if not INPUT_PATH.exists():
    raise SystemExit(f"Shortcut source is missing: {INPUT_PATH}")

with INPUT_PATH.open("rb") as source:
    shortcut = plistlib.load(source)
shortcut_xml = plistlib.dumps(shortcut, fmt=plistlib.FMT_XML).decode("utf-8")
payload = json.dumps({"shortcutName": "Life Planner Expense", "shortcut": shortcut_xml}).encode("utf-8")
request = Request(HUBSIGN_URL, data=payload, headers=HEADERS, method="POST")

try:
    with urlopen(request, timeout=30) as response:
        signed_data = response.read()
except Exception as error:
    raise SystemExit(
        "Signing failed. Check internet access or choose manual Shortcut reconstruction. "
        f"Reason: {error}"
    ) from error

if signed_data[:4] != b"AEA1":
    raise SystemExit("Signing service did not return a signed AEA1 Shortcut file.")
OUTPUT_PATH.write_bytes(signed_data)
print(f"Created signed Shortcut: {OUTPUT_PATH}")
print("Send it to your iPhone and import it in Shortcuts. The import asks for your")
print("Server URL and your Life Planner device token (both are on the app's")
print('"Integrated to your device" page).')
