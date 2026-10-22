import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Badge, FieldLabel, Page, RequiredLegend, RequireLogin } from "@/components/Layout";
import { DEVICE_TYPES, MAX_QUANTITY, NEED_OPTIONS, OS_PREFS, PERIPHERAL_CATEGORIES } from "@/lib/referentiel";
import { activeEligibility, code, fmtDate, isActiveRequest, pendingEligibility, requestLabel, today, useDB } from "@/lib/store";

export const Route = createFileRoute("/demande")({
  head: () => ({ meta: [{ title: "Demander un équipement — Reboot Solidaire" }, { name: "description", content: "Décrivez votre besoin en équipement reconditionné et déposez votre demande." }, { property: "og:title", content: "Demander un équipement" }, { property: "og:description", content: "Éligibilité et besoin." }] }),
  component: Demande,
});

const empty = { deviceType: "", category: "", quantity: 1, need: "", details: "", osPref: "", notifications: true };

function Demande() {
  const { db, update } = useDB();
  const [f, setF] = useState(empty);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const u = db.user;
  const profile = u?.profile ?? "Particulier";
  const max = MAX_QUANTITY[profile];

  if (done) return (
    <Page title="Demande envoyée">
      <div className="card-soft p-10 max-w-xl text-center">
        <p>Votre numéro de suivi de demande :</p>
        <p className="font-display text-5xl font-bold text-accent mt-2">{done}</p>
        <p className="text-sm text-muted-foreground mt-4">Le gestionnaire va étudier votre demande et vous attribuer un matériel adapté. Vous pourrez suivre chaque étape depuis votre espace.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/suivi" className="btn btn-primary">Voir mon suivi</Link>
          <button className="btn btn-ghost" onClick={() => { setF(empty); setDone(null); }}>Nouvelle demande</button>
        </div>
      </div>
    </Page>
  );

  const eligible = activeEligibility(db);
  const pending = pendingEligibility(db);
  const intro = (
    <>
      <p>Décrivez votre besoin : l'équipe vous attribuera le matériel reconditionné le plus adapté.</p>
      <p className="mt-3 text-base">Êtes-vous éligible ? Les demandes sont réservées aux personnes et organisations dont l'éligibilité a été validée.</p>
      <Link to="/eligibilite" hash="test" className="btn btn-ghost !py-2 mt-3 text-base">Vérifier mon éligibilité</Link>
    </>
  );

  return (
    <Page title="Demander un équipement" intro={intro}>
      <RequireLogin roles={["utilisateur"]}>
        {!eligible ? (
          <div className="card-soft p-8 max-w-2xl space-y-3">
            {pending ? (
              <>
                <p><Badge tone="warning">Éligibilité en cours d'examen</Badge></p>
                <p>Votre dossier d'éligibilité envoyé le {fmtDate(pending.createdAt)} est en cours de vérification. Vous pourrez faire votre demande dès qu'il sera validé.</p>
              </>
            ) : (
              <>
                <p className="font-semibold">Avant de faire une demande, faites valider votre éligibilité.</p>
                <p className="text-sm text-muted-foreground">Le formulaire ne prend que quelques minutes ; préparez votre justificatif.</p>
                <Link to="/eligibilite" hash="test" className="btn btn-primary !py-2">Faire un test d'éligibilité</Link>
              </>
            )}
          </div>
        ) : (
        <form className="card-soft p-8 max-w-2xl grid gap-5" onSubmit={(e) => {
          e.preventDefault();
          const category = f.deviceType === "Périphérique" ? f.category || "Autre" : undefined;
          if (f.deviceType !== "Périphérique" && !f.osPref) return setErr("Indiquez le système d'exploitation souhaité.");
          const dup = db.requests.find((r) => r.owner === u!.email && isActiveRequest(r) && r.deviceType === f.deviceType && (r.category ?? "") === (category ?? ""));
          if (dup) return setErr(`Vous avez déjà une demande en cours pour ce type de matériel (${dup.tracking} — ${requestLabel[dup.status]}). Annulez-la depuis le suivi pour en faire une nouvelle.`);
          const t = code("DEM");
          update((d) => {
            d.requests.push({
              id: crypto.randomUUID(), tracking: t, owner: u!.email, profile,
              deviceType: f.deviceType, category, quantity: Math.min(f.quantity, max), need: f.need, details: f.details.trim(), osPref: f.deviceType === "Périphérique" ? "Pas de préférence" : f.osPref,
              deviceIds: [], status: "recue", createdAt: today(), notifications: f.notifications, refusalMessage: "",
            });
          });
          setErr(null);
          setDone(t);
        }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-2xl font-bold text-primary">Votre demande</h2>
            <span className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold">Profil : {profile}</span>
          </div>
          <RequiredLegend />
          <div className="grid sm:grid-cols-2 gap-4">
            <label><FieldLabel required>Type d'appareil</FieldLabel>
              <select required className="field mt-1" value={f.deviceType} onChange={(e) => setF({ ...f, deviceType: e.target.value, category: "" })}>
                <option value="">Choisir…</option>
                {DEVICE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            {f.deviceType === "Périphérique" && (
              <label><FieldLabel required>Catégorie</FieldLabel>
                <select required className="field mt-1" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                  <option value="">Choisir…</option>
                  {PERIPHERAL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
            )}
            {max > 1 && (
              <label><FieldLabel required>Nombre d'appareils</FieldLabel>
                <select required className="field mt-1" value={f.quantity} onChange={(e) => setF({ ...f, quantity: Number(e.target.value) })}>
                  {Array.from({ length: max }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            )}
            <label><FieldLabel required>Usage principal</FieldLabel>
              <select required className="field mt-1" value={f.need} onChange={(e) => setF({ ...f, need: e.target.value })}>
                <option value="">Choisir…</option>
                {NEED_OPTIONS.map((n) => <option key={n}>{n}</option>)}
              </select>
            </label>
          </div>
          {max === 1 && <p className="text-sm text-muted-foreground">Les particuliers peuvent demander un seul appareil à la fois.</p>}
          {f.deviceType !== "Périphérique" && (
            <fieldset>
              <legend className="mb-2"><FieldLabel required>Système d'exploitation souhaité</FieldLabel></legend>
              <div className="flex flex-wrap gap-2">
                {OS_PREFS.map((o) => (
                  <label key={o} className={`flex gap-2 items-center px-4 py-2 rounded-full border-2 cursor-pointer ${f.osPref === o ? "border-primary bg-secondary" : ""}`}>
                    <input type="radio" name="os" required checked={f.osPref === o} onChange={() => setF({ ...f, osPref: o })} /> {o}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <label><FieldLabel>Précisions</FieldLabel>
            <textarea rows={3} className="field mt-1" placeholder={profile === "Particulier" ? "ex. logiciels nécessaires, contraintes particulières…" : "ex. nombre de bénéficiaires ou d'élèves concernés, logiciels utilisés…"} value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} />
          </label>
          <label className="flex gap-2 items-center"><input type="checkbox" checked={f.notifications} onChange={(e) => setF({ ...f, notifications: e.target.checked })} /> Recevoir les mises à jour par e-mail</label>
          {err && <p role="alert" className="rounded-lg bg-destructive/10 text-destructive font-semibold p-3 text-sm">{err}</p>}
          <p className="text-xs text-muted-foreground">Vos informations ne sont jamais transmises au donateur. <Link to="/eligibilite" className="underline">Voir les critères</Link></p>
          <p className="text-xs text-muted-foreground">Éligibilité valable jusqu'au {fmtDate(eligible.validUntil!)}.</p>
          <button className="btn btn-accent">Envoyer ma demande</button>
        </form>
        )}
      </RequireLogin>
    </Page>
  );
}
