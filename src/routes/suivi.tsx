import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Badge, Page, RequireLogin, ToneLegend, toneBg } from "@/components/Layout";
import {
  cancelRequest, deviceLabel, deviceTone, fmtDate, requestLabel, requestTone, statusLabel, STATUSES, useDB,
  type Device, type Request,
} from "@/lib/store";

export const Route = createFileRoute("/suivi")({
  head: () => ({ meta: [{ title: "Mes dons et demandes — Reboot Solidaire" }, { name: "description", content: "Statut, historique et notifications de vos dons et demandes." }, { property: "og:title", content: "Mes dons et demandes" }, { property: "og:description", content: "Statut, historique, notifications." }] }),
  component: Suivi,
});

function Suivi() {
  return (
    <Page title="Mes dons et demandes" intro="Suivez l'avancement de vos dons de matériel et de vos demandes d'équipement.">
      <RequireLogin roles={["utilisateur"]}><SuiviContent /></RequireLogin>
    </Page>
  );
}

function SuiviContent() {
  const { db } = useDB();
  const [q, setQ] = useState("");
  const u = db.user!;
  const norm = q.trim().toUpperCase();
  const has = (...vals: (string | undefined)[]) => vals.some((v) => v && v.toUpperCase().includes(norm));
  const myReqs = db.requests.filter((r) => r.owner === u.email);
  const myDons = db.devices.filter((d) => d.owner === u.email);
  const reqs = (norm ? myReqs.filter((r) => has(r.tracking, r.deviceType, r.category, r.need)) : myReqs).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const dons = (norm ? myDons.filter((d) => has(d.tracking, d.brand, d.ref, d.type, d.category)) : myDons).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      {myDons.length > 0 && !norm && <DonorDashboard devices={myDons} />}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <form className="flex flex-wrap items-end gap-2 max-w-xl flex-1" onSubmit={(e) => e.preventDefault()} role="search">
          <label className="flex-1 min-w-60"><span className="font-semibold">Rechercher</span>
            <input className="field mt-1" placeholder="N° de suivi (DON-1234, DEM-1234), marque, modèle…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          {q && <button type="button" className="btn btn-ghost !py-2" onClick={() => setQ("")}>Effacer</button>}
        </form>
        <ToneLegend />
      </div>
      {norm && <p className="text-sm text-muted-foreground mt-2">{reqs.length + dons.length} résultat(s) pour « {q.trim()} ».</p>}

      <h2 className="text-2xl font-bold mt-10 mb-4">Mes demandes de matériel</h2>
      <div className="grid gap-4">
        {reqs.map((r) => <RequestCard key={r.id} r={r} />)}
        {!reqs.length && (
          <p className="text-muted-foreground">{norm ? "Aucune demande ne correspond à votre recherche." : <>Aucune demande. <Link to="/demande" className="underline">Faire une demande</Link></>}</p>
        )}
      </div>

      <h2 className="text-2xl font-bold mt-10 mb-4">Mes dons</h2>
      <div className="grid gap-3">
        {dons.map((d) => (
          <div key={d.id} className="card-soft p-5 flex flex-wrap justify-between items-center gap-2">
            <span><b>{d.tracking}</b> — {deviceLabel(d)} <span className="text-sm text-muted-foreground">· déclaré le {fmtDate(d.createdAt)}</span></span>
            <Badge tone={deviceTone[d.status]}>{statusLabel.utilisateur[d.status]}</Badge>
          </div>
        ))}
        {!dons.length && (
          <p className="text-muted-foreground">{norm ? "Aucun don ne correspond à votre recherche." : <>Aucun don. <Link to="/don" className="underline">Faire un don</Link></>}</p>
        )}
      </div>
    </>
  );
}

const STEPS = [
  ["recue", "Reçue"], ["validee", "Approuvée"], ["attribuee", "Matériel attribué"], ["expediee", "Expédiée"], ["livree", "Livrée"],
] as const;

function stepIndex(r: Request) {
  if (r.status === "livree") return 4;
  if (r.status === "expediee") return 3;
  if (r.status === "validee") return r.deviceIds.length >= r.quantity ? 2 : 1;
  return 0;
}

function RequestCard({ r }: { r: Request }) {
  const { db, update } = useDB();
  const i = stepIndex(r);
  const assigned = r.deviceIds.map((id) => db.devices.find((d) => d.id === id)).filter((d): d is Device => !!d);
  const canCancel = r.status === "recue" || r.status === "validee";
  const closed = r.status === "annulee" || r.status === "refusee";
  return (
    <div className="card-soft p-6">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <span className="flex items-center gap-3"><b className="font-display text-xl">{r.tracking}</b><Badge tone={requestTone[r.status]}>{requestLabel[r.status]}</Badge></span>
        <span className="text-sm text-muted-foreground">Demandée le {fmtDate(r.createdAt)}</span>
      </div>
      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1 mt-3 text-sm">
        <div><dt className="inline font-semibold">Matériel demandé : </dt><dd className="inline">{r.quantity} × {r.category ?? r.deviceType}</dd></div>
        {r.deviceType !== "Périphérique" && <div><dt className="inline font-semibold">Système : </dt><dd className="inline">{r.osPref}</dd></div>}
        <div><dt className="inline font-semibold">Usage : </dt><dd className="inline">{r.need}</dd></div>
        {!closed && (
          <div className="sm:col-span-2"><dt className="inline font-semibold">Matériel attribué : </dt>
            <dd className="inline">{assigned.length ? assigned.map((d) => `${deviceLabel(d)}${d.ram ? ` (${d.ram}, ${d.disk}, ${d.os})` : ""}`).join(", ") : "en attente d'attribution par l'équipe"}</dd>
          </div>
        )}
        {r.details && <div className="sm:col-span-2"><dt className="inline font-semibold">Précisions : </dt><dd className="inline">{r.details}</dd></div>}
      </dl>

      {r.status === "refusee" ? (
        <div className="mt-4 rounded-xl bg-destructive/10 p-4 text-sm">
          <p className="font-semibold text-destructive">Demande refusée : {r.refusalReason}</p>
          {r.refusalMessage && <p className="mt-1 whitespace-pre-line">Message du gestionnaire : {r.refusalMessage}</p>}
          <p className="mt-2 text-muted-foreground">Une question ? <Link to="/contact" className="underline">Contactez-nous</Link>.</p>
        </div>
      ) : r.status === "annulee" ? (
        <p className="mt-4 text-sm text-muted-foreground">Vous avez annulé cette demande.</p>
      ) : (
        <ol className="grid grid-cols-5 gap-2 mt-4" aria-label="Avancement de la demande">
          {STEPS.map(([k, l], n) => (
            <li key={k} aria-current={n === i ? "step" : undefined}
              className={`text-xs font-semibold p-2 rounded-lg text-center ${n < i ? toneBg.success : n === i ? toneBg[requestTone[r.status]] : toneBg.muted}`}>
              {l}
            </li>
          ))}
        </ol>
      )}

      {!closed && (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
          <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={r.notifications} onChange={(e) => update((d) => { const x = d.requests.find((y) => y.id === r.id); if (x) x.notifications = e.target.checked; })} /> Recevoir les mises à jour par e-mail</label>
          {canCancel && (
            <button className="btn btn-ghost !py-1.5 text-sm" onClick={() => { if (confirm(`Annuler la demande ${r.tracking} ?`)) update((d) => cancelRequest(d, r.id)); }}>Annuler la demande</button>
          )}
        </div>
      )}
    </div>
  );
}

function DonorDashboard({ devices }: { devices: Device[] }) {
  const count = (...s: Device["status"][]) => devices.filter((d) => s.includes(d.status)).length;
  const distributed = count("demande");
  const tiles: [string, number][] = [
    ["Appareils donnés", devices.length],
    ["En cours de traitement", count("enregistre", "diagnostic")],
    ["Reconditionnés", count("disponible", "reserve", "expedie", "demande")],
    ["Distribués", distributed],
  ];
  const byType = Object.entries(devices.reduce<Record<string, number>>((acc, d) => { const k = d.category ?? d.type; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]);
  const pct = (n: number) => `${Math.round((n / devices.length) * 100)}%`;

  return (
    <section aria-labelledby="dash-title" className="mb-10">
      <h2 id="dash-title" className="text-2xl font-bold mb-4">Mon impact</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tiles.map(([l, n]) => (
          <div key={l} className="card-soft p-5">
            <div className="font-display text-4xl font-bold text-accent">{n}</div>
            <div className="text-sm font-semibold mt-1">{l}</div>
          </div>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <div className="card-soft p-5">
          <h3 className="font-semibold mb-3">Où en sont mes dons ?</h3>
          <ul className="grid gap-2">
            {STATUSES.map((s) => { const n = count(s); return n ? (
              <li key={s} className="text-sm">
                <div className="flex justify-between"><span>{statusLabel.utilisateur[s]}</span><span className="font-semibold">{n}</span></div>
                <div className="h-2 rounded-full bg-muted mt-1"><div className={`h-2 rounded-full ${toneBg[deviceTone[s]]}`} style={{ width: pct(n) }} /></div>
              </li>
            ) : null; })}
          </ul>
        </div>
        <div className="card-soft p-5">
          <h3 className="font-semibold mb-3">Par type de matériel</h3>
          <ul className="grid gap-2">
            {byType.map(([t, n]) => (
              <li key={t} className="text-sm">
                <div className="flex justify-between"><span>{t}</span><span className="font-semibold">{n}</span></div>
                <div className="h-2 rounded-full bg-muted mt-1"><div className="h-2 rounded-full bg-accent" style={{ width: pct(n) }} /></div>
              </li>
            ))}
          </ul>
          {distributed > 0 && <p className="text-sm text-muted-foreground mt-4">Grâce à vous, {distributed} appareil{distributed > 1 ? "s ont" : " a"} déjà trouvé une seconde vie.</p>}
        </div>
      </div>
    </section>
  );
}
