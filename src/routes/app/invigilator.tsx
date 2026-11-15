import { createFileRoute } from "@tanstack/react-router";
import { RoleDashboard } from "@/components/app/role-dashboard";
export const Route = createFileRoute("/app/invigilator")({
  head: () => ({ meta: [{ title: "invigilator dashboard — ExamFlow" }, { name: "description", content: "ExamFlow invigilator dashboard preview." }, { property: "og:title", content: "ExamFlow invigilator dashboard" }, { property: "og:description", content: "ExamFlow invigilator dashboard preview." }] }),
  component: () => <RoleDashboard role="invigilator" />,
});
