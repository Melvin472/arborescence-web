import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Badge, ErrorMsg, FieldLabel, Page, RequiredLegend, RequireLogin } from "@/components/Layout";
import { JUSTIFS, ORG_TYPES, PARTICULIER_JUSTIFS } from "@/lib/referentiel";
import {
  activeEligibility, eligibilityLabel, eligibilityTone, fmtDate, isValidSiret, lookupSiret, myEligibilities, pendingEligibility,
  submitEligibility, useDB,
} from "@/lib/store";

export const Route = createFileRoute("/eligibilite")({
  head: () => ({ meta: [{ title: "Critères d'éligibilité — Reboot Solidaire" }, { name: "description", content: "Qui peut recevoir un ordinateur reconditionné ? Critères, justificatifs à fournir et test d'éligibilité pour les particuliers et les organisations." }, { property: "og:title", content: "Critères d'éligibilité" }, { property: "og:description", content: "Qui peut recevoir un équipement reconditionné." }] }),
  component: Eligibilite,
});

const MAX_SIZE = 5 * 1024 * 1024;
const ACCEPT = "application/pdf,image/jpeg,image/png";
const months = (n: number) => (n % 12 === 0 ? `${n / 12} an${n > 12 ? "s" : ""}` : `${n} mois`);

function Eligibilite() {
  return (
    <Page title="Critères d'éligibilité" intro="Des règles simples pour que le matériel aille à ceux qui en ont le plus besoin.">
      <div className="grid md:grid-cols-2 gap-6">
        <article className="card-soft p-8">
          <h2 className="text-2xl font-bold text-primary">Particuliers</h2>
          <p className="mt-2 text-sm text-muted-foreground">Vous êtes éligible si vous êtes dans l'une de ces situations, avec le justificatif correspondant :</p>
          <ul className="mt-4 space-y-3">
            {PARTICULIER_JUSTIFS.map(([k, j]) => (
              <li key={k} className="flex gap-2"><span className="text-success font-bold">✓</span>
                <span><b>{j.label}</b><br /><span className="text-sm text-muted-foreground">{j.doc} · éligibilité de {months(j.months)}</span></span>
              </li>
            ))}
          </ul>
        </article>
        <article className="card-soft p-8">
          <h2 className="text-2xl font-bold text-primary">Organisations</h2>
          <p className="mt-2 text-sm text-muted-foreground">Associations, écoles, structures de l'ESS ou collectivités qui accompagnent des publics éloignés du numérique.</p>
          <ul className="mt-4 space-y-3">
            {[
              ["Un numéro SIRET valide et actif", "Vérifié automatiquement dans l'annuaire officiel des entreprises"],
              ["Un projet d'inclusion numérique", "Pourquoi vous avez besoin de matériel et dans quel cadre il sera utilisé"],
              ["Le nombre de personnes accompagnées", "C'est ce critère qui détermine la quantité de matériel attribuée"],
              ["Un justificatif", "Statuts, récépissé de déclaration ou attestation d'immatriculation"],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-2"><span className="text-success font-bold">✓</span><span><b>{t}</b><br /><span className="text-sm text-muted-foreground">{d}</span></span></li>
            ))}
          </ul>
          <p className="mt-4 text-sm">Éligibilité de <b>{months(JUSTIFS.organisation.months)}</b> une fois le dossier validé.</p>
        </article>
      </div>

      <div className="card-soft p-8 mt-8">
        <h2 className="text-xl font-bold">Vos données restent confidentielles</h2>
        <p className="mt-2 text-muted-foreground">Vos justificatifs ne sont vus que par le gestionnaire de l'association, jamais par les donateurs. À la fin de la période d'éligibilité, il suffit de refaire une demande.</p>
      </div>

      <section id="test" className="mt-12 scroll-mt-24" aria-labelledby="test-title">
        <h2 id="test-title" className="text-3xl font-bold text-primary">Test d'éligibilité</h2>
        <p className="mt-2 text-muted-foreground max-w-2xl">Remplissez le formulaire correspondant à votre compte. Un gestionnaire vérifie votre dossier et vous autorise à faire des demandes pendant une durée qui dépend de votre justificatif.</p>
        <div className="mt-6">
          <RequireLogin roles={["utilisateur"]} message="Connectez-vous ou créez un compte pour faire votre test d'éligibilité.">
            <EligibilityArea />
          </RequireLogin>
        </div>
      </section>
    </Page>
  );
}

function EligibilityArea() {
  const { db } = useDB();
  const [sent, setSent] = useState<number | null>(null);
  const active = activeEligibility(db);
  const pending = pendingEligibility(db);
  const last = myEligibilities(db)[0];

  if (sent !== null)
    return (
      <div className="card-soft p-8 max-w-2xl space-y-3">
        <p className="text-success font-bold">✓ Votre demande d'éligibilité a bien été envoyée.</p>
        <p>Un gestionnaire va examiner votre dossier. Si elle est validée, votre éligibilité sera valable <b>{months(sent)}</b> : vous pourrez faire des demandes de matériel pendant cette période.</p>
        <p className="text-sm text-muted-foreground">Vous recevrez la décision par message sur le site ; elle reste consultable dans votre profil.</p>
        <Link to="/profil" className="btn btn-primary !py-2">Voir mon profil</Link>
      </div>
    );
  if (active)
    return (
      <div className="card-soft p-8 max-w-2xl space-y-3">
        <p><Badge tone="success">Éligible</Badge></p>
        <p>Votre éligibilité est valable jusqu'au <b>{fmtDate(active.validUntil!)}</b>.</p>
        <Link to="/demande" className="btn btn-accent !py-2">Faire une demande de matériel</Link>
      </div>
    );
  if (pending)
    return (
      <div className="card-soft p-8 max-w-2xl space-y-2">
        <p><Badge tone="warning">En cours d'examen</Badge></p>
        <p>Votre dossier envoyé le {fmtDate(pending.createdAt)} est en cours d'examen. Vous serez prévenu dès qu'une décision sera prise.</p>
      </div>
    );
  return (
    <>
      {last && (
        <p className="mb-4 text-sm"><Badge tone={eligibilityTone(last)}>{eligibilityLabel(last)}</Badge> <span className="ml-2">{last.status === "refusee" ? `Votre précédente demande a été refusée : ${last.decisionMessage}` : "Votre précédente éligibilité a expiré, vous pouvez en refaire une."}</span></p>
      )}
      {db.user?.profile === "Organisation" ? <OrganisationForm onSent={setSent} /> : <ParticulierForm onSent={setSent} />}
    </>
  );
}

function FileField({ label, required, file, onFile, hint }: { label: string; required?: boolean; file: File | null; onFile: (f: File | null) => void; hint?: string }) {
  const [err, setErr] = useState<string | null>(null);
  return (
    <label className="block">
      <FieldLabel required={required}>{label}</FieldLabel>
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      <input required={required} type="file" accept={ACCEPT} className="field mt-1" onChange={(e) => {
        const f = e.target.files?.[0] ?? null;
        if (f && f.size > MAX_SIZE) { setErr("Fichier trop lourd (5 Mo maximum)."); e.target.value = ""; return onFile(null); }
        setErr(null); onFile(f);
      }} />
      <span className="text-xs text-muted-foreground">{file ? `${file.name} (${Math.round(file.size / 1024)} Ko)` : "PDF, JPG ou PNG, 5 Mo maximum"}</span>
      {err && <span className="block text-xs text-destructive font-semibold">{err}</span>}
    </label>
  );
}

function Consent({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex gap-2 items-start text-sm">
      <input required type="checkbox" className="mt-1" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>J'accepte que mes justificatifs soient consultés par le gestionnaire de Reboot Solidaire pour vérifier mon éligibilité. Ils ne sont jamais transmis aux donateurs.<span className="text-destructive" aria-hidden="true">*</span></span>
    </label>
  );
}

function ParticulierForm({ onSent }: { onSent: (months: number) => void }) {
  const { db } = useDB();
  const [justif, setJustif] = useState("");
  const [doc, setDoc] = useState<File | null>(null);
  const [extra, setExtra] = useState<File | null>(null);
  const [details, setDetails] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const j = JUSTIFS[justif];
  return (
    <form className="card-soft p-8 max-w-2xl grid gap-5" onSubmit={async (e) => {
      e.preventDefault();
      if (!j || !doc) return setErr("Choisissez votre situation et joignez le justificatif.");
      setBusy(true);
      const ok = await submitEligibility(db, { justifType: justif, siretVerified: false, project: details.trim() }, [doc, ...(extra ? [extra] : [])]);
      setBusy(false);
      if (ok) onSent(j.months);
    }}>
      <div className="flex flex-wrap justify-between gap-2 items-center">
        <h3 className="text-xl font-bold">Formulaire particulier</h3>
        <Badge tone="info">Compte particulier</Badge>
      </div>
      <RequiredLegend />
      <fieldset>
        <legend className="mb-2"><FieldLabel required>Votre situation</FieldLabel></legend>
        <div className="grid gap-2">
          {PARTICULIER_JUSTIFS.map(([k, v]) => (
            <label key={k} className={`flex gap-3 items-start p-3 rounded-xl border-2 cursor-pointer ${justif === k ? "border-primary bg-secondary" : ""}`}>
              <input type="radio" name="justif" className="mt-1" checked={justif === k} onChange={() => setJustif(k)} />
              <span><b>{v.label}</b><br /><span className="text-sm text-muted-foreground">Justificatif : {v.doc}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      {j && <FileField label={`Justificatif : ${j.doc}`} required file={doc} onFile={setDoc} />}
      <FileField label="Pièce complémentaire" file={extra} onFile={setExtra} hint="Par exemple un certificat de scolarité ou une pièce d'identité si le justificatif ne mentionne pas votre nom." />
      <label><FieldLabel>Précisions</FieldLabel><textarea rows={2} className="field mt-1" value={details} onChange={(e) => setDetails(e.target.value)} /></label>
      {j && <p className="rounded-lg bg-secondary p-3 text-sm">Si votre dossier est validé, vous serez éligible pendant <b>{months(j.months)}</b>.</p>}
      <Consent checked={consent} onChange={setConsent} />
      <ErrorMsg msg={err} />
      <button className="btn btn-accent" disabled={busy}>{busy ? "Envoi…" : "Envoyer ma demande d'éligibilité"}</button>
    </form>
  );
}

function OrganisationForm({ onSent }: { onSent: (months: number) => void }) {
  const { db } = useDB();
  const [f, setF] = useState({ orgType: "", orgName: db.user?.name ?? "", siret: "", project: "", participants: "" });
  const [doc, setDoc] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [check, setCheck] = useState<{ state: "idle" | "checking" | "ok" | "ko" | "unknown"; msg?: string }>({ state: "idle" });
  const siret = f.siret.replace(/\s/g, "");

  const verify = async (): Promise<boolean | null> => {
    if (!isValidSiret(siret)) { setCheck({ state: "ko", msg: "Numéro SIRET invalide (14 chiffres, clé de contrôle incorrecte)." }); return false; }
    setCheck({ state: "checking" });
    const r = await lookupSiret(siret);
    if (!r) { setCheck({ state: "unknown", msg: "Vérification automatique indisponible : le gestionnaire contrôlera le numéro." }); return null; }
    if (!r.found) { setCheck({ state: "ko", msg: "Ce SIRET est introuvable dans l'annuaire des entreprises." }); return false; }
    if (!r.active) { setCheck({ state: "ko", msg: `${r.name} : cet établissement est fermé.` }); return false; }
    setCheck({ state: "ok", msg: `Établissement trouvé : ${r.name}` });
    return true;
  };

  return (
    <form className="card-soft p-8 max-w-2xl grid gap-5" onSubmit={async (e) => {
      e.preventDefault();
      if (!doc) return setErr("Joignez un justificatif.");
      const participants = Number(f.participants);
      if (!Number.isInteger(participants) || participants < 1) return setErr("Indiquez le nombre de participants attendus.");
      if (f.project.trim().length < 30) return setErr("Décrivez votre projet en quelques phrases (30 caractères minimum).");
      const verified = check.state === "ok" ? true : await verify();
      if (verified === false) return setErr("Le numéro SIRET n'a pas pu être validé.");
      setBusy(true);
      const ok = await submitEligibility(db, {
        justifType: "organisation", orgType: f.orgType, orgName: f.orgName.trim(), siret, siretVerified: verified === true,
        project: f.project.trim(), participants,
      }, [doc]);
      setBusy(false);
      if (ok) onSent(JUSTIFS.organisation.months);
    }}>
      <div className="flex flex-wrap justify-between gap-2 items-center">
        <h3 className="text-xl font-bold">Formulaire organisation</h3>
        <Badge tone="info">Compte organisation</Badge>
      </div>
      <RequiredLegend />
      <div className="grid sm:grid-cols-2 gap-4">
        <label><FieldLabel required>Type d'organisation</FieldLabel>
          <select required className="field mt-1" value={f.orgType} onChange={(e) => setF({ ...f, orgType: e.target.value })}>
            <option value="">Choisir…</option>
            {ORG_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label><FieldLabel required>Nom de l'organisation</FieldLabel><input required className="field mt-1" value={f.orgName} onChange={(e) => setF({ ...f, orgName: e.target.value })} /></label>
      </div>
      <div>
        <label className="block"><FieldLabel required>Numéro SIRET</FieldLabel>
          <div className="flex gap-2 mt-1">
            <input required inputMode="numeric" maxLength={17} className="field font-mono" placeholder="14 chiffres" value={f.siret}
              onChange={(e) => { setF({ ...f, siret: e.target.value.replace(/[^\d\s]/g, "") }); setCheck({ state: "idle" }); }} />
            <button type="button" className="btn btn-ghost !py-2 shrink-0" onClick={verify} disabled={check.state === "checking"}>{check.state === "checking" ? "Vérification…" : "Vérifier"}</button>
          </div>
        </label>
        {check.msg && <p role="status" className={`text-sm mt-1 ${check.state === "ok" ? "text-success font-semibold" : check.state === "ko" ? "text-destructive font-semibold" : "text-muted-foreground"}`}>{check.state === "ok" ? "✓ " : ""}{check.msg}</p>}
      </div>
      <FileField label="Justificatif" required file={doc} onFile={setDoc} hint={JUSTIFS.organisation.doc} />
      <label><FieldLabel required>Description du projet</FieldLabel>
        <span className="block text-xs text-muted-foreground">Pourquoi cette demande ? Dans quel cadre le matériel sera-t-il utilisé ?</span>
        <textarea required minLength={30} rows={4} className="field mt-1" value={f.project} onChange={(e) => setF({ ...f, project: e.target.value })} />
      </label>
      <label className="max-w-xs"><FieldLabel required>Public visé : nombre de participants attendus</FieldLabel>
        <input required type="number" min={1} max={100000} className="field mt-1" value={f.participants} onChange={(e) => setF({ ...f, participants: e.target.value })} />
      </label>
      <p className="rounded-lg bg-secondary p-3 text-sm">Si votre dossier est validé, votre organisation sera éligible pendant <b>{months(JUSTIFS.organisation.months)}</b>. Le nombre d'appareils attribués tient compte du public accompagné.</p>
      <Consent checked={consent} onChange={setConsent} />
      <ErrorMsg msg={err} />
      <button className="btn btn-accent" disabled={busy}>{busy ? "Envoi…" : "Envoyer la demande d'éligibilité"}</button>
    </form>
  );
}
