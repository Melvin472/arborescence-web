// Référentiel des valeurs proposées dans les listes déroulantes.
// Centralisé ici pour pouvoir être remplacé plus tard par une table en base de données
// (ex. une table `fabricants`) sans toucher aux formulaires.

export const DEVICE_TYPES = ["PC portable", "Tour", "Périphérique"] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

export const PERIPHERAL_CATEGORIES = [
  "Écran",
  "Clavier",
  "Souris",
  "Imprimante / scanner",
  "Webcam",
  "Casque / micro",
  "Haut-parleurs",
  "Disque dur externe",
  "Station d'accueil / hub",
  "Autre",
] as const;

const PC_BRANDS = ["Acer", "Apple", "Asus", "Dell", "Fujitsu", "HP", "Huawei", "Lenovo", "LG", "Medion", "MSI", "Microsoft", "Samsung", "Toshiba / Dynabook"];

const PERIPHERAL_BRANDS: Record<string, string[]> = {
  "Écran": ["Acer", "AOC", "Asus", "BenQ", "Dell", "HP", "Iiyama", "Lenovo", "LG", "Philips", "Samsung", "ViewSonic"],
  "Clavier": ["Cherry", "Corsair", "Dell", "HP", "Logitech", "Microsoft", "Razer"],
  "Souris": ["Corsair", "Dell", "HP", "Logitech", "Microsoft", "Razer", "SteelSeries"],
  "Imprimante / scanner": ["Brother", "Canon", "Epson", "HP", "Kyocera", "Lexmark", "Ricoh", "Samsung", "Xerox"],
  "Webcam": ["Creative", "Logitech", "Microsoft", "Razer"],
  "Casque / micro": ["Jabra", "JBL", "Logitech", "Plantronics / Poly", "Sennheiser", "Sony", "SteelSeries"],
  "Haut-parleurs": ["Bose", "Creative", "Edifier", "JBL", "Logitech"],
  "Disque dur externe": ["LaCie", "Samsung", "Seagate", "Toshiba", "Western Digital"],
  "Station d'accueil / hub": ["Anker", "Belkin", "Dell", "HP", "Lenovo", "StarTech"],
};

export const OTHER_BRAND = "Autre marque";

/** Liste des fabricants proposés selon le type (et la catégorie pour un périphérique). */
export function brandsFor(type: string, category?: string): string[] {
  if (type !== "Périphérique") return PC_BRANDS;
  const list = (category && PERIPHERAL_BRANDS[category]) || Array.from(new Set(Object.values(PERIPHERAL_BRANDS).flat())).sort();
  return list;
}

export const AGE_OPTIONS = [
  "Moins d'1 an",
  ...Array.from({ length: 9 }, (_, i) => `${i + 1} an${i ? "s" : ""}`),
  "10 ans",
  "Plus de 10 ans",
  "Je ne sais pas",
];

export const CPU_OPTIONS = [
  "Intel Core i3",
  "Intel Core i5",
  "Intel Core i7",
  "Intel Core i9",
  "Intel Celeron / Pentium",
  "AMD Ryzen 3",
  "AMD Ryzen 5",
  "AMD Ryzen 7",
  "AMD (autre)",
  "Apple M1 / M2 / M3",
  "Autre",
  "Je ne sais pas",
];

export const RAM_OPTIONS = ["2 Go", "4 Go", "8 Go", "12 Go", "16 Go", "32 Go"];
export const DISK_OPTIONS = ["HDD 250 Go", "HDD 500 Go", "HDD 1 To", "SSD 128 Go", "SSD 256 Go", "SSD 512 Go", "SSD 1 To"];
export const OS_OPTIONS = ["Linux Mint", "Ubuntu", "Windows 10", "Windows 11", "macOS", "ChromeOS Flex", "Aucun"];

export const PROFILES = ["Particulier", "Association", "École"] as const;
export type Profile = (typeof PROFILES)[number];

export const NEED_OPTIONS = [
  "Recherche d'emploi",
  "Études / scolarité",
  "Démarches administratives",
  "Usage pédagogique (classe)",
  "Accompagnement / formation au numérique",
  "Télétravail",
  "Autre",
];

/** Nombre maximum d'appareils par demande selon le profil. */
export const MAX_QUANTITY: Record<Profile, number> = { Particulier: 1, Association: 20, "École": 30 };
