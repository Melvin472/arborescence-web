<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project rules

- All app data (devices, requests, profiles, roles) lives in Lovable Cloud; `src/lib/store.ts` exposes `useDB()` whose `update(fn)` diffs the in-memory snapshot and writes inserted/changed rows — keeps page code simple while RLS and triggers enforce permissions.
- Roles live in `public.user_roles` (set by the signup trigger; only the first "admin" signup is accepted) — never trust client-side role claims.
- Request cancellation side-effects (freeing devices) run in the `guard_request_update` DB trigger, because beneficiaries cannot update devices under RLS.
- One user account type: any non-admin account can donate and request (`public.is_member`); the profile is "Particulier" or "Organisation". The internal `app_role` value for users stays `donateur`.
- Requests require a valid eligibility (`public.is_eligible`, table `eligibilities`, validated by the admin with an expiry date). Justificatifs live in the private `justificatifs` storage bucket, one folder per user id.
- The request workflow (recue → validee → expediee → livree, refus motivé before shipping) is enforced in `guard_request_update`; automatic user messages are inserted into `notifications` by DB triggers.
- Schema changes go in a new file under `drizzle/migrations/` registered in `meta/_journal.json`.
