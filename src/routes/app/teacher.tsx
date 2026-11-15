import { createFileRoute } from "@tanstack/react-router";
import { RoleDashboard } from "@/components/app/role-dashboard";
export const Route = createFileRoute("/app/teacher")({
  head: () => ({ meta: [{ title: "teacher dashboard — ExamFlow" }, { name: "description", content: "ExamFlow teacher dashboard preview." }, { property: "og:title", content: "ExamFlow teacher dashboard" }, { property: "og:description", content: "ExamFlow teacher dashboard preview." }] }),
  component: () => <RoleDashboard role="teacher" />,
});
