import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Reboot Solidaire — Donnez une seconde vie à vos ordinateurs" },
      { name: "description", content: "Donnez votre matériel informatique inutilisé ou demandez un équipement reconditionné." },
      { property: "og:title", content: "Reboot Solidaire" },
      { property: "og:description", content: "Le réemploi informatique solidaire, du don au bénéficiaire." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <Layout>
      <section className="max-w-6xl mx-auto px-4 py-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <p className="font-bold text-accent uppercase tracking-widest text-sm">Économie circulaire · Inclusion numérique</p>
          <h1 className="mt-4 text-5xl md:text-6xl font-bold text-primary leading-tight">
            Votre ancien ordinateur peut changer une vie.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-lg">
            Reboot Solidaire collecte, reconditionne et redistribue le matériel informatique aux personnes et structures qui en ont besoin.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/don" className="btn btn-accent">Faire un don de matériel</Link>
            <Link to="/demande" className="btn btn-primary">Faire une demande de matériel</Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[["3 min", "pour déclarer un don"], ["100 %", "anonyme entre donateur et bénéficiaire"], ["4", "étapes de suivi en temps réel"], ["0 €", "pour les bénéficiaires éligibles"]].map(([n, l], i) => (
            <div key={l} className={`card-soft p-6 ${i % 2 ? "mt-8" : ""}`}>
              <div className="font-display text-4xl font-bold text-accent">{n}</div>
              <div className="mt-2 text-sm font-semibold">{l}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="bg-primary text-primary-foreground">
        <div className="max-w-6xl mx-auto px-4 py-16 grid md:grid-cols-3 gap-8">
          {[["1. Je déclare", "Type d'appareil, âge, état : un formulaire court génère un numéro de suivi."], ["2. On reconditionne", "L'association diagnostique, répare, formate et met en ligne au catalogue."], ["3. Il est redistribué", "Un bénéficiaire éligible le demande et suit sa demande jusqu'à la livraison."]].map(([t, d]) => (
            <div key={t}><h2 className="text-2xl font-bold">{t}</h2><p className="mt-2 opacity-80">{d}</p></div>
          ))}
        </div>
      </section>
      <section className="max-w-6xl mx-auto px-4 py-16 grid md:grid-cols-2 gap-6">
        <Link to="/projet" className="card-soft p-8 hover:border-primary"><h2 className="text-2xl font-bold text-primary">Le projet →</h2><p className="mt-2 text-muted-foreground">Réemploi, impact et association.</p></Link>
        <Link to="/eligibilite" className="card-soft p-8 hover:border-primary"><h2 className="text-2xl font-bold text-primary">Critères d'éligibilité →</h2><p className="mt-2 text-muted-foreground">Qui peut recevoir un équipement ?</p></Link>
      </section>
    </Layout>
  );
}
