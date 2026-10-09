import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { ChevronDown, Mail, Menu, Phone, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import GlobalSearch from "@/components/GlobalSearch";
import { SITE, STREAMS, slugify } from "@/lib/site";
import { useSite } from "@/lib/site-context";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/predictor", label: "Predictor" },
  { to: "/courses", label: "Courses" },
  { to: "/exams", label: "Exams" },
  { to: "/compare", label: "Compare" },
  { to: "/news", label: "News" },
  { to: "/consultation", label: "Counselling" },
];

const linkCls = ({ isActive }: { isActive: boolean }) =>
  cn("rounded-md px-3 py-2 text-[15px] font-medium transition-colors", isActive ? "text-brand-red" : "text-slate-700 hover:text-brand-red");

export function Logo({ className = "h-11" }: { className?: string }) {
  return <img src={SITE.logo} alt="Digital Shiksha — Counselling & Admission" className={cn("w-auto select-none", className)} />;
}

export default function Navbar() {
  const { openEnquiry } = useSite();
  const [mobile, setMobile] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const nav = useNavigate();

  return (
    <header className="sticky top-0 z-40" data-testid="site-header">
      <div className="bg-brand-navy text-slate-200">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between gap-4 px-4 text-xs sm:px-6 lg:px-8">
          <p className="truncate" data-testid="topbar-tagline">
            Career counselling for MBBS • B.Tech • MBA • Law • Design — admissions open for 2026
          </p>
          <div className="flex shrink-0 items-center gap-4">
            <a href={SITE.phoneHref} data-testid="topbar-phone-link" className="flex items-center gap-1.5 hover:text-white transition-colors">
              <Phone className="size-3.5" /> {SITE.phone}
            </a>
            <a href={`mailto:${SITE.email}`} data-testid="topbar-email-link" className="hidden items-center gap-1.5 hover:text-white transition-colors md:flex">
              <Mail className="size-3.5" /> {SITE.email}
            </a>
          </div>
        </div>
      </div>
      <div className="border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" data-testid="nav-logo-link" className="shrink-0"><Logo className="h-11" /></Link>

          <nav className="ml-4 hidden items-center gap-0.5 lg:flex" data-testid="main-nav">
            <DropdownMenu>
              <DropdownMenuTrigger data-testid="nav-colleges-dropdown" className="flex items-center gap-1 rounded-md px-3 py-2 text-[15px] font-medium text-slate-700 outline-none hover:text-brand-red transition-colors">
                Colleges <ChevronDown className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[520px] p-2">
                <div className="grid grid-cols-2 gap-0.5">
                  <DropdownMenuItem data-testid="nav-colleges-all" onClick={() => nav("/colleges")} className="col-span-2 font-semibold text-brand-red">
                    All colleges in India →
                  </DropdownMenuItem>
                  {STREAMS.slice(0, 16).map((s) => (
                    <DropdownMenuItem key={s.name} data-testid={`nav-colleges-stream-${slugify(s.name)}`} onClick={() => nav(`/colleges?stream=${encodeURIComponent(s.name)}`)}>
                      <s.icon className="size-4 text-slate-500" /> {s.name} Colleges
                    </DropdownMenuItem>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className={linkCls} data-testid={`nav-link-${slugify(l.label)}`}>
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              data-testid="nav-search-button"
              onClick={() => setSearchOpen(true)}
              className="hidden h-9 items-center gap-2 rounded-lg border bg-slate-50 px-3 text-sm text-slate-500 hover:border-slate-300 transition-colors md:flex"
            >
              <Search className="size-4" /> <span className="hidden xl:inline">Search colleges, exams…</span>
            </button>
            <Button data-testid="nav-enquire-button" onClick={() => openEnquiry({ source: "header" })} className="hidden h-9 bg-brand-red px-4 text-white hover:bg-red-700 active:scale-[0.98] transition-[background-color,transform] sm:inline-flex">
              Enquire Now
            </Button>
            <Sheet open={mobile} onOpenChange={setMobile}>
              <SheetTrigger render={<Button variant="outline" size="icon" className="lg:hidden" data-testid="mobile-menu-button" />}>
                <Menu className="size-5" />
              </SheetTrigger>
              <SheetContent side="right" className="w-80 overflow-y-auto p-5">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <Logo className="h-10" />
                <div className="mt-5"><GlobalSearch testid="mobile-search" onNavigate={() => setMobile(false)} /></div>
                <nav className="mt-4 grid gap-1">
                  {[{ to: "/colleges", label: "Colleges" }, ...LINKS].map((l) => (
                    <NavLink key={l.to} to={l.to} onClick={() => setMobile(false)} className={linkCls} data-testid={`mobile-nav-${slugify(l.label)}`}>
                      {l.label}
                    </NavLink>
                  ))}
                </nav>
                <Button data-testid="mobile-enquire-button" className="mt-4 w-full bg-brand-red text-white hover:bg-red-700" onClick={() => { setMobile(false); openEnquiry({ source: "mobile-menu" }); }}>
                  Enquire Now
                </Button>
                <a href={SITE.phoneHref} className="mt-3 flex items-center gap-2 text-sm text-slate-700" data-testid="mobile-call-link"><Phone className="size-4" /> {SITE.phone}</a>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="top-24 translate-y-0 sm:max-w-xl" data-testid="search-dialog">
          <DialogTitle>Search Digital Shiksha</DialogTitle>
          <GlobalSearch testid="dialog-search" onNavigate={() => setSearchOpen(false)} />
          <p className="text-xs text-slate-500">Try “Pune”, “MBA”, “NEET” or “COEP”.</p>
        </DialogContent>
      </Dialog>
    </header>
  );
}
