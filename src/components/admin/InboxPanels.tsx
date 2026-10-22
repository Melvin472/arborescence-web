import { Badge, Stars } from "@/components/Layout";
import { deleteFeedback, fmtDate, moderateFeedback, setContactHandled, useDB } from "@/lib/store";

export function MessagesPanel() {
  const { db } = useDB();
  const list = [...db.contacts].sort((a, b) => Number(a.handled) - Number(b.handled) || b.createdAt.localeCompare(a.createdAt));
  return (
    <div className="grid gap-3">
      {list.map((m) => (
        <div key={m.id} className={`card-soft p-5 ${m.handled ? "opacity-70" : ""}`}>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={m.handled ? "success" : "warning"}>{m.handled ? "Traité" : "À traiter"}</Badge>
            <b>{m.subject}</b>
            <span className="text-sm">{m.email}</span>
            <span className="text-sm text-muted-foreground ml-auto">{fmtDate(m.createdAt)}</span>
          </div>
          <p className="mt-3 text-sm whitespace-pre-line">{m.message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a className="btn btn-primary !py-1.5 text-sm" href={`mailto:${m.email}?subject=${encodeURIComponent(`Re : ${m.subject}`)}`}>Répondre par e-mail</a>
            <button className="btn btn-ghost !py-1.5 text-sm" onClick={() => setContactHandled(m.id, !m.handled)}>{m.handled ? "Marquer à traiter" : "Marquer comme traité"}</button>
          </div>
        </div>
      ))}
      {!list.length && <p className="text-muted-foreground">Aucun message reçu.</p>}
    </div>
  );
}

export function FeedbackPanel() {
  const { db } = useDB();
  const list = [...db.feedback].sort((a, b) => Number(a.approved) - Number(b.approved) || b.createdAt.localeCompare(a.createdAt));
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">Seuls les avis publiés apparaissent dans le bandeau de la page d'accueil.</p>
      {list.map((f) => (
        <div key={f.id} className="card-soft p-5">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={f.approved ? "success" : "warning"}>{f.approved ? "Publié" : "En attente"}</Badge>
            <b>{f.author}</b>
            <Stars value={f.rating} />
            <span className="text-sm text-muted-foreground ml-auto">{fmtDate(f.createdAt)}</span>
          </div>
          <p className="mt-2 text-sm">« {f.message} »</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn btn-primary !py-1.5 text-sm" onClick={() => moderateFeedback(f.id, !f.approved)}>{f.approved ? "Retirer de l'accueil" : "Publier"}</button>
            <button className="btn btn-ghost !py-1.5 text-sm" onClick={() => { if (confirm("Supprimer définitivement cet avis ?")) deleteFeedback(f.id); }}>Supprimer</button>
          </div>
        </div>
      ))}
      {!list.length && <p className="text-muted-foreground">Aucun avis pour le moment.</p>}
    </div>
  );
}
