import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Page, RequireLogin } from "@/components/Layout";
import { code, useDB } from "@/lib/store";

export const Route = createFileRoute("/don")({
  head: () => ({ meta: [{ title: "Déclarer un don — Reboot Solidaire" }, { name: "description", content: "Déclarez votre ordinateur ou périphérique en moins de 3 minutes." }, { property: "og:title", content: "Déclarer un don" }, { property: "og:description", content: "Ordinateur, caractéristiques, état." }] }),
  component: Don,
});

function Don() {
  const { db, update } = useDB();
  const [done, setDone] = useState<string | null>(null);
  const [f, setF] = useState({ type: "PC portable", brand: "", ref: "", age: "", cpu: "", powersOn: true, screenOk: true, notes: "" });
  const set = (k: string, v: unknown) => setF({ ...f, [k]: v });
  return (
    <Page title="Faire un don de matériel" intro="Moins de 3 minutes. Aucune information personnelle requise.">
      <RequireLogin>
        {done ? (
          <div className="card-soft p-10 max-w-xl text-center">
            <p className="text-success font-bold">Merci pour votre don !</p>
            <p className="mt-4">Votre numéro de suivi :</p>
            <p className="font-display text-5xl font-bold text-accent mt-2">{done}</p>
            <div className="mt-6 flex justify-center gap-3"><Link to="/suivi" className="btn btn-primary">Suivre mon don</Link><button className="btn btn-ghost" onClick={() => setDone(null)}>Nouveau don</button></div>
          </div>
        ) : (
          <form className="card-soft p-8 max-w-2xl grid gap-5" onSubmit={(e) => {
            e.preventDefault();
            const t = code("DON");
            update((d) => { d.devices.push({ ...f, id: crypto.randomUUID(), tracking: t, status: "enregistre", createdAt: new Date().toISOString().slice(0, 10), owner: db.user!.name }); });
            setDone(t);
          }}>
            <fieldset><legend className="font-semibold mb-2">Type d'appareil</legend>
              <div className="flex flex-wrap gap-2">{["PC portable", "Tour", "Périphérique"].map((t) => (
                <button type="button" key={t} onClick={() => set("type", t)} className={`btn !py-2 ${f.type === t ? "btn-primary" : "btn-ghost"}`}>{t}</button>))}</div>
            </fieldset>
            <div className="grid sm:grid-cols-2 gap-4">
              <label><span className="font-semibold">Marque</span><input required className="field mt-1" value={f.brand} onChange={(e) => set("brand", e.target.value)} /></label>
              <label><span className="font-semibold">Référence / modèle</span><input required className="field mt-1" value={f.ref} onChange={(e) => set("ref", e.target.value)} /></label>
              <label><span className="font-semibold">Âge / durée d'utilisation</span><input className="field mt-1" placeholder="ex. 5 ans" value={f.age} onChange={(e) => set("age", e.target.value)} /></label>
              <label><span className="font-semibold">Processeur (si connu)</span><input className="field mt-1" value={f.cpu} onChange={(e) => set("cpu", e.target.value)} /></label>
            </div>
            <fieldset className="grid sm:grid-cols-2 gap-4"><legend className="font-semibold mb-2">État visuel et technique</legend>
              {([["powersOn", "S'allume-t-il ?"], ["screenOk", "L'écran est-il intact ?"]] as const).map(([k, l]) => (
                <div key={k}><p className="text-sm mb-1">{l}</p><div className="flex gap-2">{[true, false].map((v) => (
                  <button type="button" key={String(v)} onClick={() => set(k, v)} className={`btn !py-1.5 ${f[k] === v ? "btn-primary" : "btn-ghost"}`}>{v ? "Oui" : "Non"}</button>))}</div></div>))}
            </fieldset>
            <label><span className="font-semibold">Remarques</span><textarea className="field mt-1" rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></label>
            <button className="btn btn-accent">Confirmer le don</button>
          </form>
        )}
      </RequireLogin>
    </Page>
  );
}
