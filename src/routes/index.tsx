import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout, Stars } from "@/components/Layout";
import { TRUSTPILOT_URL } from "@/lib/referentiel";
import { useDB } from "@/lib/store";

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
  const { db } = useDB();
  const sent = db.stats.pcsSent;
  const published = db.feedback.filter((f) => f.approved);
  const average = published.length ? published.reduce((a, f) => a + f.rating, 0) / published.length : 0;
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
            <Link to="/eligibilite" hash="test" className="btn btn-ghost">Faire un test d'éligibilité</Link>
          </div>
        </div>
        {/* Quatre cadres identiques : même taille, même structure, alignés sur une grille. */}
        <div className="grid grid-cols-2 auto-rows-fr gap-4">
          {([["3 min", "pour déclarer un don"], ["100 %", "anonyme entre donateur et bénéficiaire"], ["live", "PC déjà envoyés aux bénéficiaires"], ["0 €", "pour les bénéficiaires éligibles"]] as const).map(([n, l]) => (
            <div key={l} className="card-soft p-6 flex flex-col relative">
              {n === "live" && (
                <span className="absolute top-4 right-4 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-success animate-pulse" aria-hidden="true" /> En direct
                </span>
              )}
              <div className="font-display text-4xl font-bold text-accent" aria-live={n === "live" ? "polite" : undefined}>{n === "live" ? sent ?? "…" : n}</div>
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
      <section className="py-14 overflow-hidden" aria-labelledby="avis-title">
        <div className="max-w-6xl mx-auto px-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="avis-title" className="text-3xl font-bold text-primary">Ils en parlent</h2>
            {published.length > 0 && (
              <p className="mt-2 flex items-center gap-2 text-sm"><Stars value={average} /> <b>{average.toFixed(1).replace(".", ",")}/5</b> · {published.length} avis</p>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-sm font-semibold">
            <Link to="/profil" className="underline">Laisser mon avis</Link>
            {TRUSTPILOT_URL && <a href={TRUSTPILOT_URL} target="_blank" rel="noopener noreferrer" className="underline">Nos avis sur Trustpilot ↗</a>}
          </div>
        </div>
        {published.length ? (
          <div className="mt-6 overflow-x-auto motion-safe:overflow-hidden">
            <ul className="marquee-track px-4" style={{ ["--marquee-duration" as string]: `${Math.max(20, published.length * 8)}s` }}>
              {[...published, ...published].map((f, i) => (
                <li key={`${f.id}-${i}`} aria-hidden={i >= published.length} className="card-soft p-6 w-80 shrink-0">
                  <Stars value={f.rating} />
                  <p className="text-sm mt-2">« {f.message} »</p>
                  <p className="mt-3 text-sm font-semibold text-accent">— {f.author}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="max-w-6xl mx-auto px-4 mt-4 text-muted-foreground">Les premiers retours de nos bénéficiaires et donateurs apparaîtront ici. Vous avez reçu ou donné du matériel ? Partagez votre expérience depuis votre profil.</p>
        )}
      </section>
      <section className="max-w-6xl mx-auto px-4 py-16 grid md:grid-cols-2 gap-6">
        <Link to="/projet" className="card-soft p-8 hover:border-primary"><h2 className="text-2xl font-bold text-primary">Le projet →</h2><p className="mt-2 text-muted-foreground">Réemploi, impact et association.</p></Link>
        <Link to="/eligibilite" className="card-soft p-8 hover:border-primary"><h2 className="text-2xl font-bold text-primary">Critères d'éligibilité →</h2><p className="mt-2 text-muted-foreground">Qui peut recevoir un équipement ?</p></Link>
      </section>
    </Layout>
  );
}
