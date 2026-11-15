import { createFileRoute } from "@tanstack/react-router";
import { RoleDashboard } from "@/components/app/role-dashboard";
export const Route = createFileRoute("/app/student")({
  head: () => ({ meta: [{ title: "student dashboard — ExamFlow" }, { name: "description", content: "ExamFlow student dashboard preview." }, { property: "og:title", content: "ExamFlow student dashboard" }, { property: "og:description", content: "ExamFlow student dashboard preview." }] }),
  component: () => <RoleDashboard role="student" />,
});
