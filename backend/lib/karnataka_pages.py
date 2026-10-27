"""One-time setup of the Karnataka engineering city pages (/engineering-colleges-in-bengaluru, -mysuru, -mangaluru):
hand-written intro + FAQs + SEO stored as landing-page overrides (editable in Admin → City Pages), and NIT Surathkal
filed under Mangaluru (Surathkal is a Mangaluru locality). Runs once per database; existing overrides are never touched.
"""
import logging

from lib.db import db

logger = logging.getLogger(__name__)
FLAG = "karnataka_city_pages_v1"
PHONE = "+91 8149 68 9468"


def _faq(q: str, a: str) -> dict:
    return {"question": q, "answer": a}


def _seo(title: str, desc: str, kw: str) -> dict:
    return {"meta_title": title, "meta_description": desc, "keywords": [kw], "canonical_url": "", "og_image": "", "noindex": False}


PAGES = {
    "engineering-colleges-in-bengaluru": {
        "intro": (
            "<p>Bengaluru is India's technology capital and Karnataka's biggest engineering hub. It is home to <strong>IISc</strong>, "
            "<strong>IIIT Bangalore</strong>, <strong>RV College of Engineering</strong>, <strong>BMS College of Engineering</strong>, "
            "<strong>MS Ramaiah Institute of Technology</strong>, <strong>PES University</strong> and <strong>Dayananda Sagar</strong>, plus 80+ VTU-affiliated, "
            "autonomous and private-university colleges, many of them close to the city's IT parks.</p>"
            "<h2>How B.E / B.Tech admission works in Bengaluru</h2>"
            "<ul><li><strong>KCET (KEA)</strong>: government-quota seats for Karnataka students. The table below shows the official 2025 Round I General Merit closing ranks.</li>"
            "<li><strong>COMEDK UGET</strong>: private-college seats open to students from every state.</li>"
            "<li><strong>JEE Main / JEE Advanced</strong>: IISc's undergraduate programmes and IIIT Bangalore's integrated M.Tech.</li>"
            "<li><strong>University tests and management quota</strong>: PES, Dayananda Sagar, REVA, Presidency, Alliance and other private universities.</li></ul>"
            "<p>Check which colleges fit your rank with the <a href=\"/predictor?exam=KCET\">KCET College Predictor</a>. It covers your category, Kannada-medium and rural seats.</p>"
        ),
        "faqs": [
            _faq("Which is the best engineering college in Bengaluru?",
                 "IISc and IIIT Bangalore are the top institutes. Among KCET colleges, RV College of Engineering (RVCE) is the most competitive: B.E Computer Science closed at General Merit rank 234 in KCET 2025 Round I. PES University, MS Ramaiah (RIT) and BMSCE follow."),
            _faq("What KCET rank is needed for a good engineering college in Bengaluru?",
                 "In KCET 2025 Round I, Computer Science closed at about GM rank 234 at RVCE, 934 at PES University, 1,100 at MS Ramaiah and 2,246 at BMSCE. Ranks up to roughly 15,000 still get Computer Science at many established Bengaluru colleges. Reserved-category, Kannada-medium and rural seats close later."),
            _faq("Can students from outside Karnataka get admission in Bengaluru engineering colleges?",
                 "Yes. KCET government seats are mainly for Karnataka candidates, but students from any state can apply through COMEDK UGET, JEE Main (for some private universities) or management quota."),
            _faq("What is the fee for B.Tech in Bengaluru?",
                 "Government-quota (KCET) seats usually cost about ₹1–1.1 lakh a year in private colleges. COMEDK seats cost about ₹2–2.8 lakh a year, and private-university or management seats can be ₹3–5 lakh+ a year. Check each college page for its latest fee."),
            _faq("How can Digital Shiksha help with Bengaluru engineering admission?",
                 f"Our counsellors help you shortlist colleges by rank, budget and branch, and plan your KCET / COMEDK option entry. Call or WhatsApp {PHONE} for free guidance."),
        ],
        "seo": _seo("Top Engineering Colleges in Bengaluru: KCET Cutoff, Fees | Digital Shiksha",
                    "Best engineering colleges in Bengaluru with KCET 2025 closing ranks, fees and placements: RVCE, PES, MS Ramaiah, BMSCE and more. Free counselling.",
                    "engineering colleges in Bengaluru"),
    },
    "engineering-colleges-in-mysuru": {
        "intro": (
            "<p>Mysuru is one of Karnataka's oldest engineering education centres, with lower living costs than Bengaluru. Top names include "
            "<strong>Sri Jayachamarajendra College of Engineering (SJCE)</strong> and <strong>JSS Science & Technology University</strong>, "
            "<strong>The National Institute of Engineering (NIE)</strong> and <strong>Vidyavardhaka College of Engineering</strong>, "
            "with Vidya Vikas, GSSS (for women), ATME and Maharaja Institute of Technology close behind.</p>"
            "<h2>Admission routes</h2>"
            "<ul><li><strong>KCET (KEA)</strong>: most seats, for Karnataka students. Official 2025 Round I closing ranks are listed below.</li>"
            "<li><strong>COMEDK UGET</strong>: private-college seats for students from any state.</li>"
            "<li><strong>Management / NRI quota</strong>: filled directly by the colleges.</li></ul>"
            "<p>Enter your rank in the <a href=\"/predictor?exam=KCET\">KCET College Predictor</a> to see your Mysuru options by branch and category.</p>"
        ),
        "faqs": [
            _faq("Which is the best engineering college in Mysuru?",
                 "Sri Jayachamarajendra College of Engineering (SJCE, JSS STU) is the most sought-after: B.E Computer Science closed at KCET 2025 Round I General Merit rank 2,704. It is followed by JSS Science & Technology University (4,707) and NIE Mysuru (8,002)."),
            _faq("What KCET rank do I need for engineering colleges in Mysuru?",
                 "Computer Science at the top three Mysuru colleges closed between about GM rank 2,700 and 8,000 in 2025 Round I. Vidyavardhaka and GSSS closed near 16,000–18,000, and other colleges admitted much higher ranks. Core branches like Mechanical and Civil close later."),
            _faq("Is Mysuru good for engineering compared with Bengaluru?",
                 "Yes, Mysuru's established colleges (SJCE, NIE, VVCE) have strong alumni networks and recruiters, a calmer campus life and lower hostel and living costs, and Bengaluru's IT companies are about three hours away."),
            _faq("How can I get admission to an engineering college in Mysuru?",
                 f"Write KCET (Karnataka students) or COMEDK UGET (all-India), then enter your options during KEA / COMEDK counselling. Digital Shiksha counsellors can plan your option list. Call {PHONE}."),
        ],
        "seo": _seo("Top Engineering Colleges in Mysuru: KCET Cutoff, Fees | Digital Shiksha",
                    "Best engineering colleges in Mysuru: SJCE, JSS STU, NIE, VVCE with KCET 2025 closing ranks, fees and placements. Free admission counselling.",
                    "engineering colleges in Mysuru"),
    },
    "engineering-colleges-in-mangaluru": {
        "intro": (
            "<p>Mangaluru and coastal Karnataka are known for disciplined campuses and strong placements. <strong>NIT Karnataka (NITK) Surathkal</strong> is one of India's top NITs. "
            "It sits alongside <strong>Sahyadri College of Engineering & Management</strong>, <strong>St Joseph Engineering College</strong>, "
            "<strong>Mangalore Institute of Technology & Engineering (MITE)</strong>, <strong>Canara Engineering College</strong> and "
            "<strong>Alva's Institute of Engineering & Technology</strong> in Moodabidri.</p>"
            "<h2>Admission routes</h2>"
            "<ul><li><strong>JEE Main (JoSAA)</strong>: NITK Surathkal.</li>"
            "<li><strong>KCET (KEA)</strong>: government-quota seats in the VTU and autonomous colleges. Official 2025 Round I closing ranks are listed below.</li>"
            "<li><strong>COMEDK UGET and management quota</strong>: private-college seats for students from any state.</li></ul>"
            "<p>Use the <a href=\"/predictor?exam=KCET\">KCET College Predictor</a> for your KCET options, or the <a href=\"/predictor?exam=JEE%20Main\">JEE Main predictor</a> for NIT seats.</p>"
        ),
        "faqs": [
            _faq("Which is the best engineering college in Mangaluru?",
                 "NIT Karnataka (NITK) Surathkal is the top engineering college in Mangaluru, admitting through JEE Main and JoSAA. Among KCET colleges, Sahyadri College of Engineering & Management and St Joseph Engineering College are the most competitive."),
            _faq("What KCET rank is needed for engineering colleges in Mangaluru?",
                 "In KCET 2025 Round I, Computer Science closed at about General Merit rank 16,167 at Sahyadri, 22,379 at St Joseph Engineering College, 30,970 at MITE and 41,641 at Canara Engineering College. Other colleges admitted ranks beyond 50,000."),
            _faq("Is NIT Surathkal in Mangaluru?",
                 "Yes. NITK is in Surathkal, a locality of Mangaluru city, about 20 km north of the city centre on the coast. Admission is through JEE Main ranks in JoSAA counselling, not KCET."),
            _faq("How can Digital Shiksha help with admission in Mangaluru colleges?",
                 f"We help you compare KCET, COMEDK and JoSAA options for NITK and the Mangaluru colleges, check fees and hostels, and plan your option entry. Call or WhatsApp {PHONE}."),
        ],
        "seo": _seo("Top Engineering Colleges in Mangaluru: NITK, KCET Cutoff | Digital Shiksha",
                    "Best engineering colleges in Mangaluru: NITK Surathkal, Sahyadri, St Joseph, MITE with KCET 2025 closing ranks, fees and placements. Free counselling.",
                    "engineering colleges in Mangaluru"),
    },
}


async def setup_karnataka_pages() -> None:
    try:
        if await db.settings.find_one({"key": FLAG}):
            return
        await db.colleges.update_one({"slug": "nit-surathkal", "city": "Surathkal"}, {"$set": {"city": "Mangaluru"}})
        added = 0
        for slug, doc in PAGES.items():
            if not await db.landing_pages.find_one({"slug": slug}, {"_id": 1}):
                await db.landing_pages.insert_one({"slug": slug, **doc})
                added += 1
        await db.settings.update_one({"key": FLAG}, {"$set": {"key": FLAG, "done": True, "added": added}}, upsert=True)
    except Exception as exc:  # noqa: BLE001
        logger.error("Karnataka city pages setup failed: %s", exc)
