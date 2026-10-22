import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { FieldLabel, Page, RequiredLegend } from "@/components/Layout";
import { PROFILES, type Profile } from "@/lib/referentiel";
import { hashPassword, isValidEmail, today, useDB, type Account, type Role } from "@/lib/store";

export const Route = createFileRoute("/connexion")({
  head: () => ({ meta: [{ title: "Se connecter — Reboot Solidaire" }, { name: "description", content: "Accédez à votre espace donateur, bénéficiaire ou gestionnaire." }, { property: "og:title", content: "Se connecter" }, { property: "og:description", content: "Accédez à votre espace Reboot Solidaire." }] }),
  component: Login,
});

const roles: [Role, string, string][] = [
  ["donateur", "Donateur", "Particulier, entreprise ou organisme"],
  ["beneficiaire", "Bénéficiaire", "École, association ou particulier"],
  ["admin", "Gestionnaire", "Équipe Reboot Solidaire"],
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
  const { db, update } = useDB();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <form className="card-soft p-8 space-y-5" onSubmit={async (e) => {
      e.preventDefault();
      const acc = db.accounts.find((a) => a.email === email.trim().toLowerCase());
      if (!acc || acc.passwordHash !== (await hashPassword(pw))) return setErr("E-mail ou mot de passe incorrect.");
      if (!acc.verified) return setErr("Cette adresse e-mail n'a pas encore été vérifiée.");
      update((d) => { d.user = { email: acc.email, name: acc.name, role: acc.role, profile: acc.profile }; });
      nav({ to: home(acc.role) });
    }}>
      <RequiredLegend />
      <label className="block"><FieldLabel required>E-mail</FieldLabel><input required type="email" autoComplete="email" className="field mt-1" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" /></label>
      <label className="block"><FieldLabel required>Mot de passe</FieldLabel><input required type="password" autoComplete="current-password" className="field mt-1" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
      <ErrorMsg msg={err} />
      <button className="btn btn-primary w-full">Se connecter</button>
      <p className="text-xs text-muted-foreground">
        Comptes de démonstration (mot de passe <code>demo1234</code>) : donateur@demo.fr, particulier@demo.fr, ecole@demo.fr, admin@demo.fr
      </p>
    </form>
  );
}

type Pending = Omit<Account, "passwordHash" | "verified" | "createdAt"> & { password: string; code: string };
const newCode = () => String(Math.floor(100000 + Math.random() * 900000));

function SignupForm() {
  const { db, update } = useDB();
  const nav = useNavigate();
  const [f, setF] = useState({ email: "", name: "", password: "", confirm: "", role: "donateur" as Role, profile: "" as Profile | "" });
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [typed, setTyped] = useState("");

  if (pending)
    return (
      <form className="card-soft p-8 space-y-5" onSubmit={async (e) => {
        e.preventDefault();
        if (typed.trim() !== pending.code) return setErr("Code incorrect. Vérifiez l'e-mail reçu ou renvoyez un code.");
        const acc: Account = {
          email: pending.email, name: pending.name, role: pending.role, profile: pending.profile,
          verified: true, passwordHash: await hashPassword(pending.password), createdAt: today(),
        };
        update((d) => { d.accounts.push(acc); d.user = { email: acc.email, name: acc.name, role: acc.role, profile: acc.profile }; });
        nav({ to: home(acc.role) });
      }}>
        <h2 className="text-2xl font-bold text-primary">Vérifiez votre adresse e-mail</h2>
        <p>Un code à 6 chiffres a été envoyé à <b>{pending.email}</b>. Saisissez-le pour activer votre compte.</p>
        <p className="rounded-lg bg-secondary p-3 text-sm">
          Prototype : aucun e-mail n'est réellement envoyé. Votre code est <b className="font-mono">{pending.code}</b>.
        </p>
        <label className="block"><FieldLabel required>Code de vérification</FieldLabel>
          <input required inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} className="field mt-1 font-mono tracking-[0.5em]" value={typed} onChange={(e) => setTyped(e.target.value.replace(/\D/g, ""))} />
        </label>
        <ErrorMsg msg={err} />
        <button className="btn btn-primary w-full">Activer mon compte</button>
        <div className="flex justify-between text-sm">
          <button type="button" className="underline" onClick={() => { setPending({ ...pending, code: newCode() }); setTyped(""); setErr(null); }}>Renvoyer un code</button>
          <button type="button" className="underline" onClick={() => { setPending(null); setErr(null); }}>Modifier l'adresse</button>
        </div>
      </form>
    );

  return (
    <form className="card-soft p-8 space-y-5" onSubmit={(e) => {
      e.preventDefault();
      const email = f.email.trim().toLowerCase();
      if (!isValidEmail(email)) return setErr("Adresse e-mail invalide.");
      if (db.accounts.some((a) => a.email === email)) return setErr("Un compte existe déjà avec cette adresse.");
      if (f.password.length < 8) return setErr("Le mot de passe doit contenir au moins 8 caractères.");
      if (f.password !== f.confirm) return setErr("Les mots de passe ne correspondent pas.");
      if (f.role === "beneficiaire" && !f.profile) return setErr("Précisez si vous êtes un particulier, une association ou une école.");
      setErr(null);
      setPending({ email, name: f.name.trim(), role: f.role, profile: f.role === "beneficiaire" ? (f.profile as Profile) : undefined, password: f.password, code: newCode() });
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
      <button className="btn btn-primary w-full">Créer mon compte</button>
    </form>
  );
}
