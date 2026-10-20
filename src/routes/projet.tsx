import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/Layout";

export const Route = createFileRoute("/projet")({
  head: () => ({ meta: [{ title: "Le projet — Reboot Solidaire" }, { name: "description", content: "Réemploi, impact et association : découvrez Reboot Solidaire." }, { property: "og:title", content: "Le projet Reboot Solidaire" }, { property: "og:description", content: "Réemploi, impact et association." }] }),
  component: () => (
    <Page title="Le projet" intro="L'obsolescence et le renouvellement des équipements génèrent un volume important de matériel inutilisé. Nous le remettons en circulation.">
      <div className="grid md:grid-cols-3 gap-6">
        {[
          ["Réemploi", "Chaque ordinateur fonctionnel donné évite la fabrication d'un appareil neuf. Nous diagnostiquons, réparons et formatons chaque machine avant de la redistribuer."],
          ["Impact", "Nous connectons les dons aux besoins qualifiés : étudiants boursiers, demandeurs d'emploi, écoles et associations en situation de précarité numérique."],
          ["Association", "Bénévoles et techniciens assurent le reconditionnement et la logistique. La plateforme leur offre un outil simple de gestion des stocks et des statuts."],
        ].map(([t, d]) => (
          <article key={t} className="card-soft p-8"><h2 className="text-2xl font-bold text-accent">{t}</h2><p className="mt-3 text-muted-foreground">{d}</p></article>
        ))}
      </div>
      <div className="card-soft p-8 mt-8 bg-secondary">
        <h2 className="text-2xl font-bold text-primary">Notre engagement éthique</h2>
        <p className="mt-2">L'anonymat entre donateur et bénéficiaire est strict. Aucune information personnelle n'est demandée aux donateurs, et aucune réparation n'est renvoyée au donateur.</p>
      </div>
    </Page>
  ),
});
