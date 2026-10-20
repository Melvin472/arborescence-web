import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Badge, Page, RequireLogin } from "@/components/Layout";
import { requestLabel, statusLabel, useDB, type Device, type Status } from "@/lib/store";

export const Route = createFileRoute("/catalogue")({
  head: () => ({ meta: [{ title: "Catalogue (gestionnaire) — Reboot Solidaire" }, { name: "description", content: "Tableau de bord du gestionnaire : réception, diagnostic et mise en ligne du matériel." }, { property: "og:title", content: "Catalogue des matériels reconditionnés" }, { property: "og:description", content: "Gestion des stocks et des statuts." }] }),
  component: Catalogue,
});

const tones: Record<Status, "accent" | "warning" | "success" | "muted"> = { enregistre: "accent", diagnostic: "warning", disponible: "success", demande: "muted" };

function Catalogue() {
  const { db, update } = useDB();
  const [fs, setFs] = useState<Status | "all">("all");
  const [fb, setFb] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [spec, setSpec] = useState({ ram: "", disk: "", os: "" });
  const list = db.devices.filter((d) => (fs === "all" || d.status === fs) && d.brand.toLowerCase().includes(fb.toLowerCase()));
  const patch = (id: string, p: Partial<Device>) => update((d) => { const x = d.devices.find((y) => y.id === id); if (x) Object.assign(x, p); });

  return (
    <Page title="Catalogue des matériels" intro="Tableau de bord du gestionnaire.">
      <RequireLogin admin>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {(Object.keys(tones) as Status[]).map((s) => (
            <button key={s} onClick={() => setFs(fs === s ? "all" : s)} className={`card-soft p-5 text-left ${fs === s ? "ring-4 ring-primary" : ""}`}>
              <div className="font-display text-3xl font-bold">{db.devices.filter((d) => d.status === s).length}</div>
              <div className="text-sm font-semibold">{statusLabel.admin[s]}</div>
            </button>
          ))}
        </div>
        <input className="field max-w-xs mb-4" placeholder="Filtrer par marque" value={fb} onChange={(e) => setFb(e.target.value)} />
        <div className="grid gap-3">
          {list.map((d) => (
            <div key={d.id} className="card-soft p-5">
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone={tones[d.status]}>{statusLabel.admin[d.status]}</Badge>
                <b>{d.tracking}</b><span>{d.type} · {d.brand} {d.ref}</span>
                <span className="text-sm text-muted-foreground">{d.age} · {d.powersOn ? "s'allume" : "ne s'allume pas"} · écran {d.screenOk ? "OK" : "abîmé"}</span>
                <div className="ml-auto flex gap-2">
                  {d.status === "enregistre" && <button className="btn btn-primary !py-1.5" onClick={() => patch(d.id, { status: "diagnostic" })}>Réceptionner → Diagnostic</button>}
                  {d.status === "diagnostic" && <button className="btn btn-accent !py-1.5" onClick={() => { setEditing(d.id); setSpec({ ram: "", disk: "", os: "" }); }}>Mettre en ligne</button>}
                  {d.status === "disponible" && <button className="btn btn-ghost !py-1.5" onClick={() => patch(d.id, { status: "demande" })}>Clore (distribué)</button>}
                </div>
              </div>
              {editing === d.id && (
                <form className="grid sm:grid-cols-4 gap-3 mt-4" onSubmit={(e) => { e.preventDefault(); patch(d.id, { ...spec, status: "disponible" }); setEditing(null); }}>
                  <input required className="field" placeholder="RAM" value={spec.ram} onChange={(e) => setSpec({ ...spec, ram: e.target.value })} />
                  <input required className="field" placeholder="Disque" value={spec.disk} onChange={(e) => setSpec({ ...spec, disk: e.target.value })} />
                  <input required className="field" placeholder="Système" value={spec.os} onChange={(e) => setSpec({ ...spec, os: e.target.value })} />
                  <button className="btn btn-primary">Disponible</button>
                </form>
              )}
            </div>
          ))}
        </div>
        <h2 className="text-2xl font-bold mt-12 mb-4">Demandes des bénéficiaires</h2>
        <div className="grid gap-3">
          {db.requests.map((r) => (
            <div key={r.id} className="card-soft p-5 flex flex-wrap items-center gap-3">
              <b>{r.tracking}</b><span>{r.profile}</span><span className="text-sm text-muted-foreground flex-1">{r.need}</span>
              <select className="field !w-auto" value={r.status} onChange={(e) => update((d) => {
                const x = d.requests.find((y) => y.id === r.id); if (!x) return;
                x.status = e.target.value as typeof x.status;
                if (x.deviceId && x.status !== "recue") { const dv = d.devices.find((y) => y.id === x.deviceId); if (dv) dv.status = "demande"; }
              })}>
                {Object.entries(requestLabel).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
          ))}
          {!db.requests.length && <p className="text-muted-foreground">Aucune demande pour le moment.</p>}
        </div>
      </RequireLogin>
    </Page>
  );
}
