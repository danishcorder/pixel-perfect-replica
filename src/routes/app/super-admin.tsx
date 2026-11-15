import { createFileRoute } from "@tanstack/react-router";
import { RoleDashboard } from "@/components/app/role-dashboard";
export const Route = createFileRoute("/app/super-admin")({
  head: () => ({ meta: [{ title: "super-admin dashboard — ExamFlow" }, { name: "description", content: "ExamFlow super-admin dashboard preview." }, { property: "og:title", content: "ExamFlow super-admin dashboard" }, { property: "og:description", content: "ExamFlow super-admin dashboard preview." }] }),
  component: () => <RoleDashboard role="super-admin" />,
});
