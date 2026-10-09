"""Pune & Mumbai colleges + approximate previous-year closing cutoffs (General Open / state quota).
Values are indicative (based on publicly reported CAP / MCC / JoSAA trends) and drive the college predictor."""

# Same tuple layout as seed.COLLEGES:
# slug, name, short, city, state, type, est, streams, nirf, rating, fees_min, fees_max, avg_pkg, high_pkg, place%, exams, featured
MH_COLLEGES = [
    # ---- Pune engineering
    ("cummins-pune", "MKSSS's Cummins College of Engineering for Women", "Cummins Pune", "Pune", "Maharashtra", "Private", 1991, ["Engineering"], None, 4.4, 160000, 170000, 7.2, 44, 88, ["MHT CET", "JEE Main"], False),
    ("viit-pune", "Vishwakarma Institute of Information Technology", "VIIT Pune", "Pune", "Maharashtra", "Private", 2002, ["Engineering"], None, 4.2, 175000, 185000, 6.0, 33, 84, ["MHT CET", "JEE Main"], False),
    ("aissms-coe-pune", "AISSMS College of Engineering", "AISSMS COE", "Pune", "Maharashtra", "Private", 1992, ["Engineering"], None, 4.1, 125000, 135000, 5.2, 21, 80, ["MHT CET", "JEE Main"], False),
    ("dypcoe-akurdi", "Dr. D. Y. Patil College of Engineering, Akurdi", "DYPCOE Akurdi", "Pune", "Maharashtra", "Private", 1984, ["Engineering"], None, 4.0, 140000, 150000, 5.0, 20, 78, ["MHT CET", "JEE Main"], False),
    ("scoe-pune", "Sinhgad College of Engineering, Vadgaon", "SCOE Pune", "Pune", "Maharashtra", "Private", 1996, ["Engineering"], None, 3.9, 110000, 120000, 4.5, 18, 72, ["MHT CET", "JEE Main"], False),
    ("mitaoe-pune", "MIT Academy of Engineering, Alandi", "MITAOE", "Pune", "Maharashtra", "Private", 1999, ["Engineering"], None, 4.0, 165000, 175000, 5.5, 24, 80, ["MHT CET", "JEE Main"], False),
    ("ait-pune", "Army Institute of Technology", "AIT Pune", "Pune", "Maharashtra", "Private", 1994, ["Engineering"], None, 4.4, 160000, 170000, 9.5, 50, 95, ["JEE Main"], False),
    ("sit-pune", "Symbiosis Institute of Technology", "SIT Pune", "Pune", "Maharashtra", "Deemed", 2008, ["Engineering"], None, 4.2, 375000, 400000, 7.5, 45, 85, ["JEE Main", "SET"], False),
    # ---- Pune medical
    ("afmc-pune", "Armed Forces Medical College", "AFMC Pune", "Pune", "Maharashtra", "Government", 1948, ["Medical"], 20, 4.8, 0, 60000, 0, 0, 0, ["NEET UG"], True),
    ("bvdu-medical-pune", "Bharati Vidyapeeth Medical College", "BVDU Medical", "Pune", "Maharashtra", "Deemed", 1989, ["Medical", "Dental", "Nursing"], 37, 4.3, 2400000, 2600000, 0, 0, 0, ["NEET UG", "NEET PG"], False),
    ("smcw-pune", "Symbiosis Medical College for Women", "SMCW Pune", "Pune", "Maharashtra", "Deemed", 2020, ["Medical"], None, 4.2, 2200000, 2300000, 0, 0, 0, ["NEET UG"], False),
    ("mimer-talegaon", "MIMER Medical College, Talegaon", "MIMER", "Pune", "Maharashtra", "Private", 1995, ["Medical"], None, 4.0, 850000, 950000, 0, 0, 0, ["NEET UG"], False),
    # ---- Pune management
    ("scmhrd-pune", "Symbiosis Centre for Management & HR Development", "SCMHRD", "Pune", "Maharashtra", "Deemed", 1993, ["Management"], None, 4.6, 1150000, 1200000, 24.0, 55, 100, ["SNAP"], False),
    ("pumba-pune", "Department of Management Sciences, SPPU (PUMBA)", "PUMBA", "Pune", "Maharashtra", "Government", 1971, ["Management"], None, 4.4, 75000, 90000, 9.0, 21, 95, ["MAH MBA CET", "CAT"], False),
    # ---- Mumbai engineering
    ("spit-mumbai", "Sardar Patel Institute of Technology", "SPIT Mumbai", "Mumbai", "Maharashtra", "Private", 1995, ["Engineering", "Computer Applications"], None, 4.6, 175000, 190000, 13.0, 57, 92, ["MHT CET", "JEE Main"], True),
    ("djsce-mumbai", "Dwarkadas J. Sanghvi College of Engineering", "DJ Sanghvi", "Mumbai", "Maharashtra", "Private", 1994, ["Engineering"], None, 4.5, 240000, 260000, 10.5, 45, 90, ["MHT CET", "JEE Main"], True),
    ("tsec-mumbai", "Thadomal Shahani Engineering College", "TSEC Mumbai", "Mumbai", "Maharashtra", "Private", 1983, ["Engineering"], None, 4.3, 150000, 160000, 7.5, 30, 85, ["MHT CET", "JEE Main"], False),
    ("frcrce-mumbai", "Fr. Conceicao Rodrigues College of Engineering", "FRCRCE", "Mumbai", "Maharashtra", "Private", 1984, ["Engineering"], None, 4.3, 155000, 165000, 7.8, 32, 86, ["MHT CET", "JEE Main"], False),
    ("vesit-mumbai", "Vivekanand Education Society's Institute of Technology", "VESIT", "Mumbai", "Maharashtra", "Private", 1984, ["Engineering", "Computer Applications"], None, 4.2, 140000, 150000, 6.5, 27, 84, ["MHT CET", "JEE Main"], False),
    ("kjsce-mumbai", "K. J. Somaiya College of Engineering (Somaiya Vidyavihar University)", "KJSCE", "Mumbai", "Maharashtra", "Deemed", 1983, ["Engineering"], None, 4.4, 420000, 450000, 8.5, 42, 88, ["JEE Main", "SVU CET"], False),
    # ---- Mumbai medical
    ("gsmc-kem-mumbai", "Seth G.S. Medical College & KEM Hospital", "GSMC & KEM", "Mumbai", "Maharashtra", "Government", 1926, ["Medical"], 34, 4.8, 105000, 115000, 0, 0, 0, ["NEET UG", "NEET PG"], True),
    ("ggmc-jj-mumbai", "Grant Government Medical College & Sir J.J. Hospital", "Grant Medical (JJ)", "Mumbai", "Maharashtra", "Government", 1845, ["Medical"], None, 4.7, 120000, 125000, 0, 0, 0, ["NEET UG", "NEET PG"], False),
    ("ltmmc-sion-mumbai", "Lokmanya Tilak Municipal Medical College, Sion", "LTMMC Sion", "Mumbai", "Maharashtra", "Government", 1964, ["Medical"], None, 4.6, 105000, 115000, 0, 0, 0, ["NEET UG", "NEET PG"], False),
    ("tnmc-nair-mumbai", "Topiwala National Medical College & BYL Nair Hospital", "TNMC Nair", "Mumbai", "Maharashtra", "Government", 1921, ["Medical"], None, 4.6, 105000, 115000, 0, 0, 0, ["NEET UG", "NEET PG"], False),
    # ---- Mumbai management
    ("simsree-mumbai", "Sydenham Institute of Management Studies (SIMSREE)", "SIMSREE", "Mumbai", "Maharashtra", "Government", 1983, ["Management"], None, 4.6, 130000, 140000, 20.0, 35, 100, ["MAH MBA CET"], False),
    ("welingkar-mumbai", "Welingkar Institute of Management (WeSchool)", "WeSchool Mumbai", "Mumbai", "Maharashtra", "Private", 1977, ["Management"], None, 4.3, 460000, 480000, 11.5, 30, 95, ["MAH MBA CET", "CAT", "XAT", "CMAT"], False),
    ("spjimr-mumbai", "S. P. Jain Institute of Management & Research", "SPJIMR", "Mumbai", "Maharashtra", "Private", 1981, ["Management"], None, 4.8, 1230000, 1250000, 33.0, 89, 100, ["CAT", "XAT", "GMAT"], True),
    ("kjsim-mumbai", "K. J. Somaiya Institute of Management", "KJSIM", "Mumbai", "Maharashtra", "Deemed", 1981, ["Management"], 53, 4.3, 1100000, 1150000, 12.0, 30, 98, ["CAT", "XAT", "CMAT", "GMAT"], False),
]

# slug -> [(exam, branch, value)]; percentile/score: higher is harder; JEE Advanced: closing rank.
REAL_CUTOFFS = {
    # MHT CET state quota & JEE Main All-India quota, CAP Round 1, GOPEN (approx.)
    "coep-pune": [("MHT CET", "Computer Engineering", 99.86), ("MHT CET", "Electronics & Telecom", 99.55), ("MHT CET", "Mechanical Engineering", 98.7), ("MHT CET", "Civil Engineering", 97.4), ("JEE Main", "Computer Engineering (AI quota)", 99.1)],
    "vjti-mumbai": [("MHT CET", "Computer Engineering", 99.85), ("MHT CET", "Information Technology", 99.72), ("MHT CET", "Electronics & Telecom", 99.4), ("MHT CET", "Mechanical Engineering", 98.4), ("JEE Main", "Computer Engineering (AI quota)", 99.2)],
    "pict-pune": [("MHT CET", "Computer Engineering", 99.55), ("MHT CET", "Information Technology", 99.35), ("MHT CET", "Electronics & Telecom", 98.85), ("JEE Main", "Computer Engineering (AI quota)", 98.4)],
    "spit-mumbai": [("MHT CET", "Computer Engineering", 99.45), ("MHT CET", "CSE (Data Science)", 99.2), ("MHT CET", "Electronics & Telecom", 98.5), ("JEE Main", "Computer Engineering (AI quota)", 98.2)],
    "djsce-mumbai": [("MHT CET", "Computer Engineering", 99.25), ("MHT CET", "AI & Machine Learning", 98.95), ("MHT CET", "Information Technology", 98.9), ("MHT CET", "Mechanical Engineering", 95.5), ("JEE Main", "Computer Engineering (AI quota)", 97.6)],
    "vit-pune": [("MHT CET", "Computer Engineering", 98.9), ("MHT CET", "Information Technology", 98.5), ("MHT CET", "Electronics & Telecom", 97.4), ("MHT CET", "Mechanical Engineering", 94.8), ("JEE Main", "Computer Engineering (AI quota)", 96.5)],
    "pccoe-pune": [("MHT CET", "Computer Engineering", 98.5), ("MHT CET", "Information Technology", 98.0), ("MHT CET", "Electronics & Telecom", 96.8), ("MHT CET", "Mechanical Engineering", 93.0), ("JEE Main", "Computer Engineering (AI quota)", 95.5)],
    "cummins-pune": [("MHT CET", "Computer Engineering", 97.9), ("MHT CET", "Information Technology", 97.3), ("MHT CET", "Electronics & Telecom", 95.8)],
    "tsec-mumbai": [("MHT CET", "Computer Engineering", 97.9), ("MHT CET", "Information Technology", 97.4), ("MHT CET", "AI & Data Science", 97.2)],
    "frcrce-mumbai": [("MHT CET", "Computer Engineering", 97.95), ("MHT CET", "Electronics & Computer Science", 96.6), ("MHT CET", "Mechanical Engineering", 90.5)],
    "viit-pune": [("MHT CET", "Computer Engineering", 97.5), ("MHT CET", "Information Technology", 97.0), ("MHT CET", "AI & Data Science", 96.8), ("JEE Main", "Computer Engineering (AI quota)", 93.0)],
    "vesit-mumbai": [("MHT CET", "Computer Engineering", 97.3), ("MHT CET", "Information Technology", 96.8), ("MHT CET", "AI & Data Science", 96.5)],
    "aissms-coe-pune": [("MHT CET", "Computer Engineering", 96.3), ("MHT CET", "Information Technology", 95.8), ("MHT CET", "Electronics & Telecom", 93.5)],
    "dypcoe-akurdi": [("MHT CET", "Computer Engineering", 96.0), ("MHT CET", "Information Technology", 95.2), ("MHT CET", "Mechanical Engineering", 85.0)],
    "mitaoe-pune": [("MHT CET", "Computer Engineering", 94.8), ("MHT CET", "Information Technology", 94.0), ("MHT CET", "Mechanical Engineering", 82.0)],
    "scoe-pune": [("MHT CET", "Computer Engineering", 95.5), ("MHT CET", "Information Technology", 94.8), ("MHT CET", "Mechanical Engineering", 85.0)],
    "ict-mumbai": [("MHT CET", "Chemical Engineering", 99.3), ("MHT CET", "B.Pharm", 99.0), ("JEE Main", "Chemical Engineering (AI quota)", 98.0)],
    "ait-pune": [("JEE Main", "Computer Engineering (Army wards)", 90.0), ("JEE Main", "Mechanical Engineering (Army wards)", 75.0)],
    "sit-pune": [("JEE Main", "Computer Science", 92.0), ("JEE Main", "AI & Machine Learning", 91.0), ("JEE Main", "Mechanical Engineering", 70.0)],
    "iit-bombay": [("JEE Advanced", "Computer Science & Engineering", 68), ("JEE Advanced", "Electrical Engineering", 520), ("JEE Advanced", "Mechanical Engineering", 2400), ("JEE Advanced", "Civil Engineering", 6500)],
    # NEET UG — MBBS, Maharashtra state quota GOPEN (deemed/private: all-India counselling), score out of 720
    "gsmc-kem-mumbai": [("NEET UG", "MBBS", 672)],
    "ggmc-jj-mumbai": [("NEET UG", "MBBS", 662)],
    "ltmmc-sion-mumbai": [("NEET UG", "MBBS", 655)],
    "tnmc-nair-mumbai": [("NEET UG", "MBBS", 652)],
    "bjmc-pune": [("NEET UG", "MBBS", 650)],
    "afmc-pune": [("NEET UG", "MBBS (AFMC merit list)", 625)],
    "mimer-talegaon": [("NEET UG", "MBBS (state quota)", 590)],
    "smcw-pune": [("NEET UG", "MBBS (deemed quota)", 560)],
    "bvdu-medical-pune": [("NEET UG", "MBBS (deemed quota)", 520)],
    "dy-patil-pune": [("NEET UG", "MBBS (deemed quota)", 500)],
    # MAH MBA CET — MBA/MMS state CAP, GOPEN percentile
    "jbims-mumbai": [("MAH MBA CET", "MMS", 99.95)],
    "simsree-mumbai": [("MAH MBA CET", "MMS", 99.85)],
    "pumba-pune": [("MAH MBA CET", "MBA", 98.7)],
    "welingkar-mumbai": [("MAH MBA CET", "PGDM / MMS (state seats)", 98.4)],
}


def display(exam: str, value: float) -> str:
    if exam == "JEE Advanced":
        return f"Closing rank {int(value)}"
    if exam == "NEET UG":
        return f"{int(value)} / 720"
    return f"{value:.2f} percentile"
