"""Unit tests for lib.razorpay.find_by_phone / _check — mocking httpx.AsyncClient.get so no
real Razorpay calls are made. Covers: phone matched via notes only (contact empty), convenience
fee tolerance (<=5%), amount above/below the tolerated range rejected, already-used payment ->
409, failed payment -> 402, unmatched mobile -> 404, and pagination stopping once a page returns
fewer than 100 items (scanning up to 3 pages).
"""
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from lib import razorpay  # noqa: E402

FEE = 150000  # MHT CET ₹1500 in paise
PHONE = "9876543210"


def _payment(id_, amount=FEE, status="captured", contact="", notes=None, currency="INR", created_at=1000):
    return {"id": id_, "amount": amount, "status": status, "currency": currency,
            "contact": contact, "notes": notes or {}, "created_at": created_at, "email": "payer@example.com"}


def _mock_get(pages: list[list[dict]]):
    """Returns an AsyncMock .get(url, params=...) that serves `pages` in order by params['skip']."""
    async def _get(url, params=None, **kw):
        page_idx = (params or {}).get("skip", 0) // 100
        items = pages[page_idx] if page_idx < len(pages) else []
        return SimpleNamespace(status_code=200, json=lambda: {"items": items}, text="")
    return _get


class _FakeClient:
    def __init__(self, get_fn):
        self._get = get_fn

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def get(self, url, params=None, **kw):
        return await self._get(url, params=params, **kw)


def _patch_client(get_fn):
    return patch("lib.razorpay.httpx.AsyncClient", lambda **kw: _FakeClient(get_fn))


@pytest.mark.asyncio
async def test_phone_matched_only_via_notes_and_convenience_fee_matched():
    pay = _payment("pay_TESTAGENT_NOTES1", amount=153000, contact="",
                    notes={"phone": "+91 98765 43210"})
    with _patch_client(_mock_get([[pay]])):
        result = await razorpay.find_by_phone(PHONE, used=set(), fee=FEE)
    assert result["id"] == "pay_TESTAGENT_NOTES1"


@pytest.mark.asyncio
async def test_amount_above_fee_times_1_05_rejected():
    too_high = _payment("pay_TESTAGENT_HIGH1", amount=FEE * 2, contact=PHONE)
    with _patch_client(_mock_get([[too_high]])):
        with pytest.raises(razorpay.PaymentError) as exc:
            await razorpay.find_by_phone(PHONE, used=set(), fee=FEE)
    assert exc.value.status == 404


@pytest.mark.asyncio
async def test_amount_below_fee_rejected():
    too_low = _payment("pay_TESTAGENT_LOW1", amount=FEE - 1, contact=PHONE)
    with _patch_client(_mock_get([[too_low]])):
        with pytest.raises(razorpay.PaymentError) as exc:
            await razorpay.find_by_phone(PHONE, used=set(), fee=FEE)
    assert exc.value.status == 404


@pytest.mark.asyncio
async def test_already_used_payment_gives_409():
    pay = _payment("pay_TESTAGENT_USED1", amount=FEE, contact=PHONE)
    with _patch_client(_mock_get([[pay]])):
        with pytest.raises(razorpay.PaymentError) as exc:
            await razorpay.find_by_phone(PHONE, used={"pay_TESTAGENT_USED1"}, fee=FEE)
    assert exc.value.status == 409
    assert "already used" in exc.value.detail


@pytest.mark.asyncio
async def test_failed_payment_gives_402():
    pay = _payment("pay_TESTAGENT_FAIL1", amount=FEE, status="failed", contact=PHONE)
    with _patch_client(_mock_get([[pay]])):
        with pytest.raises(razorpay.PaymentError) as exc:
            await razorpay.find_by_phone(PHONE, used=set(), fee=FEE)
    assert exc.value.status == 402


@pytest.mark.asyncio
async def test_other_mobile_gives_404():
    pay = _payment("pay_TESTAGENT_OTHER1", amount=FEE, contact="9999999999")
    with _patch_client(_mock_get([[pay]])):
        with pytest.raises(razorpay.PaymentError) as exc:
            await razorpay.find_by_phone(PHONE, used=set(), fee=FEE)
    assert exc.value.status == 404


@pytest.mark.asyncio
async def test_pagination_stops_when_page_has_fewer_than_100_items():
    full_page = [_payment(f"pay_TESTAGENT_PAD{i}", amount=FEE, contact="9999999999") for i in range(100)]
    match = _payment("pay_TESTAGENT_PAGE2", amount=FEE, contact=PHONE, created_at=2000)
    page2 = [match]
    calls = []

    async def get_fn(url, params=None, **kw):
        calls.append((params or {}).get("skip", 0))
        skip = (params or {}).get("skip", 0)
        if skip == 0:
            return SimpleNamespace(status_code=200, json=lambda: {"items": full_page}, text="")
        if skip == 100:
            return SimpleNamespace(status_code=200, json=lambda: {"items": page2}, text="")
        return SimpleNamespace(status_code=200, json=lambda: {"items": []}, text="")

    with _patch_client(get_fn):
        result = await razorpay.find_by_phone(PHONE, used=set(), fee=FEE)
    assert result["id"] == "pay_TESTAGENT_PAGE2"
    # page2 had < 100 items -> loop stopped there, never requested a 3rd page (skip=200)
    assert 200 not in calls
    assert calls == [0, 100]
