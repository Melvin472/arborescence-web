import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ErrorMsg, FieldLabel, Page, RequiredLegend } from "@/components/Layout";
import { CONTACT_SUBJECTS } from "@/lib/referentiel";
import { isValidEmail, sendContact, useDB } from "@/lib/store";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Nous contacter — Reboot Solidaire" }, { name: "description", content: "Une question sur un don, une demande de matériel ou votre éligibilité ? Contactez l'équipe Reboot Solidaire." }, { property: "og:title", content: "Nous contacter" }, { property: "og:description", content: "Écrivez à l'équipe Reboot Solidaire." }] }),
  component: Contact,
});

function Contact() {
  const { db } = useDB();
  const [f, setF] = useState({ email: "", subject: "", message: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  // Adresse pré-remplie quand la personne est connectée.
  useEffect(() => { if (db.user?.email) setF((p) => (p.email ? p : { ...p, email: db.user!.email })); }, [db.user?.email]);

  return (
    <Page title="Nous contacter" intro="Un souci avec un don ou une demande, une question sur l'éligibilité, une demande spécifique ? Écrivez-nous : nous vous répondons par e-mail.">
      {sent ? (
        <div className="card-soft p-8 max-w-xl space-y-2">
          <p className="text-success font-bold">✓ Message envoyé</p>
          <p>Merci ! L'équipe vous répondra à l'adresse <b>{f.email}</b>.</p>
        </div>
      ) : (
        <form className="card-soft p-8 max-w-xl grid gap-5" onSubmit={async (e) => {
          e.preventDefault();
          if (!isValidEmail(f.email)) return setErr("Adresse e-mail invalide.");
          setBusy(true);
          const ok = await sendContact(f);
          setBusy(false);
          if (ok) setSent(true);
        }}>
          <RequiredLegend />
          <label><FieldLabel required>Votre e-mail</FieldLabel><input required type="email" autoComplete="email" className="field mt-1" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
          <label><FieldLabel required>Sujet</FieldLabel>
            <select required className="field mt-1" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })}>
              <option value="">Choisir…</option>
              {CONTACT_SUBJECTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label><FieldLabel required>Message</FieldLabel>
            <textarea required maxLength={5000} rows={6} className="field mt-1" placeholder="Indiquez si possible votre numéro de suivi (DON-… ou DEM-…)." value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
          </label>
          <ErrorMsg msg={err} />
          <button className="btn btn-accent" disabled={busy}>{busy ? "Envoi…" : "Envoyer"}</button>
        </form>
      )}
    </Page>
  );
}
