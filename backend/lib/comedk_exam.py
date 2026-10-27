"""COMEDK UGET exam page (/exams/comedk), inserted once if missing; editable in Admin → Exams afterwards.
Dates follow the site's exam-tab rule (current 2026 cycle); cut-off figures are the official COMEDK 2025 Round 1 closing ranks.
"""
import logging

from lib.db import db
from models.content import Exam

logger = logging.getLogger(__name__)
PHONE = "+91 8149 68 9468"

OVERVIEW = """<p><strong>COMEDK UGET</strong> (Undergraduate Entrance Test) is held by the <strong>Consortium of Medical, Engineering and Dental Colleges of Karnataka</strong> for B.E / B.Tech admission to 150+ private and aided engineering colleges in Karnataka, including RV College of Engineering, MS Ramaiah, BMSCE, Dayananda Sagar, BIT and CMRIT. Unlike KCET, <strong>COMEDK seats are open to students from every state</strong>, which makes it the main route into Bengaluru's top private colleges for students from Maharashtra and the rest of India.</p>
<h2>COMEDK UGET 2026: important dates</h2>
<table><tbody>
<tr><th>Event</th><th>Date</th></tr>
<tr><td>Application form opens</td><td>3 February 2026</td></tr>
<tr><td>Last date to apply (extended)</td><td>23 March 2026</td></tr>
<tr><td>Application correction window</td><td>10 – 13 April 2026</td></tr>
<tr><td>Exam date (computer-based test)</td><td>9 May 2026</td></tr>
<tr><td>Final answer key</td><td>23 May 2026</td></tr>
<tr><td>Rank / score card</td><td>29 May 2026</td></tr>
<tr><td>Counselling and seat allotment</td><td>June – August 2026 (round-wise, online at comedk.org)</td></tr>
</tbody></table>
<h2>Exam pattern</h2>
<table><tbody>
<tr><th>Section</th><th>Questions</th><th>Marks</th></tr>
<tr><td>Physics</td><td>60</td><td>60</td></tr>
<tr><td>Chemistry</td><td>60</td><td>60</td></tr>
<tr><td>Mathematics</td><td>60</td><td>60</td></tr>
<tr><td><strong>Total</strong></td><td><strong>180 MCQs</strong></td><td><strong>180</strong></td></tr>
</tbody></table>
<ul><li><strong>Duration:</strong> 3 hours (180 minutes), with no sectional time limit.</li>
<li><strong>Marking:</strong> +1 for each correct answer, <strong>no negative marking</strong>.</li>
<li><strong>Mode and language:</strong> online computer-based test, in English only, at centres across India.</li>
<li><strong>Syllabus:</strong> Class 11 and 12 Physics, Chemistry and Mathematics, close to the PUC / CBSE syllabus.</li></ul>
<h2>Eligibility</h2>
<p>You need to have passed or be appearing in 10+2 (or equivalent) with Physics and Mathematics as compulsory subjects, plus Chemistry, Biotechnology, Biology, Electronics or Computer Science. General Merit candidates need at least 45% aggregate in these subjects; SC / ST / OBC candidates from Karnataka need 40%. There is no domicile requirement, so candidates from any Indian state can apply.</p>
<h2>COMEDK 2025 cut-off (Round 1 closing ranks, GM, Computer Science)</h2>
<table><tbody>
<tr><th>College</th><th>Closing rank</th></tr>
<tr><td>RV College of Engineering, Bengaluru</td><td>307</td></tr>
<tr><td>MS Ramaiah Institute of Technology, Bengaluru</td><td>875</td></tr>
<tr><td>BMS College of Engineering, Bengaluru</td><td>2,323</td></tr>
<tr><td>Dayananda Sagar College of Engineering, Bengaluru</td><td>3,609</td></tr>
<tr><td>Bangalore Institute of Technology, Bengaluru</td><td>5,892</td></tr>
</tbody></table>
<p>Source: official COMEDK Engineering cut-off ranks after Round 1 allotment, notified 28.07.2025. Enter your rank in the <a href="/predictor?exam=COMEDK">COMEDK College Predictor</a> to see every college and branch you can get, including Kalyana-Karnataka (KKR) seats.</p>
<h2>Counselling</h2>
<p>After the result, candidates register for online counselling on comedk.org, upload documents for verification, then fill and lock their college and branch choices. Seats are allotted over several rounds. In each round you can accept and freeze a seat, accept it but upgrade, or reject it and move on. Fees for COMEDK seats are set by the consortium each year, typically ₹2–2.8 lakh a year for B.E. Digital Shiksha counsellors can build your choice list. Call or WhatsApp """ + PHONE + """.</p>"""

FAQS = [
    {"question": "When is the COMEDK UGET 2026 exam?",
     "answer": "COMEDK UGET 2026 was held on 9 May 2026 as a computer-based test. Applications ran from 3 February to 23 March 2026, and rank cards were released on 29 May 2026."},
    {"question": "Is there negative marking in COMEDK?",
     "answer": "No. COMEDK UGET has 180 multiple-choice questions (60 each in Physics, Chemistry and Mathematics), each worth 1 mark, with no negative marking, so you should attempt every question."},
    {"question": "Can students from outside Karnataka take COMEDK?",
     "answer": "Yes. COMEDK seats in Karnataka private engineering colleges are open to eligible candidates from every Indian state, unlike KCET government seats, which are mainly for Karnataka students."},
    {"question": "What COMEDK rank is good for RVCE or MS Ramaiah?",
     "answer": "In COMEDK 2025 Round 1, Computer Science closed at General Merit rank 307 at RVCE and 875 at MS Ramaiah Institute of Technology. Other branches and later rounds close at higher ranks. Use our COMEDK predictor to check your exact options."},
    {"question": "How can Digital Shiksha help with COMEDK admission?",
     "answer": f"We shortlist colleges and branches for your rank and budget, plan your COMEDK choice list round by round, and help with documents and fees. Call or WhatsApp {PHONE} for free guidance."},
]


async def ensure_comedk_exam() -> None:
    try:
        if await db.exams.find_one({"slug": "comedk"}, {"_id": 1}):
            # SEO pass: shorten the first version's 83-character title (Google shows ~60)
            await db.exams.update_one({"slug": "comedk", "seo.meta_title": "COMEDK UGET 2026: Exam Date, Pattern, Cut-off & College Predictor | Digital Shiksha"}, {"$set": {"seo.meta_title": "COMEDK UGET 2026: Exam Date, Pattern & Cut-off"}})
            return
        doc = Exam(
            slug="comedk", name="COMEDK", full_name="COMEDK Undergraduate Entrance Test (UGET)", stream="Engineering", level="State",
            conducting_body="Consortium of Medical, Engineering and Dental Colleges of Karnataka (COMEDK)", exam_date="May 2026",
            application_deadline="Mar 2026", mode="Online (CBT)", eligibility="10+2 with Physics & Maths, 45% aggregate (GM)",
            overview=OVERVIEW, syllabus=["Physics", "Chemistry", "Mathematics"], website="comedk.org", faqs=FAQS,
            seo={"meta_title": "COMEDK UGET 2026: Exam Date, Pattern & Cut-off",
                 "meta_description": "COMEDK UGET 2026 exam date (9 May), application dates, exam pattern (180 MCQs, no negative marking), 2025 cut-off ranks and a COMEDK college predictor.",
                 "keywords": ["COMEDK UGET 2026", "COMEDK cutoff", "COMEDK college predictor"], "canonical_url": "", "og_image": "", "noindex": False},
        )
        await db.exams.insert_one(doc.model_dump(exclude={"days_left"}))
        logger.info("COMEDK exam page added")
    except Exception as exc:  # noqa: BLE001
        logger.error("COMEDK exam page setup failed: %s", exc)
