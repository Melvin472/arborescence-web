import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { FieldLabel, Page, RequiredLegend, RequireLogin } from "@/components/Layout";
import { AGE_OPTIONS, CPU_OPTIONS, DEVICE_TYPES, OTHER_BRAND, PERIPHERAL_CATEGORIES, brandsFor } from "@/lib/referentiel";
import { code, today, useDB, type Device } from "@/lib/store";

export const Route = createFileRoute("/don")({
  head: () => ({ meta: [{ title: "Déclarer un don — Reboot Solidaire" }, { name: "description", content: "Déclarez votre ordinateur ou périphérique en moins de 3 minutes." }, { property: "og:title", content: "Déclarer un don" }, { property: "og:description", content: "Ordinateur, caractéristiques, état." }] }),
  component: Don,
});

const empty = {
  type: "PC portable" as string, category: "", brandChoice: "", brandOther: "", ref: "", age: "", cpu: "",
  powersOn: true, screenOk: true, notes: "",
  // Écran donné avec une tour : enregistré comme un périphérique distinct
  withScreen: false, screenBrandChoice: "", screenBrandOther: "", screenRef: "", screenWorks: true,
};

function YesNo({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div>
      <p className="text-sm mb-1">{label}</p>
      <div className="flex gap-2" role="radiogroup" aria-label={label}>
        {[true, false].map((v) => (
          <button type="button" role="radio" aria-checked={value === v} key={String(v)} onClick={() => onChange(v)} className={`btn !py-1.5 ${value === v ? "btn-primary" : "btn-ghost"}`}>{v ? "Oui" : "Non"}</button>
        ))}
      </div>
    </div>
  );
}

function BrandField({ brands, choice, other, onChoice, onOther, label = "Marque" }: { brands: string[]; choice: string; other: string; onChoice: (v: string) => void; onOther: (v: string) => void; label?: string }) {
  return (
    <div className="grid gap-2">
      <label>
        <FieldLabel required>{label}</FieldLabel>
        <select required className="field mt-1" value={choice} onChange={(e) => onChoice(e.target.value)}>
          <option value="">Choisir un fabricant…</option>
          {brands.map((b) => <option key={b}>{b}</option>)}
          <option>{OTHER_BRAND}</option>
        </select>
      </label>
      {choice === OTHER_BRAND && (
        <label>
          <FieldLabel required>Nom du fabricant</FieldLabel>
          <input required className="field mt-1" value={other} onChange={(e) => onOther(e.target.value)} />
        </label>
      )}
    </div>
  );
}

function Don() {
  const { db, update } = useDB();
  const [done, setDone] = useState<string[] | null>(null);
  const [f, setF] = useState(empty);
  const set = <K extends keyof typeof empty>(k: K, v: (typeof empty)[K]) => setF((p) => ({ ...p, [k]: v }));

  const isPC = f.type !== "Périphérique";
  const isScreen = f.type === "Périphérique" && f.category === "Écran";
  const brand = f.brandChoice === OTHER_BRAND ? f.brandOther.trim() : f.brandChoice;
  const screenBrand = f.screenBrandChoice === OTHER_BRAND ? f.screenBrandOther.trim() : f.screenBrandChoice;
  // Suggestions de références déjà connues pour cette marque
  const knownRefs = Array.from(new Set(db.devices.filter((d) => d.brand === brand).map((d) => d.ref)));

  const changeType = (t: string) => setF((p) => ({ ...p, type: t, category: "", brandChoice: "", brandOther: "", cpu: "", withScreen: false }));

  return (
    <Page title="Faire un don de matériel" intro="Moins de 3 minutes. Aucune information personnelle requise.">
      <RequireLogin roles={["utilisateur"]}>
        {done ? (
          <div className="card-soft p-10 max-w-xl text-center">
            <p className="text-success font-bold">Merci pour votre don !</p>
            <p className="mt-4">{done.length > 1 ? "Vos numéros de suivi :" : "Votre numéro de suivi :"}</p>
            {done.map((t) => <p key={t} className="font-display text-5xl font-bold text-accent mt-2">{t}</p>)}
            {done.length > 1 && <p className="text-sm text-muted-foreground mt-2">L'écran est suivi séparément, comme un périphérique.</p>}
            <div className="mt-6 flex justify-center gap-3"><Link to="/suivi" className="btn btn-primary">Suivre mon don</Link><button className="btn btn-ghost" onClick={() => { setF(empty); setDone(null); }}>Nouveau don</button></div>
          </div>
        ) : (
          <form className="card-soft p-8 max-w-2xl grid gap-5" onSubmit={(e) => {
            e.preventDefault();
            const owner = db.user!.email;
            const base = { status: "enregistre" as const, createdAt: today(), owner, comment: "" };
            const t = code("DON");
            const main: Device = {
              ...base, id: crypto.randomUUID(), tracking: t, type: f.type,
              category: f.type === "Périphérique" ? f.category || "Autre" : undefined,
              brand, ref: f.ref.trim(), age: f.age, cpu: isPC ? f.cpu : "", powersOn: f.powersOn,
              screenOk: f.type === "PC portable" || isScreen ? f.screenOk : undefined, notes: f.notes.trim(),
            };
            const created = [main];
            if (f.type === "Tour" && f.withScreen) {
              created.push({
                ...base, id: crypto.randomUUID(), tracking: code("DON"), type: "Périphérique", category: "Écran",
                brand: screenBrand, ref: f.screenRef.trim(), age: f.age, cpu: "", powersOn: f.screenWorks, screenOk: f.screenWorks,
                notes: `Donné avec la tour ${t}`, linkedTo: t,
              });
            }
            update((d) => { d.devices.push(...created); });
            setDone(created.map((c) => c.tracking));
          }}>
            <RequiredLegend />
            <fieldset>
              <legend className="mb-2"><FieldLabel required>Type d'appareil</FieldLabel></legend>
              <div className="flex flex-wrap gap-2">{DEVICE_TYPES.map((t) => (
                <button type="button" key={t} aria-pressed={f.type === t} onClick={() => changeType(t)} className={`btn !py-2 ${f.type === t ? "btn-primary" : "btn-ghost"}`}>{t}</button>))}</div>
              {f.type === "Tour" && <p className="text-sm text-muted-foreground mt-2">Une tour n'inclut pas d'écran. Si vous donnez aussi un écran, ajoutez-le plus bas : il sera suivi comme un périphérique.</p>}
            </fieldset>

            {f.type === "Périphérique" && (
              <label>
                <FieldLabel>Catégorie de périphérique</FieldLabel>
                <select className="field mt-1" value={f.category} onChange={(e) => setF((p) => ({ ...p, category: e.target.value, brandChoice: "", brandOther: "" }))}>
                  <option value="">Choisir une catégorie…</option>
                  {PERIPHERAL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <BrandField brands={brandsFor(f.type, f.category)} choice={f.brandChoice} other={f.brandOther} onChoice={(v) => set("brandChoice", v)} onOther={(v) => set("brandOther", v)} />
              <label>
                <FieldLabel required>Référence / modèle</FieldLabel>
                <input required className="field mt-1" list="known-refs" placeholder="ex. ThinkPad T480" value={f.ref} onChange={(e) => set("ref", e.target.value)} />
                <datalist id="known-refs">{knownRefs.map((r) => <option key={r} value={r} />)}</datalist>
              </label>
              <label>
                <FieldLabel>Durée d'utilisation</FieldLabel>
                <select className="field mt-1" value={f.age} onChange={(e) => set("age", e.target.value)}>
                  <option value="">Choisir…</option>
                  {AGE_OPTIONS.map((a) => <option key={a}>{a}</option>)}
                </select>
              </label>
              {isPC && (
                <label>
                  <FieldLabel>Processeur</FieldLabel>
                  <select className="field mt-1" value={f.cpu} onChange={(e) => set("cpu", e.target.value)}>
                    <option value="">Choisir…</option>
                    {CPU_OPTIONS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
              )}
            </div>

            <fieldset className="grid sm:grid-cols-2 gap-4"><legend className="mb-2"><FieldLabel>État visuel et technique</FieldLabel></legend>
              <YesNo label={isPC ? "S'allume-t-il ?" : "Fonctionne-t-il ?"} value={f.powersOn} onChange={(v) => set("powersOn", v)} />
              {(f.type === "PC portable" || isScreen) && <YesNo label="L'écran est-il intact ?" value={f.screenOk} onChange={(v) => set("screenOk", v)} />}
            </fieldset>

            {f.type === "Tour" && (
              <fieldset className="grid gap-4 rounded-xl border-2 border-dashed p-4">
                <label className="flex gap-2 items-center font-semibold">
                  <input type="checkbox" checked={f.withScreen} onChange={(e) => set("withScreen", e.target.checked)} /> Je donne aussi un écran avec cette tour
                </label>
                {f.withScreen && (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <BrandField label="Marque de l'écran" brands={brandsFor("Périphérique", "Écran")} choice={f.screenBrandChoice} other={f.screenBrandOther} onChoice={(v) => set("screenBrandChoice", v)} onOther={(v) => set("screenBrandOther", v)} />
                    <label><FieldLabel required>Référence de l'écran</FieldLabel><input required className="field mt-1" placeholder="ex. P2219H" value={f.screenRef} onChange={(e) => set("screenRef", e.target.value)} /></label>
                    <YesNo label="L'écran fonctionne-t-il et est-il intact ?" value={f.screenWorks} onChange={(v) => set("screenWorks", v)} />
                  </div>
                )}
              </fieldset>
            )}

            <label><FieldLabel>Remarques</FieldLabel><textarea className="field mt-1" rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></label>
            <button className="btn btn-accent">Confirmer le don</button>
          </form>
        )}
      </RequireLogin>
    </Page>
  );
}
