import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ErrorMsg, Page, PasswordField } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { isStrongPassword, reload } from "@/lib/store";

export const Route = createFileRoute("/reinitialiser")({
  head: () => ({ meta: [{ title: "Nouveau mot de passe — Reboot Solidaire" }, { name: "robots", content: "noindex" }] }),
  component: Reset,
});

function Reset() {
  const [ready, setReady] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  // Le lien reçu par e-mail ouvre une session de récupération.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Page title="Choisir un nouveau mot de passe">
      <div className="max-w-xl">
        {done ? (
          <div className="card-soft p-8 space-y-4">
            <p className="font-semibold text-success">✓ Votre mot de passe a été modifié.</p>
            <Link to="/connexion" className="btn btn-primary">Se connecter</Link>
          </div>
        ) : ready === null ? (
          <p className="text-muted-foreground">Chargement…</p>
        ) : !ready ? (
          <div className="card-soft p-8 space-y-4">
            <p>Ce lien n'est plus valide ou a déjà été utilisé.</p>
            <Link to="/connexion" search={{ mode: "oubli" }} className="btn btn-primary">Recevoir un nouveau lien</Link>
          </div>
        ) : (
          <form className="card-soft p-8 space-y-5" onSubmit={async (e) => {
            e.preventDefault();
            if (!isStrongPassword(pw)) return setErr("Le mot de passe ne respecte pas tous les critères.");
            if (pw !== confirm) return setErr("Les mots de passe ne correspondent pas.");
            setBusy(true);
            const { error } = await supabase.auth.updateUser({ password: pw });
            if (error) { setBusy(false); return setErr(`Modification impossible : ${error.message}`); }
            // On déconnecte : la personne se reconnecte avec son nouveau mot de passe.
            await supabase.auth.signOut();
            await reload();
            setBusy(false);
            setDone(true);
          }}>
            <PasswordField label="Nouveau mot de passe" value={pw} onChange={setPw} autoComplete="new-password" showRules />
            <PasswordField label="Confirmation" value={confirm} onChange={setConfirm} autoComplete="new-password" />
            <ErrorMsg msg={err} />
            <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer le mot de passe"}</button>
          </form>
        )}
      </div>
    </Page>
  );
}
