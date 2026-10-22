"""One-off: parse the official CET Cell 2026 Engineering CAP cut-off PDFs (Maharashtra seats) into
backend/data/cap_cutoffs_2026.json.gz, which the app loads into the `cap_cutoffs` collection at startup.

Source: https://fe2026.mahacet.org/ → CAP Round I–IV "MH Cut Off" PDFs
  https://cappublicdocs2026.blob.core.windows.net/documents/2026ENGG_CAP{1..4}_MH_CutOff*.pdf

Usage (needs PyMuPDF, NOT a runtime dependency):
  pip install --target /tmp/pylib pymupdf
  PYTHONPATH=/tmp/pylib python scripts/parse_cap_pdfs.py cap1.pdf cap2.pdf cap3.pdf cap4.pdf
  PYTHONPATH=/tmp/pylib python scripts/parse_cap_pdfs.py --program pharmacy ph1.pdf ph2.pdf ph3.pdf ph4.pdf  (ph2026.mahacet.org)
"""
import gzip
import json
import re
import sys
from pathlib import Path

import pymupdf  # type: ignore

COLLEGE_RE = re.compile(r"^(\d{5}) - (.+)$")
COURSE_RE = re.compile(r"^(\d{9,10}[A-Z]?) - (.+)$")
CODE_RE = re.compile(r"^[A-Z][A-Z0-9]{2,11}$")
ROMAN = {"I", "II", "III", "IV", "V", "VI", "VII"}
RANK_RE = re.compile(r"^\d{1,7}$")
PCT_RE = re.compile(r"^\(([\d.]+)\)$")
SKIP_CODES = {"Stage", "State", "Status"}
SOURCES = {"engineering": "https://fe2026.mahacet.org/", "pharmacy": "https://ph2026.mahacet.org/"}


def lines_of(page):
    out = []
    for b in page.get_text("dict")["blocks"]:
        for ln in b.get("lines", []):
            t = "".join(s["text"] for s in ln["spans"]).strip()
            if t:
                x0, y0, x1, _ = ln["bbox"]
                out.append((round(y0), x0, x1, t))
    out.sort(key=lambda r: (r[0], r[1]))
    return out


def city_of(name: str) -> str:
    tail = name.split(",")[-1] if "," in name else name.split()[-1]
    return re.sub(r"[\d\-.]+", " ", tail).strip().title()


def parse(path: str, rnd: int, courses: dict) -> None:
    doc = pymupdf.open(path)
    college = course = None
    headers: list[tuple[float, str]] = []
    header_y = None
    stage_ranks: dict[int, int] = {}
    for page in doc:
        for y, x0, x1, t in lines_of(page):
            if m := COURSE_RE.match(t):
                code, branch = m.groups()
                course = courses.setdefault(code, {
                    "course_code": code, "college_code": college["code"] if college else code[:5],
                    "college_name": college["name"] if college else "", "city": college["city"] if college else "",
                    "branch": branch.strip(), "status": "", "home_university": "", "rounds": {}})
                course["rounds"].setdefault(str(rnd), {})
                headers, header_y = [], None
                continue
            if m := COLLEGE_RE.match(t):
                name = m.group(2).strip()
                college = {"code": m.group(1), "name": name, "city": city_of(name)}
                continue
            if course is None:
                continue
            if "Home University :" in t and not course["home_university"]:
                st, hu = t.split("Home University :", 1)
                course["status"], course["home_university"] = st.strip(), hu.strip()
                continue
            if CODE_RE.match(t) and t not in SKIP_CODES and x0 > 60:
                if header_y is None or abs(y - header_y) > 3:
                    headers, header_y = [], y
                headers.append(((x0 + x1) / 2, t))
                continue
            if t in ROMAN and x0 < 60:
                stage_ranks = {}
                continue
            if not headers:
                continue
            col = min(range(len(headers)), key=lambda i: abs(headers[i][0] - (x0 + 15)))
            if RANK_RE.match(t):
                stage_ranks[col] = int(t)
            elif (pm := PCT_RE.match(t)) and col in stage_ranks:
                pct, code = float(pm.group(1)), headers[col][1]
                cur = course["rounds"][str(rnd)].get(code)
                if cur is None or pct < cur[1]:  # closing = most lenient stage
                    course["rounds"][str(rnd)][code] = [stage_ranks[col], round(pct, 4)]


def main(files: list[str], program: str = "engineering") -> None:
    courses: dict = {}
    for i, f in enumerate(files, 1):
        parse(f, i, courses)
        print(f"round {i}: {len(courses)} courses so far", file=sys.stderr)
    for c in courses.values():
        c["rounds"] = {r: v for r, v in c["rounds"].items() if v}
    rows = [c for c in courses.values() if c["rounds"]]
    for c in rows:
        c["program"] = program
    name = "cap_cutoffs_2026.json.gz" if program == "engineering" else f"cap_{program}_2026.json.gz"
    out = Path(__file__).resolve().parent.parent / "data" / name
    out.parent.mkdir(exist_ok=True)
    with gzip.open(out, "wt", encoding="utf-8") as fh:
        json.dump({"version": f"2026-{program}-mh-cap1-4-v4", "year": 2026, "program": program,
                   "source": SOURCES[program], "courses": rows}, fh, separators=(",", ":"))
    print(f"wrote {len(rows)} courses from {len({c['college_code'] for c in rows})} colleges -> {out}", file=sys.stderr)


if __name__ == "__main__":
    # python scripts/parse_cap_pdfs.py [--program pharmacy] r1.pdf r2.pdf r3.pdf r4.pdf
    args = sys.argv[1:]
    prog = "engineering"
    if args[:1] == ["--program"]:
        prog, args = args[1], args[2:]
    main(args, prog)
