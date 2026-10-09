import {
  Atom, BookOpen, Briefcase, Building2, Calculator, Clapperboard, Cpu, GraduationCap, HeartPulse,
  Hotel, Landmark, Mic, Palette, Pill, Plane, Scale, Smile, Sprout, Stethoscope, Syringe, Theater, PawPrint,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const SITE = {
  name: "Digital Shiksha",
  phone: "+91 8149 68 9468",
  phoneHref: "tel:+918149689468",
  whatsappHref: "https://wa.me/918149689468?text=Hi%20Digital%20Shiksha%2C%20I%20need%20admission%20guidance",
  email: "enquiry@digitalshiksha.in",
  address: "Saudamini Commercial Complex, C1-203, Paud Road, Bhusari Colony, Kothrud, Pune, Maharashtra 411038",
  mapHref: "https://maps.app.goo.gl/ab3QrL9qLAmJy4hYA",
  facebook: "https://www.facebook.com/DigitalShikshaOfficial",
  instagram: "https://www.instagram.com/digitalshikshaoffical/",
  logo: "/logo.png",
};

export interface StreamDef {
  name: string;
  icon: LucideIcon;
  tint: string; // tailwind classes for icon chip
}

// Mirrors Collegedunia's India streams (Study/Work Abroad intentionally excluded).
export const STREAMS: StreamDef[] = [
  { name: "Engineering", icon: Cpu, tint: "bg-red-50 text-red-700" },
  { name: "Management", icon: Briefcase, tint: "bg-green-50 text-green-700" },
  { name: "Medical", icon: Stethoscope, tint: "bg-teal-50 text-teal-700" },
  { name: "Law", icon: Scale, tint: "bg-indigo-50 text-indigo-800" },
  { name: "Commerce", icon: Calculator, tint: "bg-amber-50 text-amber-800" },
  { name: "Science", icon: Atom, tint: "bg-sky-50 text-sky-800" },
  { name: "Arts", icon: BookOpen, tint: "bg-rose-50 text-rose-700" },
  { name: "Computer Applications", icon: Landmark, tint: "bg-blue-50 text-blue-800" },
  { name: "Pharmacy", icon: Pill, tint: "bg-emerald-50 text-emerald-700" },
  { name: "Dental", icon: Smile, tint: "bg-cyan-50 text-cyan-800" },
  { name: "Nursing", icon: Syringe, tint: "bg-pink-50 text-pink-700" },
  { name: "Paramedical", icon: HeartPulse, tint: "bg-red-50 text-red-700" },
  { name: "Design", icon: Palette, tint: "bg-fuchsia-50 text-fuchsia-700" },
  { name: "Architecture", icon: Building2, tint: "bg-slate-100 text-slate-800" },
  { name: "Mass Communication", icon: Mic, tint: "bg-orange-50 text-orange-700" },
  { name: "Hotel Management", icon: Hotel, tint: "bg-yellow-50 text-yellow-800" },
  { name: "Agriculture", icon: Sprout, tint: "bg-lime-50 text-lime-800" },
  { name: "Education", icon: GraduationCap, tint: "bg-indigo-50 text-indigo-800" },
  { name: "Performing Arts", icon: Theater, tint: "bg-purple-50 text-purple-800" },
  { name: "Animation", icon: Clapperboard, tint: "bg-violet-50 text-violet-800" },
  { name: "Veterinary", icon: PawPrint, tint: "bg-stone-100 text-stone-800" },
  { name: "Aviation", icon: Plane, tint: "bg-sky-50 text-sky-800" },
];

export const streamDef = (name: string): StreamDef =>
  STREAMS.find((s) => s.name === name) ?? { name, icon: GraduationCap, tint: "bg-slate-100 text-slate-800" };

export const STATS = [
  { value: "200+", label: "Associate Institutes" },
  { value: "1,500+", label: "Admission Success" },
  { value: "578+", label: "Students Counselled" },
  { value: "16+", label: "Years of Experience" },
];

export const COURSE_INTERESTS = [
  "Engineering (B.Tech / B.E)", "MBA / PGDM", "MBBS / Medical", "BDS / Dental", "BBA / BMS", "Law (LLB / BA LLB)",
  "Pharmacy", "Nursing", "Design", "B.Com / Commerce", "B.Sc / Science", "BCA / MCA", "Hotel Management", "Other",
];

export const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const formatINR = (n: number) => {
  if (!n) return "—";
  if (n >= 100000) return `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
};

export const feeRange = (min: number, max: number) =>
  min === max || !max ? formatINR(min) : `${formatINR(min)} – ${formatINR(max)}`;
