"""Branded college-prediction PDF (reportlab, core Helvetica — so no ₹/≈ glyphs; use Rs./~)."""
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import List

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from models.predictor import PredictorOut

LOGO = Path(__file__).resolve().parent.parent / "assets" / "logo.png"
NAVY, RED, GREEN, AMBER, SLATE = colors.HexColor("#0A2540"), colors.HexColor("#DC2626"), colors.HexColor("#15803D"), colors.HexColor("#B45309"), colors.HexColor("#475569")
CONTACT = {
    "phone": "+91 8149 68 9468",
    "email": "enquiry@digitalshiksha.in",
    "address": "Saudamini Commercial Complex, C1-203, Paud Road, Bhusari Colony, Kothrud, Pune 411038",
}
CHANCE_LABEL = {"High": "High chance", "Medium": "Good chance", "Reach": "Reach"}
CHANCE_COLOR = {"High": GREEN, "Medium": AMBER, "Reach": RED}

S = {
    "title": ParagraphStyle("t", fontName="Helvetica-Bold", fontSize=18, textColor=NAVY, leading=22),
    "sub": ParagraphStyle("s", fontName="Helvetica", fontSize=10, textColor=SLATE, leading=14),
    "cell": ParagraphStyle("c", fontName="Helvetica", fontSize=8.5, leading=11, textColor=colors.HexColor("#0F172A")),
    "cellb": ParagraphStyle("cb", fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=colors.HexColor("#0F172A")),
    "head": ParagraphStyle("h", fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=colors.white),
    "contact": ParagraphStyle("ct", fontName="Helvetica", fontSize=8.5, leading=12, textColor=SLATE, alignment=TA_RIGHT),
    "small": ParagraphStyle("sm", fontName="Helvetica", fontSize=7.5, leading=10, textColor=SLATE),
}


def _ascii(s: str) -> str:
    return (s or "").replace("₹", "Rs. ").replace("≈", "~").replace("•", "-").replace("→", "->").replace("&", "&amp;").replace("<", "&lt;")


def _money(n: int) -> str:
    if not n:
        return "-"
    return f"Rs. {n / 100000:.1f} L" if n >= 100000 else f"Rs. {n:,}"


def _score(out: PredictorOut) -> str:
    if out.metric == "rank":
        return f"Rank {int(out.score)}"
    if out.metric == "score":
        return f"{int(out.score)} / 720"
    return f"{out.score:g} percentile"


def build_prediction_pdf(out: PredictorOut, cities: List[str]) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=14 * mm, rightMargin=14 * mm, topMargin=14 * mm, bottomMargin=18 * mm,
                            title=f"Digital Shiksha - {out.exam} College Prediction", author="Digital Shiksha")
    width = A4[0] - 28 * mm

    def footer(canvas, d):
        canvas.saveState()
        canvas.setFillColor(SLATE)
        canvas.setFont("Helvetica", 7.5)
        canvas.drawString(14 * mm, 10 * mm, f"Digital Shiksha  |  {CONTACT['phone']}  |  {CONTACT['email']}")
        canvas.drawRightString(A4[0] - 14 * mm, 10 * mm, f"Page {d.page}")
        canvas.setStrokeColor(RED)
        canvas.setLineWidth(2)
        canvas.line(14 * mm, A4[1] - 8 * mm, A4[0] - 14 * mm, A4[1] - 8 * mm)
        canvas.restoreState()

    logo = Image(str(LOGO), width=48 * mm, height=21.6 * mm) if LOGO.exists() else Paragraph("<b>Digital Shiksha</b>", S["title"])
    header = Table([[logo, Paragraph(f"<b>Free counselling:</b> {CONTACT['phone']}<br/>Call / WhatsApp<br/>{CONTACT['email']}<br/>{_ascii(CONTACT['address'])}", S["contact"])]],
                   colWidths=[width * 0.45, width * 0.55])
    header.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))

    where = " & ".join(cities) if cities else "All India"
    counts = {k: sum(r.chance == k for r in out.results) for k in CHANCE_LABEL}
    generated = datetime.now(timezone.utc).strftime("%d %b %Y")
    story = [
        header, Spacer(1, 6 * mm),
        Paragraph(f"{_ascii(out.exam)} College Prediction Report", S["title"]),
        Spacer(1, 1.5 * mm),
        Paragraph(f"Score: <b>{_score(out)}</b> &nbsp;|&nbsp; Category: <b>{out.category}</b> &nbsp;|&nbsp; Location: <b>{_ascii(where)}</b> &nbsp;|&nbsp; Generated: {generated}", S["sub"]),
        Spacer(1, 4 * mm),
    ]
    summary = Table([[Paragraph(f"<font size=16><b>{len({r.college_slug for r in out.results})}</b></font><br/>colleges", S["sub"]),
                      Paragraph(f"<font size=16 color='#15803D'><b>{counts['High']}</b></font><br/>high chance", S["sub"]),
                      Paragraph(f"<font size=16 color='#B45309'><b>{counts['Medium']}</b></font><br/>good chance", S["sub"]),
                      Paragraph(f"<font size=16 color='#DC2626'><b>{counts['Reach']}</b></font><br/>reach options", S["sub"])]],
                    colWidths=[width / 4] * 4)
    summary.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F1F5F9")), ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                                 ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6), ("LEFTPADDING", (0, 0), (-1, -1), 10)]))
    story += [summary, Spacer(1, 5 * mm)]

    if out.results:
        rows = [[Paragraph(h, S["head"]) for h in ("#", "College", "Course / Branch", "Cutoff" + (" (est.)" if out.category != "General" else ""), "Chance", "Fees / yr")]]
        for i, r in enumerate(out.results[:120], 1):
            rows.append([
                Paragraph(str(i), S["cell"]),
                Paragraph(f"<b>{_ascii(r.college_name)}</b><br/><font color='#64748B'>{_ascii(r.city)} - {_ascii(r.type)}</font>", S["cell"]),
                Paragraph(_ascii(r.course), S["cell"]),
                Paragraph(_ascii(r.cutoff.replace(f" ({out.category})", "")), S["cell"]),
                Paragraph(f"<font color='{CHANCE_COLOR[r.chance].hexval().replace('0x', '#')}'><b>{CHANCE_LABEL[r.chance]}</b></font>", S["cell"]),
                Paragraph(_money(r.fees_min), S["cell"]),
            ])
        t = Table(rows, colWidths=[8 * mm, width * 0.33, width * 0.2, width * 0.17, width * 0.12, None], repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), NAVY), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ("LINEBELOW", (0, 1), (-1, -1), 0.25, colors.HexColor("#E2E8F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(t)
    else:
        story.append(Paragraph("No colleges matched this score range. Our counsellors can still help with institute-level and management quota options.", S["sub"]))

    cta = Table([[Paragraph(f"<font color='white'><b>Want help with your option form?</b><br/>Book a free counselling session with Digital Shiksha - call or WhatsApp {CONTACT['phone']}.</font>", S["sub"])]], colWidths=[width])
    cta.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), RED), ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8), ("LEFTPADDING", (0, 0), (-1, -1), 10)]))
    story += [Spacer(1, 6 * mm), cta, Spacer(1, 4 * mm), Paragraph(
        "Disclaimer: predictions use approximate previous-year closing cutoffs. Where an official category cutoff is not available, the category cutoff is "
        "estimated from the Open cutoff. Cutoffs change every year and differ for home-university, ladies, minority and other quotas. Please verify with the "
        "State CET Cell / MCC / JoSAA and the respective institute.", S["small"])]
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue()
