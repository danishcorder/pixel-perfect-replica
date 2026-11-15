<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## ExamFlow project instructions

- ExamFlow is a commercial, multi-tenant examination platform for schools, colleges, universities, and training institutions. Its scope includes MCQ and descriptive exams, question banks, online attempts, automatic and manual grading, proctoring and invigilator review, subscriptions, and platform administration.
- Build only the specific phase the user requests; do not start multiple modules at once. Work in small phases and inspect existing implementation before changing it. Preserve working features and avoid fake functionality or presenting mock data as real.
- Use the existing Lovable-supported full-stack stack, TypeScript, reusable modules, and GitHub source control. Persistent data, authentication, and permitted uploads use the project's approved managed services. Never expose secret keys or service-role credentials to frontend code.
- Enforce strict institution-level isolation: associate every institution-owned record with its institution, apply database row-level security, and enforce role-based authorization on both frontend and server. Never trust frontend-only authorization.
- Support Platform Super Admin, Institution Admin, Teacher / Examiner, Student, and Invigilator roles. Roles and permissions must be validated securely on the server.
- Preserve historical state for published exams and submitted attempts. Validate examination deadlines and submissions on the server.
- Make every critical control functional. Include loading, success, empty, and error states; validate forms and handle errors.
- Explain data changes and security implications. Test each workflow and report completed, incomplete, and untested behavior honestly.
