import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Badge, Page, RequireLogin } from "@/components/Layout";
import { DISK_OPTIONS, OS_OPTIONS, RAM_OPTIONS } from "@/lib/referentiel";
import {
  assignDevice, deviceLabel, fmtDate, requestLabel, setRequestStatus, statusLabel, STATUSES, unassignDevice, useDB,
  type Device, type Request, type RequestStatus, type Status,
} from "@/lib/store";

export const Route = createFileRoute("/catalogue")({
  head: () => ({ meta: [{ title: "Catalogue (gestionnaire) — Reboot Solidaire" }, { name: "description", content: "Tableau de bord du gestionnaire : réception, diagnostic et mise en ligne du matériel." }, { property: "og:title", content: "Catalogue des matériels reconditionnés" }, { property: "og:description", content: "Gestion des stocks et des statuts." }] }),
  component: Catalogue,
});

const tones: Record<Status, "accent" | "warning" | "success" | "muted"> = { enregistre: "accent", diagnostic: "warning", disponible: "success", reserve: "warning", expedie: "accent", demande: "muted" };

function Catalogue() {
  const { db, update } = useDB();
  const [fs, setFs] = useState<Status | "all">("all");
  const [fb, setFb] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [spec, setSpec] = useState({ ram: "", disk: "", os: "" });
  const brands = Array.from(new Set(db.devices.map((d) => d.brand))).sort();
  const list = db.devices.filter((d) => (fs === "all" || d.status === fs) && (!fb || d.brand === fb));
  const patch = (id: string, p: Partial<Device>) => update((d) => { const x = d.devices.find((y) => y.id === id); if (x) Object.assign(x, p); });
  const requests = [...db.requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <Page title="Catalogue des matériels" intro="Tableau de bord du gestionnaire.">
      <RequireLogin admin>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setFs(fs === s ? "all" : s)} className={`card-soft p-5 text-left ${fs === s ? "ring-4 ring-primary" : ""}`}>
              <div className="font-display text-3xl font-bold">{db.devices.filter((d) => d.status === s).length}</div>
              <div className="text-sm font-semibold">{statusLabel.admin[s]}</div>
            </button>
          ))}
        </div>
        <label className="block max-w-xs mb-4"><span className="sr-only">Filtrer par marque</span>
          <select className="field" value={fb} onChange={(e) => setFb(e.target.value)}>
            <option value="">Toutes les marques</option>
            {brands.map((b) => <option key={b}>{b}</option>)}
          </select>
        </label>
        <div className="grid gap-3">
          {list.map((d) => (
            <div key={d.id} className="card-soft p-5">
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone={tones[d.status]}>{statusLabel.admin[d.status]}</Badge>
                <b>{d.tracking}</b><span>{d.type}{d.category ? ` (${d.category})` : ""} · {d.brand} {d.ref}</span>
                <span className="text-sm text-muted-foreground">
                  {[d.age, d.powersOn ? "fonctionne" : "ne fonctionne pas", d.screenOk === undefined ? null : `écran ${d.screenOk ? "OK" : "abîmé"}`, d.linkedTo ? `donné avec ${d.linkedTo}` : null].filter(Boolean).join(" · ")}
                </span>
                <div className="ml-auto flex gap-2">
                  {d.status === "enregistre" && <button className="btn btn-primary !py-1.5" onClick={() => patch(d.id, { status: "diagnostic" })}>Réceptionner → Diagnostic</button>}
                  {d.status === "diagnostic" && (d.type === "Périphérique"
                    ? <button className="btn btn-accent !py-1.5" onClick={() => patch(d.id, { status: "disponible" })}>Mettre en ligne</button>
                    : <button className="btn btn-accent !py-1.5" onClick={() => { setEditing(d.id); setSpec({ ram: "", disk: "", os: "" }); }}>Mettre en ligne</button>)}
                </div>
              </div>
              {editing === d.id && (
                <form className="grid sm:grid-cols-4 gap-3 mt-4" onSubmit={(e) => { e.preventDefault(); patch(d.id, { ...spec, status: "disponible" }); setEditing(null); }}>
                  {([["ram", "RAM", RAM_OPTIONS], ["disk", "Stockage", DISK_OPTIONS], ["os", "Système", OS_OPTIONS]] as const).map(([k, l, opts]) => (
                    <label key={k}><span className="sr-only">{l}</span>
                      <select required className="field" value={spec[k]} onChange={(e) => setSpec({ ...spec, [k]: e.target.value })}>
                        <option value="">{l} *</option>
                        {opts.map((o) => <option key={o}>{o}</option>)}
                      </select>
                    </label>
                  ))}
                  <button className="btn btn-primary">Disponible</button>
                </form>
              )}
            </div>
          ))}
          {!list.length && <p className="text-muted-foreground">Aucun matériel pour ce filtre.</p>}
        </div>

        <h2 className="text-2xl font-bold mt-12 mb-4">Demandes des bénéficiaires</h2>
        <div className="grid gap-4">
          {requests.map((r) => <RequestCard key={r.id} r={r} />)}
          {!requests.length && <p className="text-muted-foreground">Aucune demande pour le moment.</p>}
        </div>
      </RequireLogin>
    </Page>
  );
}

function RequestCard({ r }: { r: Request }) {
  const { db, update } = useDB();
  const [pick, setPick] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const owner = db.accounts.find((a) => a.email === r.owner);
  const assigned = r.deviceIds.map((id) => db.devices.find((d) => d.id === id)).filter((d): d is Device => !!d);
  const candidates = db.devices.filter((d) => d.status === "disponible" && d.type === r.deviceType && (!r.category || d.category === r.category));
  const run = (fn: Parameters<typeof update>[0]) => { setErr(null); update(fn); };
  const closed = r.status === "annulee" || r.status === "livree";

  return (
    <div className={`card-soft p-5 grid gap-3 ${r.status === "annulee" ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        <b className="font-display text-lg">{r.tracking}</b>
        <Badge tone={r.status === "annulee" ? "muted" : r.status === "livree" ? "success" : "accent"}>{requestLabel[r.status]}</Badge>
        <span className="text-sm">{r.profile}{owner ? ` · ${owner.name}` : ""}</span>
        <span className="text-sm text-muted-foreground ml-auto">Demandée le {fmtDate(r.createdAt)}</span>
      </div>
      <p className="text-sm">
        <b>{r.quantity} × {r.category ?? r.deviceType}</b> · {r.need}
        {r.details && <span className="text-muted-foreground"> — {r.details}</span>}
      </p>
      <div className="text-sm">
        <span className="font-semibold">Matériel attribué ({assigned.length}/{r.quantity}) :</span>
        {assigned.length ? (
          <ul className="mt-1 flex flex-wrap gap-2">
            {assigned.map((d) => (
              <li key={d.id} className="rounded-full bg-secondary px-3 py-1">
                {d.tracking} — {deviceLabel(d)}
                {!closed && r.status !== "expediee" && <button className="ml-2 font-bold" aria-label={`Retirer ${d.tracking}`} onClick={() => run((x) => unassignDevice(x, r.id, d.id))}>×</button>}
              </li>
            ))}
          </ul>
        ) : <span className="text-destructive font-semibold"> aucun — la demande ne peut pas être validée.</span>}
      </div>
      {!closed && r.status !== "expediee" && assigned.length < r.quantity && (
        <form className="flex flex-wrap gap-2" onSubmit={(e) => {
          e.preventDefault();
          if (!pick) return;
          let msg: string | null = null;
          update((x) => { msg = assignDevice(x, r.id, pick); });
          setErr(msg); setPick("");
        }}>
          <select className="field !w-auto" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">{candidates.length ? "Choisir un matériel disponible…" : "Aucun matériel disponible de ce type"}</option>
            {candidates.map((d) => <option key={d.id} value={d.id}>{d.tracking} — {deviceLabel(d)}{d.ram ? ` · ${d.ram}` : ""}</option>)}
          </select>
          <button className="btn btn-primary !py-1.5" disabled={!pick}>Attribuer</button>
        </form>
      )}
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">Statut :</span>
        <select className="field !w-auto" value={r.status} onChange={(e) => {
          let msg: string | null = null;
          update((x) => { msg = setRequestStatus(x, r.id, e.target.value as RequestStatus); });
          setErr(msg);
        }}>
          {(Object.entries(requestLabel) as [RequestStatus, string][]).map(([k, l]) => (
            <option key={k} value={k} disabled={!assigned.length && k !== "recue" && k !== "annulee"}>{l}</option>
          ))}
        </select>
      </label>
      {err && <p role="alert" className="text-sm text-destructive font-semibold">{err}</p>}
    </div>
  );
}
