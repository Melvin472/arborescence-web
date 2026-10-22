import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { Profile } from "@/lib/referentiel";

/** Un seul type de compte utilisateur (peut donner et demander) + le gestionnaire. */
export type Role = "utilisateur" | "admin";

/**
 * Cycle de vie d'un matériel :
 * enregistre → diagnostic → disponible → reserve (« Demandé ») → expedie → demande (distribué)
 * En cas d'annulation ou de refus d'une demande, le matériel réservé repasse à « disponible ».
 */
export type Status = "enregistre" | "diagnostic" | "disponible" | "reserve" | "expedie" | "demande";
export const STATUSES: Status[] = ["enregistre", "diagnostic", "disponible", "reserve", "expedie", "demande"];

export type Device = {
  id: string; tracking: string; type: string; category?: string | undefined; brand: string; ref: string;
  age: string; cpu: string; powersOn: boolean; screenOk?: boolean | undefined; notes: string;
  status: Status; ram?: string | undefined; disk?: string | undefined; os?: string | undefined; createdAt: string; owner: string;
  /** Numéro de suivi de la tour avec laquelle cet écran a été donné. */
  linkedTo?: string | undefined;
  /** Commentaire facultatif saisi lors de la mise en ligne. */
  comment: string;
};

/** Workflow : recue → validee (approuvée) → [attribution du matériel] → expediee → livree. Refus possible avant expédition. */
export type RequestStatus = "recue" | "validee" | "expediee" | "livree" | "annulee" | "refusee";
export type Request = {
  id: string; tracking: string; owner: string; profile: Profile;
  deviceType: string; category?: string | undefined; quantity: number; need: string; details: string; osPref: string;
  deviceIds: string[]; status: RequestStatus; createdAt: string; notifications: boolean;
  refusalReason?: string | undefined; refusalMessage: string;
  /** Date de chaque étape, écrite par la base. */
  approvedAt?: string | undefined; shippedAt?: string | undefined; deliveredAt?: string | undefined; closedAt?: string | undefined;
};

export type EligibilityStatus = "en_attente" | "validee" | "refusee";
export type EligibilityDoc = { path: string; name: string; size: number };
export type Eligibility = {
  id: string; ownerId: string; owner: string; profile: Profile; justifType: string;
  orgType?: string | undefined; orgName?: string | undefined; siret?: string | undefined; siretVerified: boolean;
  siretDetails?: SiretDetails | undefined; documentsDeletedAt?: string | undefined;
  project: string; participants?: number | undefined; documents: EligibilityDoc[];
  status: EligibilityStatus; validUntil?: string | undefined; decisionMessage: string; decidedAt?: string | undefined; createdAt: string;
};

export type Notification = { id: string; title: string; body: string; read: boolean; createdAt: string };
export type ContactMessage = { id: string; email: string; subject: string; message: string; handled: boolean; createdAt: string };
export type Feedback = { id: string; userId: string; author: string; message: string; rating: number; approved: boolean; createdAt: string };
export type SiretDetails = { name: string; active: boolean; isAssociation: boolean; rna?: string; commune?: string; naf?: string; creationDate?: string };

export type Account = { email: string; name: string; profile?: Profile | undefined };
export type User = { id: string; email: string; name: string; role: Role; profile?: Profile | undefined };

export type DB = {
  ready: boolean; user: User | null;
  devices: Device[]; requests: Request[]; accounts: Account[];
  eligibilities: Eligibility[]; notifications: Notification[]; contacts: ContactMessage[]; feedback: Feedback[];
  stats: { pcsSent: number | null };
};

// ---------- Synchronisation avec la base de données ----------

const empty = (): DB => ({
  ready: false, user: null, devices: [], requests: [], accounts: [], eligibilities: [], notifications: [], contacts: [], feedback: [],
  stats: { pcsSent: null },
});
let state: DB = empty();
const listeners = new Set<(d: DB) => void>();
const setState = (d: DB) => { state = d; listeners.forEach((l) => l(d)); };
let started = false;

const u = <T,>(v: T | null | undefined) => (v === null ? undefined : v);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromDevice = (r: any): Device => ({
  id: r.id, tracking: r.tracking, type: r.type, category: u(r.category), brand: r.brand, ref: r.ref, age: r.age, cpu: r.cpu,
  powersOn: r.powers_on, screenOk: u(r.screen_ok), notes: r.notes, status: r.status, ram: u(r.ram), disk: u(r.disk), os: u(r.os),
  createdAt: r.created_at, owner: r.owner, linkedTo: u(r.linked_to), comment: r.comment ?? "",
});
const toDevice = (d: Device) => ({
  id: d.id, tracking: d.tracking, type: d.type, category: d.category ?? null, brand: d.brand, ref: d.ref, age: d.age, cpu: d.cpu,
  powers_on: d.powersOn, screen_ok: d.screenOk ?? null, notes: d.notes, status: d.status, ram: d.ram ?? null, disk: d.disk ?? null,
  os: d.os ?? null, owner: d.owner, linked_to: d.linkedTo ?? null, comment: d.comment,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromRequest = (r: any): Request => ({
  id: r.id, tracking: r.tracking, owner: r.owner, profile: r.profile, deviceType: r.device_type, category: u(r.category),
  quantity: r.quantity, need: r.need, details: r.details, osPref: r.os_pref ?? "Pas de préférence", deviceIds: r.device_ids ?? [], status: r.status,
  createdAt: r.created_at, notifications: r.notifications, refusalReason: u(r.refusal_reason), refusalMessage: r.refusal_message ?? "",
  approvedAt: u(r.approved_at), shippedAt: u(r.shipped_at), deliveredAt: u(r.delivered_at), closedAt: u(r.closed_at),
});
const toRequest = (r: Request) => ({
  id: r.id, tracking: r.tracking, owner: r.owner, profile: r.profile, device_type: r.deviceType, category: r.category ?? null,
  quantity: r.quantity, need: r.need, details: r.details, os_pref: r.osPref, device_ids: r.deviceIds, status: r.status,
  notifications: r.notifications, refusal_reason: r.refusalReason ?? null, refusal_message: r.refusalMessage,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromEligibility = (r: any): Eligibility => ({
  id: r.id, ownerId: r.owner_id, owner: r.owner, profile: r.profile, justifType: r.justif_type, orgType: u(r.org_type), orgName: u(r.org_name),
  siret: u(r.siret), siretVerified: r.siret_verified, project: r.project, participants: u(r.participants),
  documents: Array.isArray(r.documents) ? r.documents : [], status: r.status, validUntil: u(r.valid_until),
  siretDetails: u(r.siret_details), documentsDeletedAt: u(r.documents_deleted_at),
  decisionMessage: r.decision_message, decidedAt: u(r.decided_at), createdAt: r.created_at,
});

async function loadStats(): Promise<DB["stats"]> {
  const { data } = await supabase.rpc("public_stats");
  const s = data as { pcs_sent?: number } | null;
  return { pcsSent: typeof s?.pcs_sent === "number" ? s.pcs_sent : null };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromFeedback = (f: any): Feedback => ({ id: f.id, userId: f.user_id, author: f.author, message: f.message, rating: f.rating ?? 5, approved: f.approved, createdAt: f.created_at });

export async function reload(): Promise<DB> {
  const { data: { user } } = await supabase.auth.getUser();
  const [stats, fb] = await Promise.all([loadStats(), supabase.from("feedback").select("*").order("created_at", { ascending: false })]);
  const feedback = (fb.data ?? []).map(fromFeedback);
  if (!user) { const d = { ...empty(), ready: true, stats, feedback }; setState(d); return d; }

  const [prof, roles] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  const role: Role = (roles.data ?? []).some((r) => r.role === "admin") ? "admin" : "utilisateur";
  const [devs, reqs, profs, elig, notifs, contacts] = await Promise.all([
    supabase.from("devices").select("*").order("created_at", { ascending: false }),
    supabase.from("requests").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("email, name, profile"),
    supabase.from("eligibilities").select("*").order("created_at", { ascending: false }),
    supabase.from("notifications").select("*").order("created_at", { ascending: false }),
    role === "admin" ? supabase.from("contact_messages").select("*").order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
  ]);
  const d: DB = {
    ready: true, stats, feedback,
    user: { id: user.id, email: prof.data?.email ?? user.email ?? "", name: prof.data?.name ?? "", role, profile: (prof.data?.profile ?? undefined) as Profile | undefined },
    devices: (devs.data ?? []).map(fromDevice),
    requests: (reqs.data ?? []).map(fromRequest),
    accounts: (profs.data ?? []).map((p) => ({ email: p.email, name: p.name, profile: (p.profile ?? undefined) as Profile | undefined })),
    eligibilities: (elig.data ?? []).map(fromEligibility),
    notifications: (notifs.data ?? []).map((n) => ({ id: n.id, title: n.title, body: n.body, read: n.read, createdAt: n.created_at })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contacts: ((contacts.data ?? []) as any[]).map((c) => ({ id: c.id, email: c.email, subject: c.subject, message: c.message, handled: c.handled, createdAt: c.created_at })),
  };
  setState(d);
  return d;
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  reload();
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") setTimeout(reload, 0);
  });
  // Rafraîchit le compteur public et les notifications toutes les 30 secondes.
  window.setInterval(() => { if (document.visibilityState === "visible") void reload(); }, 30_000);
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Applique une modification localement puis l'enregistre dans la base de données. */
async function persist(before: DB, after: DB) {
  const admin = before.user?.role === "admin";
  const ops: PromiseLike<{ error: { message: string } | null }>[] = [];
  for (const d of after.devices) {
    const old = before.devices.find((x) => x.id === d.id);
    if (!old) ops.push(supabase.from("devices").insert(toDevice(d)));
    else if (admin && !same(old, d)) ops.push(supabase.from("devices").update(toDevice(d)).eq("id", d.id));
  }
  for (const r of after.requests) {
    const old = before.requests.find((x) => x.id === r.id);
    if (!old) ops.push(supabase.from("requests").insert(toRequest(r)));
    else if (!same(old, r)) ops.push(supabase.from("requests").update(toRequest(r)).eq("id", r.id));
  }
  const res = await Promise.all(ops);
  const err = res.find((r) => r.error);
  if (err) toast.error(`Enregistrement impossible : ${err.error!.message}`);
  await reload();
}

export function useDB() {
  const [db, setDb] = useState<DB>(state);
  useEffect(() => {
    listeners.add(setDb);
    setDb(state);
    start();
    return () => { listeners.delete(setDb); };
  }, []);
  const update = (fn: (d: DB) => void) => {
    const before = state;
    const next = structuredClone(state);
    fn(next);
    setState(next);
    void persist(before, next);
  };
  return { db, update };
}

export async function signOut() { await supabase.auth.signOut(); await reload(); }

/** Exécute une action sur la base, affiche l'erreur éventuelle et recharge les données. */
async function act(p: PromiseLike<{ error: { message: string } | null }>, ok?: string): Promise<boolean> {
  const { error } = await p;
  if (error) { toast.error(`Action impossible : ${error.message}`); return false; }
  if (ok) toast.success(ok);
  await reload();
  return true;
}

// ---------- Utilitaires ----------

export const code = (p: string) => `${p}-${Math.floor(1000 + Math.random() * 9000)}`;
export const today = () => new Date().toISOString().slice(0, 10);
export const addMonths = (months: number) => { const d = new Date(); d.setMonth(d.getMonth() + months); return d.toISOString().slice(0, 10); };
export const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
};
export const deviceLabel = (d: Device) => `${d.category ?? d.type} ${d.brand} ${d.ref}`;
export const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e.trim());

/** Critères de mot de passe affichés à l'inscription et au changement de mot de passe. */
export const PASSWORD_RULES: [string, (p: string) => boolean][] = [
  ["8 caractères minimum", (p) => p.length >= 8],
  ["Une lettre majuscule", (p) => /[A-Z]/.test(p)],
  ["Une lettre minuscule", (p) => /[a-z]/.test(p)],
  ["Un chiffre", (p) => /\d/.test(p)],
];
export const isStrongPassword = (p: string) => PASSWORD_RULES.every(([, ok]) => ok(p));

/** Vérifie la clé de contrôle d'un numéro SIRET (algorithme de Luhn). */
export function isValidSiret(s: string): boolean {
  if (!/^\d{14}$/.test(s)) return false;
  // Exception historique : établissements de La Poste
  if (s.startsWith("356000000")) return s.split("").reduce((a, c) => a + Number(c), 0) % 5 === 0;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let n = Number(s[13 - i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
}

/**
 * Connecteur vers l'annuaire officiel des entreprises de l'État (API ouverte recherche-entreprises.api.gouv.fr) :
 * vérifie que le SIRET existe, que l'établissement est actif, et s'il s'agit d'une association.
 */
export async function lookupSiret(siret: string): Promise<({ found: true } & SiretDetails) | { found: false } | null> {
  try {
    const res = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${siret}&page=1&per_page=1`);
    if (!res.ok) return null;
    const json = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = (json.results ?? [])[0] as any;
    if (!r) return { found: false };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const etab = [r.siege, ...(r.matching_etablissements ?? [])].find((e: any) => e?.siret === siret);
    if (!etab) return { found: false };
    return {
      found: true,
      name: String(r.nom_complet ?? ""),
      active: etab.etat_administratif !== "F",
      isAssociation: !!r.complements?.est_association,
      rna: r.complements?.identifiant_association ?? undefined,
      commune: etab.libelle_commune ?? undefined,
      naf: r.activite_principale ?? undefined,
      creationDate: r.date_creation ?? undefined,
    };
  } catch {
    return null; // service indisponible : la vérification sera faite par le gestionnaire
  }
}

// ---------- Éligibilité ----------

export const myEligibilities = (db: DB) => db.eligibilities.filter((e) => e.ownerId === db.user?.id);
export const isExpired = (e: Eligibility) => e.status === "validee" && !!e.validUntil && e.validUntil < today();
/** Éligibilité en cours de validité de l'utilisateur connecté, s'il en a une. */
export const activeEligibility = (db: DB) => myEligibilities(db).find((e) => e.status === "validee" && !isExpired(e));
export const pendingEligibility = (db: DB) => myEligibilities(db).find((e) => e.status === "en_attente");

export async function submitEligibility(
  db: DB,
  data: Pick<Eligibility, "justifType" | "orgType" | "orgName" | "siret" | "siretVerified" | "siretDetails" | "project" | "participants">,
  files: File[],
): Promise<boolean> {
  const user = db.user!;
  const documents: EligibilityDoc[] = [];
  for (const f of files) {
    const path = `${user.id}/${Date.now()}-${f.name.replace(/[^\w.-]+/g, "_")}`;
    const { error } = await supabase.storage.from("justificatifs").upload(path, f, { contentType: f.type });
    if (error) { toast.error(`Envoi du fichier « ${f.name} » impossible : ${error.message}`); return false; }
    documents.push({ path, name: f.name, size: f.size });
  }
  return act(supabase.from("eligibilities").insert({
    owner: user.email, profile: user.profile ?? "Particulier", justif_type: data.justifType,
    org_type: data.orgType ?? null, org_name: data.orgName ?? null, siret: data.siret ?? null, siret_verified: data.siretVerified, siret_details: (data.siretDetails ?? null) as unknown as Json,
    project: data.project, participants: data.participants ?? null, documents: documents as unknown as Json,
  }));
}

/**
 * Décision du gestionnaire. Pour limiter les données conservées (RGPD), les justificatifs
 * sont supprimés du stockage dès que la décision est prise ; seule la décision reste.
 */
export async function decideEligibility(e: Eligibility, decision: { status: "validee"; validUntil: string; message: string } | { status: "refusee"; message: string }) {
  const ok = await act(supabase.from("eligibilities").update({
    status: decision.status, valid_until: decision.status === "validee" ? decision.validUntil : null,
    decision_message: decision.message.trim(), decided_at: new Date().toISOString(),
    documents_deleted_at: e.documents.length ? new Date().toISOString() : null,
  }).eq("id", e.id), decision.status === "validee" ? "Éligibilité validée : le demandeur a été prévenu." : "Refus envoyé au demandeur.");
  if (ok && e.documents.length) {
    const { error } = await supabase.storage.from("justificatifs").remove(e.documents.map((d) => d.path));
    if (error) toast.error(`Les justificatifs n'ont pas pu être supprimés : ${error.message}`);
  }
  return ok;
}

export async function openDocument(path: string) {
  const { data, error } = await supabase.storage.from("justificatifs").createSignedUrl(path, 300);
  if (error || !data) return toast.error("Impossible d'ouvrir le justificatif.");
  window.open(data.signedUrl, "_blank", "noopener");
}

// ---------- Notifications, contact, avis ----------

export const markNotificationRead = (id: string) => act(supabase.from("notifications").update({ read: true }).eq("id", id));

export const sendContact = (m: { email: string; subject: string; message: string }) =>
  act(supabase.from("contact_messages").insert({ email: m.email.trim().toLowerCase(), subject: m.subject, message: m.message.trim() }));
export const setContactHandled = (id: string, handled: boolean) => act(supabase.from("contact_messages").update({ handled }).eq("id", id));

export const submitFeedback = (author: string, message: string, rating: number) =>
  act(supabase.from("feedback").insert({ author: author.trim(), message: message.trim(), rating }), "Merci ! Votre avis sera publié après relecture.");
export const moderateFeedback = (id: string, approved: boolean) => act(supabase.from("feedback").update({ approved }).eq("id", id));
export const deleteFeedback = (id: string) => act(supabase.from("feedback").delete().eq("id", id));

// ---------- Demandes : workflow du gestionnaire (à utiliser dans update()) ----------

/** Une demande « active » bloque une nouvelle demande du même type d'appareil. */
export const isActiveRequest = (r: Request) => !["livree", "annulee", "refusee"].includes(r.status);

const setDevices = (d: DB, ids: string[], s: Status) => { for (const id of ids) { const dv = d.devices.find((x) => x.id === id); if (dv) dv.status = s; } };

export function approveRequest(d: DB, id: string) {
  const r = d.requests.find((x) => x.id === id);
  if (r?.status === "recue") r.status = "validee";
}

/** Attribue un matériel disponible à une demande approuvée : il disparaît de la liste des disponibles. */
export function assignDevice(d: DB, requestId: string, deviceId: string): string | null {
  const r = d.requests.find((x) => x.id === requestId);
  const dv = d.devices.find((x) => x.id === deviceId);
  if (!r || !dv) return "Demande ou matériel introuvable.";
  if (r.status !== "validee") return "Approuvez la demande avant d'attribuer du matériel.";
  if (dv.status !== "disponible") return "Ce matériel n'est plus disponible.";
  if (r.deviceIds.length >= r.quantity) return `Cette demande porte sur ${r.quantity} appareil(s).`;
  r.deviceIds.push(deviceId);
  dv.status = "reserve";
  return null;
}

export function unassignDevice(d: DB, requestId: string, deviceId: string) {
  const r = d.requests.find((x) => x.id === requestId);
  if (!r || r.status !== "validee") return;
  r.deviceIds = r.deviceIds.filter((id) => id !== deviceId);
  setDevices(d, [deviceId], "disponible");
}

export function shipRequest(d: DB, id: string): string | null {
  const r = d.requests.find((x) => x.id === id);
  if (!r || r.status !== "validee") return "La demande doit être approuvée.";
  if (r.deviceIds.length < r.quantity) return "La commande doit être complète avant l'expédition.";
  r.status = "expediee";
  setDevices(d, r.deviceIds, "expedie");
  return null;
}

export function deliverRequest(d: DB, id: string) {
  const r = d.requests.find((x) => x.id === id);
  if (r?.status !== "expediee") return;
  r.status = "livree";
  setDevices(d, r.deviceIds, "demande");
}

export function refuseRequest(d: DB, id: string, reason: string, message: string) {
  const r = d.requests.find((x) => x.id === id);
  if (!r || !["recue", "validee"].includes(r.status)) return;
  setDevices(d, r.deviceIds, "disponible");
  r.deviceIds = [];
  r.status = "refusee";
  r.refusalReason = reason;
  r.refusalMessage = message.trim();
}

/** Annulation par le demandeur (le matériel est libéré côté serveur). */
export function cancelRequest(d: DB, id: string) {
  const r = d.requests.find((x) => x.id === id);
  if (!r || !["recue", "validee"].includes(r.status)) return;
  r.status = "annulee";
  r.deviceIds = [];
}

// ---------- Libellés et couleurs cohérentes des statuts ----------

/**
 * Une même couleur = une même signification, partout sur le site :
 * jaune = en attente, bleu = en cours, orange = en route, vert = terminé / prêt, rouge = refusé, gris = annulé / expiré.
 */
export type Tone = "warning" | "info" | "accent" | "success" | "destructive" | "muted";
export const deviceTone: Record<Status, Tone> = { enregistre: "warning", diagnostic: "info", disponible: "success", reserve: "info", expedie: "accent", demande: "success" };
export const requestTone: Record<RequestStatus, Tone> = { recue: "warning", validee: "info", expediee: "accent", livree: "success", annulee: "muted", refusee: "destructive" };
export const eligibilityTone = (e: Eligibility): Tone => (isExpired(e) ? "muted" : ({ en_attente: "warning", validee: "success", refusee: "destructive" } as const)[e.status]);
/** Libellé d'une catégorie de statut (même couleur = même signification). */
export const TONE_LABEL: Record<Tone, string> = { warning: "En attente", info: "En cours", accent: "En route", success: "Terminé · prêt", destructive: "Refusé", muted: "Annulé" };
export const TONE_ORDER: Tone[] = ["warning", "info", "accent", "success", "destructive", "muted"];
export const TONE_LEGEND: [Tone, string][] = [["warning", "En attente"], ["info", "En cours"], ["accent", "En route"], ["success", "Terminé / prêt"], ["destructive", "Refusé"], ["muted", "Annulé"]];

export const statusLabel: Record<Role, Record<Status, string>> = {
  utilisateur: { enregistre: "En attente de dépôt", diagnostic: "En cours de réparation", disponible: "Reconditionné", reserve: "Attribué à un bénéficiaire", expedie: "Expédié", demande: "Distribué" },
  admin: { enregistre: "À réceptionner", diagnostic: "En atelier", disponible: "Au catalogue", reserve: "Demandé", expedie: "Expédié", demande: "Distribué" },
};
export const requestLabel: Record<RequestStatus, string> = { recue: "Reçue", validee: "Approuvée", expediee: "Expédiée", livree: "Livrée", annulee: "Annulée", refusee: "Refusée" };
export const eligibilityLabel = (e: Eligibility) => (isExpired(e) ? "Expirée" : { en_attente: "En cours d'examen", validee: "Validée", refusee: "Refusée" }[e.status]);
export const roleLabel: Record<Role, string> = { utilisateur: "Utilisateur", admin: "Gestionnaire" };
