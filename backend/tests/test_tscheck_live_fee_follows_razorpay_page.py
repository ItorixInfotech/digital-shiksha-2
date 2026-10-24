"""Fee follows the live Razorpay Payment Page price (root cause of the live 404: the page
charges ₹1499 but code used to expect ₹1500).

Two lanes:
1. Black-box HTTP: GET /api/predictor/exams must report the current live fees (1499 MHT CET,
   599 Pharmacy, 2499 JEE Main, 3499 NEET UG, 1199 MAH MBA CET, 2999 JEE Advanced).
2. In-process: lib.razorpay.exam_fee('MHT CET') reads the live page (cached 10 min) and
   returns 149900; when the page fetch raises, it falls back to PAID_EXAMS.
"""
import sys
import time
from pathlib import Path
from unittest.mock import patch

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tests.conftest import api_url  # noqa: E402

EXPECTED_FEES = {
    "MHT CET": 1499,
    "MHT CET Pharmacy": 599,
    "JEE Main": 2499,
    "NEET UG": 3499,
    "MAH MBA CET": 1199,
    "JEE Advanced": 2999,
}


def test_predictor_exams_reports_live_fees():
    r = httpx.get(api_url("/predictor/exams"), timeout=30)
    assert r.status_code == 200, r.text
    fees = {e["name"]: e["fee"] for e in r.json()}
    for exam, fee in EXPECTED_FEES.items():
        assert fees.get(exam) == fee, f"{exam}: expected fee {fee}, got {fees.get(exam)} (full: {fees})"


@pytest.mark.asyncio
async def test_exam_fee_reads_live_page_and_falls_back_on_error():
    from lib import razorpay

    razorpay._FEE_CACHE.pop("MHT CET", None)
    fee = await razorpay.exam_fee("MHT CET")
    assert fee == 149900, f"expected live MHT CET fee 149900 (Rs 1499), got {fee}"

    # Cache hit should short-circuit a second call without re-fetching.
    with patch("httpx.AsyncClient.get", side_effect=AssertionError("should use cache")):
        fee_cached = await razorpay.exam_fee("MHT CET")
        assert fee_cached == 149900

    # Simulate the page fetch failing -> falls back to the hard-coded PAID_EXAMS value.
    razorpay._FEE_CACHE.pop("MHT CET", None)
    with patch("httpx.AsyncClient.get", side_effect=httpx.ConnectError("boom")):
        fee_fallback = await razorpay.exam_fee("MHT CET")
    assert fee_fallback == razorpay.PAID_EXAMS["MHT CET"][0] == 149900

    razorpay._FEE_CACHE.pop("MHT CET", None)  # leave cache clean for other tests
