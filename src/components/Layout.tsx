import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FAQ } from "@/lib/referentiel";
import { markNotificationRead, PASSWORD_RULES, roleLabel, signOut, TONE_LEGEND, useDB, type Role, type Tone } from "@/lib/store";

export function Layout({ children }: { children: ReactNode }) {
  const { db } = useDB();
  const nav = useNavigate();
  const u = db.user;
  const unread = db.notifications.filter((n) => !n.read);
  const link = "px-3 py-2 rounded-full text-sm font-semibold hover:bg-secondary";
  const active = { className: "bg-secondary text-primary" };
  const member = u && u.role !== "admin";
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
            {member && <Link to="/don" className={link} activeProps={active}>Faire un don</Link>}
            {member && <Link to="/demande" className={link} activeProps={active}>Demander</Link>}
            {member && <Link to="/suivi" className={link} activeProps={active}>Mes dons et demandes</Link>}
            {u?.role === "admin" && <Link to="/catalogue" className={link} activeProps={active}>Gestion</Link>}
          </nav>
          {u ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="btn btn-ghost !py-2 relative" aria-label={`Mon compte${unread.length ? `, ${unread.length} message(s) non lu(s)` : ""}`}>
                <span aria-hidden="true">👤</span> {u.name || u.email}
                {unread.length > 0 && <span className="absolute -top-1 -right-1 rounded-full bg-destructive text-destructive-foreground text-xs font-bold min-w-5 h-5 px-1 grid place-items-center">{unread.length}</span>}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56">
                <DropdownMenuLabel>
                  {u.name || u.email}
                  <span className="block text-xs font-normal text-muted-foreground">{u.role === "admin" ? roleLabel.admin : u.profile ?? roleLabel.utilisateur}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => nav({ to: "/profil" })}>Mon profil{unread.length ? ` (${unread.length} message${unread.length > 1 ? "s" : ""})` : ""}</DropdownMenuItem>
                {member && <DropdownMenuItem onSelect={() => nav({ to: "/suivi" })}>Mes dons et demandes</DropdownMenuItem>}
                {u.role === "admin" && <DropdownMenuItem onSelect={() => nav({ to: "/catalogue" })}>Espace gestionnaire</DropdownMenuItem>}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={async () => { await signOut(); nav({ to: "/" }); }}>Se déconnecter</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/connexion" className="btn btn-primary !py-2">Se connecter</Link>
          )}
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <Footer />
      <NotificationPopup />
    </div>
  );
}

/** Affiche en fenêtre le plus ancien message non lu (validation, refus, expédition…). */
function NotificationPopup() {
  const { db } = useDB();
  const [closing, setClosing] = useState<string | null>(null);
  const next = [...db.notifications].reverse().find((n) => !n.read && n.id !== closing);
  if (!next) return null;
  const close = async () => { setClosing(next.id); await markNotificationRead(next.id); setClosing(null); };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) void close(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{next.title}</DialogTitle>
          <DialogDescription className="whitespace-pre-line text-foreground">{next.body}</DialogDescription>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">Message reçu le {new Date(next.createdAt).toLocaleDateString("fr-FR")}. Retrouvez tous vos messages dans votre profil.</p>
        <DialogFooter><button className="btn btn-primary !py-2" onClick={() => void close()}>J'ai compris</button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Footer() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
  return (
    <footer className="border-t mt-12 bg-secondary/40">
      <div className="max-w-6xl mx-auto px-4 py-12 grid lg:grid-cols-3 gap-10">
        <section className="lg:col-span-2" aria-labelledby="faq-title">
          <h2 id="faq-title" className="text-2xl font-bold text-primary">Questions fréquentes sur le don et le reconditionnement d'ordinateurs</h2>
          <div className="mt-4 grid gap-2">
            {FAQ.map(([q, a]) => (
              <details key={q} className="card-soft px-5 py-3 group">
                <summary className="font-semibold cursor-pointer list-none flex justify-between gap-4">{q}<span className="text-accent group-open:rotate-45 transition-transform" aria-hidden="true">+</span></summary>
                <p className="mt-2 text-sm text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
        </section>
        <aside className="card-soft p-6 self-start">
          <h2 className="text-xl font-bold text-primary">Besoin d'aide ?</h2>
          <p className="mt-2 text-sm text-muted-foreground">Un souci avec un don ou une demande, une demande spécifique ? Écrivez-nous, nous répondons par e-mail.</p>
          <Link to="/contact" className="btn btn-accent mt-4 w-full">Nous contacter</Link>
          <ul className="mt-6 grid gap-1 text-sm">
            <li><Link to="/projet" className="underline">Le projet</Link></li>
            <li><Link to="/eligibilite" className="underline">Critères d'éligibilité</Link></li>
          </ul>
        </aside>
      </div>
      <p className="border-t py-6 text-center text-sm text-muted-foreground px-4">
        Reboot Solidaire — réemploi informatique solidaire. Donateurs et bénéficiaires restent anonymes l'un pour l'autre.
      </p>
    </footer>
  );
}

export function Page({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <Layout>
      <section className="max-w-6xl mx-auto px-4 py-12">
        <h1 className="text-4xl md:text-5xl font-bold text-primary">{title}</h1>
        {intro && <div className="mt-3 max-w-2xl text-lg text-muted-foreground">{intro}</div>}
        <div className="mt-10">{children}</div>
      </section>
    </Layout>
  );
}

export function RequireLogin({ children, admin, roles, message }: { children: ReactNode; admin?: boolean; roles?: Role[]; message?: string }) {
  const { db } = useDB();
  const allowed: Role[] | undefined = admin ? ["admin"] : roles;
  if (!db.ready) return <p className="text-muted-foreground">Chargement…</p>;
  if (!db.user)
    return (
      <div className="card-soft p-8 max-w-lg">
        <p className="font-semibold">{message ?? "Connectez-vous pour accéder à cet espace."}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/connexion" className="btn btn-primary">Se connecter</Link>
          <Link to="/connexion" search={{ mode: "inscription" }} className="btn btn-ghost">Créer un compte</Link>
        </div>
      </div>
    );
  if (allowed && !allowed.includes(db.user.role))
    return (
      <div className="card-soft p-8 max-w-lg">
        <p className="font-semibold">
          {admin ? "Cet espace est réservé au gestionnaire de l'association." : "Les gestionnaires ne peuvent pas faire de don ni de demande. Utilisez un compte personnel."}
        </p>
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

const toneClass: Record<Tone, string> = {
  muted: "bg-muted text-muted-foreground",
  success: "bg-success text-primary-foreground",
  warning: "bg-warning text-foreground",
  info: "bg-info text-primary-foreground",
  accent: "bg-accent text-accent-foreground",
  destructive: "bg-destructive text-destructive-foreground",
};
export const toneBg = toneClass;

export function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${toneClass[tone]}`}>{children}</span>;
}

export function ToneLegend() {
  return (
    <ul className="flex flex-wrap gap-2 text-xs" aria-label="Signification des couleurs">
      {TONE_LEGEND.map(([t, l]) => <li key={t}><Badge tone={t}>{l}</Badge></li>)}
    </ul>
  );
}

/** Champ mot de passe avec bouton « afficher » et, si demandé, la liste des critères. */
export function PasswordField({ label, value, onChange, autoComplete, showRules, required = true }: {
  label: string; value: string; onChange: (v: string) => void; autoComplete: string; showRules?: boolean; required?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label className="block">
        <FieldLabel required={required}>{label}</FieldLabel>
        <div className="relative mt-1">
          <input required={required} type={visible ? "text" : "password"} autoComplete={autoComplete} className="field pr-24" value={value} onChange={(e) => onChange(e.target.value)} />
          <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-sm font-semibold text-primary px-2 py-1 rounded-md hover:bg-secondary" aria-pressed={visible} onClick={() => setVisible(!visible)}>
            {visible ? "Masquer" : "Afficher"}
          </button>
        </div>
      </label>
      {showRules && (
        <ul className="mt-2 grid grid-cols-2 gap-1 text-xs" aria-live="polite">
          {PASSWORD_RULES.map(([l, ok]) => (
            <li key={l} className={ok(value) ? "text-success font-semibold" : "text-muted-foreground"}>{ok(value) ? "✓" : "○"} {l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ErrorMsg({ msg }: { msg: string | null }) {
  return msg ? <p role="alert" className="rounded-lg bg-destructive/10 text-destructive font-semibold p-3 text-sm">{msg}</p> : null;
}
