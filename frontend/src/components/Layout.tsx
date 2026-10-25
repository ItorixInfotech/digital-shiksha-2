import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ExitIntent from "@/components/ExitIntent";
import { useOldPageRedirect } from "@/components/RedirectGuard";
import { CompareBar, EnquiryDialog, FloatingActions, MobileBottomBar } from "@/components/Overlays";
import { SiteProvider } from "@/lib/site-context";

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function Layout() {
  const hold = useOldPageRedirect();
  return (
    <SiteProvider>
      <ScrollTop />
      <div className="flex min-h-screen flex-col pb-16 md:pb-0">
        <Navbar />
        <main className="flex-1">
          {hold ? <div className="min-h-[60vh]" data-testid="redirect-pending" /> : <Outlet />}
        </main>
        <Footer />
      </div>
      <FloatingActions />
      <MobileBottomBar />
      <ExitIntent />
      <CompareBar />
      <EnquiryDialog />
      <Toaster richColors />
    </SiteProvider>
  );
}
