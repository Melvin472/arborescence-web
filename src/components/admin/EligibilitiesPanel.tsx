import { useState } from "react";
import { Badge } from "@/components/Layout";
import { JUSTIFS, VALIDITY_OPTIONS } from "@/lib/referentiel";
import { decideEligibility, eligibilityLabel, eligibilityTone, fmtDate, openDocument, useDB, type Eligibility } from "@/lib/store";

export function EligibilitiesPanel() {
  const { db } = useDB();
  const [showAll, setShowAll] = useState(false);
  const pending = db.eligibilities.filter((e) => e.status === "en_attente").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const decided = db.eligibilities.filter((e) => e.status !== "en_attente");
  return (
    <>
      <h3 className="text-xl font-bold mb-3">À examiner ({pending.length})</h3>
      <div className="grid gap-4">
        {pending.map((e) => <EligibilityCard key={e.id} e={e} />)}
        {!pending.length && <p className="text-muted-foreground">Aucune demande d'éligibilité en attente.</p>}
      </div>
      <h3 className="text-xl font-bold mt-10 mb-3">Décisions prises ({decided.length})</h3>
      <div className="grid gap-3">
        {(showAll ? decided : decided.slice(0, 10)).map((e) => <EligibilityCard key={e.id} e={e} />)}
      </div>
      {decided.length > 10 && !showAll && <button className="btn btn-ghost !py-2 mt-3" onClick={() => setShowAll(true)}>Tout afficher</button>}
    </>
  );
}

const months = (n: number) => (n % 12 === 0 ? `${n / 12} an${n > 12 ? "s" : ""}` : `${n} mois`);
const untilFrom = (m: number) => { const d = new Date(); d.setMonth(d.getMonth() + m); return d.toISOString().slice(0, 10); };

function EligibilityCard({ e }: { e: Eligibility }) {
  const { db } = useDB();
  const j = JUSTIFS[e.justifType];
  const [validity, setValidity] = useState(j?.months ?? 12);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const owner = db.accounts.find((a) => a.email === e.owner);
  const pending = e.status === "en_attente";

  const decide = async (status: "validee" | "refusee") => {
    if (status === "refusee" && !message.trim()) return alert("Indiquez au demandeur la raison du refus.");
    setBusy(true);
    await decideEligibility(e.id, status === "validee" ? { status, validUntil: untilFrom(validity), message } : { status, message });
    setBusy(false);
  };

  return (
    <div className="card-soft p-5 grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={eligibilityTone(e)}>{eligibilityLabel(e)}</Badge>
        <b>{e.profile === "Organisation" ? e.orgName : owner?.name || e.owner}</b>
        <span className="text-sm text-muted-foreground">{e.profile} · {e.owner}</span>
        <span className="text-sm text-muted-foreground ml-auto">Envoyée le {fmtDate(e.createdAt)}</span>
      </div>
      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <div><dt className="inline font-semibold">Situation : </dt><dd className="inline">{j?.label ?? e.justifType}</dd></div>
        {e.profile === "Organisation" && (
          <>
            <div><dt className="inline font-semibold">Type : </dt><dd className="inline">{e.orgType}</dd></div>
            <div><dt className="inline font-semibold">SIRET : </dt>
              <dd className="inline font-mono">{e.siret}</dd>{" "}
              <Badge tone={e.siretVerified ? "success" : "warning"}>{e.siretVerified ? "vérifié" : "à contrôler"}</Badge>{" "}
              <a className="underline" href={`https://annuaire-entreprises.data.gouv.fr/etablissement/${e.siret}`} target="_blank" rel="noopener noreferrer">annuaire</a>
            </div>
            <div><dt className="inline font-semibold">Participants attendus : </dt><dd className="inline">{e.participants}</dd></div>
          </>
        )}
        {e.project && <div className="sm:col-span-2"><dt className="font-semibold">{e.profile === "Organisation" ? "Projet" : "Précisions"}</dt><dd className="whitespace-pre-line">{e.project}</dd></div>}
      </dl>
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="font-semibold">Justificatifs :</span>
        {e.documents.length ? e.documents.map((d) => (
          <button key={d.path} className="underline" onClick={() => openDocument(d.path)}>📄 {d.name}</button>
        )) : <span className="text-muted-foreground">aucun</span>}
      </div>

      {pending ? (
        <div className="grid gap-3 rounded-xl bg-muted/50 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm"><span className="font-semibold">Durée de validité</span>
              <select className="field mt-1 !w-auto" value={validity} onChange={(ev) => setValidity(Number(ev.target.value))}>
                {VALIDITY_OPTIONS.map((m) => <option key={m} value={m}>{months(m)}{m === j?.months ? " (recommandé)" : ""}</option>)}
              </select>
            </label>
            <span className="text-sm text-muted-foreground pb-3">jusqu'au {fmtDate(untilFrom(validity))}</span>
          </div>
          <label className="text-sm"><span className="font-semibold">Message au demandeur</span> <span className="text-xs text-muted-foreground">(facultatif pour une validation, obligatoire pour un refus)</span>
            <textarea rows={2} className="field mt-1" value={message} onChange={(ev) => setMessage(ev.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary !py-2" disabled={busy} onClick={() => decide("validee")}>✓ Valider l'éligibilité</button>
            <button className="btn btn-ghost !py-2 !border-destructive text-destructive" disabled={busy} onClick={() => decide("refusee")}>Refuser</button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {e.status === "validee" ? `Validée jusqu'au ${fmtDate(e.validUntil!)}` : "Refusée"}{e.decidedAt ? ` · décision du ${fmtDate(e.decidedAt)}` : ""}{e.decisionMessage ? ` · « ${e.decisionMessage} »` : ""}
        </p>
      )}
    </div>
  );
}
