"""Code-review fix: owner lead-alert email must not be dropped when the enquiry
message contains phishing-like words (e.g. 'CVV', 'seed phrase'). The alert email is
`internal=True` so the credential-phrase scan is skipped for it (lib/email.py).
"""
import random
import re
import time

SUB_RE = re.compile(r"subprocess|^")


def _tail_log(path: str, n: int = 4000) -> str:
    try:
        with open(path, "rb") as f:
            f.seek(0, 2)
            size = f.tell()
            f.seek(max(0, size - n))
            return f.read().decode("utf-8", errors="replace")
    except OSError:
        return ""


def test_enquiry_with_phishing_words_sends_lead_alert(client):
    phone = f"9{random.randint(100000000, 999999999)}"
    payload = {
        "name": "Tscheck Phish Tester",
        "phone": phone,
        "message": "Please help, should I share my CVV or seed phrase for verification?",
        "source": "tscheck-phishing-words",
    }
    resp = client.post("/enquiries", json=payload)
    assert resp.status_code == 201, resp.text
    lead = resp.json()
    lead_id = lead["id"]
    assert lead["message"] == payload["message"]

    log_line = ""
    for _ in range(20):
        time.sleep(0.5)
        tail = _tail_log("/var/log/supervisor/backend.err.log")
        for line in tail.splitlines():
            if f"Lead alert for {lead_id} sent" in line:
                log_line = line
                break
        if log_line:
            break

    assert log_line, "Expected a 'Lead alert for <id> sent: ...' log line within 10s"
    assert "asks the recipient for credentials" not in log_line
    # "sent: None" is an email-provider outcome (e.g. undeliverable test domain) - acceptable.
    # A ValueError from the phishing-phrase scan would show up as 'Lead alert failed for <id>: ...'.
    fail_tail = _tail_log("/var/log/supervisor/backend.err.log")
    assert f"Lead alert failed for {lead_id}" not in fail_tail
