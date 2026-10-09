import { Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Colleges from "@/pages/Colleges";
import CollegeDetail from "@/pages/CollegeDetail";
import Courses from "@/pages/Courses";
import CourseDetail from "@/pages/CourseDetail";
import Exams from "@/pages/Exams";
import ExamDetail from "@/pages/ExamDetail";
import Compare from "@/pages/Compare";
import { ArticleDetail, News } from "@/pages/News";
import { Consultation, NotFound } from "@/pages/Consultation";
import Admin, { AdminLogin } from "@/pages/Admin";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
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
        <Route path="/news" element={<News />} />
        <Route path="/news/:slug" element={<ArticleDetail />} />
        <Route path="/consultation" element={<Consultation />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  );
}
