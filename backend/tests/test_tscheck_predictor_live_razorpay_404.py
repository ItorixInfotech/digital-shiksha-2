"""Live Razorpay TEST keys in preview: a phone with no matching payment returns 404 with the
expected message, and the backend emits a 'Razorpay find_by_phone: scanned=' diagnostic line
(no real Razorpay payment can be exercised in preview — see spec_deviations).
"""
import subprocess
import time

import httpx

NO_PAYMENT_PHONE = "9123456780"  # a mobile that has never paid on the Razorpay test keys


def test_unlock_with_no_payment_returns_404_and_logs_diagnostic(client: httpx.Client):
    body = {
        "prediction": {"exam": "MHT CET Pharmacy", "score": 77.7, "category": "General", "cities": []},
        "name": "Test Agent", "phone": NO_PAYMENT_PHONE, "email": "delivered@resend.dev", "payment_id": "",
    }
    r = client.post("/predictor/unlock", json=body)
    assert r.status_code == 404, r.text
    assert r.json()["detail"].startswith("No new \u20b9599 payment found"), r.json()["detail"]

    # Give the background log flush a brief moment, then check supervisor's backend log.
    time.sleep(0.5)
    found = False
    for log_path in ("/var/log/supervisor/backend.err.log", "/var/log/supervisor/backend.out.log"):
        try:
            out = subprocess.run(["tail", "-n", "200", log_path], capture_output=True, text=True, timeout=5).stdout
        except Exception:
            continue
        if "Razorpay find_by_phone: scanned=" in out:
            found = True
            break
    assert found, "expected a 'Razorpay find_by_phone: scanned=' diagnostic line in the backend log"
