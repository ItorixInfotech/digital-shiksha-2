import { Link } from "react-router-dom";
import { Facebook, Instagram, Mail, MapPin, Phone } from "lucide-react";
import { SITE } from "@/lib/site";

const COLS = [
  { title: "Top Colleges", links: [["Engineering Colleges", "/colleges?stream=Engineering"], ["MBA Colleges", "/colleges?stream=Management"], ["Medical Colleges", "/colleges?stream=Medical"], ["Law Colleges", "/colleges?stream=Law"], ["Colleges in Pune", "/colleges?city=Pune"], ["Colleges in Mumbai", "/colleges?city=Mumbai"]] },
  { title: "Top Courses", links: [["B.Tech", "/courses/btech"], ["MBA", "/courses/mba"], ["MBBS", "/courses/mbbs"], ["BBA", "/courses/bba"], ["BA LLB", "/courses/ba-llb"], ["All Courses", "/courses"]] },
  { title: "Top Exams", links: [["JEE Main", "/exams/jee-main"], ["NEET UG", "/exams/neet-ug"], ["MHT CET", "/exams/mht-cet"], ["CAT", "/exams/cat"], ["CLAT", "/exams/clat"], ["All Exams", "/exams"]] },
  { title: "Digital Shiksha", links: [["Free Counselling", "/consultation"], ["Compare Colleges", "/compare"], ["News & Articles", "/news"], ["Admin Login", "/admin/login"]] },
] as const;

export default function Footer() {
  return (
    <footer className="bg-[#0F172A] text-slate-300" data-testid="site-footer">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="inline-block rounded-xl bg-white p-3"><img src={SITE.logo} alt="Digital Shiksha" className="h-12 w-auto" /></div>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-slate-400">
              Digital Shiksha is a trusted admission consultant in Pune and Mumbai providing personalised guidance, career counselling and hassle-free admission services across India.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              <li><a href={SITE.phoneHref} data-testid="footer-phone-link" className="flex items-center gap-2.5 hover:text-white transition-colors"><Phone className="size-4 text-brand-red" /> {SITE.phone}</a></li>
              <li><a href={`mailto:${SITE.email}`} data-testid="footer-email-link" className="flex items-center gap-2.5 hover:text-white transition-colors"><Mail className="size-4 text-brand-red" /> {SITE.email}</a></li>
              <li><a href={SITE.mapHref} target="_blank" rel="noreferrer" data-testid="footer-address-link" className="flex items-start gap-2.5 hover:text-white transition-colors"><MapPin className="mt-0.5 size-4 shrink-0 text-brand-red" /> {SITE.address}</a></li>
            </ul>
            <div className="mt-6 flex gap-3">
              <a href={SITE.facebook} target="_blank" rel="noreferrer" aria-label="Facebook" data-testid="footer-facebook-link" className="grid size-9 place-items-center rounded-full bg-white/10 hover:bg-brand-red transition-colors"><Facebook className="size-4" /></a>
              <a href={SITE.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" data-testid="footer-instagram-link" className="grid size-9 place-items-center rounded-full bg-white/10 hover:bg-brand-red transition-colors"><Instagram className="size-4" /></a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-8">
            {COLS.map((c) => (
              <div key={c.title}>
                <h4 className="text-sm font-semibold text-white">{c.title}</h4>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {c.links.map(([label, to]) => (
                    <li key={label}><Link to={to} className="text-slate-400 hover:text-white transition-colors" data-testid={`footer-link-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>{label}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-12 border-t border-white/10 pt-6 text-xs leading-relaxed text-slate-500">
          <p>DISCLAIMER – Published in good faith and for general information purposes only. Fees, cutoffs and dates are indicative; please verify with the respective institute or exam authority.</p>
          <p className="mt-3 text-slate-400">© {new Date().getFullYear()} Digital Shiksha – All Rights Reserved.</p>
        </div>
      </div>
    </footer>
  );
}
