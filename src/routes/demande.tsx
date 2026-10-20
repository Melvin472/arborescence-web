import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Page, RequireLogin } from "@/components/Layout";
import { code, useDB } from "@/lib/store";

export const Route = createFileRoute("/demande")({
  head: () => ({ meta: [{ title: "Demander un équipement — Reboot Solidaire" }, { name: "description", content: "Choisissez un équipement reconditionné et déposez votre demande." }, { property: "og:title", content: "Demander un équipement" }, { property: "og:description", content: "Éligibilité et besoin." }] }),
  component: Demande,
});

function Demande() {
  const { db, update } = useDB();
  const available = db.devices.filter((d) => d.status === "disponible");
  const [filter, setFilter] = useState("Tous");
  const [sel, setSel] = useState<string | undefined>();
  const [f, setF] = useState({ profile: "Particulier", need: "", notifications: true });
  const [done, setDone] = useState<string | null>(null);
  const list = available.filter((d) => filter === "Tous" || d.type === filter);

  if (done) return (
    <Page title="Demande envoyée">
      <div className="card-soft p-10 max-w-xl text-center">
        <p>Votre numéro de suivi de demande :</p>
        <p className="font-display text-5xl font-bold text-accent mt-2">{done}</p>
        <Link to="/suivi" className="btn btn-primary mt-6">Voir mon historique</Link>
      </div>
    </Page>
  );

  return (
    <Page title="Demander un équipement" intro="Sélectionnez un matériel du catalogue, puis décrivez votre besoin.">
      <RequireLogin>
        <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label="Filtrer par appareil">
          {["Tous", "PC portable", "Tour", "Périphérique"].map((t) => <button key={t} onClick={() => setFilter(t)} className={`btn !py-1.5 ${filter === t ? "btn-primary" : "btn-ghost"}`}>{t}</button>)}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((d) => (
            <article key={d.id} className={`card-soft p-6 ${sel === d.id ? "ring-4 ring-accent" : ""}`}>
              <p className="text-xs font-bold text-accent uppercase">{d.type}</p>
              <h2 className="text-xl font-bold mt-1">{d.brand} {d.ref}</h2>
              <ul className="text-sm text-muted-foreground mt-2"><li>RAM : {d.ram}</li><li>Stockage : {d.disk}</li><li>Système : {d.os}</li></ul>
              <button onClick={() => setSel(d.id)} className="btn btn-primary !py-2 mt-4 w-full">{sel === d.id ? "Sélectionné ✓" : "Demander cet équipement"}</button>
            </article>
          ))}
          {!list.length && <p className="text-muted-foreground">Aucun matériel disponible pour ce filtre.</p>}
        </div>
        <form className="card-soft p-8 max-w-2xl mt-10 grid gap-4" onSubmit={(e) => {
          e.preventDefault();
          const t = code("DEM");
          update((d) => { d.requests.push({ id: crypto.randomUUID(), tracking: t, owner: d.user!.name, ...f, deviceId: sel, status: "recue", createdAt: new Date().toISOString().slice(0, 10) }); });
          setDone(t);
        }}>
          <h2 className="text-2xl font-bold text-primary">Votre demande</h2>
          <p className="text-sm">Matériel : <b>{sel ? (() => { const d = available.find((x) => x.id === sel); return d ? `${d.brand} ${d.ref} (${d.tracking})` : "—"; })() : "aucun (nous vous proposerons un appareil adapté)"}</b></p>
          <label><span className="font-semibold">Vous êtes</span>
            <select className="field mt-1" value={f.profile} onChange={(e) => setF({ ...f, profile: e.target.value })}>{["Particulier", "Association", "École"].map((p) => <option key={p}>{p}</option>)}</select></label>
          <label><span className="font-semibold">Votre besoin</span><textarea required rows={3} className="field mt-1" placeholder="ex. recherche d'emploi, études…" value={f.need} onChange={(e) => setF({ ...f, need: e.target.value })} /></label>
          <label className="flex gap-2 items-center"><input type="checkbox" checked={f.notifications} onChange={(e) => setF({ ...f, notifications: e.target.checked })} /> Recevoir les mises à jour par e-mail</label>
          <p className="text-xs text-muted-foreground">Vos informations ne sont jamais transmises au donateur. <Link to="/eligibilite" className="underline">Voir les critères</Link></p>
          <button className="btn btn-accent">Envoyer ma demande</button>
        </form>
      </RequireLogin>
    </Page>
  );
}
