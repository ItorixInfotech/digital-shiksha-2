"""One-off: KCET (KEA UGCET 2025) First Round final allotment closing ranks -> data/kcet_cutoffs_2025.json.gz.

Source: KEA official allotment PDF (cetonline.karnataka.gov.in/keawebentry456/ugcet2025/PROF_CODE_E_R_01082025english.pdf),
read from the machine-readable transcription published at optionentry.com/kea-ugcet-2025-first-round-final-cutoff.html
(the KEA portal is not reachable from this server). Usage:
    curl -sL -A "Mozilla/5.0" https://optionentry.com/kea-ugcet-2025-first-round-final-cutoff.html -o /tmp/r1.html
    python scripts/build_kcet_data.py /tmp/r1.html
"""
import gzip
import json
import re
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "data" / "kcet_cutoffs_2025.json.gz"


def main(src: str) -> None:
    html = Path(src).read_text(encoding="utf-8")
    m = re.search(r"window\.__KCET2025__\s*=\s*(?=\{\")", html)
    if not m:
        sys.exit("KCET data block not found")
    data, _ = json.JSONDecoder().raw_decode(html, m.end())
    rows = []
    for r in data["data"]:
        ranks = {k: int(round(v)) for k, v in (r.get("r", {}).get("R1") or {}).items() if v}
        if ranks:
            rows.append({"college_code": r["cc"], "college_name": re.sub(r"\s+", " ", r["cn"]).strip(),
                         "branch_code": r["oc"], "branch": r["on"].strip().title().replace("Engg", "Engineering"), "ranks": ranks})
    payload = {"version": f"kcet-2025-r1-{len(rows)}", "year": 2025, "round": "First Round (final allotment)", "courses": rows}
    with gzip.open(OUT, "wt", encoding="utf-8") as fh:
        json.dump(payload, fh, separators=(",", ":"))
    print(f"{len(rows)} rows, {len({r['college_code'] for r in rows})} colleges -> {OUT}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp/r1.html")
