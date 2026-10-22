import { useEffect, useState } from "react";
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
  id: string; tracking: string; type: string; category?: string; brand: string; ref: string;
  age: string; cpu: string; powersOn: boolean; screenOk?: boolean; notes: string;
  status: Status; ram?: string; disk?: string; os?: string; createdAt: string; owner: string;
  /** Numéro de suivi de la tour avec laquelle cet écran a été donné. */
  linkedTo?: string;
};

export type RequestStatus = "recue" | "validee" | "expediee" | "livree" | "annulee";
export type Request = {
  id: string; tracking: string; owner: string; profile: Profile;
  deviceType: string; category?: string; quantity: number; need: string; details: string;
  deviceIds: string[]; status: RequestStatus; createdAt: string; notifications: boolean;
};

export type Account = {
  email: string; name: string; role: Role; profile?: Profile;
  verified: boolean; passwordHash: string; createdAt: string;
};
export type User = { email: string; name: string; role: Role; profile?: Profile };

const KEY = "reboot-solidaire-v1";
const VERSION = 2;
type DB = { version: number; devices: Device[]; requests: Request[]; accounts: Account[]; user: User | null };

// Mot de passe des comptes de démonstration : demo1234
const DEMO_HASH = "0ead2060b65992dca4769af601a1b3a35ef38cfad2c2c465bb160ea764157c5d";
const DEMO_DONOR = "donateur@demo.fr";

const seed: DB = {
  version: VERSION,
  user: null,
  requests: [],
  accounts: [
    { email: DEMO_DONOR, name: "Donateur démo", role: "donateur", verified: true, passwordHash: DEMO_HASH, createdAt: "2026-09-01" },
    { email: "particulier@demo.fr", name: "Particulier démo", role: "beneficiaire", profile: "Particulier", verified: true, passwordHash: DEMO_HASH, createdAt: "2026-09-01" },
    { email: "ecole@demo.fr", name: "École démo", role: "beneficiaire", profile: "École", verified: true, passwordHash: DEMO_HASH, createdAt: "2026-09-01" },
    { email: "admin@demo.fr", name: "Gestionnaire démo", role: "admin", verified: true, passwordHash: DEMO_HASH, createdAt: "2026-09-01" },
  ],
  devices: [
    { id: "d1", tracking: "DON-4821", type: "PC portable", brand: "Lenovo", ref: "ThinkPad T480", age: "5 ans", cpu: "Intel Core i5", powersOn: true, screenOk: true, notes: "", status: "disponible", ram: "8 Go", disk: "SSD 256 Go", os: "Linux Mint", createdAt: "2026-09-12", owner: DEMO_DONOR },
    { id: "d2", tracking: "DON-4822", type: "Tour", brand: "Dell", ref: "OptiPlex 7050", age: "6 ans", cpu: "Intel Core i5", powersOn: true, notes: "", status: "disponible", ram: "16 Go", disk: "SSD 512 Go", os: "Windows 10", createdAt: "2026-09-20", owner: DEMO_DONOR },
    { id: "d3", tracking: "DON-4823", type: "PC portable", brand: "HP", ref: "EliteBook 840 G5", age: "4 ans", cpu: "Intel Core i7", powersOn: true, screenOk: false, notes: "Écran rayé", status: "diagnostic", createdAt: "2026-10-02", owner: DEMO_DONOR },
    { id: "d4", tracking: "DON-4824", type: "Périphérique", category: "Clavier", brand: "Logitech", ref: "K120", age: "3 ans", cpu: "", powersOn: true, notes: "", status: "enregistre", createdAt: "2026-10-18", owner: DEMO_DONOR },
    { id: "d5", tracking: "DON-4825", type: "PC portable", brand: "Apple", ref: "MacBook Air 2017", age: "9 ans", cpu: "Intel Core i5", powersOn: true, screenOk: true, notes: "", status: "disponible", ram: "8 Go", disk: "SSD 128 Go", os: "macOS", createdAt: "2026-09-28", owner: DEMO_DONOR },
    { id: "d6", tracking: "DON-4826", type: "Périphérique", category: "Écran", brand: "Dell", ref: "P2219H", age: "6 ans", cpu: "", powersOn: true, screenOk: true, notes: "Donné avec la tour DON-4822", status: "disponible", createdAt: "2026-09-20", owner: DEMO_DONOR, linkedTo: "DON-4822" },
  ],
};

const fresh = (): DB => structuredClone(seed);

/** Convertit les données enregistrées par l'ancienne version du prototype. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrate(raw: any): DB {
  if (raw?.version === VERSION) return raw as DB;
  if (!raw || !Array.isArray(raw.devices)) return fresh();
  const devices: Device[] = raw.devices.map((d: Device) => ({ ...d, screenOk: d.type === "Tour" ? undefined : d.screenOk }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requests: Request[] = (raw.requests ?? []).map((r: any) => {
    const dev = devices.find((d) => d.id === r.deviceId);
    return {
      id: r.id, tracking: r.tracking, owner: r.owner, profile: r.profile ?? "Particulier",
      deviceType: dev?.type ?? "PC portable", quantity: 1, need: r.need ?? "", details: "",
      deviceIds: r.deviceId ? [r.deviceId] : [], status: r.status ?? "recue",
      createdAt: r.createdAt, notifications: r.notifications ?? true,
    };
  });
  // Le matériel déjà choisi dans une demande en cours ne doit plus apparaître comme disponible.
  for (const r of requests) {
    if (!isActiveRequest(r)) continue;
    for (const id of r.deviceIds) { const dv = devices.find((d) => d.id === id); if (dv?.status === "disponible") dv.status = "reserve"; }
  }
  // Les anciennes sessions n'avaient pas de compte : on déconnecte l'utilisateur.
  return { version: VERSION, devices, requests, accounts: fresh().accounts, user: null };
}

function read(): DB {
  if (typeof window === "undefined") return fresh();
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? migrate(JSON.parse(raw)) : fresh();
  } catch {
    return fresh();
  }
}
function write(db: DB) { localStorage.setItem(KEY, JSON.stringify(db)); window.dispatchEvent(new Event("rs-update")); }

export function useDB() {
  const [db, setDb] = useState<DB>(seed);
  useEffect(() => {
    const sync = () => setDb(read());
    sync();
    window.addEventListener("rs-update", sync);
    return () => window.removeEventListener("rs-update", sync);
  }, []);
  const update = (fn: (d: DB) => void) => { const d = read(); fn(d); write(d); };
  return { db, update };
}

export const code = (p: string) => `${p}-${Math.floor(1000 + Math.random() * 9000)}`;
export const today = () => new Date().toISOString().slice(0, 10);
export const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
};
export const deviceLabel = (d: Device) => `${d.category ?? d.type} ${d.brand} ${d.ref}`;

// ---------- Comptes ----------

export const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e.trim());

export async function hashPassword(pw: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

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
