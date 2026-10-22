import { useState } from "react";
import { Badge } from "@/components/Layout";
import { StatusFilter } from "@/components/Status";
import { DISK_OPTIONS, OS_OPTIONS, RAM_OPTIONS } from "@/lib/referentiel";
import { deviceTone, statusLabel, STATUSES, useDB, type Device, type Status } from "@/lib/store";

export function DevicesPanel() {
  const { db, update } = useDB();
  const [fs, setFs] = useState<Status | "all">("all");
  const [fb, setFb] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const brands = Array.from(new Set(db.devices.map((d) => d.brand))).sort();
  const list = db.devices.filter((d) => (fs === "all" || d.status === fs) && (!fb || d.brand === fb));
  const patch = (id: string, p: Partial<Device>) => update((d) => { const x = d.devices.find((y) => y.id === id); if (x) Object.assign(x, p); });

  return (
    <>
      <div className="mb-4">
        <StatusFilter<Status> label="Filtrer le matériel par statut" value={fs} onChange={setFs} total={db.devices.length}
          items={STATUSES.map((s) => ({ key: s, label: statusLabel.admin[s], tone: deviceTone[s], count: db.devices.filter((d) => d.status === s).length }))} />
      </div>
      <label className="block max-w-xs mb-6"><span className="sr-only">Filtrer par marque</span>
        <select className="field" value={fb} onChange={(e) => setFb(e.target.value)}>
          <option value="">Toutes les marques</option>
          {brands.map((b) => <option key={b}>{b}</option>)}
        </select>
      </label>
      <div className="grid gap-3">
        {list.map((d) => (
          <div key={d.id} className="card-soft p-5">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={deviceTone[d.status]}>{statusLabel.admin[d.status]}</Badge>
              <b>{d.tracking}</b><span>{d.type}{d.category ? ` (${d.category})` : ""} · {d.brand} {d.ref}</span>
              <span className="text-sm text-muted-foreground">
                {[d.age, d.powersOn ? "fonctionne" : "ne fonctionne pas", d.screenOk === undefined ? null : `écran ${d.screenOk ? "OK" : "abîmé"}`, d.linkedTo ? `donné avec ${d.linkedTo}` : null, d.ram ? `${d.ram} · ${d.disk} · ${d.os}` : null].filter(Boolean).join(" · ")}
              </span>
              <div className="ml-auto flex gap-2">
                {d.status === "enregistre" && <button className="btn btn-primary !py-1.5" onClick={() => patch(d.id, { status: "diagnostic" })}>Réceptionner → Diagnostic</button>}
                {d.status === "diagnostic" && <button className="btn btn-accent !py-1.5" onClick={() => setEditing(editing === d.id ? null : d.id)}>Mettre en ligne</button>}
              </div>
            </div>
            {d.notes && <p className="text-sm mt-2"><span className="font-semibold">Remarque du donateur :</span> {d.notes}</p>}
            {d.comment && <p className="text-sm mt-1"><span className="font-semibold">Commentaire :</span> {d.comment}</p>}
            {editing === d.id && <PublishForm device={d} onDone={() => setEditing(null)} />}
          </div>
        ))}
        {!list.length && <p className="text-muted-foreground">Aucun matériel pour ce filtre.</p>}
      </div>
    </>
  );
}

function PublishForm({ device, onDone }: { device: Device; onDone: () => void }) {
  const { update } = useDB();
  const isPC = device.type !== "Périphérique";
  const [spec, setSpec] = useState({ ram: "", disk: "", os: "", comment: "" });
  return (
    <form className="grid gap-3 mt-4 rounded-xl bg-muted/50 p-4" onSubmit={(e) => {
      e.preventDefault();
      update((d) => {
        const x = d.devices.find((y) => y.id === device.id);
        if (!x) return;
        if (isPC) Object.assign(x, { ram: spec.ram, disk: spec.disk, os: spec.os });
        x.comment = spec.comment.trim();
        x.status = "disponible";
      });
      onDone();
    }}>
      {isPC && (
        <div className="grid sm:grid-cols-3 gap-3">
          {([["ram", "RAM", RAM_OPTIONS], ["disk", "Stockage", DISK_OPTIONS], ["os", "Système", OS_OPTIONS]] as const).map(([k, l, opts]) => (
            <label key={k}><span className="text-sm font-semibold">{l}<span className="text-destructive">*</span></span>
              <select required className="field mt-1" value={spec[k]} onChange={(e) => setSpec({ ...spec, [k]: e.target.value })}>
                <option value="">Choisir…</option>
                {opts.map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
          ))}
        </div>
      )}
      <label><span className="text-sm font-semibold">Commentaire</span> <span className="text-xs text-muted-foreground">(facultatif)</span>
        <textarea rows={2} className="field mt-1" placeholder="ex. batterie remplacée, légère rayure sur le capot…" value={spec.comment} onChange={(e) => setSpec({ ...spec, comment: e.target.value })} />
      </label>
      <div className="flex gap-2">
        <button className="btn btn-primary !py-2">Mettre au catalogue</button>
        <button type="button" className="btn btn-ghost !py-2" onClick={onDone}>Annuler</button>
      </div>
    </form>
  );
}
