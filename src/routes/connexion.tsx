import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Page } from "@/components/Layout";
import { useDB, type Role } from "@/lib/store";

export const Route = createFileRoute("/connexion")({
  head: () => ({ meta: [{ title: "Se connecter — Reboot Solidaire" }, { name: "description", content: "Accédez à votre espace donateur, bénéficiaire ou gestionnaire." }, { property: "og:title", content: "Se connecter" }, { property: "og:description", content: "Accédez à votre espace Reboot Solidaire." }] }),
  component: Login,
});

function Login() {
  const { update } = useDB();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("donateur");
  const roles: [Role, string, string][] = [["donateur", "Donateur", "Particulier, entreprise ou organisme"], ["beneficiaire", "Bénéficiaire", "École, association ou particulier"], ["admin", "Gestionnaire", "Équipe Reboot Solidaire"]];
  return (
    <Page title="Se connecter" intro="Prototype : choisissez votre profil pour découvrir le parcours correspondant.">
      <form className="card-soft p-8 max-w-xl space-y-6" onSubmit={(e) => {
        e.preventDefault();
        update((d) => { d.user = { name: name || "Invité", role }; });
        nav({ to: role === "admin" ? "/catalogue" : role === "donateur" ? "/don" : "/demande" });
      }}>
        <label className="block"><span className="font-semibold">Identifiant / e-mail</span><input className="field mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="vous@exemple.fr" /></label>
        <label className="block"><span className="font-semibold">Mot de passe</span><input type="password" className="field mt-1" placeholder="••••••••" /></label>
        <fieldset><legend className="font-semibold mb-2">Je suis</legend>
          <div className="grid gap-2">{roles.map(([r, l, d]) => (
            <label key={r} className={`flex gap-3 items-center p-3 rounded-xl border-2 cursor-pointer ${role === r ? "border-primary bg-secondary" : ""}`}>
              <input type="radio" name="role" checked={role === r} onChange={() => setRole(r)} />
              <span><b>{l}</b><br /><span className="text-sm text-muted-foreground">{d}</span></span>
            </label>))}
          </div>
        </fieldset>
        <button className="btn btn-primary w-full">Se connecter</button>
      </form>
    </Page>
  );
}
