import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CompareBar, EnquiryDialog, FloatingActions } from "@/components/Overlays";
import { SiteProvider } from "@/lib/site-context";

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function Layout() {
  return (
    <SiteProvider>
      <ScrollTop />
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
      <FloatingActions />
      <CompareBar />
      <EnquiryDialog />
      <Toaster richColors />
    </SiteProvider>
  );
}
