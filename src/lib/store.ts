import { useEffect, useState } from "react";

export type Role = "donateur" | "beneficiaire" | "admin";
export type Status = "enregistre" | "diagnostic" | "disponible" | "demande";
export type Device = {
  id: string; tracking: string; type: string; brand: string; ref: string;
  age: string; cpu: string; powersOn: boolean; screenOk: boolean; notes: string;
  status: Status; ram?: string; disk?: string; os?: string; createdAt: string; owner: string;
};
export type Request = {
  id: string; tracking: string; owner: string; profile: string; need: string;
  deviceId?: string | undefined; status: "recue" | "validee" | "expediee" | "livree"; createdAt: string; notifications: boolean;
};
export type User = { name: string; role: Role };

const KEY = "reboot-solidaire-v1";
type DB = { devices: Device[]; requests: Request[]; user: User | null };

const seed: DB = {
  user: null,
  requests: [],
  devices: [
    { id: "d1", tracking: "DON-4821", type: "PC portable", brand: "Lenovo", ref: "ThinkPad T480", age: "5 ans", cpu: "Intel i5-8250U", powersOn: true, screenOk: true, notes: "", status: "disponible", ram: "8 Go", disk: "SSD 256 Go", os: "Linux Mint", createdAt: "2026-09-12", owner: "demo" },
    { id: "d2", tracking: "DON-4822", type: "Tour", brand: "Dell", ref: "OptiPlex 7050", age: "6 ans", cpu: "Intel i5-7500", powersOn: true, screenOk: true, notes: "", status: "disponible", ram: "16 Go", disk: "SSD 512 Go", os: "Windows 10", createdAt: "2026-09-20", owner: "demo" },
    { id: "d3", tracking: "DON-4823", type: "PC portable", brand: "HP", ref: "EliteBook 840 G5", age: "4 ans", cpu: "Intel i7-8550U", powersOn: true, screenOk: false, notes: "Écran rayé", status: "diagnostic", createdAt: "2026-10-02", owner: "demo" },
    { id: "d4", tracking: "DON-4824", type: "Périphérique", brand: "Logitech", ref: "Clavier K120", age: "3 ans", cpu: "—", powersOn: true, screenOk: true, notes: "", status: "enregistre", createdAt: "2026-10-18", owner: "demo" },
    { id: "d5", tracking: "DON-4825", type: "PC portable", brand: "Apple", ref: "MacBook Air 2017", age: "9 ans", cpu: "Intel i5", powersOn: true, screenOk: true, notes: "", status: "disponible", ram: "8 Go", disk: "SSD 128 Go", os: "macOS Monterey", createdAt: "2026-09-28", owner: "demo" },
  ],
};

function read(): DB {
  if (typeof window === "undefined") return seed;
  try { return JSON.parse(localStorage.getItem(KEY) || "") as DB; } catch { return seed; }
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

export const statusLabel: Record<Role, Record<Status, string>> = {
  donateur: { enregistre: "En attente de dépôt", diagnostic: "En cours de réparation", disponible: "Reconditionné", demande: "Distribué" },
  admin: { enregistre: "À réceptionner", diagnostic: "En atelier", disponible: "Au catalogue", demande: "Dossier clos" },
  beneficiaire: { enregistre: "Invisible", diagnostic: "Invisible", disponible: "Disponible", demande: "Dans mes équipements" },
};
export const requestLabel = { recue: "Demande reçue", validee: "Éligibilité validée", expediee: "Expédiée", livree: "Livrée" };
