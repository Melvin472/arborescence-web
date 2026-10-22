import { createFileRoute } from "@tanstack/react-router";
import { DevicesPanel } from "@/components/admin/DevicesPanel";
import { EligibilitiesPanel } from "@/components/admin/EligibilitiesPanel";
import { FeedbackPanel, MessagesPanel } from "@/components/admin/InboxPanels";
import { RequestsPanel } from "@/components/admin/RequestsPanel";
import { Page, RequireLogin } from "@/components/Layout";
import { ADMIN_TABS, type AdminTab } from "@/lib/referentiel";

export const Route = createFileRoute("/catalogue")({
  validateSearch: (s: Record<string, unknown>): { onglet?: AdminTab } => ({
    onglet: ADMIN_TABS.some(([k]) => k === s.onglet) ? (s.onglet as AdminTab) : undefined,
  }),
  head: () => ({ meta: [{ title: "Espace gestionnaire — Reboot Solidaire" }, { name: "robots", content: "noindex" }] }),
  component: Catalogue,
});

function Catalogue() {
  const tab: AdminTab = Route.useSearch().onglet ?? "demandes";
  const [, title, intro] = ADMIN_TABS.find(([k]) => k === tab)!;
  return (
    <Page title={title} intro={intro}>
      <RequireLogin admin>
        {tab === "demandes" && <RequestsPanel />}
        {tab === "eligibilites" && <EligibilitiesPanel />}
        {tab === "materiel" && <DevicesPanel />}
        {tab === "messages" && <MessagesPanel />}
        {tab === "avis" && <FeedbackPanel />}
      </RequireLogin>
    </Page>
  );
}
