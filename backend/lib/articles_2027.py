"""2027 admission guides for JEE Main, MHT CET and NEET UG — inserted once per slug at startup (never overwrites admin edits)."""
from lib.dates import today_iso
from lib.db import db
from models.content import Article

_IMG = "https://images.unsplash.com/{}?crop=entropy&cs=srgb&fm=jpg&q=80&w=1200"
CALL = "Digital Shiksha counsellors build a personalised plan from your score, category and budget. Call +91 8149 68 9468 to book a free session."

GUIDES = [
    dict(
        slug="jee-main-2027-admission-guide",
        title="JEE Main 2027 Admission Guide: Dates, Eligibility, Percentile & College Options",
        excerpt="Your complete JEE Main 2027 roadmap — session dates, eligibility, how the NTA percentile works, JoSAA counselling and Maharashtra seats.",
        image=_IMG.format("photo-1523240795612-9a054b0db644"),
        tags=["JEE Main", "2027", "Engineering", "JoSAA"],
        content=[
            "JEE Main 2027 is the gateway to NITs, IIITs and other centrally funded technical institutes, and it is also the qualifying exam for JEE Advanced. NTA is expected to hold the exam in two sessions — January and April 2027 — with applications for the first session likely to open around October–November 2026.",
            "Eligibility: You must have passed or be appearing in Class 12 in 2026 or 2027 with Physics, Mathematics and one of Chemistry, Biology, Biotechnology or a technical vocational subject. For NIT, IIIT and CFTI admission, general category students also need 75% in Class 12 (65% for SC/ST) or a top-20 percentile rank in their board.",
            "Exam pattern: Paper 1 (B.E/B.Tech) is a computer-based test in Physics, Chemistry and Mathematics. You can attempt both sessions; NTA counts your better NTA score for the merit list, so treat January as a full rehearsal rather than your only chance.",
            "Understanding the percentile: Your JEE Main percentile shows the share of candidates who scored at or below you in your shift, normalised across shifts. As a rough guide, 99+ percentile puts top NITs within reach, 95–98 opens many NITs and IIITs, and 85–95 is a strong position for good state and private engineering colleges.",
            "Counselling: Admissions to NITs, IIITs and CFTIs happen through JoSAA, followed by CSAB special rounds. Maharashtra students should also keep MHT CET in mind, because a share of seats in Maharashtra private engineering colleges is filled on JEE Main scores through the state CAP process.",
            "Preparation plan: Finish the Class 11 and 12 syllabus by December, then switch to full-length mock tests with a weekly error log. NCERT Chemistry is non-negotiable, and timed practice in Mathematics usually brings the biggest percentile gains.",
            "Use the Digital Shiksha College Predictor with your JEE Main percentile to see which colleges are a High, Good or Reach chance. " + CALL,
        ],
    ),
    dict(
        slug="mht-cet-2027-admission-guide",
        title="MHT CET 2027 Admission Guide: Exam Dates, Percentile & CAP Round Strategy",
        excerpt="Everything Maharashtra students need for MHT CET 2027 — registration, PCM vs PCB groups, percentile targets for COEP, PICT and VJTI, and CAP tips.",
        image=_IMG.format("photo-1541339907198-e08756dedf3f"),
        tags=["MHT CET", "2027", "Engineering", "Pharmacy", "CAP"],
        content=[
            "MHT CET 2027, conducted by the State CET Cell, Maharashtra, decides admission to engineering, pharmacy and agriculture colleges across the state. The exam is expected in April–May 2027, with registration likely to open around January–February 2027.",
            "Groups: Choose the PCM group for B.E/B.Tech, the PCB group for B.Pharm and agriculture, or both if you want to keep pharmacy open as a backup. Mathematics carries double weightage in the PCM paper, so it has the biggest effect on your percentile.",
            "Eligibility: You need Class 12 with Physics and Mathematics plus Chemistry, Biology, Biotechnology or a technical vocational subject, with 45% aggregate (40% for reserved categories from Maharashtra). Maharashtra domicile candidates get the large state-quota share of seats, including Home University seats.",
            "Percentile targets: Previous CAP rounds show top branches at COEP, VJTI and ICT closing around 99.5+ percentile, PICT and SPIT around 99, and well-known Pune colleges such as VIT, PCCOE and Cummins mostly between 95 and 99 depending on branch and category. These shift every year, so plan with a range of options, not a single number.",
            "CAP round strategy: After results, register for CAP, complete document verification and fill your option form carefully — order matters more than the number of options. After each round decide whether to Freeze, Float (Betterment) or not accept, and always report to the allotted college with fees before the deadline.",
            "Documents to keep ready: Class 10 and 12 marksheets, MHT CET score card, domicile certificate, caste and validity certificates, non-creamy layer (if applicable), EWS certificate (if applicable) and income certificate for fee concessions.",
            "Try the Digital Shiksha MHT CET (Engineering) and MHT CET (Pharmacy) predictors — they use official CAP cut-offs to show your High, Good and Reach colleges. " + CALL,
        ],
    ),
    dict(
        slug="neet-ug-2027-admission-guide",
        title="NEET UG 2027 Admission Guide: Exam Date, Expected Cutoff & MBBS Counselling",
        excerpt="A clear NEET UG 2027 plan — exam date, eligibility, score targets for government MBBS in Maharashtra, MCC vs state counselling and BDS/AYUSH options.",
        image=_IMG.format("photo-1658133134704-121129a67c73"),
        tags=["NEET UG", "2027", "MBBS", "Medical"],
        content=[
            "NEET UG 2027 is the single entrance exam for MBBS, BDS, BAMS, BHMS and B.Sc Nursing seats across India. NTA is expected to hold the pen-and-paper exam in May 2027, with applications likely to open around February–March 2027.",
            "Eligibility: You need Class 12 with Physics, Chemistry, Biology/Biotechnology and English, with 50% in PCB for general category (45% for PwD and 40% for SC/ST/OBC). You must be at least 17 years old by 31 December 2027.",
            "Exam pattern: The paper covers Physics, Chemistry, Botany and Zoology for a total of 720 marks, with negative marking for wrong answers. Biology carries half the marks, so NCERT-level accuracy in Botany and Zoology is the fastest way to raise your score.",
            "Score targets: Based on recent years, general category students in Maharashtra usually need about 620+ for top government colleges such as BJMC Pune, GMC Mumbai and Seth GS Medical College. Scores between 500 and 600 open many state government and private seats depending on category, while deemed universities admit on a wider range. Cutoffs change every year, so treat these as planning ranges.",
            "Counselling: MCC conducts counselling for 15% All India Quota seats, deemed universities and central institutes, while the State CET Cell runs the 85% Maharashtra state quota rounds. Register for both, check fee structures before filling deemed-university choices, and keep your documents verified early.",
            "Backup options: If MBBS is out of reach, BDS, BAMS, BHMS, B.Sc Nursing, BPT and allied health courses also use NEET UG scores and offer strong careers.",
            "Enter your NEET UG score in the Digital Shiksha College Predictor to see your High, Good and Reach colleges. " + CALL,
        ],
    ),
]


async def ensure_2027_guides() -> None:
    today = today_iso("Asia/Kolkata")
    for g in GUIDES:
        if await db.articles.find_one({"slug": g["slug"]}, {"_id": 1}):
            continue
        doc = Article(category="Admission", author="Digital Shiksha Counselling Team", published_at=today,
                      **{**g, "content": "\n\n".join(g["content"])})
        await db.articles.insert_one(doc.model_dump())
