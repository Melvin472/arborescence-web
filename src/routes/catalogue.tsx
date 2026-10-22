import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DevicesPanel } from "@/components/admin/DevicesPanel";
import { EligibilitiesPanel } from "@/components/admin/EligibilitiesPanel";
import { FeedbackPanel, MessagesPanel } from "@/components/admin/InboxPanels";
import { RequestsPanel } from "@/components/admin/RequestsPanel";
import { Page, RequireLogin, ToneLegend } from "@/components/Layout";
import { useDB } from "@/lib/store";

export const Route = createFileRoute("/catalogue")({
  head: () => ({ meta: [{ title: "Espace gestionnaire — Reboot Solidaire" }, { name: "robots", content: "noindex" }] }),
  component: Catalogue,
});

type Tab = "materiel" | "demandes" | "eligibilites" | "messages" | "avis";

function Catalogue() {
  const { db } = useDB();
  const [tab, setTab] = useState<Tab>("demandes");
  const tabs: [Tab, string, number][] = [
    ["demandes", "Demandes", db.requests.filter((r) => r.status === "recue").length],
    ["eligibilites", "Éligibilités", db.eligibilities.filter((e) => e.status === "en_attente").length],
    ["materiel", "Matériel", db.devices.filter((d) => d.status === "enregistre").length],
    ["messages", "Messages", db.contacts.filter((m) => !m.handled).length],
    ["avis", "Avis", db.feedback.filter((f) => !f.approved).length],
  ];
  return (
    <Page title="Espace gestionnaire" intro="Demandes, éligibilités, matériel, messages et avis.">
      <RequireLogin admin>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Sections">
            {tabs.map(([k, l, n]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`btn !py-2 ${tab === k ? "btn-primary" : "btn-ghost"}`}>
                {l}{n > 0 && <span className="ml-1 rounded-full bg-accent text-accent-foreground text-xs px-2 py-0.5">{n}</span>}
              </button>
            ))}
          </div>
          <ToneLegend />
        </div>
        <div role="tabpanel">
          {tab === "demandes" && <RequestsPanel />}
          {tab === "eligibilites" && <EligibilitiesPanel />}
          {tab === "materiel" && <DevicesPanel />}
          {tab === "messages" && <MessagesPanel />}
          {tab === "avis" && <FeedbackPanel />}
        </div>
      </RequireLogin>
    </Page>
  );
}
