import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ErrorMsg, FieldLabel, Page, PasswordField, RequiredLegend } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { PROFILES, type Profile } from "@/lib/referentiel";
import { isStrongPassword, isValidEmail, reload } from "@/lib/store";

type Mode = "connexion" | "inscription" | "oubli";
type Search = { mode?: "inscription" | "oubli"; verifie?: number };

export const Route = createFileRoute("/connexion")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    mode: s.mode === "inscription" || s.mode === "oubli" ? s.mode : undefined,
    verifie: s.verifie ? 1 : undefined,
  }),
  head: () => ({ meta: [{ title: "Se connecter — Reboot Solidaire" }, { name: "description", content: "Connectez-vous ou créez votre compte pour donner ou demander du matériel informatique reconditionné." }, { property: "og:title", content: "Se connecter" }, { property: "og:description", content: "Accédez à votre espace Reboot Solidaire." }] }),
  component: Login,
});

const titles: Record<Mode, string> = { connexion: "Se connecter", inscription: "Créer un compte", oubli: "Mot de passe oublié" };

function Login() {
  const search = Route.useSearch();
  const [mode, setMode] = useState<Mode>(search.mode ?? "connexion");
  const [verified, setVerified] = useState(false);

  // Après le clic sur le lien de vérification, Supabase ouvre une session :
  // on la ferme pour que la personne se connecte elle-même avec son mot de passe.
  useEffect(() => {
    if (!search.verifie) return;
    (async () => {
      await supabase.auth.getSession();
      await supabase.auth.signOut();
      await reload();
      setVerified(true);
      setMode("connexion");
    })();
  }, [search.verifie]);

  return (
    <Page title={titles[mode]} intro="Un seul compte pour donner du matériel et faire des demandes.">
      <div className="max-w-xl">
        {verified && <p role="status" className="rounded-lg bg-success/15 text-foreground font-semibold p-3 mb-6">✓ Votre adresse e-mail est vérifiée. Vous pouvez maintenant vous connecter.</p>}
        {mode !== "oubli" && (
          <div className="flex gap-2 mb-6" role="tablist">
            {([["connexion", "J'ai déjà un compte"], ["inscription", "Créer un compte"]] as const).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={`btn !py-2 ${mode === k ? "btn-primary" : "btn-ghost"}`}>{l}</button>
            ))}
          </div>
        )}
        {mode === "connexion" && <LoginForm onForgot={() => setMode("oubli")} />}
        {mode === "inscription" && <SignupForm />}
        {mode === "oubli" && <ForgotForm onBack={() => setMode("connexion")} />}
      </div>
    </Page>
  );
}

function LoginForm({ onForgot }: { onForgot: () => void }) {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form className="card-soft p-8 space-y-5" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: pw });
      if (error) {
        setBusy(false);
        return setErr(/confirm/i.test(error.message) ? "Cette adresse e-mail n'a pas encore été vérifiée. Cliquez sur le lien reçu par e-mail." : "E-mail ou mot de passe incorrect.");
      }
      const d = await reload();
      setBusy(false);
      if (d.user?.role === "admin") nav({ to: "/catalogue", search: { onglet: "demandes" } });
      else nav({ to: "/suivi" });
    }}>
      <RequiredLegend />
      <label className="block"><FieldLabel required>E-mail</FieldLabel><input required type="email" autoComplete="email" className="field mt-1" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" /></label>
      <div>
        <PasswordField label="Mot de passe" value={pw} onChange={setPw} autoComplete="current-password" />
        <button type="button" className="mt-2 text-sm underline" onClick={onForgot}>Mot de passe oublié ?</button>
      </div>
      <ErrorMsg msg={err} />
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Connexion…" : "Se connecter"}</button>
    </form>
  );
}

function SignupForm() {
  const [f, setF] = useState({ email: "", name: "", password: "", confirm: "", profile: "" as Profile | "", admin: false });
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (sent)
    return (
      <div className="card-soft p-8 space-y-4">
        <h2 className="text-2xl font-bold text-primary">Vérifiez votre adresse e-mail</h2>
        <p>Un lien de confirmation a été envoyé à <b>{sent}</b>. Cliquez dessus pour activer votre compte : vous serez renvoyé vers la page de connexion.</p>
        <p className="text-sm text-muted-foreground">Pensez à regarder dans vos courriers indésirables.</p>
      </div>
    );

  return (
    <form className="card-soft p-8 space-y-5" onSubmit={async (e) => {
      e.preventDefault();
      const email = f.email.trim().toLowerCase();
      if (!f.admin && !f.profile) return setErr("Indiquez si vous êtes un particulier ou une organisation.");
      if (!isValidEmail(email)) return setErr("Adresse e-mail invalide.");
      if (!isStrongPassword(f.password)) return setErr("Le mot de passe ne respecte pas tous les critères.");
      if (f.password !== f.confirm) return setErr("Les mots de passe ne correspondent pas.");
      setErr(null); setBusy(true);
      const { error } = await supabase.auth.signUp({
        email, password: f.password,
        options: {
          emailRedirectTo: `${window.location.origin}/connexion?verifie=1`,
          data: { name: f.name.trim(), role: f.admin ? "admin" : "donateur", profile: f.admin ? null : f.profile },
        },
      });
      setBusy(false);
      if (error) {
        if (/already/i.test(error.message)) return setErr("Un compte existe déjà avec cette adresse.");
        if (f.admin && /database/i.test(error.message)) return setErr("Un compte gestionnaire existe déjà. Contactez l'équipe.");
        return setErr(`Inscription impossible : ${error.message}`);
      }
      setSent(email);
    }}>
      <RequiredLegend />
      {!f.admin && (
        <fieldset><legend className="mb-2"><FieldLabel required>Vous êtes</FieldLabel></legend>
          <div className="grid sm:grid-cols-2 gap-2">
            {PROFILES.map((p) => (
              <label key={p} className={`flex gap-3 items-center p-3 rounded-xl border-2 cursor-pointer ${f.profile === p ? "border-primary bg-secondary" : ""}`}>
                <input type="radio" name="profile" checked={f.profile === p} onChange={() => setF({ ...f, profile: p })} />
                <span><b>{p}</b><br /><span className="text-sm text-muted-foreground">{p === "Particulier" ? "Une personne, pour soi ou son foyer" : "Association, école, structure de l'ESS…"}</span></span>
              </label>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-2">Avec ce compte, vous pourrez à la fois donner du matériel et en demander.</p>
        </fieldset>
      )}
      <label className="block"><FieldLabel required>{f.profile === "Organisation" ? "Nom de l'organisation" : "Nom et prénom"}</FieldLabel><input required className="field mt-1" autoComplete={f.profile === "Organisation" ? "organization" : "name"} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label className="block"><FieldLabel required>E-mail</FieldLabel><input required type="email" autoComplete="email" className="field mt-1" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="vous@exemple.fr" /></label>
      <PasswordField label="Mot de passe" value={f.password} onChange={(v) => setF({ ...f, password: v })} autoComplete="new-password" showRules />
      <PasswordField label="Confirmation du mot de passe" value={f.confirm} onChange={(v) => setF({ ...f, confirm: v })} autoComplete="new-password" />
      {f.confirm && f.confirm !== f.password && <p className="text-sm text-destructive">Les deux mots de passe sont différents.</p>}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Vous faites partie de l'équipe Reboot Solidaire ?</summary>
        <label className="flex gap-2 items-center mt-2"><input type="checkbox" checked={f.admin} onChange={(e) => setF({ ...f, admin: e.target.checked })} /> Créer le compte gestionnaire (un seul compte possible)</label>
      </details>
      <ErrorMsg msg={err} />
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Envoi…" : "Créer mon compte"}</button>
    </form>
  );
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (sent)
    return (
      <div className="card-soft p-8 space-y-4">
        <p>Si un compte existe pour <b>{email}</b>, un e-mail contenant un lien de réinitialisation vient d'être envoyé.</p>
        <button className="btn btn-ghost" onClick={onBack}>Retour à la connexion</button>
      </div>
    );
  return (
    <form className="card-soft p-8 space-y-5" onSubmit={async (e) => {
      e.preventDefault();
      if (!isValidEmail(email)) return setErr("Adresse e-mail invalide.");
      setBusy(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/reinitialiser` });
      setBusy(false);
      if (error) return setErr(`Envoi impossible : ${error.message}`);
      setSent(true);
    }}>
      <p>Saisissez l'adresse e-mail de votre compte : nous vous enverrons un lien pour choisir un nouveau mot de passe.</p>
      <label className="block"><FieldLabel required>E-mail</FieldLabel><input required type="email" autoComplete="email" className="field mt-1" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <ErrorMsg msg={err} />
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" disabled={busy}>{busy ? "Envoi…" : "Envoyer le lien"}</button>
        <button type="button" className="btn btn-ghost" onClick={onBack}>Retour</button>
      </div>
    </form>
  );
}
