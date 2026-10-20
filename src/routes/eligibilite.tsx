import { createFileRoute, Link } from "@tanstack/react-router";
import { Page } from "@/components/Layout";

export const Route = createFileRoute("/eligibilite")({
  head: () => ({ meta: [{ title: "Critères d'éligibilité — Reboot Solidaire" }, { name: "description", content: "Qui peut recevoir un équipement reconditionné ? Des critères clairs et accessibles." }, { property: "og:title", content: "Critères d'éligibilité" }, { property: "og:description", content: "Qui peut recevoir un équipement reconditionné." }] }),
  component: () => (
    <Page title="Critères d'éligibilité" intro="Des règles simples pour que le matériel aille à ceux qui en ont le plus besoin.">
      <div className="grid md:grid-cols-3 gap-6">
        {[
          ["Particuliers", ["Étudiant boursier", "Demandeur d'emploi", "Bénéficiaire des minima sociaux", "Un justificatif récent"]],
          ["Associations", ["Association loi 1901 déclarée", "Projet d'inclusion ou d'accompagnement", "Numéro RNA"]],
          ["Écoles", ["Établissement public ou sous contrat", "Usage pédagogique", "Demande signée par la direction"]],
        ].map(([t, items]) => (
          <article key={t as string} className="card-soft p-8">
            <h2 className="text-2xl font-bold text-primary">{t as string}</h2>
            <ul className="mt-4 space-y-2">{(items as string[]).map((i) => <li key={i} className="flex gap-2"><span className="text-success font-bold">✓</span>{i}</li>)}</ul>
          </article>
        ))}
      </div>
      <div className="card-soft p-8 mt-8">
        <h2 className="text-xl font-bold">Vos données restent confidentielles</h2>
        <p className="mt-2 text-muted-foreground">Vos justificatifs ne sont vus que par le gestionnaire de l'association, jamais par les donateurs. Un seul équipement par foyer par an.</p>
        <Link to="/demande" className="btn btn-primary mt-4">Faire une demande</Link>
      </div>
    </Page>
  ),
});
