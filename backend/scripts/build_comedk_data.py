"""One-off: official COMEDK UGET 2025 Engineering cut-off ranks after Round 1 (notified 28.07.2025) -> data/comedk_cutoffs_2025.json.gz.

Source PDF: https://www.comedk.org/uploads/Engineering-Cut-Off-Ranks-after-Round-1-Allotment%5F-Notified-on-28%5F07%5F2025.pdf
Usage (pymupdf is a one-off tool, not an app dependency):
    pip install --target /tmp/pylib pymupdf
    PYTHONPATH=/tmp/pylib python scripts/build_comedk_data.py /tmp/comedk_r1.pdf
"""
import gzip
import json
import re
import sys
from pathlib import Path

import pymupdf  # type: ignore

OUT = Path(__file__).resolve().parents[1] / "data" / "comedk_cutoffs_2025.json.gz"


def clean(s: str | None) -> str:
    return re.sub(r"\s+", " ", (s or "").replace("\n", " ")).strip(" ,")


def split_name(raw: str) -> tuple[str, str]:
    """"College Name-Locality, City" -> (name, place); the API derives the city from the place."""
    raw = re.sub(r"\s+,", ",", clean(raw))
    m = re.match(r"^(.*?)\s?-\s?([^-]*)$", raw)
    name, place = (m.group(1), m.group(2)) if m else (raw, "")
    return name.strip(), place.strip(" .,")


def pretty_branch(b: str) -> str:
    b = re.sub(r"(\w)- (\w)", r"\1\2", b)
    for a, z in (("ofDesign", "of Design"), ("Bachelorof", "Bachelor of"), ("ofUrban", "of Urban"), ("VLSIDesign", "VLSI Design"),
                 ("BigData", "Big Data"), ("Realityand", "Reality and"), ("Mech - atronics", "Mechatronics"), ("Reality(AR/ VR)", "Reality (AR/VR))")):
        b = b.replace(a, z)
    return re.sub(r"\s+", " ", b).strip()


def main(src: str) -> None:
    doc = pymupdf.open(src)
    courses: dict[tuple[str, str], dict] = {}
    for page in doc:
        for t in page.find_tables().tables:
            rows = t.extract()
            if not rows or not rows[0] or "Code" not in (rows[0][0] or ""):
                continue
            heads = [clean(h).replace("& ", "&").replace("&", " & ") for h in rows[0][3:]]
            for r in rows[1:]:
                code, raw, seat = clean(r[0]), r[1], clean(r[2])
                if not re.match(r"^E\d{3}$", code) or seat not in ("GM", "KKR"):
                    continue
                name, place = split_name(raw)
                for h, cell in zip(heads, r[3:]):
                    v = clean(cell)
                    if not h or not v.isdigit():
                        continue
                    bcode, _, bname = h.partition("-")
                    bname = re.sub(r"\s+", " ", bname).strip()
                    key = (code, bcode.strip())
                    c = courses.setdefault(key, {"college_code": code, "college_name": name, "place": place, "branch_code": bcode.strip(), "branch": pretty_branch(bname), "ranks": {}})
                    c["ranks"][seat] = int(v)
    rows = sorted(courses.values(), key=lambda c: (c["college_code"], c["branch_code"]))
    payload = {"version": f"comedk-2025-r1-{len(rows)}", "year": 2025, "round": "Round 1", "courses": rows}
    with gzip.open(OUT, "wt", encoding="utf-8") as fh:
        json.dump(payload, fh, separators=(",", ":"))
    print(f"{len(rows)} rows, {len({r['college_code'] for r in rows})} colleges -> {OUT}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp/comedk_r1.pdf")
