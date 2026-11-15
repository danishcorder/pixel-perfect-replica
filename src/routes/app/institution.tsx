import { createFileRoute } from "@tanstack/react-router";
import { RoleDashboard } from "@/components/app/role-dashboard";
export const Route = createFileRoute("/app/institution")({
  head: () => ({ meta: [{ title: "institution dashboard — ExamFlow" }, { name: "description", content: "ExamFlow institution dashboard preview." }, { property: "og:title", content: "ExamFlow institution dashboard" }, { property: "og:description", content: "ExamFlow institution dashboard preview." }] }),
  component: () => <RoleDashboard role="institution" />,
});
