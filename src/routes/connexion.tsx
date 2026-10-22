import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { FieldLabel, Page, RequiredLegend } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { PROFILES, type Profile } from "@/lib/referentiel";
import { isValidEmail, reload, type Role } from "@/lib/store";

export const Route = createFileRoute("/connexion")({
  head: () => ({ meta: [{ title: "Se connecter — Reboot Solidaire" }, { name: "description", content: "Accédez à votre espace donateur, bénéficiaire ou gestionnaire." }, { property: "og:title", content: "Se connecter" }, { property: "og:description", content: "Accédez à votre espace Reboot Solidaire." }] }),
  component: Login,
});

const roles: [Role, string, string][] = [
  ["donateur", "Donateur", "Particulier, entreprise ou organisme"],
  ["beneficiaire", "Bénéficiaire", "École, association ou particulier"],
  ["admin", "Gestionnaire", "Équipe Reboot Solidaire (un seul compte possible)"],
];

const home = (r: Role) => (r === "admin" ? "/catalogue" : r === "donateur" ? "/don" : "/demande");

function Login() {
  const [tab, setTab] = useState<"login" | "signup">("login");
  return (
    <Page title={tab === "login" ? "Se connecter" : "Créer un compte"} intro="Accédez à votre espace donateur, bénéficiaire ou gestionnaire.">
      <div className="max-w-xl">
        <div className="flex gap-2 mb-6" role="tablist">
          {([["login", "J'ai déjà un compte"], ["signup", "Créer un compte"]] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`btn !py-2 ${tab === k ? "btn-primary" : "btn-ghost"}`}>{l}</button>
          ))}
        </div>
        {tab === "login" ? <LoginForm /> : <SignupForm />}
      </div>
    </Page>
  );
}

function ErrorMsg({ msg }: { msg: string | null }) {
  return msg ? <p role="alert" className="rounded-lg bg-destructive/10 text-destructive font-semibold p-3 text-sm">{msg}</p> : null;
}

function LoginForm() {
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
      nav({ to: home(d.user?.role ?? "donateur") });
    }}>
      <RequiredLegend />
      <label className="block"><FieldLabel required>E-mail</FieldLabel><input required type="email" autoComplete="email" className="field mt-1" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" /></label>
      <label className="block"><FieldLabel required>Mot de passe</FieldLabel><input required type="password" autoComplete="current-password" className="field mt-1" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
      <ErrorMsg msg={err} />
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Connexion…" : "Se connecter"}</button>
    </form>
  );
}

function SignupForm() {
  const [f, setF] = useState({ email: "", name: "", password: "", confirm: "", role: "donateur" as Role, profile: "" as Profile | "" });
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (sent)
    return (
      <div className="card-soft p-8 space-y-4">
        <h2 className="text-2xl font-bold text-primary">Vérifiez votre adresse e-mail</h2>
        <p>Un lien de confirmation a été envoyé à <b>{sent}</b>. Cliquez dessus pour activer votre compte, puis connectez-vous.</p>
        <p className="text-sm text-muted-foreground">Pensez à regarder dans vos courriers indésirables.</p>
      </div>
    );

  return (
    <form className="card-soft p-8 space-y-5" onSubmit={async (e) => {
      e.preventDefault();
      const email = f.email.trim().toLowerCase();
      if (!isValidEmail(email)) return setErr("Adresse e-mail invalide.");
      if (f.password.length < 8) return setErr("Le mot de passe doit contenir au moins 8 caractères.");
      if (f.password !== f.confirm) return setErr("Les mots de passe ne correspondent pas.");
      if (f.role === "beneficiaire" && !f.profile) return setErr("Précisez si vous êtes un particulier, une association ou une école.");
      setErr(null); setBusy(true);
      const { error } = await supabase.auth.signUp({
        email, password: f.password,
        options: {
          emailRedirectTo: `${window.location.origin}/connexion`,
          data: { name: f.name.trim(), role: f.role, profile: f.role === "beneficiaire" ? f.profile : null },
        },
      });
      setBusy(false);
      if (error) {
        if (/already/i.test(error.message)) return setErr("Un compte existe déjà avec cette adresse.");
        if (f.role === "admin" && /database/i.test(error.message)) return setErr("Un compte gestionnaire existe déjà. Contactez l'équipe.");
        return setErr(`Inscription impossible : ${error.message}`);
      }
      setSent(email);
    }}>
      <RequiredLegend />
      <fieldset><legend className="mb-2"><FieldLabel required>Je suis</FieldLabel></legend>
        <div className="grid gap-2">{roles.map(([r, l, d]) => (
          <label key={r} className={`flex gap-3 items-center p-3 rounded-xl border-2 cursor-pointer ${f.role === r ? "border-primary bg-secondary" : ""}`}>
            <input type="radio" name="role" checked={f.role === r} onChange={() => setF({ ...f, role: r })} />
            <span><b>{l}</b><br /><span className="text-sm text-muted-foreground">{d}</span></span>
          </label>))}
        </div>
      </fieldset>
      {f.role === "beneficiaire" && (
        <label className="block"><FieldLabel required>Type de structure</FieldLabel>
          <select required className="field mt-1" value={f.profile} onChange={(e) => setF({ ...f, profile: e.target.value as Profile })}>
            <option value="">Choisir…</option>
            {PROFILES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
      )}
      <label className="block"><FieldLabel required>{f.role === "beneficiaire" && f.profile && f.profile !== "Particulier" ? "Nom de la structure" : "Nom et prénom"}</FieldLabel><input required className="field mt-1" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label className="block"><FieldLabel required>E-mail</FieldLabel><input required type="email" autoComplete="email" className="field mt-1" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="vous@exemple.fr" /></label>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block"><FieldLabel required>Mot de passe</FieldLabel><input required type="password" minLength={8} autoComplete="new-password" className="field mt-1" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /><span className="text-xs text-muted-foreground">8 caractères minimum</span></label>
        <label className="block"><FieldLabel required>Confirmation</FieldLabel><input required type="password" autoComplete="new-password" className="field mt-1" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></label>
      </div>
      <ErrorMsg msg={err} />
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Envoi…" : "Créer mon compte"}</button>
    </form>
  );
}
