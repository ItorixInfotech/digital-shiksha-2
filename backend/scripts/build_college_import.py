"""Build backend/data/colleges_mh_ka.json from the Collegedunia B.Tech listings (cd_mh.txt / cd_ka.txt)
and download each college logo into frontend/public/logos/ so the site serves its own copy.

Line format: name|city|logo_url|total_btech_fees_rupees|rating_out_of_5
Run: cd /app/backend && python scripts/build_college_import.py
"""
import json
import re
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
LOGO_DIR = ROOT.parent / "frontend" / "public" / "logos"

# existing site slugs for colleges that also appear in the listing (matched by hand: names differ)
ALIASES = {
    "IIT Bombay": "iit-bombay", "NMIMS Mumbai": "nmims-mumbai", "COEP Pune": "coep-pune", "PICT Pune": "pict-pune",
    "VIT Pune": "vit-pune", "PCCOE Pune": "pccoe-pune", "CCEW Pune": "cummins-pune", "SPIT Mumbai": "spit-mumbai",
    "DJSCE Mumbai": "djsce-mumbai", "D.Y. Patil COE Pune": "dypcoe-akurdi",
    "MIT Academy of Engineering - [MITAOE]": "mitaoe-pune", "MIT World Peace University - [MIT-WPU],Pune": "mit-wpu-pune",
    "Sinhgad College of Engineering - [SCOE] Vadgaon Ambegaon,Pune": "scoe-pune", "SIU Pune": "symbiosis-pune",
}
GOVT = re.compile(r"\b(Government|IIT|NIT|VNIT|IISc|IIIT|COEP|WCE|SGGS|NIELIT|UBDT|University BDT|Central University|University of Mysore|Laxminarayan)\b", re.I)
CITY = {"Bangalore": "Bengaluru", "Belgaum": "Belagavi", "Mysore": "Mysuru", "Gulbarga": "Kalaburagi", "Shimoga": "Shivamogga", "Tumkur": "Tumakuru",
        "Bijapur": "Vijayapura", "Bellary": "Ballari", "Hubli": "Hubballi", "Mangalore": "Mangaluru"}  # official names used elsewhere on the site
EXAMS = {"Maharashtra": ["MHT CET", "JEE Main"], "Karnataka": ["KCET", "COMEDK UGET", "JEE Main"]}


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def parse(line: str):
    name, city, logo, fees, rating = (line.split("|") + [""] * 5)[:5]
    name = name.strip()
    city = city.strip()
    if city and name.endswith("," + city):
        name = name[: -len(city) - 1].strip()
    acr = re.search(r"\[\s*([^\]]+?)\s*\]", name)
    clean = re.sub(r"\s*-?\s*\[[^\]]*\]\s*", " ", name).strip(" -,")
    clean = re.sub(r"\s{2,}", " ", clean)
    short = acr.group(1).strip() if acr else (name if len(name) <= 28 else "")
    return name, clean, short, city, logo.strip(), int(fees or 0), float(rating or 0) if rating.strip() else 0.0


def main():
    LOGO_DIR.mkdir(parents=True, exist_ok=True)
    out, seen, seen_logo = [], set(), set()
    client = httpx.Client(timeout=20, headers={"User-Agent": "Mozilla/5.0"}, follow_redirects=True)
    for state, fn in (("Maharashtra", "cd_mh.txt"), ("Karnataka", "cd_ka.txt")):
        for rank, line in enumerate(l for l in (ROOT / "data" / fn).read_text().splitlines() if l.strip()):
            raw, clean, short, city, logo_url, total, rating = parse(line)
            slug = ALIASES.get(raw.split(",")[0] if raw not in ALIASES else raw) or ALIASES.get(line.split("|")[0].strip())
            match = bool(slug)
            if not slug:
                base = short if short and not short.lower().endswith(city.lower()) else (short or clean)
                slug = slugify(f"{base} {city}" if city.lower() not in base.lower() else base)
            if slug in seen:
                slug = slugify(f"{clean} {city}")
            seen.add(slug)
            logo = ""
            if logo_url and logo_url not in seen_logo:
                seen_logo.add(logo_url)
                try:
                    r = client.get(logo_url)
                    ext = (re.search(r"\.(png|jpe?g|gif|webp)$", logo_url.split("?")[0], re.I) or [None, "png"])[1].lower()
                    if r.status_code == 200 and r.headers.get("content-type", "").startswith("image/") and len(r.content) > 300:
                        (LOGO_DIR / f"{slug}.{ext}").write_bytes(r.content)
                        logo = f"/logos/{slug}.{ext}"
                except httpx.HTTPError:
                    pass
            per_year = round(total / 4 / 1000) * 1000 if total else 0
            out.append({
                "slug": slug, "match": match, "rank": rank + 1, "name": clean, "short_name": short, "city": CITY.get(city, city), "state": state,
                "type": "Government" if GOVT.search(raw) else "Private", "rating": round(min(rating, 5), 1),
                "fees_total": total, "fees_per_year": per_year, "logo": logo, "exams": EXAMS[state],
            })
            print(("MATCH " if match else "NEW   ") + slug, logo or "(no logo)", file=sys.stderr)
    (ROOT / "data" / "colleges_mh_ka.json").write_text(json.dumps(out, indent=1, ensure_ascii=False))
    print(len(out), "colleges;", sum(1 for c in out if c["logo"]), "logos;", sum(c["match"] for c in out), "matched")


if __name__ == "__main__":
    main()
