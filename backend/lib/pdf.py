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


def build_prediction_pdf(out: PredictorOut, cities: List[str], receipt: dict | None = None) -> bytes:
    """receipt (paid MHT CET): {name, payment_id, amount, paid_at} — adds a payment receipt box under the title."""
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
        canvas.setFont("Helvetica-Oblique", 7)
        canvas.drawCentredString(A4[0] / 2, 6 * mm, "This is only a prediction based on previous years' cut-offs, not a guarantee of admission. "
                                                    "For more details, contact your counsellor.")
        canvas.setStrokeColor(RED)
        canvas.setLineWidth(2)
        canvas.line(14 * mm, A4[1] - 8 * mm, A4[0] - 14 * mm, A4[1] - 8 * mm)
        canvas.restoreState()

    logo = Image(str(LOGO), width=48 * mm, height=21.6 * mm) if LOGO.exists() else Paragraph("<b>Digital Shiksha</b>", S["title"])
    header = Table([[logo, Paragraph(f"<b>Free counselling:</b> {CONTACT['phone']}<br/>Call / WhatsApp<br/>{CONTACT['email']}", S["contact"])]],
                   colWidths=[width * 0.45, width * 0.55])
    header.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))

    official = bool(out.results and out.results[0].official)
    kcet = out.exam in ("KCET", "COMEDK")
    comedk = out.exam == "COMEDK"
    where = " & ".join(cities) if cities else ("All Karnataka" if kcet else "All India")
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
    if receipt:
        rc = Table([[Paragraph(f"<b>PAYMENT RECEIPT</b><br/>Paid by: <b>{_ascii(receipt.get('name') or 'Student')}</b> &nbsp;|&nbsp; "
                               f"Amount: <b>Rs. {int(receipt['amount']):,}</b> &nbsp;|&nbsp; Payment ID: <b>{_ascii(receipt['payment_id'])}</b> &nbsp;|&nbsp; "
                               f"Date: {receipt['paid_at'].strftime('%d %b %Y')}<br/><font color='#64748B'>College Predictor - full {_ascii(out.exam)} college list for this percentile</font>", S["sub"])]],
                   colWidths=[width])
        rc.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#15803D")), ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F0FDF4")),
                                ("LEFTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
        story += [rc, Spacer(1, 4 * mm)]
    notice = Table([[Paragraph(
        "<b>IMPORTANT - PLEASE READ:</b> This report is only a prediction based on previous years' cut-offs. It is not a guarantee of admission "
        "or of a seat allotment, and actual cut-offs can change every year. Digital Shiksha is not responsible for admission decisions made on the "
        f"basis of this report. <b>For more details, contact your counsellor</b> - call / WhatsApp {CONTACT['phone']} or email {CONTACT['email']}.",
        ParagraphStyle("legal", parent=S["sub"], fontSize=8.5, leading=12, textColor=colors.HexColor("#78350F")))]], colWidths=[width])
    notice.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#D97706")), ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFFBEB")),
                                ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    story += [summary, Spacer(1, 4 * mm), notice, Spacer(1, 5 * mm)]

    if out.results:
        rows = [[Paragraph(h, S["head"]) for h in ("#", "College", "Course / Branch", ("COMEDK 2025 Round 1 closing rank" if comedk else "KCET 2025 Round I closing rank" if kcet else "Round I cutoff (official CAP)" if official else "Cutoff" + (" (est.)" if out.category != "General" else "")), "Chance", "Fees / yr")]]
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
        ("Source: official COMEDK UGET 2025 Engineering cut-off ranks after Round 1 allotment, comedk.org. Chance is judged on the closing rank "
         "of the most lenient seat you are eligible for (GM, plus KKR if selected). " if comedk else
         "Source: official KEA UGCET 2025 First Round allotment closing ranks, cetonline.karnataka.gov.in/kea. Chance is judged on the closing rank "
         "of the most lenient seat type you are eligible for (General Merit + your category, Kannada / Rural if selected). " if kcet else
         "Source: official State CET Cell CAP cut-offs (Rounds I-IV, Maharashtra seats), cetcell.mahacet.org. Chance is judged on the Round I "
         "closing percentile of the most lenient seat type you are eligible for. " if official else "") +
        "Disclaimer: this is just a predictor based on previous years' cut-offs - not a guarantee of admission. For more details, contact your counsellor. "
        "Predictions use approximate previous-year closing cutoffs. Where an official category cutoff is not available, the category cutoff is "
        "estimated from the Open cutoff. Cutoffs change every year and differ for home-university, ladies, minority and other quotas. Please verify with the "
        "State CET Cell / KEA / COMEDK / MCC / JoSAA and the respective institute.", S["small"])]
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue()
