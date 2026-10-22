import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { roleLabel, useDB, type Role } from "@/lib/store";

export function Layout({ children }: { children: ReactNode }) {
  const { db, update } = useDB();
  const nav = useNavigate();
  const u = db.user;
  const link = "px-3 py-2 rounded-full text-sm font-semibold hover:bg-secondary";
  const active = { className: "bg-secondary text-primary" };
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-2 px-4 py-3">
          <Link to="/" className="font-display text-xl font-bold text-primary mr-auto">
            Reboot<span className="text-accent">·</span>Solidaire
          </Link>
          <nav className="flex flex-wrap gap-1" aria-label="Navigation principale">
            <Link to="/projet" className={link} activeProps={active}>Le projet</Link>
            <Link to="/eligibilite" className={link} activeProps={active}>Éligibilité</Link>
            {u && u.role !== "beneficiaire" && <Link to="/don" className={link} activeProps={active}>Faire un don</Link>}
            {u?.role === "beneficiaire" && <Link to="/demande" className={link} activeProps={active}>Demander</Link>}
            {u && <Link to="/suivi" className={link} activeProps={active}>Suivi</Link>}
            {u?.role === "admin" && <Link to="/catalogue" className={link} activeProps={active}>Catalogue</Link>}
          </nav>
          {u ? (
            <button className="btn btn-ghost !py-2" onClick={() => { update((d) => { d.user = null; }); nav({ to: "/" }); }}>
              Déconnexion ({u.name} · {u.role === "beneficiaire" && u.profile ? u.profile : roleLabel[u.role]})
            </button>
          ) : (
            <Link to="/connexion" className="btn btn-primary !py-2">Se connecter</Link>
          )}
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        Reboot Solidaire — réemploi informatique solidaire. Donateurs et bénéficiaires restent anonymes l'un pour l'autre.
      </footer>
    </div>
  );
}

export function Page({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <Layout>
      <section className="max-w-6xl mx-auto px-4 py-12">
        <h1 className="text-4xl md:text-5xl font-bold text-primary">{title}</h1>
        {intro && <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{intro}</p>}
        <div className="mt-10">{children}</div>
      </section>
    </Layout>
  );
}

export function RequireLogin({ children, admin, roles }: { children: ReactNode; admin?: boolean; roles?: Role[] }) {
  const { db } = useDB();
  const allowed: Role[] | undefined = admin ? ["admin"] : roles;
  if (!db.user)
    return (
      <div className="card-soft p-8 max-w-lg">
        <p className="font-semibold">Connectez-vous pour accéder à cet espace.</p>
        <Link to="/connexion" className="btn btn-primary mt-4">Se connecter</Link>
      </div>
    );
  if (allowed && !allowed.includes(db.user.role))
    return (
      <div className="card-soft p-8 max-w-lg">
        <p className="font-semibold">
          {admin ? "Cet espace est réservé au gestionnaire de l'association." : `Cet espace est réservé aux comptes : ${allowed.map((r) => roleLabel[r]).join(", ")}.`}
        </p>
        <p className="text-sm text-muted-foreground mt-2">Vous êtes connecté en tant que {roleLabel[db.user.role]}.</p>
      </div>
    );
  return <>{children}</>;
}

/** Libellé de champ : astérisque rouge pour les champs obligatoires, mention « facultatif » sinon. */
export function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <span className="font-semibold">
      {children}
      {required ? (
        <span className="text-destructive ml-0.5" aria-hidden="true">*</span>
      ) : (
        <span className="ml-1 text-xs font-normal text-muted-foreground">(facultatif)</span>
      )}
    </span>
  );
}

export function RequiredLegend() {
  return (
    <p className="text-sm text-muted-foreground">
      Les champs marqués d'un <span className="text-destructive font-bold">*</span> sont obligatoires.
    </p>
  );
}

export function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "success" | "warning" | "accent" }) {
  const t = { muted: "bg-muted text-muted-foreground", success: "bg-success text-primary-foreground", warning: "bg-warning text-foreground", accent: "bg-accent text-accent-foreground" }[tone];
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${t}`}>{children}</span>;
}
