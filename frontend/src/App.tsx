import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Colleges from "@/pages/Colleges";
import CollegeDetail from "@/pages/CollegeDetail";
import Courses from "@/pages/Courses";
import CourseDetail from "@/pages/CourseDetail";
import Exams from "@/pages/Exams";
import ExamDetail from "@/pages/ExamDetail";
import { ArticleDetail, News } from "@/pages/News";
import { Consultation, NotFound } from "@/pages/Consultation";
import Landing from "@/pages/Landing";

// Heavy, less-visited pages load on demand so the main bundle (and every first visit) stays small.
const Compare = lazy(() => import("@/pages/Compare"));
const Predictor = lazy(() => import("@/pages/Predictor"));
const Admin = lazy(() => import("@/pages/Admin"));
const AdminLogin = lazy(() => import("@/pages/Admin").then((m) => ({ default: m.AdminLogin })));
const AdminReset = lazy(() => import("@/pages/AdminReset"));

const PageLoading = () => (
  <div className="grid min-h-[50vh] place-items-center" data-testid="page-loading">
    <span className="size-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-navy" />
  </div>
);

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <Suspense fallback={<PageLoading />}>
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/colleges" element={<Colleges />} />
        <Route path="/colleges/:slug" element={<CollegeDetail />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/courses/:slug" element={<CourseDetail />} />
        <Route path="/exams" element={<Exams />} />
        <Route path="/exams/:slug" element={<ExamDetail />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/predictor" element={<Predictor />} />
        <Route path="/news" element={<News />} />
        <Route path="/news/:slug" element={<ArticleDetail />} />
        <Route path="/consultation" element={<Consultation />} />
        <Route path="/:landing" element={<Landing />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin/reset" element={<AdminReset />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
    </Suspense>
  );
}
