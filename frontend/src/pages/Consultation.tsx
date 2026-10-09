import { Link } from "react-router-dom";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import EnquiryForm from "@/components/EnquiryForm";
import { PageHeader } from "@/components/Common";
import { SITE } from "@/lib/site";
import { PageSeo, Seo } from "@/components/Seo";

const STEPS = [
  ["Share your profile", "Tell us your scores, preferred course, city and budget."],
  ["Get a shortlist", "Our counsellor maps realistic colleges using past cutoffs."],
  ["Apply with confidence", "We handle registrations, option forms and documents."],
  ["Secure your seat", "Guidance through every round until you report to college."],
];

export function Consultation() {
  return (
    <div data-testid="consultation-page">
      <PageSeo page="consultation" />
      <PageHeader crumbs={[{ label: "Home", to: "/" }, { label: "Free Counselling" }]} title="Book your free admission consultation" subtitle="Personalised guidance from Pune's trusted admission consultants — for Engineering, MBA, Medical, Law and every course in India." testid="consultation-header" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-12 lg:px-8">
        <div className="lg:col-span-5">
          <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
          <ol className="mt-6 space-y-6">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-navy font-semibold text-white">{i + 1}</span>
                <div><p className="font-semibold text-slate-900">{t}</p><p className="text-sm text-slate-600">{d}</p></div>
              </li>
            ))}
          </ol>
          <div className="mt-10 space-y-4 rounded-2xl border bg-white p-6" data-testid="contact-details">
            <a href={SITE.phoneHref} className="flex items-center gap-3 text-slate-800 hover:text-brand-red transition-colors" data-testid="consultation-phone-link"><Phone className="size-5 text-brand-red" /> {SITE.phone}</a>
            <a href={SITE.whatsappHref} target="_blank" rel="noreferrer" className="flex items-center gap-3 text-slate-800 hover:text-brand-red transition-colors" data-testid="consultation-whatsapp-link"><MessageCircle className="size-5 text-[#25D366]" /> Chat on WhatsApp</a>
            <a href={`mailto:${SITE.email}`} className="flex items-center gap-3 text-slate-800 hover:text-brand-red transition-colors" data-testid="consultation-email-link"><Mail className="size-5 text-brand-red" /> {SITE.email}</a>
            <a href={SITE.mapHref} target="_blank" rel="noreferrer" className="flex items-start gap-3 text-slate-800 hover:text-brand-red transition-colors" data-testid="consultation-address-link"><MapPin className="mt-0.5 size-5 shrink-0 text-brand-red" /> {SITE.address}</a>
            <p className="flex items-center gap-3 text-slate-600"><Clock className="size-5 text-slate-400" /> Mon – Sat, 10:00 AM – 7:00 PM</p>
          </div>
        </div>
        <div className="lg:col-span-7">
          <div className="rounded-2xl border bg-white p-6 shadow-lg sm:p-8">
            <h2 className="text-xl font-semibold">Tell us about yourself</h2>
            <p className="mt-1 text-sm text-slate-500">All fields except name & mobile are optional.</p>
            <div className="mt-6"><EnquiryForm testid="consultation" prefill={{ source: "consultation-page" }} showMessage showBudget /></div>
          </div>
          <div className="mt-6 overflow-hidden rounded-2xl border">
            <iframe title="Digital Shiksha office location" src="https://www.google.com/maps?q=Saudamini+Commercial+Complex+Paud+Road+Kothrud+Pune&output=embed" className="h-72 w-full" loading="lazy" data-testid="consultation-map" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center" data-testid="not-found-page">
      <Seo title="Page not found | Digital Shiksha" description="This page does not exist." noindex />
      <p className="text-6xl font-bold text-brand-red">404</p>
      <h1 className="mt-4 text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-slate-500">The page you're looking for doesn't exist.</p>
      <Link to="/" className="mt-6 inline-block font-semibold text-brand-blue hover:text-brand-red" data-testid="not-found-home-link">← Back to home</Link>
    </div>
  );
}
