import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/referentiel";

export type Role = "donateur" | "beneficiaire" | "admin";

/**
 * Cycle de vie d'un matériel :
 * enregistre → diagnostic → disponible → reserve (« Demandé ») → expedie → demande (distribué)
 * En cas d'annulation d'une demande, le matériel réservé repasse à « disponible ».
 */
export type Status = "enregistre" | "diagnostic" | "disponible" | "reserve" | "expedie" | "demande";
export const STATUSES: Status[] = ["enregistre", "diagnostic", "disponible", "reserve", "expedie", "demande"];

export type Device = {
  id: string; tracking: string; type: string; category?: string | undefined; brand: string; ref: string;
  age: string; cpu: string; powersOn: boolean; screenOk?: boolean | undefined; notes: string;
  status: Status; ram?: string | undefined; disk?: string | undefined; os?: string | undefined; createdAt: string; owner: string;
  /** Numéro de suivi de la tour avec laquelle cet écran a été donné. */
  linkedTo?: string | undefined;
};

export type RequestStatus = "recue" | "validee" | "expediee" | "livree" | "annulee";
export type Request = {
  id: string; tracking: string; owner: string; profile: Profile;
  deviceType: string; category?: string | undefined; quantity: number; need: string; details: string;
  deviceIds: string[]; status: RequestStatus; createdAt: string; notifications: boolean;
};

export type Account = { email: string; name: string };
export type User = { id: string; email: string; name: string; role: Role; profile?: Profile | undefined };

export type DB = { ready: boolean; devices: Device[]; requests: Request[]; accounts: Account[]; user: User | null };

// ---------- Synchronisation avec la base de données ----------

let state: DB = { ready: false, devices: [], requests: [], accounts: [], user: null };
const listeners = new Set<(d: DB) => void>();
const setState = (d: DB) => { state = d; listeners.forEach((l) => l(d)); };
let started = false;

const u = <T,>(v: T | null | undefined) => (v === null ? undefined : v);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromDevice = (r: any): Device => ({
  id: r.id, tracking: r.tracking, type: r.type, category: u(r.category), brand: r.brand, ref: r.ref, age: r.age, cpu: r.cpu,
  powersOn: r.powers_on, screenOk: u(r.screen_ok), notes: r.notes, status: r.status, ram: u(r.ram), disk: u(r.disk), os: u(r.os),
  createdAt: r.created_at, owner: r.owner, linkedTo: u(r.linked_to),
});
const toDevice = (d: Device) => ({
  id: d.id, tracking: d.tracking, type: d.type, category: d.category ?? null, brand: d.brand, ref: d.ref, age: d.age, cpu: d.cpu,
  powers_on: d.powersOn, screen_ok: d.screenOk ?? null, notes: d.notes, status: d.status, ram: d.ram ?? null, disk: d.disk ?? null,
  os: d.os ?? null, owner: d.owner, linked_to: d.linkedTo ?? null,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromRequest = (r: any): Request => ({
  id: r.id, tracking: r.tracking, owner: r.owner, profile: r.profile, deviceType: r.device_type, category: u(r.category),
  quantity: r.quantity, need: r.need, details: r.details, deviceIds: r.device_ids ?? [], status: r.status,
  createdAt: r.created_at, notifications: r.notifications,
});
const toRequest = (r: Request) => ({
  id: r.id, tracking: r.tracking, owner: r.owner, profile: r.profile, device_type: r.deviceType, category: r.category ?? null,
  quantity: r.quantity, need: r.need, details: r.details, device_ids: r.deviceIds, status: r.status, notifications: r.notifications,
});

export async function reload(): Promise<DB> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { const d = { ready: true, devices: [], requests: [], accounts: [], user: null }; setState(d); return d; }
  const [prof, roles, devs, reqs, profs] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.from("devices").select("*").order("created_at", { ascending: false }),
    supabase.from("requests").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("email, name"),
  ]);
  const rs = (roles.data ?? []).map((r) => r.role as Role);
  const role: Role = rs.includes("admin") ? "admin" : rs.includes("beneficiaire") ? "beneficiaire" : "donateur";
  const d: DB = {
    ready: true,
    user: { id: user.id, email: prof.data?.email ?? user.email ?? "", name: prof.data?.name ?? "", role, profile: (prof.data?.profile ?? undefined) as Profile | undefined },
    devices: (devs.data ?? []).map(fromDevice),
    requests: (reqs.data ?? []).map(fromRequest),
    accounts: (profs.data ?? []).map((p) => ({ email: p.email, name: p.name })),
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

export const code = (p: string) => `${p}-${Math.floor(1000 + Math.random() * 9000)}`;
export const today = () => new Date().toISOString().slice(0, 10);
export const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
};
export const deviceLabel = (d: Device) => `${d.category ?? d.type} ${d.brand} ${d.ref}`;

export const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e.trim());

// ---------- Demandes ----------

/** Une demande « active » bloque une nouvelle demande du même type d'appareil. */
export const isActiveRequest = (r: Request) => r.status !== "livree" && r.status !== "annulee";

const deviceStatusFor: Partial<Record<RequestStatus, Status>> = {
  recue: "reserve", validee: "reserve", expediee: "expedie", livree: "demande",
};

/**
 * Change le statut d'une demande et répercute le changement sur le matériel attribué.
 * Retourne un message d'erreur si la transition est impossible.
 */
export function setRequestStatus(d: DB, requestId: string, status: RequestStatus): string | null {
  const r = d.requests.find((x) => x.id === requestId);
  if (!r) return "Demande introuvable.";
  if (status !== "recue" && status !== "annulee" && r.deviceIds.length === 0)
    return "Attribuez au moins un matériel avant de valider ou d'expédier la demande.";
  if (status === "annulee") {
    for (const id of r.deviceIds) { const dv = d.devices.find((x) => x.id === id); if (dv) dv.status = "disponible"; }
    r.deviceIds = [];
  } else {
    const s = deviceStatusFor[status]!;
    for (const id of r.deviceIds) { const dv = d.devices.find((x) => x.id === id); if (dv) dv.status = s; }
  }
  r.status = status;
  return null;
}

/** Attribue un matériel disponible à une demande : il disparaît de la liste des disponibles. */
export function assignDevice(d: DB, requestId: string, deviceId: string): string | null {
  const r = d.requests.find((x) => x.id === requestId);
  const dv = d.devices.find((x) => x.id === deviceId);
  if (!r || !dv) return "Demande ou matériel introuvable.";
  if (dv.status !== "disponible") return "Ce matériel n'est plus disponible.";
  if (r.deviceIds.length >= r.quantity) return `Cette demande porte sur ${r.quantity} appareil(s) maximum.`;
  r.deviceIds.push(deviceId);
  dv.status = deviceStatusFor[r.status] ?? "reserve";
  return null;
}

export function unassignDevice(d: DB, requestId: string, deviceId: string) {
  const r = d.requests.find((x) => x.id === requestId);
  const dv = d.devices.find((x) => x.id === deviceId);
  if (!r) return;
  r.deviceIds = r.deviceIds.filter((id) => id !== deviceId);
  if (dv) dv.status = "disponible";
  if (r.deviceIds.length === 0 && r.status !== "annulee") r.status = "recue";
}

// ---------- Libellés ----------

export const statusLabel: Record<Role, Record<Status, string>> = {
  donateur: { enregistre: "En attente de dépôt", diagnostic: "En cours de réparation", disponible: "Reconditionné", reserve: "Attribué à un bénéficiaire", expedie: "Expédié", demande: "Distribué" },
  admin: { enregistre: "À réceptionner", diagnostic: "En atelier", disponible: "Au catalogue", reserve: "Demandé", expedie: "Expédié", demande: "Distribué" },
  beneficiaire: { enregistre: "Invisible", diagnostic: "Invisible", disponible: "Disponible", reserve: "Demandé", expedie: "Expédié", demande: "Dans mes équipements" },
};
export const requestLabel: Record<RequestStatus, string> = { recue: "Demande reçue", validee: "Éligibilité validée", expediee: "Expédiée", livree: "Livrée", annulee: "Annulée" };
export const roleLabel: Record<Role, string> = { donateur: "Donateur", beneficiaire: "Bénéficiaire", admin: "Gestionnaire" };
