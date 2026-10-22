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

export const PROFILES = ["Particulier", "Organisation"] as const;
export type Profile = (typeof PROFILES)[number];

export const ORG_TYPES = ["Association", "École / établissement scolaire", "Structure de l'économie sociale et solidaire", "Collectivité", "Autre"];

export const NEED_OPTIONS = [
  "Recherche d'emploi",
  "Études / scolarité",
  "Démarches administratives",
  "Usage pédagogique (classe)",
  "Accompagnement / formation au numérique",
  "Télétravail",
  "Autre",
];

export const OS_PREFS = ["Linux", "Windows", "Pas de préférence"] as const;

/** Nombre maximum d'appareils par demande selon le profil. */
export const MAX_QUANTITY: Record<Profile, number> = { Particulier: 1, Organisation: 30 };

/**
 * Justificatifs acceptés et durée d'éligibilité proposée par défaut (en mois).
 * Le gestionnaire peut ajuster la durée au moment de la validation.
 */
export const JUSTIFS: Record<string, { label: string; doc: string; months: number; profile: Profile }> = {
  bourse: { label: "Étudiant boursier", doc: "Notification de bourse (CROUS) de l'année en cours", months: 12, profile: "Particulier" },
  france_travail: { label: "Demandeur d'emploi", doc: "Attestation d'inscription à France Travail de moins de 3 mois", months: 6, profile: "Particulier" },
  caf: { label: "Bénéficiaire des minima sociaux (RSA, AAH, prime d'activité…)", doc: "Attestation CAF ou MSA de moins de 3 mois", months: 12, profile: "Particulier" },
  impots: { label: "Revenus modestes", doc: "Dernier avis d'imposition (revenu fiscal de référence)", months: 12, profile: "Particulier" },
  organisation: { label: "Organisation", doc: "Statuts, récépissé de déclaration ou attestation d'immatriculation", months: 24, profile: "Organisation" },
};
export const PARTICULIER_JUSTIFS = Object.entries(JUSTIFS).filter(([, j]) => j.profile === "Particulier");
export const VALIDITY_OPTIONS = [3, 6, 12, 18, 24, 36];

export const REFUSAL_REASONS = [
  "Critères d'éligibilité non remplis",
  "Justificatif manquant, illisible ou expiré",
  "Demande abusive ou en double",
  "Matériel demandé indisponible",
  "Autre",
];

export const CONTACT_SUBJECTS = ["Question sur un don", "Question sur une demande", "Éligibilité", "Problème technique", "Partenariat", "Autre"];

/** Questions fréquentes, affichées dans le pied de page (et balisées pour le référencement). */
export const FAQ: [string, string][] = [
  ["Qui peut recevoir un ordinateur reconditionné ?", "Les particuliers en situation de précarité (étudiants boursiers, demandeurs d'emploi, bénéficiaires des minima sociaux, foyers aux revenus modestes) et les organisations qui accompagnent des publics éloignés du numérique : associations, écoles, structures de l'ESS."],
  ["Comment prouver mon éligibilité ?", "Créez un compte, puis remplissez le formulaire d'éligibilité avec un justificatif (attestation CAF, France Travail, bourse, avis d'imposition ou, pour une organisation, numéro SIRET et statuts). Un gestionnaire valide votre dossier pour une durée limitée."],
  ["Combien de temps mon éligibilité est-elle valable ?", "Elle dépend du justificatif : 6 mois pour une attestation France Travail, 12 mois pour une bourse, une attestation CAF ou un avis d'imposition, 24 mois pour une organisation. À l'échéance, il suffit de refaire une demande d'éligibilité."],
  ["Quel matériel puis-je donner ?", "Ordinateurs portables, tours et périphériques (écrans, claviers, souris, imprimantes…), même anciens ou en panne : nous les diagnostiquons et les réparons quand c'est possible."],
  ["Mes données sont-elles effacées avant redistribution ?", "Oui. Chaque appareil est entièrement formaté et un système d'exploitation propre (Linux ou Windows) est réinstallé avant d'être confié à un bénéficiaire."],
  ["Est-ce que je peux choisir mon système d'exploitation ?", "Oui, vous indiquez votre préférence (Linux, Windows ou pas de préférence) lors de votre demande."],
  ["Donateurs et bénéficiaires se connaissent-ils ?", "Non. L'anonymat est strict dans les deux sens : seul le gestionnaire de l'association voit les informations nécessaires au traitement."],
  ["Le service est-il payant ?", "Non, le matériel est remis gratuitement aux bénéficiaires éligibles."],
];
