import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Badge, ErrorMsg, FieldLabel, Page, PasswordField, RequireLogin, StarInput, Stars } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { JUSTIFS } from "@/lib/referentiel";
import {
  activeEligibility, eligibilityLabel, eligibilityTone, fmtDate, isActiveRequest, isStrongPassword, isValidEmail,
  markNotificationRead, myEligibilities, roleLabel, submitFeedback, useDB,
} from "@/lib/store";

export const Route = createFileRoute("/profil")({
  head: () => ({ meta: [{ title: "Mon profil — Reboot Solidaire" }, { name: "robots", content: "noindex" }] }),
  component: Profil,
});

function Profil() {
  return (
    <Page title="Mon profil">
      <RequireLogin><ProfilContent /></RequireLogin>
    </Page>
  );
}

function ProfilContent() {
  const { db } = useDB();
  const u = db.user!;
  const member = u.role !== "admin";
  const myReqs = db.requests.filter((r) => r.owner === u.email);
  const myDons = db.devices.filter((d) => d.owner === u.email);
  const elig = myEligibilities(db)[0];
  const active = activeEligibility(db);

  return (
    <div className="grid lg:grid-cols-3 gap-6 items-start">
      <div className="grid gap-6 lg:col-span-2">
        <section className="card-soft p-6">
          <h2 className="text-2xl font-bold text-primary">Mon compte</h2>
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mt-4 text-sm">
            <div><dt className="font-semibold">Nom</dt><dd>{u.name || "—"}</dd></div>
            <div><dt className="font-semibold">E-mail</dt><dd>{u.email}</dd></div>
            <div><dt className="font-semibold">Type de compte</dt><dd>{member ? u.profile ?? "Particulier" : roleLabel.admin}</dd></div>
          </dl>
          {member && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              {([["Demandes faites", myReqs.length], ["Demandes en cours", myReqs.filter(isActiveRequest).length], ["Dons faits", myDons.length], ["Dons distribués", myDons.filter((d) => d.status === "demande").length]] as const).map(([l, n]) => (
                <div key={l} className="rounded-xl bg-secondary p-4">
                  <div className="font-display text-3xl font-bold text-accent">{n}</div>
                  <div className="text-xs font-semibold mt-1">{l}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {member && (
          <section className="card-soft p-6">
            <h2 className="text-xl font-bold text-primary">Mon éligibilité</h2>
            {elig ? (
              <div className="mt-3 space-y-2 text-sm">
                <p><Badge tone={eligibilityTone(elig)}>{eligibilityLabel(elig)}</Badge> <span className="ml-2">{JUSTIFS[elig.justifType]?.label ?? elig.justifType}</span></p>
                {active?.validUntil && <p>Valable jusqu'au <b>{fmtDate(active.validUntil)}</b>. Vous pouvez faire des demandes de matériel.</p>}
                {elig.status === "en_attente" && <p>Votre dossier est en cours d'examen par un gestionnaire.</p>}
                {elig.status === "refusee" && <p className="text-destructive">Motif : {elig.decisionMessage}</p>}
                {!active && elig.status !== "en_attente" && <Link to="/eligibilite" hash="test" className="btn btn-primary !py-2 mt-2">Refaire une demande d'éligibilité</Link>}
              </div>
            ) : (
              <div className="mt-3 text-sm">
                <p>Vous n'avez pas encore fait de demande d'éligibilité. Elle est nécessaire pour demander du matériel.</p>
                <Link to="/eligibilite" hash="test" className="btn btn-primary !py-2 mt-3">Faire un test d'éligibilité</Link>
              </div>
            )}
          </section>
        )}

        <Messages />
        {member && <FeedbackForm />}
      </div>

      <div className="grid gap-6">
        <EmailForm />
        <PasswordForm />
      </div>
    </div>
  );
}

function Messages() {
  const { db } = useDB();
  return (
    <section className="card-soft p-6">
      <h2 className="text-xl font-bold text-primary">Mes messages</h2>
      {db.notifications.length ? (
        <ul className="mt-3 grid gap-3">
          {db.notifications.map((n) => (
            <li key={n.id} className={`rounded-xl border p-4 ${n.read ? "" : "border-accent bg-accent/5"}`}>
              <div className="flex flex-wrap justify-between gap-2"><b>{n.title}</b><span className="text-xs text-muted-foreground">{fmtDate(n.createdAt)}</span></div>
              <p className="text-sm mt-1 whitespace-pre-line">{n.body}</p>
              {!n.read && <button className="text-sm underline mt-2" onClick={() => markNotificationRead(n.id)}>Marquer comme lu</button>}
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted-foreground mt-2">Aucun message pour le moment.</p>}
    </section>
  );
}

function EmailForm() {
  const { db } = useDB();
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  return (
    <form className="card-soft p-6 space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      const v = email.trim().toLowerCase();
      if (!isValidEmail(v)) return setErr("Adresse e-mail invalide.");
      if (v === db.user?.email) return setErr("C'est déjà votre adresse actuelle.");
      const { error } = await supabase.auth.updateUser({ email: v }, { emailRedirectTo: `${window.location.origin}/profil` });
      if (error) return setErr(`Modification impossible : ${error.message}`);
      setErr(null); setSent(true);
    }}>
      <h2 className="text-xl font-bold text-primary">Changer d'adresse e-mail</h2>
      {sent ? (
        <p className="text-sm">Un lien de confirmation a été envoyé. Le changement sera effectif après avoir cliqué sur le lien (selon la configuration, un lien est aussi envoyé à votre ancienne adresse).</p>
      ) : (
        <>
          <label className="block"><FieldLabel required>Nouvelle adresse</FieldLabel><input required type="email" autoComplete="email" className="field mt-1" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <ErrorMsg msg={err} />
          <button className="btn btn-primary !py-2 w-full">Modifier l'e-mail</button>
        </>
      )}
    </form>
  );
}

function PasswordForm() {
  const { db } = useDB();
  const [f, setF] = useState({ current: "", pw: "", confirm: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form className="card-soft p-6 space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      if (!isStrongPassword(f.pw)) return setErr("Le nouveau mot de passe ne respecte pas tous les critères.");
      if (f.pw !== f.confirm) return setErr("Les mots de passe ne correspondent pas.");
      setBusy(true);
      const check = await supabase.auth.signInWithPassword({ email: db.user!.email, password: f.current });
      if (check.error) { setBusy(false); return setErr("Mot de passe actuel incorrect."); }
      const { error } = await supabase.auth.updateUser({ password: f.pw });
      setBusy(false);
      if (error) return setErr(`Modification impossible : ${error.message}`);
      setErr(null); setF({ current: "", pw: "", confirm: "" });
      toast.success("Mot de passe modifié.");
    }}>
      <h2 className="text-xl font-bold text-primary">Changer de mot de passe</h2>
      <PasswordField label="Mot de passe actuel" value={f.current} onChange={(v) => setF({ ...f, current: v })} autoComplete="current-password" />
      <PasswordField label="Nouveau mot de passe" value={f.pw} onChange={(v) => setF({ ...f, pw: v })} autoComplete="new-password" showRules />
      <PasswordField label="Confirmation" value={f.confirm} onChange={(v) => setF({ ...f, confirm: v })} autoComplete="new-password" />
      <ErrorMsg msg={err} />
      <button className="btn btn-primary !py-2 w-full" disabled={busy}>{busy ? "Enregistrement…" : "Modifier le mot de passe"}</button>
    </form>
  );
}

function FeedbackForm() {
  const { db } = useDB();
  const mine = db.feedback.filter((f) => f.userId === db.user?.id);
  const [author, setAuthor] = useState((db.user?.name ?? "").split(" ")[0] ?? "");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  return (
    <section className="card-soft p-6">
      <h2 className="text-xl font-bold text-primary">Laisser un avis</h2>
      <p className="text-sm text-muted-foreground mt-1">Votre retour peut être publié sur la page d'accueil après relecture par l'équipe.</p>
      <form className="grid gap-3 mt-4" onSubmit={async (e) => {
        e.preventDefault();
        if (!rating) return setErr("Choisissez une note de 1 à 5 étoiles.");
        setErr(null);
        if (await submitFeedback(author, message, rating)) { setMessage(""); setRating(0); }
      }}>
        <div><FieldLabel required>Votre note</FieldLabel><div className="mt-1"><StarInput value={rating} onChange={setRating} /></div></div>
        <label><FieldLabel required>Nom affiché</FieldLabel><input required maxLength={60} className="field mt-1" placeholder="ex. Camille, ou le nom de votre association" value={author} onChange={(e) => setAuthor(e.target.value)} /></label>
        <label><FieldLabel required>Votre avis</FieldLabel><textarea required minLength={10} maxLength={500} rows={3} className="field mt-1" value={message} onChange={(e) => setMessage(e.target.value)} /></label>
        <ErrorMsg msg={err} />
        <button className="btn btn-accent !py-2 justify-self-start">Envoyer mon avis</button>
      </form>
      {mine.length > 0 && (
        <ul className="mt-4 grid gap-2 text-sm">
          {mine.map((f) => <li key={f.id} className="rounded-lg bg-muted p-3"><Badge tone={f.approved ? "success" : "warning"}>{f.approved ? "Publié" : "En relecture"}</Badge> <span className="ml-2 inline-flex align-middle"><Stars value={f.rating} size={14} /></span> <span className="ml-1">« {f.message} »</span></li>)}
        </ul>
      )}
    </section>
  );
}
