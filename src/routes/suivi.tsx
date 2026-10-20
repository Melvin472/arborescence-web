import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Badge, Page, RequireLogin } from "@/components/Layout";
import { requestLabel, statusLabel, useDB } from "@/lib/store";

export const Route = createFileRoute("/suivi")({
  head: () => ({ meta: [{ title: "Suivre une demande — Reboot Solidaire" }, { name: "description", content: "Statut, historique et notifications de vos dons et demandes." }, { property: "og:title", content: "Suivre une demande" }, { property: "og:description", content: "Statut, historique, notifications." }] }),
  component: Suivi,
});

const reqSteps = ["recue", "validee", "expediee", "livree"] as const;

function Suivi() {
  const { db, update } = useDB();
  const [q, setQ] = useState("");
  const u = db.user;
  const dons = db.devices.filter((d) => d.owner === u?.name || (q && d.tracking === q.toUpperCase()));
  const reqs = db.requests.filter((r) => r.owner === u?.name || (q && r.tracking === q.toUpperCase()));
  return (
    <Page title="Suivre une demande" intro="Retrouvez le statut et l'historique de vos dons et demandes.">
      <RequireLogin>
        <label className="block max-w-md"><span className="font-semibold">Numéro de suivi</span><input className="field mt-1" placeholder="DON-1234 ou DEM-1234" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <h2 className="text-2xl font-bold mt-10 mb-4">Mes demandes</h2>
        <div className="grid gap-4">
          {reqs.map((r) => {
            const i = reqSteps.indexOf(r.status);
            return (
              <div key={r.id} className="card-soft p-6">
                <div className="flex flex-wrap justify-between gap-2"><b className="font-display text-xl">{r.tracking}</b><span className="text-sm text-muted-foreground">{r.createdAt}</span></div>
                <ol className="grid grid-cols-4 gap-2 mt-4">{reqSteps.map((s, k) => (
                  <li key={s} className={`text-xs font-semibold p-2 rounded-lg text-center ${k <= i ? "bg-success text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{requestLabel[s]}</li>))}</ol>
                <label className="flex gap-2 items-center mt-4 text-sm"><input type="checkbox" checked={r.notifications} onChange={(e) => update((d) => { const x = d.requests.find((y) => y.id === r.id); if (x) x.notifications = e.target.checked; })} /> Notifications par e-mail</label>
              </div>
            );
          })}
          {!reqs.length && <p className="text-muted-foreground">Aucune demande.</p>}
        </div>
        <h2 className="text-2xl font-bold mt-10 mb-4">Mes dons</h2>
        <div className="grid gap-3">
          {dons.map((d) => (
            <div key={d.id} className="card-soft p-5 flex flex-wrap justify-between items-center gap-2">
              <span><b>{d.tracking}</b> — {d.brand} {d.ref}</span>
              <Badge tone={d.status === "disponible" || d.status === "demande" ? "success" : "warning"}>{statusLabel.donateur[d.status]}</Badge>
            </div>
          ))}
          {!dons.length && <p className="text-muted-foreground">Aucun don.</p>}
        </div>
      </RequireLogin>
    </Page>
  );
}
