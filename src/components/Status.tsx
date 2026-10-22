import { Ban, BadgeCheck, CircleX, House, Inbox, PackageCheck, Truck, type LucideIcon } from "lucide-react";
import { toneBg } from "@/components/Layout";
import type { Request, Tone } from "@/lib/store";

// ---------------------------------------------------------------------------
// Barre de statuts unique et cliquable : elle sert à la fois de légende des
// couleurs et de filtre (même composant côté utilisateur et côté gestionnaire).
// ---------------------------------------------------------------------------

export type FilterItem<K extends string> = { key: K; label: string; tone: Tone; count: number };

export function StatusFilter<K extends string>({ items, value, onChange, total, label = "Filtrer par statut" }: {
  items: FilterItem<K>[]; value: K | "all"; onChange: (v: K | "all") => void; total: number; label?: string;
}) {
  const chip = "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-shadow";
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      <button type="button" aria-pressed={value === "all"} onClick={() => onChange("all")}
        className={`${chip} border-2 ${value === "all" ? "border-primary bg-primary text-primary-foreground" : "border-primary/30 text-primary hover:border-primary"}`}>
        Tous <span className="opacity-80">({total})</span>
      </button>
      {items.map((it) => {
        const active = value === it.key;
        return (
          <button key={it.key} type="button" aria-pressed={active} onClick={() => onChange(active ? "all" : it.key)}
            className={`${chip} ${toneBg[it.tone]} ${active ? "ring-4 ring-offset-2 ring-primary/60" : value === "all" ? "" : "opacity-55 hover:opacity-100"}`}>
            {it.label} <span className="opacity-80">({it.count})</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Frise de suivi d'une demande, identique pour le demandeur et le gestionnaire.
// ---------------------------------------------------------------------------

type Node = { key: string; label: string; icon: LucideIcon; date?: string | undefined; state: "done" | "current" | "todo"; tone: Tone };

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : undefined);

export function requestStepIndex(r: Request) {
  if (r.status === "livree") return 4;
  if (r.status === "expediee") return 3;
  if (r.status === "validee") return r.deviceIds.length >= r.quantity ? 2 : 1;
  return 0;
}

export function RequestTimeline({ r }: { r: Request }) {
  const base: Omit<Node, "state" | "tone">[] = [
    { key: "recue", label: "Reçue", icon: Inbox, date: fmt(r.createdAt) },
    { key: "validee", label: "Approuvée", icon: BadgeCheck, date: fmt(r.approvedAt) },
    { key: "attribuee", label: r.quantity > 1 ? `Matériel attribué (${Math.min(r.deviceIds.length, r.quantity)}/${r.quantity})` : "Matériel attribué", icon: PackageCheck },
    { key: "expediee", label: "Expédiée", icon: Truck, date: fmt(r.shippedAt) },
    { key: "livree", label: "Livrée", icon: House, date: fmt(r.deliveredAt) },
  ];
  let nodes: Node[];
  if (r.status === "refusee" || r.status === "annulee") {
    // La frise s'arrête à l'étape atteinte, suivie de la clôture.
    const reached = r.approvedAt ? 2 : 1;
    nodes = [
      ...base.slice(0, reached).map((n) => ({ ...n, state: "done" as const, tone: "success" as Tone })),
      { key: r.status, label: r.status === "refusee" ? "Refusée" : "Annulée", icon: r.status === "refusee" ? CircleX : Ban, date: fmt(r.closedAt), state: "current", tone: r.status === "refusee" ? "destructive" : "muted" },
    ];
  } else {
    const i = requestStepIndex(r);
    const currentTone: Tone = r.status === "livree" ? "success" : r.status === "expediee" ? "accent" : r.status === "validee" ? "info" : "warning";
    nodes = base.map((n, k) => ({ ...n, state: k < i ? "done" : k === i ? "current" : "todo", tone: k < i ? "success" : currentTone }));
  }

  return (
    <ol className="flex items-start mt-4" aria-label="Frise de suivi de la demande">
      {nodes.map((n, k) => {
        const Icon = n.icon;
        const circle = n.state === "todo" ? "bg-muted text-muted-foreground border-2 border-dashed border-muted-foreground/40" : `${toneBg[n.tone]} shadow-md`;
        return (
          <li key={n.key} className="flex-1 flex flex-col items-center text-center relative min-w-0" aria-current={n.state === "current" ? "step" : undefined}>
            {k > 0 && (
              <span aria-hidden="true" className={`absolute top-6 right-1/2 w-full h-1 ${n.state === "todo" ? "bg-muted" : n.key === "refusee" ? "bg-destructive" : n.key === "annulee" ? "bg-muted-foreground/40" : "bg-success"}`} />
            )}
            <span className={`relative z-10 grid place-items-center h-12 w-12 rounded-full ${circle} ${n.state === "current" ? "ring-4 ring-offset-2 ring-offset-card ring-primary/20" : ""}`}>
              <Icon width={22} height={22} aria-hidden="true" />
            </span>
            <span className={`mt-2 text-xs sm:text-sm leading-tight px-1 ${n.state === "todo" ? "text-muted-foreground" : "font-semibold"}`}>{n.label}</span>
            <span className="text-xs text-muted-foreground">{n.date ?? (n.state === "todo" ? "à venir" : "")}</span>
            <span className="sr-only">{n.state === "done" ? "étape terminée" : n.state === "current" ? "étape en cours" : "étape à venir"}</span>
          </li>
        );
      })}
    </ol>
  );
}
