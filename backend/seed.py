"""Idempotent seed for Digital Shiksha. Run: cd /app/backend && python seed.py
Upserts by slug, so admin edits to other docs are kept; re-running restores seed docs."""
import asyncio

from lib.db import db, ensure_indexes
from models.content import Article, College, Course, Exam

IMG = [
    "https://images.unsplash.com/photo-1658133134704-121129a67c73?crop=entropy&cs=srgb&fm=jpg&q=80&w=1200",
    "https://images.unsplash.com/photo-1680084521816-cc1ad0433ceb?crop=entropy&cs=srgb&fm=jpg&q=80&w=1200",
    "https://images.unsplash.com/photo-1687709348710-05314eea5476?crop=entropy&cs=srgb&fm=jpg&q=80&w=1200",
    "https://images.unsplash.com/photo-1680084521631-e4e6d77704d8?crop=entropy&cs=srgb&fm=jpg&q=80&w=1200",
    "https://images.unsplash.com/photo-1695722099520-564bb36a3a6b?crop=entropy&cs=srgb&fm=jpg&q=80&w=1200",
    "https://images.unsplash.com/photo-1523240795612-9a054b0db644?crop=entropy&cs=srgb&fm=jpg&q=80&w=1200",
    "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?crop=entropy&cs=srgb&fm=jpg&q=80&w=1200",
]

FACILITIES = ["Hostel", "Library", "Wi-Fi Campus", "Labs", "Sports Complex", "Cafeteria", "Auditorium", "Medical Center"]

# slug, name, short, city, state, type, est, streams, nirf, rating, fees_min, fees_max, avg_pkg, high_pkg, place%, exams, featured
COLLEGES = [
    ("iit-bombay", "Indian Institute of Technology Bombay", "IIT Bombay", "Mumbai", "Maharashtra", "Government", 1958, ["Engineering", "Science", "Design", "Management"], 3, 4.8, 230000, 900000, 23.5, 367, 92, ["JEE Advanced", "GATE", "CEED", "CAT"], True),
    ("iit-delhi", "Indian Institute of Technology Delhi", "IIT Delhi", "New Delhi", "Delhi", "Government", 1961, ["Engineering", "Science", "Management"], 2, 4.8, 230000, 900000, 22.0, 200, 90, ["JEE Advanced", "GATE", "CAT"], True),
    ("iit-madras", "Indian Institute of Technology Madras", "IIT Madras", "Chennai", "Tamil Nadu", "Government", 1959, ["Engineering", "Science", "Management"], 1, 4.9, 230000, 900000, 21.5, 198, 91, ["JEE Advanced", "GATE"], True),
    ("iim-ahmedabad", "Indian Institute of Management Ahmedabad", "IIM Ahmedabad", "Ahmedabad", "Gujarat", "Government", 1961, ["Management"], 1, 4.9, 2500000, 2500000, 34.4, 115, 100, ["CAT"], True),
    ("iim-bangalore", "Indian Institute of Management Bangalore", "IIM Bangalore", "Bengaluru", "Karnataka", "Government", 1973, ["Management"], 2, 4.8, 2450000, 2450000, 33.8, 110, 100, ["CAT"], False),
    ("aiims-new-delhi", "All India Institute of Medical Sciences New Delhi", "AIIMS Delhi", "New Delhi", "Delhi", "Government", 1956, ["Medical", "Nursing", "Paramedical"], 1, 4.9, 6000, 30000, 0, 0, 0, ["NEET UG", "NEET PG", "INI CET"], True),
    ("coep-pune", "COEP Technological University", "COEP Pune", "Pune", "Maharashtra", "Government", 1854, ["Engineering", "Architecture"], 72, 4.6, 90000, 140000, 9.5, 54, 88, ["MHT CET", "JEE Main", "GATE"], True),
    ("pict-pune", "Pune Institute of Computer Technology", "PICT Pune", "Pune", "Maharashtra", "Private", 1983, ["Engineering"], None, 4.5, 95000, 105000, 8.8, 45, 90, ["MHT CET", "JEE Main"], True),
    ("vit-pune", "Vishwakarma Institute of Technology", "VIT Pune", "Pune", "Maharashtra", "Private", 1983, ["Engineering"], None, 4.3, 190000, 210000, 6.5, 42, 85, ["MHT CET", "JEE Main"], False),
    ("pccoe-pune", "Pimpri Chinchwad College of Engineering", "PCCOE Pune", "Pune", "Maharashtra", "Private", 1999, ["Engineering", "Management"], None, 4.2, 150000, 165000, 5.8, 32, 82, ["MHT CET", "JEE Main", "MAH MBA CET"], False),
    ("mit-wpu-pune", "MIT World Peace University", "MIT-WPU", "Pune", "Maharashtra", "Private", 1983, ["Engineering", "Management", "Design", "Law", "Pharmacy", "Science"], None, 4.2, 180000, 450000, 6.2, 44, 80, ["MHT CET", "JEE Main", "MIT-WPU CET", "CAT"], True),
    ("dy-patil-pune", "Dr. D. Y. Patil Vidyapeeth Pune", "DPU Pune", "Pune", "Maharashtra", "Deemed", 2003, ["Medical", "Dental", "Nursing", "Management", "Engineering"], 46, 4.1, 150000, 2650000, 5.0, 25, 75, ["NEET UG", "NEET PG", "MHT CET", "CAT"], False),
    ("symbiosis-pune", "Symbiosis International University", "SIU Pune", "Pune", "Maharashtra", "Deemed", 2002, ["Management", "Law", "Design", "Mass Communication", "Commerce", "Computer Applications"], 24, 4.5, 300000, 2200000, 11.5, 40, 92, ["SNAP", "SET", "SLAT", "NID DAT"], True),
    ("sibm-pune", "Symbiosis Institute of Business Management Pune", "SIBM Pune", "Pune", "Maharashtra", "Deemed", 1978, ["Management"], 18, 4.6, 2400000, 2400000, 27.0, 70, 100, ["SNAP"], False),
    ("ils-law-pune", "ILS Law College Pune", "ILS Pune", "Pune", "Maharashtra", "Private", 1924, ["Law"], 16, 4.5, 50000, 120000, 6.0, 15, 70, ["MH CET Law"], False),
    ("fergusson-pune", "Fergusson College Pune", "Fergusson", "Pune", "Maharashtra", "Government", 1885, ["Science", "Arts", "Commerce"], None, 4.4, 10000, 60000, 4.0, 12, 60, ["CUET UG"], False),
    ("bjmc-pune", "B. J. Government Medical College Pune", "BJMC Pune", "Pune", "Maharashtra", "Government", 1946, ["Medical"], 42, 4.6, 120000, 125000, 0, 0, 0, ["NEET UG", "NEET PG"], False),
    ("vjti-mumbai", "Veermata Jijabai Technological Institute", "VJTI Mumbai", "Mumbai", "Maharashtra", "Government", 1887, ["Engineering"], 89, 4.6, 85000, 95000, 10.5, 62, 90, ["MHT CET", "JEE Main", "GATE"], True),
    ("nmims-mumbai", "NMIMS School of Business Management", "NMIMS Mumbai", "Mumbai", "Maharashtra", "Deemed", 1981, ["Management", "Engineering", "Commerce", "Pharmacy", "Law"], 21, 4.5, 400000, 2400000, 23.0, 65, 98, ["NMAT", "NPAT", "CLAT"], True),
    ("jbims-mumbai", "Jamnalal Bajaj Institute of Management Studies", "JBIMS", "Mumbai", "Maharashtra", "Government", 1965, ["Management"], 38, 4.7, 600000, 600000, 25.0, 70, 100, ["MAH MBA CET", "CAT"], False),
    ("ict-mumbai", "Institute of Chemical Technology Mumbai", "ICT Mumbai", "Mumbai", "Maharashtra", "Government", 1933, ["Engineering", "Pharmacy", "Science"], 22, 4.6, 85000, 250000, 9.0, 30, 85, ["MHT CET", "JEE Main", "GATE"], False),
    ("bits-pilani", "Birla Institute of Technology and Science Pilani", "BITS Pilani", "Pilani", "Rajasthan", "Deemed", 1964, ["Engineering", "Science", "Pharmacy", "Management"], 20, 4.7, 550000, 600000, 30.4, 60, 95, ["BITSAT"], True),
    ("vit-vellore", "Vellore Institute of Technology", "VIT Vellore", "Vellore", "Tamil Nadu", "Deemed", 1984, ["Engineering", "Science", "Management", "Computer Applications"], 11, 4.3, 195000, 400000, 9.9, 102, 88, ["VITEEE", "CAT", "GATE"], False),
    ("nlsiu-bangalore", "National Law School of India University", "NLSIU", "Bengaluru", "Karnataka", "Government", 1987, ["Law"], 1, 4.9, 300000, 330000, 18.0, 45, 98, ["CLAT"], True),
    ("srcc-delhi", "Shri Ram College of Commerce", "SRCC", "New Delhi", "Delhi", "Government", 1926, ["Commerce", "Arts"], 15, 4.7, 30000, 35000, 10.0, 34, 90, ["CUET UG"], False),
    ("nid-ahmedabad", "National Institute of Design Ahmedabad", "NID", "Ahmedabad", "Gujarat", "Government", 1961, ["Design"], 1, 4.7, 400000, 450000, 12.0, 40, 85, ["NID DAT"], False),
    ("ihm-mumbai", "Institute of Hotel Management Mumbai", "IHM Mumbai", "Mumbai", "Maharashtra", "Government", 1954, ["Hotel Management"], 1, 4.5, 140000, 160000, 4.5, 10, 95, ["NCHMCT JEE"], False),
    ("cmc-vellore", "Christian Medical College Vellore", "CMC Vellore", "Vellore", "Tamil Nadu", "Private", 1900, ["Medical", "Nursing"], 3, 4.8, 3000, 52000, 0, 0, 0, ["NEET UG", "NEET PG"], False),
]

COURSE_BY_STREAM = {
    "Engineering": [("B.Tech (Computer Science)", "4 Years", "₹1,00,000 - ₹9,00,000 / yr", "10+2 with PCM, min 50-75%", 120),
                    ("B.Tech (Mechanical)", "4 Years", "₹1,00,000 - ₹8,00,000 / yr", "10+2 with PCM", 60),
                    ("M.Tech", "2 Years", "₹50,000 - ₹2,50,000 / yr", "B.E/B.Tech with valid GATE", 30)],
    "Management": [("MBA / PGDM", "2 Years", "₹6,00,000 - ₹25,00,000 total", "Graduation with 50% + CAT/MAT/CMAT", 180),
                   ("BBA", "3 Years", "₹1,50,000 - ₹4,00,000 / yr", "10+2 any stream", 120)],
    "Medical": [("MBBS", "5.5 Years", "₹6,000 - ₹25,00,000 / yr", "10+2 PCB 50% + NEET UG", 150),
                ("MD / MS", "3 Years", "₹50,000 - ₹30,00,000 / yr", "MBBS + NEET PG", 60)],
    "Law": [("BA LLB (Hons)", "5 Years", "₹1,00,000 - ₹3,30,000 / yr", "10+2 with 45% + CLAT/SLAT", 120), ("LLM", "1 Year", "₹2,00,000 / yr", "LLB + CLAT PG", 30)],
    "Design": [("B.Des", "4 Years", "₹3,00,000 - ₹4,50,000 / yr", "10+2 any stream + NID DAT/UCEED", 60)],
    "Science": [("B.Sc", "3 Years", "₹10,000 - ₹1,50,000 / yr", "10+2 with Science", 120), ("M.Sc", "2 Years", "₹20,000 - ₹2,00,000 / yr", "B.Sc in relevant subject", 40)],
    "Commerce": [("B.Com (Hons)", "3 Years", "₹15,000 - ₹2,50,000 / yr", "10+2 Commerce preferred", 240)],
    "Arts": [("BA (Hons)", "3 Years", "₹10,000 - ₹1,00,000 / yr", "10+2 any stream", 200)],
    "Pharmacy": [("B.Pharm", "4 Years", "₹80,000 - ₹2,50,000 / yr", "10+2 PCB/PCM + MHT CET", 60)],
    "Dental": [("BDS", "5 Years", "₹1,00,000 - ₹7,00,000 / yr", "10+2 PCB + NEET UG", 100)],
    "Nursing": [("B.Sc Nursing", "4 Years", "₹20,000 - ₹1,50,000 / yr", "10+2 PCB + NEET/entrance", 100)],
    "Paramedical": [("BPT", "4.5 Years", "₹80,000 - ₹2,00,000 / yr", "10+2 PCB", 50)],
    "Architecture": [("B.Arch", "5 Years", "₹90,000 - ₹2,00,000 / yr", "10+2 PCM + NATA/JEE Paper 2", 40)],
    "Mass Communication": [("BA Mass Communication", "3 Years", "₹2,50,000 - ₹4,00,000 / yr", "10+2 any stream + SET", 60)],
    "Computer Applications": [("BCA", "3 Years", "₹80,000 - ₹3,00,000 / yr", "10+2 with Maths", 120), ("MCA", "2 Years", "₹1,00,000 - ₹3,00,000 / yr", "BCA/B.Sc + NIMCET/state CET", 60)],
    "Hotel Management": [("B.Sc Hospitality & Hotel Administration", "3 Years", "₹1,40,000 - ₹1,60,000 / yr", "10+2 any stream + NCHMCT JEE", 300)],
}

RECRUITERS = {
    "Engineering": ["Google", "Microsoft", "Amazon", "TCS", "Infosys", "L&T", "Tata Motors", "Qualcomm"],
    "Management": ["McKinsey", "BCG", "Goldman Sachs", "HUL", "Deloitte", "Accenture", "ICICI Bank", "Amazon"],
    "Medical": ["AIIMS", "Apollo Hospitals", "Fortis", "Ruby Hall Clinic", "Jehangir Hospital", "Medanta"],
    "Law": ["Cyril Amarchand Mangaldas", "AZB & Partners", "Khaitan & Co", "Trilegal", "JSA"],
    "Design": ["Tata Elxsi", "Titan", "Flipkart", "Adobe", "Infosys Design"],
}


def build_college(t: tuple, i: int) -> College:
    (slug, name, short, city, state, ctype, est, streams, nirf, rating, fmin, fmax, avg, high, place, exams, featured) = t
    courses = [
        {"name": n, "duration": d, "fees": f, "eligibility": e, "seats": s}
        for st in streams for (n, d, f, e, s) in COURSE_BY_STREAM.get(st, [])
    ][:8]
    main = streams[0]
    cutoffs = []
    for ex in exams[:2]:
        if ex in ("JEE Advanced",):
            cutoffs += [{"exam": ex, "branch": "Computer Science", "cutoff": f"Closing rank {60 + i * 7}"},
                        {"exam": ex, "branch": "Electrical", "cutoff": f"Closing rank {400 + i * 30}"}]
        elif ex in ("MHT CET", "JEE Main"):
            cutoffs += [{"exam": ex, "branch": "Computer Engineering", "cutoff": f"{99.9 - i * 0.12:.2f} percentile"},
                        {"exam": ex, "branch": "Mechanical Engineering", "cutoff": f"{98.5 - i * 0.2:.2f} percentile"}]
        elif ex in ("CAT", "SNAP", "NMAT", "MAH MBA CET"):
            cutoffs.append({"exam": ex, "branch": "MBA / PGDM", "cutoff": f"{99.5 - i * 0.15:.1f} percentile"})
        elif ex.startswith("NEET"):
            cutoffs.append({"exam": ex, "branch": "MBBS (General)" if ex == "NEET UG" else "MD/MS", "cutoff": f"AIR {50 + i * 120}"})
        else:
            cutoffs.append({"exam": ex, "branch": main, "cutoff": f"Rank {100 + i * 40}"})
    return College(
        slug=slug, name=name, short_name=short, city=city, state=state, type=ctype, established=est,
        streams=streams, nirf_rank=nirf, rating=rating, fees_min=fmin, fees_max=fmax, avg_package=avg,
        highest_package=high, placement_rate=place,
        approvals=["UGC", "AICTE"] if "Engineering" in streams or "Management" in streams else ["UGC", "NMC" if "Medical" in streams else "NAAC A+"],
        exams_accepted=exams, image=IMG[i % len(IMG)],
        overview=(f"{name} ({short}), established in {est}, is a leading {ctype.lower()} institution located in {city}, {state}. "
                  f"It is renowned for {', '.join(streams[:3])} programmes, strong industry connections and a vibrant campus life. "
                  + (f"The institute is ranked #{nirf} in the NIRF rankings in its category. " if nirf else "")
                  + "Digital Shiksha counsellors help students with eligibility checks, cutoff analysis, document verification and seat allotment for this college."),
        admission=(f"Admission to {short} is based on {', '.join(exams)}. Candidates must register for the relevant entrance exam, "
                   "appear for the counselling/CAP rounds, fill choices, and report to the institute with original documents after seat allotment. "
                   "Management/institute-level quota seats (where applicable) are filled directly by the institute. "
                   "Call Digital Shiksha at +91 8149 68 9468 for end-to-end admission guidance."),
        courses=courses, cutoffs=cutoffs,
        top_recruiters=RECRUITERS.get(main, ["TCS", "Infosys", "Wipro", "HDFC Bank", "Deloitte", "Capgemini"]),
        facilities=FACILITIES[: 5 + (i % 4)], featured=featured,
    )


# slug, name, full_name, stream, level, duration, fees, salary, eligibility, exams, specs, careers, popular
COURSES = [
    ("btech", "B.Tech", "Bachelor of Technology", "Engineering", "UG", "4 Years", "₹1 - 4 Lakh / yr", "₹4 - 12 LPA", "10+2 with PCM, min 50-75%", ["JEE Main", "JEE Advanced", "MHT CET", "BITSAT", "VITEEE"], ["Computer Science", "AI & ML", "Electronics", "Mechanical", "Civil", "Electrical"], ["Software Engineer", "Data Scientist", "Design Engineer", "Site Engineer"], True),
    ("be", "B.E", "Bachelor of Engineering", "Engineering", "UG", "4 Years", "₹80K - 3 Lakh / yr", "₹3.5 - 10 LPA", "10+2 with PCM", ["MHT CET", "JEE Main", "KCET"], ["Computer", "IT", "E&TC", "Mechanical"], ["Engineer", "Analyst", "Consultant"], False),
    ("mtech", "M.Tech", "Master of Technology", "Engineering", "PG", "2 Years", "₹50K - 2.5 Lakh / yr", "₹6 - 18 LPA", "B.E/B.Tech + GATE", ["GATE"], ["VLSI", "Data Science", "Structural", "Thermal"], ["R&D Engineer", "Professor", "Senior Engineer"], True),
    ("diploma-engineering", "Diploma in Engineering", "Polytechnic Diploma", "Engineering", "Diploma", "3 Years", "₹20K - 1 Lakh / yr", "₹2 - 4 LPA", "10th pass", ["State Polytechnic CET"], ["Mechanical", "Civil", "Computer"], ["Junior Engineer", "Technician"], False),
    ("mba", "MBA", "Master of Business Administration", "Management", "PG", "2 Years", "₹2 - 25 Lakh total", "₹6 - 30 LPA", "Graduation with 50% + entrance", ["CAT", "XAT", "MAT", "CMAT", "SNAP", "NMAT", "MAH MBA CET"], ["Finance", "Marketing", "HR", "Operations", "Business Analytics"], ["Manager", "Consultant", "Investment Banker", "Product Manager"], True),
    ("pgdm", "PGDM", "Post Graduate Diploma in Management", "Management", "PG", "2 Years", "₹5 - 20 Lakh total", "₹6 - 25 LPA", "Graduation with 50% + CAT/XAT/MAT", ["CAT", "XAT", "MAT", "CMAT"], ["Marketing", "Finance", "International Business"], ["Brand Manager", "Analyst"], True),
    ("bba", "BBA", "Bachelor of Business Administration", "Management", "UG", "3 Years", "₹1 - 4 Lakh / yr", "₹3 - 7 LPA", "10+2 any stream", ["IPMAT", "SET", "NPAT", "CUET UG"], ["Marketing", "Finance", "Digital Business"], ["Business Executive", "Sales Manager"], True),
    ("bms", "BMS", "Bachelor of Management Studies", "Management", "UG", "3 Years", "₹50K - 2 Lakh / yr", "₹3 - 6 LPA", "10+2 any stream", ["CUET UG"], ["Marketing", "Finance"], ["Executive", "Analyst"], False),
    ("bcom", "B.Com", "Bachelor of Commerce", "Commerce", "UG", "3 Years", "₹10K - 1.5 Lakh / yr", "₹3 - 6 LPA", "10+2 (Commerce preferred)", ["CUET UG"], ["Accounting", "Banking", "Taxation"], ["Accountant", "Tax Consultant", "Banker"], True),
    ("mcom", "M.Com", "Master of Commerce", "Commerce", "PG", "2 Years", "₹15K - 1 Lakh / yr", "₹3.5 - 7 LPA", "B.Com", ["CUET PG"], ["Accounting", "Finance"], ["Lecturer", "Finance Analyst"], False),
    ("ca", "CA", "Chartered Accountancy", "Commerce", "Certification", "4.5 - 5 Years", "₹80K - 1 Lakh total", "₹8 - 20 LPA", "10+2 (Foundation)", ["CA Foundation"], ["Audit", "Taxation", "Corporate Finance"], ["Chartered Accountant", "CFO"], True),
    ("mbbs", "MBBS", "Bachelor of Medicine & Bachelor of Surgery", "Medical", "UG", "5.5 Years", "₹6K - 25 Lakh / yr", "₹8 - 20 LPA", "10+2 PCB 50% + NEET UG", ["NEET UG"], ["General Medicine"], ["Doctor", "Medical Officer", "Surgeon"], True),
    ("md", "MD", "Doctor of Medicine", "Medical", "PG", "3 Years", "₹50K - 30 Lakh / yr", "₹12 - 40 LPA", "MBBS + NEET PG", ["NEET PG", "INI CET"], ["General Medicine", "Paediatrics", "Radiology", "Dermatology"], ["Specialist Doctor", "Consultant"], True),
    ("ms-surgery", "MS", "Master of Surgery", "Medical", "PG", "3 Years", "₹50K - 30 Lakh / yr", "₹12 - 40 LPA", "MBBS + NEET PG", ["NEET PG", "INI CET"], ["General Surgery", "Orthopaedics", "ENT"], ["Surgeon"], False),
    ("bams", "BAMS", "Bachelor of Ayurvedic Medicine & Surgery", "Medical", "UG", "5.5 Years", "₹50K - 4 Lakh / yr", "₹3 - 8 LPA", "10+2 PCB + NEET UG", ["NEET UG"], ["Ayurveda"], ["Ayurvedic Doctor"], True),
    ("bhms", "BHMS", "Bachelor of Homoeopathic Medicine & Surgery", "Medical", "UG", "5.5 Years", "₹50K - 3 Lakh / yr", "₹3 - 7 LPA", "10+2 PCB + NEET UG", ["NEET UG"], ["Homoeopathy"], ["Homoeopathic Doctor"], False),
    ("bds", "BDS", "Bachelor of Dental Surgery", "Dental", "UG", "5 Years", "₹1 - 7 Lakh / yr", "₹4 - 8 LPA", "10+2 PCB + NEET UG", ["NEET UG"], ["Dentistry"], ["Dentist", "Dental Surgeon"], True),
    ("mds", "MDS", "Master of Dental Surgery", "Dental", "PG", "3 Years", "₹3 - 10 Lakh / yr", "₹8 - 20 LPA", "BDS + NEET MDS", ["NEET MDS"], ["Orthodontics", "Prosthodontics"], ["Specialist Dentist"], False),
    ("bsc-nursing", "B.Sc Nursing", "Bachelor of Science in Nursing", "Nursing", "UG", "4 Years", "₹20K - 1.5 Lakh / yr", "₹3 - 6 LPA", "10+2 PCB", ["NEET UG", "AIIMS Nursing"], ["General Nursing"], ["Staff Nurse", "Nursing Officer"], True),
    ("gnm", "GNM", "General Nursing & Midwifery", "Nursing", "Diploma", "3 Years", "₹30K - 1 Lakh / yr", "₹2 - 4 LPA", "10+2", ["State Nursing CET"], ["Midwifery"], ["Nurse"], False),
    ("bpharm", "B.Pharm", "Bachelor of Pharmacy", "Pharmacy", "UG", "4 Years", "₹80K - 2.5 Lakh / yr", "₹3 - 6 LPA", "10+2 PCB/PCM", ["MHT CET", "GPAT"], ["Pharmaceutics", "Pharmacology"], ["Pharmacist", "Drug Inspector", "Medical Rep"], True),
    ("dpharm", "D.Pharm", "Diploma in Pharmacy", "Pharmacy", "Diploma", "2 Years", "₹50K - 1 Lakh / yr", "₹2 - 3.5 LPA", "10+2 PCB/PCM", ["State CET"], ["Pharmacy"], ["Pharmacist"], False),
    ("mpharm", "M.Pharm", "Master of Pharmacy", "Pharmacy", "PG", "2 Years", "₹1 - 3 Lakh / yr", "₹4 - 9 LPA", "B.Pharm + GPAT", ["GPAT"], ["Pharmaceutics", "Quality Assurance"], ["Research Scientist"], False),
    ("bpt", "BPT", "Bachelor of Physiotherapy", "Paramedical", "UG", "4.5 Years", "₹80K - 2 Lakh / yr", "₹3 - 6 LPA", "10+2 PCB", ["NEET UG", "State CET"], ["Sports Physio", "Neuro"], ["Physiotherapist"], True),
    ("bmlt", "BMLT", "Bachelor of Medical Lab Technology", "Paramedical", "UG", "3 Years", "₹50K - 1.5 Lakh / yr", "₹2.5 - 5 LPA", "10+2 PCB", ["University Entrance"], ["Pathology"], ["Lab Technologist"], False),
    ("bsc", "B.Sc", "Bachelor of Science", "Science", "UG", "3 Years", "₹10K - 1.5 Lakh / yr", "₹3 - 6 LPA", "10+2 with Science", ["CUET UG"], ["Physics", "Chemistry", "Maths", "Biotech", "Computer Science"], ["Scientist", "Analyst", "Teacher"], True),
    ("msc", "M.Sc", "Master of Science", "Science", "PG", "2 Years", "₹20K - 2 Lakh / yr", "₹4 - 8 LPA", "B.Sc", ["CUET PG", "IIT JAM"], ["Physics", "Chemistry", "Data Science"], ["Researcher", "Lecturer"], False),
    ("bsc-agriculture", "B.Sc Agriculture", "Bachelor of Science in Agriculture", "Agriculture", "UG", "4 Years", "₹30K - 2 Lakh / yr", "₹3 - 6 LPA", "10+2 PCB/PCM", ["ICAR AIEEA", "MHT CET"], ["Agronomy", "Horticulture"], ["Agriculture Officer", "Agronomist"], False),
    ("bca", "BCA", "Bachelor of Computer Applications", "Computer Applications", "UG", "3 Years", "₹80K - 3 Lakh / yr", "₹3 - 6 LPA", "10+2 with Maths", ["CUET UG", "SET"], ["Cloud", "Data Analytics", "Web Development"], ["Developer", "System Admin"], True),
    ("mca", "MCA", "Master of Computer Applications", "Computer Applications", "PG", "2 Years", "₹1 - 3 Lakh / yr", "₹4 - 10 LPA", "BCA/B.Sc + entrance", ["NIMCET", "MAH MCA CET"], ["Software Development", "AI"], ["Software Engineer"], True),
    ("ba", "BA", "Bachelor of Arts", "Arts", "UG", "3 Years", "₹10K - 1 Lakh / yr", "₹2.5 - 5 LPA", "10+2 any stream", ["CUET UG"], ["English", "Psychology", "Economics", "Political Science"], ["Content Writer", "Civil Services", "Psychologist"], True),
    ("ma", "MA", "Master of Arts", "Arts", "PG", "2 Years", "₹10K - 1 Lakh / yr", "₹3 - 6 LPA", "BA", ["CUET PG"], ["English", "Economics", "History"], ["Lecturer", "Researcher"], False),
    ("ba-llb", "BA LLB", "Bachelor of Arts + Bachelor of Laws", "Law", "UG", "5 Years", "₹1 - 3.3 Lakh / yr", "₹5 - 15 LPA", "10+2 with 45%", ["CLAT", "AILET", "SLAT", "MH CET Law"], ["Corporate Law", "Criminal Law"], ["Lawyer", "Legal Advisor", "Judge"], True),
    ("llb", "LLB", "Bachelor of Laws", "Law", "UG", "3 Years", "₹50K - 2 Lakh / yr", "₹3 - 10 LPA", "Graduation with 45%", ["MH CET Law", "DU LLB"], ["Litigation"], ["Advocate"], True),
    ("llm", "LLM", "Master of Laws", "Law", "PG", "1 Year", "₹1 - 3 Lakh total", "₹6 - 15 LPA", "LLB + CLAT PG", ["CLAT", "AILET"], ["Corporate", "IPR"], ["Legal Counsel"], False),
    ("bdes", "B.Des", "Bachelor of Design", "Design", "UG", "4 Years", "₹2 - 4.5 Lakh / yr", "₹4 - 10 LPA", "10+2 any stream", ["NID DAT", "UCEED", "NIFT"], ["Fashion", "Product", "UX/UI", "Communication"], ["Designer", "UX Designer"], True),
    ("bfa", "BFA", "Bachelor of Fine Arts", "Performing Arts", "UG", "4 Years", "₹30K - 1.5 Lakh / yr", "₹2.5 - 5 LPA", "10+2 any stream", ["University Entrance"], ["Painting", "Sculpture", "Applied Art"], ["Artist", "Illustrator"], False),
    ("bjmc", "BJMC", "Bachelor of Journalism & Mass Communication", "Mass Communication", "UG", "3 Years", "₹1 - 4 Lakh / yr", "₹3 - 6 LPA", "10+2 any stream", ["SET", "IIMC Entrance", "CUET UG"], ["Journalism", "Advertising", "PR"], ["Journalist", "PR Manager"], True),
    ("bhm", "BHM", "Bachelor of Hotel Management", "Hotel Management", "UG", "4 Years", "₹1 - 3 Lakh / yr", "₹3 - 6 LPA", "10+2 any stream", ["NCHMCT JEE"], ["F&B", "Front Office", "Culinary"], ["Hotel Manager", "Chef"], True),
    ("barch", "B.Arch", "Bachelor of Architecture", "Architecture", "UG", "5 Years", "₹90K - 2 Lakh / yr", "₹4 - 8 LPA", "10+2 PCM + NATA", ["NATA", "JEE Main Paper 2"], ["Urban Design", "Landscape"], ["Architect"], True),
    ("bed", "B.Ed", "Bachelor of Education", "Education", "UG", "2 Years", "₹30K - 1 Lakh / yr", "₹3 - 5 LPA", "Graduation with 50%", ["MAH B.Ed CET"], ["Teaching"], ["Teacher"], False),
    ("bvsc", "B.V.Sc", "Bachelor of Veterinary Science", "Veterinary", "UG", "5.5 Years", "₹30K - 1.5 Lakh / yr", "₹4 - 7 LPA", "10+2 PCB + NEET UG", ["NEET UG"], ["Animal Husbandry"], ["Veterinary Doctor"], False),
    ("b-animation", "B.Sc Animation", "Bachelor of Science in Animation & VFX", "Animation", "UG", "3 Years", "₹1 - 3 Lakh / yr", "₹3 - 6 LPA", "10+2 any stream", ["University Entrance"], ["3D Animation", "VFX", "Game Design"], ["Animator", "VFX Artist"], False),
    ("phd", "Ph.D", "Doctor of Philosophy", "Science", "Doctorate", "3 - 5 Years", "₹20K - 2 Lakh / yr", "₹6 - 15 LPA", "Master's + UGC NET/GATE", ["UGC NET", "CSIR NET", "GATE"], ["All disciplines"], ["Professor", "Scientist"], False),
]

# slug, name, full_name, stream, level, body, date, deadline, mode, eligibility, syllabus, website
EXAMS = [
    ("jee-main", "JEE Main", "Joint Entrance Examination Main", "Engineering", "National", "NTA", "Jan & Apr 2026", "Nov 2025", "Online (CBT)", "10+2 with PCM", ["Physics", "Chemistry", "Mathematics"], "jeemain.nta.nic.in"),
    ("jee-advanced", "JEE Advanced", "Joint Entrance Examination Advanced", "Engineering", "National", "IIT (rotational)", "May 2026", "May 2026", "Online (CBT)", "Top 2.5 lakh JEE Main qualifiers", ["Physics", "Chemistry", "Mathematics"], "jeeadv.ac.in"),
    ("mht-cet", "MHT CET", "Maharashtra Common Entrance Test", "Engineering", "State", "State CET Cell, Maharashtra", "Apr - May 2026", "Feb 2026", "Online (CBT)", "10+2 with PCM/PCB, Maharashtra domicile preferred", ["Physics", "Chemistry", "Mathematics / Biology"], "cetcell.mahacet.org"),
    ("bitsat", "BITSAT", "BITS Admission Test", "Engineering", "University", "BITS Pilani", "May & Jun 2026", "Apr 2026", "Online (CBT)", "10+2 PCM with 75% aggregate", ["Physics", "Chemistry", "Maths", "English", "Logical Reasoning"], "bitsadmission.com"),
    ("viteee", "VITEEE", "VIT Engineering Entrance Exam", "Engineering", "University", "VIT", "Apr 2026", "Mar 2026", "Online (CBT)", "10+2 PCM/PCB with 60%", ["Maths/Biology", "Physics", "Chemistry", "Aptitude", "English"], "viteee.vit.ac.in"),
    ("gate", "GATE", "Graduate Aptitude Test in Engineering", "Engineering", "National", "IISc / IITs", "Feb 2026", "Oct 2025", "Online (CBT)", "B.E/B.Tech/B.Sc (final year allowed)", ["General Aptitude", "Engineering Maths", "Core subject"], "gate.iitr.ac.in"),
    ("kcet", "KCET", "Karnataka Common Entrance Test", "Engineering", "State", "KEA", "Apr 2026", "Feb 2026", "Offline", "10+2 PCM/PCB", ["Physics", "Chemistry", "Maths", "Biology"], "cetonline.karnataka.gov.in"),
    ("wbjee", "WBJEE", "West Bengal Joint Entrance Exam", "Engineering", "State", "WBJEEB", "Apr 2026", "Jan 2026", "Offline", "10+2 PCM", ["Physics", "Chemistry", "Maths"], "wbjeeb.nic.in"),
    ("neet-ug", "NEET UG", "National Eligibility cum Entrance Test (UG)", "Medical", "National", "NTA", "May 2026", "Mar 2026", "Offline (Pen & Paper)", "10+2 PCB with 50% (40% reserved)", ["Physics", "Chemistry", "Botany", "Zoology"], "neet.nta.nic.in"),
    ("neet-pg", "NEET PG", "National Eligibility cum Entrance Test (PG)", "Medical", "National", "NBEMS", "Jun 2026", "Apr 2026", "Online (CBT)", "MBBS with internship", ["Pre-clinical", "Para-clinical", "Clinical subjects"], "natboard.edu.in"),
    ("ini-cet", "INI CET", "Institute of National Importance Combined Entrance Test", "Medical", "National", "AIIMS New Delhi", "May & Nov 2026", "Apr 2026", "Online (CBT)", "MBBS / BDS", ["Clinical & pre-clinical subjects"], "aiimsexams.ac.in"),
    ("cat", "CAT", "Common Admission Test", "Management", "National", "IIMs (rotational)", "Nov 2026", "Sep 2026", "Online (CBT)", "Graduation with 50%", ["VARC", "DILR", "Quantitative Ability"], "iimcat.ac.in"),
    ("xat", "XAT", "Xavier Aptitude Test", "Management", "National", "XLRI Jamshedpur", "Jan 2026", "Dec 2025", "Online (CBT)", "Graduation", ["Verbal & Logical", "Decision Making", "Quant & DI", "GK"], "xatonline.in"),
    ("mat", "MAT", "Management Aptitude Test", "Management", "National", "AIMA", "Feb, May, Sep, Dec 2026", "Rolling", "Online / Paper", "Graduation", ["Language", "Maths", "DI", "Reasoning", "Indian & Global Environment"], "mat.aima.in"),
    ("cmat", "CMAT", "Common Management Admission Test", "Management", "National", "NTA", "Jan 2026", "Nov 2025", "Online (CBT)", "Graduation", ["Quant", "Logical Reasoning", "Language", "GK", "Innovation"], "cmat.nta.nic.in"),
    ("snap", "SNAP", "Symbiosis National Aptitude Test", "Management", "University", "Symbiosis International University", "Dec 2026", "Nov 2026", "Online (CBT)", "Graduation with 50%", ["General English", "Quant & DI", "Analytical Reasoning"], "snaptest.org"),
    ("nmat", "NMAT", "NMAT by GMAC", "Management", "National", "GMAC", "Oct - Dec 2026", "Oct 2026", "Online", "Graduation with 50%", ["Language Skills", "Quant", "Logical Reasoning"], "mba.com/nmat"),
    ("mah-mba-cet", "MAH MBA CET", "Maharashtra MBA Common Entrance Test", "Management", "State", "State CET Cell, Maharashtra", "Mar 2026", "Feb 2026", "Online (CBT)", "Graduation with 50%", ["Logical Reasoning", "Abstract Reasoning", "Quant", "Verbal"], "cetcell.mahacet.org"),
    ("ipmat", "IPMAT", "Integrated Programme in Management Aptitude Test", "Management", "University", "IIM Indore / Rohtak", "May 2026", "Apr 2026", "Online (CBT)", "10+2 with 60%", ["Quant", "Verbal Ability"], "iimidr.ac.in"),
    ("clat", "CLAT", "Common Law Admission Test", "Law", "National", "Consortium of NLUs", "Dec 2026", "Oct 2026", "Offline", "10+2 with 45%", ["English", "Current Affairs", "Legal Reasoning", "Logical Reasoning", "Quant"], "consortiumofnlus.ac.in"),
    ("ailet", "AILET", "All India Law Entrance Test", "Law", "University", "NLU Delhi", "Dec 2026", "Nov 2026", "Offline", "10+2 with 45%", ["English", "Current Affairs", "Logical Reasoning"], "nationallawuniversitydelhi.in"),
    ("mh-cet-law", "MH CET Law", "Maharashtra Law CET", "Law", "State", "State CET Cell, Maharashtra", "Apr 2026", "Mar 2026", "Online (CBT)", "10+2 (5-yr) / Graduation (3-yr)", ["Legal Aptitude", "GK", "Logical Reasoning", "English"], "cetcell.mahacet.org"),
    ("cuet-ug", "CUET UG", "Common University Entrance Test (UG)", "Arts", "National", "NTA", "May - Jun 2026", "Mar 2026", "Online (CBT)", "10+2", ["Languages", "Domain subjects", "General Test"], "cuet.nta.nic.in"),
    ("cuet-pg", "CUET PG", "Common University Entrance Test (PG)", "Science", "National", "NTA", "Mar 2026", "Feb 2026", "Online (CBT)", "Graduation", ["Domain-specific paper"], "pgcuet.samarth.ac.in"),
    ("nid-dat", "NID DAT", "NID Design Aptitude Test", "Design", "National", "NID Ahmedabad", "Dec 2026", "Nov 2026", "Offline", "10+2 any stream", ["Design aptitude", "Studio test"], "admissions.nid.edu"),
    ("nift", "NIFT", "NIFT Entrance Exam", "Design", "National", "NTA", "Feb 2026", "Jan 2026", "Online (CBT) + Situation Test", "10+2 any stream", ["CAT (Creative Ability)", "GAT"], "nift.ac.in"),
    ("uceed", "UCEED", "Undergraduate Common Entrance Exam for Design", "Design", "National", "IIT Bombay", "Jan 2026", "Oct 2025", "Online + Drawing", "10+2 any stream", ["Visualization", "Observation", "Drawing"], "uceed.iitb.ac.in"),
    ("nata", "NATA", "National Aptitude Test in Architecture", "Architecture", "National", "Council of Architecture", "Apr - Jun 2026", "Rolling", "Online", "10+2 PCM with 50%", ["Drawing", "Maths", "General Aptitude"], "nata.in"),
    ("nchmct-jee", "NCHMCT JEE", "National Council for Hotel Management JEE", "Hotel Management", "National", "NTA", "Apr 2026", "Feb 2026", "Online (CBT)", "10+2 any stream", ["Numerical Ability", "Reasoning", "English", "GK", "Service Aptitude"], "nchmjee.nta.nic.in"),
    ("gpat", "GPAT", "Graduate Pharmacy Aptitude Test", "Pharmacy", "National", "NBEMS", "Jun 2026", "May 2026", "Online (CBT)", "B.Pharm", ["Pharmaceutics", "Pharmacology", "Pharmacognosy"], "natboard.edu.in"),
    ("nimcet", "NIMCET", "NIT MCA Common Entrance Test", "Computer Applications", "National", "NITs", "Jun 2026", "Apr 2026", "Online (CBT)", "Graduation with Maths", ["Mathematics", "Reasoning", "Computer Awareness", "English"], "nimcet.admissions.nic.in"),
    ("ugc-net", "UGC NET", "University Grants Commission NET", "Arts", "National", "NTA", "Jun & Dec 2026", "Rolling", "Online (CBT)", "Master's with 55%", ["Teaching & Research Aptitude", "Subject paper"], "ugcnet.nta.ac.in"),
]

ARTICLES = [
    ("mht-cet-2026-cap-round-guide", "MHT CET 2026 CAP Rounds: Complete Step-by-Step Guide for Pune & Mumbai Colleges", "Admission",
     "Everything you need to know about Maharashtra CAP registration, option forms, freezing seats and reporting to colleges like COEP, PICT and VJTI.",
     ["The Centralized Admission Process (CAP) conducted by the State CET Cell decides seat allotment for engineering colleges across Maharashtra.",
      "Step 1 — Registration & document verification: Register on the CET Cell portal, upload marksheets, domicile, caste/EWS and non-creamy layer certificates, and verify them at a facilitation centre (e-scrutiny or physical).",
      "Step 2 — Option form: Choose up to 300 college-branch combinations in strict order of preference. Use previous-year cutoffs for COEP, PICT, VJTI, VIT and PCCOE to build a realistic list.",
      "Step 3 — Allotment & freezing: After each round you can Freeze, Betterment (float) or reject. Report to the allotted institute with fees within the deadline.",
      "Digital Shiksha counsellors prepare personalised option forms based on your percentile, category and budget. Call +91 8149 68 9468 to book a free session."],
     "Rahul Deshmukh, Senior Counsellor", 0, "2026-06-12", ["MHT CET", "CAP", "Engineering"]),
    ("neet-ug-2026-cutoff-analysis", "NEET UG 2026 Expected Cutoff: Government MBBS Seats in Maharashtra", "Exam",
     "Category-wise expected NEET scores for government and private MBBS colleges in Maharashtra including BJMC Pune and GMC Mumbai.",
     ["NEET UG remains the single gateway for MBBS, BDS, BAMS and BHMS admissions in India.",
      "For 2026, students in the general category will likely need 620+ for top government colleges in Maharashtra such as BJMC Pune and GMC Mumbai, while deemed universities admit on wider score ranges.",
      "The 85% state quota and 15% All India Quota are filled through separate counselling — Maharashtra State CET Cell and MCC respectively.",
      "Our medical admission experts help with both counselling processes, document checks and deemed university options."],
     "Dr. Sneha Kulkarni", 6, "2026-05-28", ["NEET", "MBBS", "Cutoff"]),
    ("top-mba-colleges-pune-2026", "Top MBA Colleges in Pune 2026: Fees, Placements & Cutoffs", "College",
     "Compare SIBM Pune, Symbiosis, MIT-WPU, PUMBA and more on fees, average package and accepted exams.",
     ["Pune is one of India's biggest management education hubs with more than 150 MBA/PGDM institutes.",
      "SIBM Pune leads with an average package around ₹27 LPA, followed by SCMHRD and SIIB. MIT-WPU and PCCOE offer value options for MAH MBA CET takers.",
      "Choose a college on ROI: compare total fees with median salary, check specialisation strength and alumni network.",
      "Digital Shiksha has guided 1,500+ students into management programmes across Pune and Mumbai."],
     "Digital Shiksha Team", 5, "2026-05-10", ["MBA", "Pune", "Placements"]),
    ("jee-main-vs-mht-cet", "JEE Main vs MHT CET: Which Exam Matters More for Maharashtra Students?", "Exam",
     "A practical comparison of the two entrance exams for engineering aspirants in Maharashtra.",
     ["Maharashtra reserves most state engineering seats for MHT CET, while a small share of seats (and NITs/IIITs) accept JEE Main.",
      "Students should prepare for both: JEE Main opens national options, MHT CET has no negative marking and a state-board-aligned syllabus.",
      "Our recommendation — target JEE Main concepts, then practise MHT CET speed tests in the last 45 days."],
     "Rahul Deshmukh, Senior Counsellor", 2, "2026-04-18", ["JEE Main", "MHT CET"]),
    ("career-after-12th-science", "Career Options After 12th Science (PCM & PCB) in 2026", "Career",
     "From B.Tech and MBBS to B.Des, B.Pharm and BCA — a complete map of courses after 12th science.",
     ["PCM students can choose Engineering, Architecture, BCA, B.Sc, Design, Merchant Navy and Defence routes.",
      "PCB students can pursue MBBS, BDS, BAMS, BHMS, Nursing, Pharmacy, Physiotherapy, Biotechnology and Agriculture.",
      "Shortlist courses by aptitude, budget and career outcomes. A 30-minute counselling session with Digital Shiksha can save months of confusion."],
     "Digital Shiksha Team", 3, "2026-03-30", ["Career", "12th Science"]),
    ("clat-2026-preparation-strategy", "CLAT 2026: 6-Month Preparation Strategy and Top NLUs", "Exam",
     "A month-by-month plan for CLAT 2026 with tips on reading comprehension and legal reasoning.",
     ["CLAT is a comprehension-heavy exam — daily editorial reading is non-negotiable.",
      "Months 1-2: build reading speed; Months 3-4: sectional tests; Months 5-6: full mocks and analysis.",
      "Top NLUs include NLSIU Bengaluru, NALSAR Hyderabad and WBNUJS Kolkata. In Pune, ILS Law College and Symbiosis Law School are popular alternatives."],
     "Adv. Priya Joshi", 4, "2026-03-05", ["CLAT", "Law"]),
]


async def upsert(coll: str, docs: list) -> None:
    for d in docs:
        data = d.model_dump()
        existing = await db[coll].find_one({"slug": data["slug"]}, {"id": 1})
        if existing:
            data["id"] = existing["id"]
        await db[coll].replace_one({"slug": data["slug"]}, data, upsert=True)
    print(f"{coll}: {len(docs)} upserted")


async def main() -> None:
    await ensure_indexes()
    await upsert("colleges", [build_college(t, i) for i, t in enumerate(COLLEGES)])
    await upsert("courses", [
        Course(slug=s, name=n, full_name=fn, stream=st, level=lv, duration=du, avg_fees=fe, avg_salary=sa,
               eligibility=el, entrance_exams=ex, specializations=sp, careers=ca, popular=po,
               overview=f"{fn} ({n}) is a {du.lower()} {lv if lv != 'Certification' else 'professional'} programme in {st}. "
                        f"Students are admitted through {', '.join(ex[:3])}. Graduates typically work as {', '.join(ca[:3])}, "
                        f"with average starting salaries of {sa}.")
        for (s, n, fn, st, lv, du, fe, sa, el, ex, sp, ca, po) in COURSES
    ])
    await upsert("exams", [
        Exam(slug=s, name=n, full_name=fn, stream=st, level=lv, conducting_body=b, exam_date=dt, application_deadline=dl,
             mode=m, eligibility=el, syllabus=sy, website=w,
             overview=f"{fn} ({n}) is a {lv.lower()}-level entrance exam conducted by {b} for admission to {st.lower()} programmes. "
                      f"The 2026 exam is expected in {dt}; applications close around {dl}.")
        for (s, n, fn, st, lv, b, dt, dl, m, el, sy, w) in EXAMS
    ])
    await upsert("articles", [
        Article(slug=s, title=t, category=c, excerpt=e, content="\n\n".join(body), author=a, image=IMG[im],
                published_at=p, tags=tg)
        for (s, t, c, e, body, a, im, p, tg) in ARTICLES
    ])


if __name__ == "__main__":
    asyncio.run(main())
