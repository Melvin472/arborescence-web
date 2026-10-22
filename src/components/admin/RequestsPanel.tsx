import { useState } from "react";
import { Badge, toneBg } from "@/components/Layout";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { REFUSAL_REASONS } from "@/lib/referentiel";
import {
  approveRequest, assignDevice, deliverRequest, deviceLabel, eligibilityLabel, eligibilityTone, fmtDate, refuseRequest, requestLabel,
  requestTone, shipRequest, unassignDevice, useDB, type Device, type Request, type RequestStatus,
} from "@/lib/store";

const FILTERS: [RequestStatus | "all", string][] = [["all", "Toutes"], ["recue", "À examiner"], ["validee", "Approuvées"], ["expediee", "Expédiées"], ["livree", "Livrées"], ["refusee", "Refusées"], ["annulee", "Annulées"]];

export function RequestsPanel() {
  const { db } = useDB();
  const [filter, setFilter] = useState<RequestStatus | "all">("all");
  const [q, setQ] = useState("");
  const list = db.requests
    .filter((r) => (filter === "all" || r.status === filter) && (!q || r.tracking.toUpperCase().includes(q.trim().toUpperCase()) || r.owner.includes(q.trim().toLowerCase())))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <>
      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Filtrer les demandes">
        {FILTERS.map(([k, l]) => {
          const n = k === "all" ? db.requests.length : db.requests.filter((r) => r.status === k).length;
          return <button key={k} onClick={() => setFilter(k)} className={`btn !py-1.5 text-sm ${filter === k ? "btn-primary" : "btn-ghost"}`}>{l} ({n})</button>;
        })}
      </div>
      <input className="field max-w-sm mb-6" placeholder="Rechercher un n° de demande ou un e-mail" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="grid gap-4">
        {list.map((r) => <RequestCard key={r.id} r={r} />)}
        {!list.length && <p className="text-muted-foreground">Aucune demande.</p>}
      </div>
    </>
  );
}

const WORKFLOW = [["recue", "1. Reçue"], ["validee", "2. Approuvée"], ["attribuee", "3. Matériel attribué"], ["expediee", "4. Expédiée"], ["livree", "5. Livrée"]] as const;
const step = (r: Request) => (r.status === "livree" ? 4 : r.status === "expediee" ? 3 : r.status === "validee" ? (r.deviceIds.length >= r.quantity ? 2 : 1) : 0);

function RequestCard({ r }: { r: Request }) {
  const { db, update } = useDB();
  const [pick, setPick] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [refusing, setRefusing] = useState(false);
  const owner = db.accounts.find((a) => a.email === r.owner);
  const elig = db.eligibilities.find((e) => e.owner === r.owner);
  const assigned = r.deviceIds.map((id) => db.devices.find((d) => d.id === id)).filter((d): d is Device => !!d);
  const candidates = db.devices.filter((d) => d.status === "disponible" && d.type === r.deviceType && (!r.category || d.category === r.category));
  const complete = assigned.length >= r.quantity;
  const closed = ["annulee", "refusee", "livree"].includes(r.status);
  const run = (fn: (d: Parameters<Parameters<typeof update>[0]>[0]) => string | null | void) => {
    let msg: string | null = null;
    update((d) => { msg = fn(d) ?? null; });
    setErr(msg);
  };

  return (
    <div className={`card-soft p-5 grid gap-4 ${r.status === "annulee" ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        <b className="font-display text-lg">{r.tracking}</b>
        <Badge tone={requestTone[r.status]}>{requestLabel[r.status]}</Badge>
        <span className="text-sm">{r.profile}{owner ? ` · ${owner.name}` : ""} · {r.owner}</span>
        <span className="text-sm text-muted-foreground ml-auto">Demandée le {fmtDate(r.createdAt)}</span>
      </div>

      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <p><b>{r.quantity} × {r.category ?? r.deviceType}</b>{r.deviceType !== "Périphérique" && ` · ${r.osPref}`}</p>
        <p>Usage : {r.need}</p>
        {r.details && <p className="sm:col-span-2 text-muted-foreground">« {r.details} »</p>}
        <p className="sm:col-span-2">
          Éligibilité : {elig ? <><Badge tone={eligibilityTone(elig)}>{eligibilityLabel(elig)}</Badge>{elig.validUntil && ` jusqu'au ${fmtDate(elig.validUntil)}`}{elig.participants ? ` · ${elig.participants} participants` : ""}</> : <Badge tone="destructive">Aucune</Badge>}
        </p>
      </div>

      {r.status === "annulee" && <p className="text-sm font-semibold">Demande annulée par le demandeur.</p>}
      {r.status === "refusee" && (
        <p className="text-sm rounded-lg bg-destructive/10 p-3"><b className="text-destructive">Refusée : {r.refusalReason}</b>{r.refusalMessage && <><br />Message envoyé : {r.refusalMessage}</>}</p>
      )}

      {!["annulee", "refusee"].includes(r.status) && (
        <ol className="grid grid-cols-5 gap-2" aria-label="Étapes de traitement">
          {WORKFLOW.map(([k, l], n) => (
            <li key={k} className={`text-xs font-semibold p-2 rounded-lg text-center ${n < step(r) ? toneBg.success : n === step(r) ? toneBg[requestTone[r.status]] : toneBg.muted}`}>{l}</li>
          ))}
        </ol>
      )}

      {(r.status === "validee" || assigned.length > 0) && !["annulee", "refusee"].includes(r.status) && (
        <div className="text-sm">
          <p className="font-semibold">Matériel attribué ({assigned.length}/{r.quantity})</p>
          {assigned.length > 0 && (
            <ul className="mt-1 flex flex-wrap gap-2">
              {assigned.map((d) => (
                <li key={d.id} className="rounded-full bg-secondary px-3 py-1">
                  {d.tracking} — {deviceLabel(d)}
                  {r.status === "validee" && <button className="ml-2 font-bold" aria-label={`Retirer ${d.tracking}`} onClick={() => run((x) => unassignDevice(x, r.id, d.id))}>×</button>}
                </li>
              ))}
            </ul>
          )}
          {r.status === "validee" && !complete && (
            <form className="flex flex-wrap gap-2 mt-2" onSubmit={(e) => { e.preventDefault(); if (pick) { run((x) => assignDevice(x, r.id, pick)); setPick(""); } }}>
              <select className="field !w-auto" value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">{candidates.length ? "Choisir un matériel disponible…" : "Aucun matériel disponible de ce type"}</option>
                {candidates.map((d) => <option key={d.id} value={d.id}>{d.tracking} — {deviceLabel(d)}{d.ram ? ` · ${d.ram} · ${d.os}` : ""}</option>)}
              </select>
              <button className="btn btn-primary !py-1.5" disabled={!pick}>Attribuer</button>
            </form>
          )}
        </div>
      )}

      {!closed && (
        <div className="flex flex-wrap gap-2 items-center">
          {r.status === "recue" && <button className="btn btn-primary !py-2" onClick={() => run((x) => approveRequest(x, r.id))}>✓ Approuver la demande</button>}
          {r.status === "validee" && (
            <>
              <button className="btn btn-primary !py-2 disabled:opacity-50 disabled:cursor-not-allowed" disabled={!complete} onClick={() => run((x) => shipRequest(x, r.id))}>Expédier la commande</button>
              {!complete && <span className="text-xs text-muted-foreground">Attribuez {r.quantity - assigned.length} appareil(s) de plus pour pouvoir expédier.</span>}
            </>
          )}
          {r.status === "expediee" && <button className="btn btn-primary !py-2" onClick={() => run((x) => deliverRequest(x, r.id))}>Marquer comme livrée</button>}
          {(r.status === "recue" || r.status === "validee") && <button className="btn btn-ghost !py-2 !border-destructive text-destructive ml-auto" onClick={() => setRefusing(true)}>Refuser la demande</button>}
        </div>
      )}
      {err && <p role="alert" className="text-sm text-destructive font-semibold">{err}</p>}
      <RefuseDialog open={refusing} tracking={r.tracking} onClose={() => setRefusing(false)} onConfirm={(reason, message) => { run((x) => refuseRequest(x, r.id, reason, message)); setRefusing(false); }} />
    </div>
  );
}

function RefuseDialog({ open, tracking, onClose, onConfirm }: { open: boolean; tracking: string; onClose: () => void; onConfirm: (reason: string, message: string) => void }) {
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <form onSubmit={(e) => { e.preventDefault(); if (reason) onConfirm(reason, message); }} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Refuser la demande {tracking}</DialogTitle>
            <DialogDescription>Le demandeur recevra le motif et votre message. Le matériel éventuellement attribué retournera au catalogue.</DialogDescription>
          </DialogHeader>
          <label><span className="font-semibold">Motif du refus<span className="text-destructive">*</span></span>
            <select required className="field mt-1" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Choisir…</option>
              {REFUSAL_REASONS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label><span className="font-semibold">Message au demandeur</span> <span className="text-xs text-muted-foreground">{reason === "Autre" ? "(obligatoire)" : "(facultatif)"}</span>
            <textarea required={reason === "Autre"} rows={4} className="field mt-1" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Expliquez la décision et, si possible, ce que la personne peut faire." />
          </label>
          <DialogFooter>
            <button type="button" className="btn btn-ghost !py-2" onClick={onClose}>Annuler</button>
            <button className="btn !py-2 bg-destructive text-destructive-foreground">Confirmer le refus</button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
