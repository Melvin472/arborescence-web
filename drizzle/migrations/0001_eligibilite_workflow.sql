-- =====================================================================
-- 0001 : compte unique, éligibilité, workflow des demandes avec refus,
--        notifications, messages de contact, avis utilisateurs.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Compte unique
--    Un compte non gestionnaire peut à la fois donner et demander.
--    Deux profils seulement : Particulier ou Organisation.
-- ---------------------------------------------------------------------
UPDATE public.profiles p
   SET profile = CASE WHEN p.profile IN ('Association', 'École', 'Organisation') THEN 'Organisation' ELSE 'Particulier' END
 WHERE NOT public.has_role(p.id, 'admin');
UPDATE public.profiles p SET profile = NULL WHERE public.has_role(p.id, 'admin');

CREATE OR REPLACE FUNCTION public.is_member(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND NOT public.has_role(_uid, 'admin')
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r text := coalesce(NEW.raw_user_meta_data->>'role', 'donateur');
  p text := NEW.raw_user_meta_data->>'profile';
BEGIN
  IF r = 'admin' THEN
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
      RAISE EXCEPTION 'Un compte gestionnaire existe déjà.';
    END IF;
  ELSE
    r := 'donateur'; -- rôle technique unique pour tous les utilisateurs
  END IF;
  INSERT INTO public.profiles (id, email, name, profile)
  VALUES (NEW.id, lower(NEW.email), coalesce(NEW.raw_user_meta_data->>'name', ''),
          CASE WHEN r = 'admin' THEN NULL WHEN p = 'Organisation' THEN 'Organisation' ELSE 'Particulier' END);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, r::public.app_role);
  RETURN NEW;
END $$;

-- Un utilisateur ne peut modifier que son nom (le profil et l'e-mail sont gérés par le système).
CREATE OR REPLACE FUNCTION public.guard_profile_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' AND (NEW.email <> OLD.email OR NEW.profile IS DISTINCT FROM OLD.profile OR NEW.id <> OLD.id) THEN
    RAISE EXCEPTION 'Modification non autorisée.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS profiles_guard ON public.profiles;
CREATE TRIGGER profiles_guard BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_update();

-- Changement d'adresse e-mail confirmé : on répercute la nouvelle adresse.
CREATE OR REPLACE FUNCTION public.handle_user_email_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles SET email = lower(NEW.email) WHERE id = NEW.id;
    UPDATE public.devices SET owner = lower(NEW.email) WHERE owner_id = NEW.id;
    UPDATE public.requests SET owner = lower(NEW.email) WHERE owner_id = NEW.id;
    UPDATE public.eligibilities SET owner = lower(NEW.email) WHERE owner_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------
-- 2. Notifications (messages affichés sur le site)
-- ---------------------------------------------------------------------
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (read) ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications read" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own notifications mark read" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.notify(_uid uuid, _title text, _body text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notifications (user_id, title, body) VALUES (_uid, _title, _body)
$$;
REVOKE EXECUTE ON FUNCTION public.notify(uuid, text, text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Éligibilité
-- ---------------------------------------------------------------------
CREATE TABLE public.eligibilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  owner text NOT NULL,
  profile text NOT NULL CHECK (profile IN ('Particulier', 'Organisation')),
  justif_type text NOT NULL,
  org_type text,
  org_name text,
  siret text CHECK (siret IS NULL OR siret ~ '^[0-9]{14}$'),
  siret_verified boolean NOT NULL DEFAULT false,
  project text NOT NULL DEFAULT '',
  participants int CHECK (participants IS NULL OR participants >= 1),
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'validee', 'refusee')),
  valid_until date,
  decision_message text NOT NULL DEFAULT '',
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eligibilities_validity CHECK (status <> 'validee' OR valid_until IS NOT NULL),
  CONSTRAINT eligibilities_refusal_message CHECK (status <> 'refusee' OR decision_message <> '')
);
GRANT SELECT, INSERT, UPDATE ON public.eligibilities TO authenticated;
GRANT ALL ON public.eligibilities TO service_role;
ALTER TABLE public.eligibilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin read eligibility" ON public.eligibilities FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "member submits eligibility" ON public.eligibilities FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid() AND public.is_member(auth.uid()) AND status = 'en_attente'
    AND valid_until IS NULL AND decided_at IS NULL AND decision_message = ''
    AND profile = (SELECT p.profile FROM public.profiles p WHERE p.id = auth.uid())
    AND NOT EXISTS (SELECT 1 FROM public.eligibilities e WHERE e.owner_id = auth.uid() AND e.status = 'en_attente')
  );
CREATE POLICY "admin decides eligibility" ON public.eligibilities FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.is_eligible(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.eligibilities WHERE owner_id = _uid AND status = 'validee' AND valid_until >= current_date)
$$;

-- Message automatique au demandeur quand le gestionnaire valide ou refuse.
CREATE OR REPLACE FUNCTION public.on_eligibility_decided()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'validee' THEN
      PERFORM public.notify(NEW.owner_id, 'Éligibilité validée',
        format('Bonne nouvelle : votre éligibilité est validée jusqu''au %s. Vous pouvez dès maintenant faire une demande de matériel.', to_char(NEW.valid_until, 'DD/MM/YYYY'))
        || CASE WHEN NEW.decision_message <> '' THEN E'\n\nMessage du gestionnaire : ' || NEW.decision_message ELSE '' END);
    ELSIF NEW.status = 'refusee' THEN
      PERFORM public.notify(NEW.owner_id, 'Éligibilité refusée',
        'Votre demande d''éligibilité n''a pas été acceptée.' || E'\n\nMessage du gestionnaire : ' || NEW.decision_message);
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER eligibilities_decided AFTER UPDATE ON public.eligibilities
  FOR EACH ROW EXECUTE FUNCTION public.on_eligibility_decided();

-- La synchronisation d'e-mail (étape 1) référence eligibilities : on crée son déclencheur maintenant.
DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
CREATE TRIGGER on_auth_user_email_changed AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_email_change();

-- ---------------------------------------------------------------------
-- 4. Matériel : commentaire de mise en ligne ; le gestionnaire ne donne pas
-- ---------------------------------------------------------------------
ALTER TABLE public.devices ADD COLUMN comment text NOT NULL DEFAULT '';

DROP POLICY IF EXISTS "donor declares device" ON public.devices;
CREATE POLICY "member declares device" ON public.devices FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND status = 'enregistre' AND public.is_member(auth.uid()));

-- ---------------------------------------------------------------------
-- 5. Demandes : système d'exploitation, refus motivé, workflow strict
-- ---------------------------------------------------------------------
ALTER TABLE public.requests
  ADD COLUMN os_pref text NOT NULL DEFAULT 'Pas de préférence',
  ADD COLUMN refusal_reason text,
  ADD COLUMN refusal_message text NOT NULL DEFAULT '';
ALTER TABLE public.requests DROP CONSTRAINT IF EXISTS requests_status_check;
ALTER TABLE public.requests ADD CONSTRAINT requests_status_check
  CHECK (status IN ('recue', 'validee', 'expediee', 'livree', 'annulee', 'refusee'));
ALTER TABLE public.requests ADD CONSTRAINT requests_os_pref_check
  CHECK (os_pref IN ('Linux', 'Windows', 'Pas de préférence'));

DROP POLICY IF EXISTS "beneficiary creates own request" ON public.requests;
CREATE POLICY "eligible member creates own request" ON public.requests FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND public.is_member(auth.uid()) AND public.is_eligible(auth.uid())
              AND status = 'recue' AND device_ids = '{}' AND refusal_reason IS NULL);

CREATE OR REPLACE FUNCTION public.guard_request_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_admin boolean := public.has_role(auth.uid(), 'admin');
BEGIN
  IF auth.uid() IS NOT NULL AND NOT is_admin THEN
    -- Le demandeur peut seulement gérer ses notifications ou annuler une demande reçue/approuvée.
    IF NEW.tracking <> OLD.tracking OR NEW.owner_id <> OLD.owner_id OR NEW.device_type <> OLD.device_type
       OR NEW.category IS DISTINCT FROM OLD.category OR NEW.quantity <> OLD.quantity OR NEW.need <> OLD.need
       OR NEW.details <> OLD.details OR NEW.profile <> OLD.profile OR NEW.os_pref <> OLD.os_pref
       OR NEW.refusal_reason IS DISTINCT FROM OLD.refusal_reason OR NEW.refusal_message <> OLD.refusal_message THEN
      RAISE EXCEPTION 'Modification non autorisée.';
    END IF;
    IF NEW.status <> OLD.status AND NOT (NEW.status = 'annulee' AND OLD.status IN ('recue', 'validee')) THEN
      RAISE EXCEPTION 'Seule l''annulation d''une demande reçue ou approuvée est possible.';
    END IF;
    IF NEW.status <> 'annulee' AND NEW.device_ids <> OLD.device_ids THEN
      RAISE EXCEPTION 'Modification non autorisée.';
    END IF;
  END IF;

  IF auth.uid() IS NOT NULL AND is_admin THEN
    -- Workflow étape par étape : reçue → approuvée → expédiée → livrée (refus possible avant expédition).
    IF NEW.status <> OLD.status AND NOT (
         (OLD.status = 'recue' AND NEW.status IN ('validee', 'refusee', 'annulee'))
      OR (OLD.status = 'validee' AND NEW.status IN ('expediee', 'refusee', 'annulee'))
      OR (OLD.status = 'expediee' AND NEW.status = 'livree')
    ) THEN
      RAISE EXCEPTION 'Étape non autorisée (% → %).', OLD.status, NEW.status;
    END IF;
    IF NEW.status = 'expediee' AND OLD.status <> 'expediee' AND cardinality(NEW.device_ids) < NEW.quantity THEN
      RAISE EXCEPTION 'La commande doit être complète avant l''expédition.';
    END IF;
    IF NEW.status = 'refusee' AND coalesce(NEW.refusal_reason, '') = '' THEN
      RAISE EXCEPTION 'Indiquez un motif de refus.';
    END IF;
    IF NEW.device_ids <> OLD.device_ids AND NEW.status NOT IN ('annulee', 'refusee') AND OLD.status <> 'validee' THEN
      RAISE EXCEPTION 'Le matériel ne peut être attribué qu''à une demande approuvée.';
    END IF;
  END IF;

  -- Annulation ou refus : le matériel attribué retourne au catalogue.
  IF NEW.status IN ('annulee', 'refusee') AND OLD.status NOT IN ('annulee', 'refusee') THEN
    UPDATE public.devices SET status = 'disponible' WHERE id = ANY(OLD.device_ids);
    NEW.device_ids := '{}';
  ELSIF NEW.status = 'expediee' AND OLD.status <> 'expediee' THEN
    UPDATE public.devices SET status = 'expedie' WHERE id = ANY(NEW.device_ids);
  ELSIF NEW.status = 'livree' AND OLD.status <> 'livree' THEN
    UPDATE public.devices SET status = 'demande' WHERE id = ANY(NEW.device_ids);
  END IF;
  RETURN NEW;
END $$;

-- Messages automatiques au demandeur à chaque étape.
CREATE OR REPLACE FUNCTION public.on_request_status_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'validee' THEN
      PERFORM public.notify(NEW.owner_id, format('Demande %s approuvée', NEW.tracking),
        'Votre demande a été approuvée. L''équipe prépare le matériel qui vous sera attribué.');
    ELSIF NEW.status = 'refusee' THEN
      PERFORM public.notify(NEW.owner_id, format('Demande %s refusée', NEW.tracking),
        'Motif : ' || NEW.refusal_reason
        || CASE WHEN NEW.refusal_message <> '' THEN E'\n\nMessage du gestionnaire : ' || NEW.refusal_message ELSE '' END);
    ELSIF NEW.status = 'expediee' THEN
      PERFORM public.notify(NEW.owner_id, format('Demande %s expédiée', NEW.tracking), 'Votre matériel est en route.');
    ELSIF NEW.status = 'livree' THEN
      PERFORM public.notify(NEW.owner_id, format('Demande %s livrée', NEW.tracking),
        'Votre matériel a été livré. N''hésitez pas à laisser un avis depuis votre profil !');
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER requests_status_notify AFTER UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.on_request_status_changed();

-- ---------------------------------------------------------------------
-- 6. Messages de contact
-- ---------------------------------------------------------------------
CREATE TABLE public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL CHECK (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$'),
  subject text NOT NULL,
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 5000),
  handled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.contact_messages TO anon, authenticated;
GRANT SELECT, UPDATE ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO service_role;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone sends contact message" ON public.contact_messages FOR INSERT TO anon, authenticated
  WITH CHECK (handled = false AND (user_id IS NULL OR user_id = auth.uid()));
CREATE POLICY "admin reads contact messages" ON public.contact_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin handles contact messages" ON public.contact_messages FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------
-- 7. Avis des utilisateurs (publiés après modération)
-- ---------------------------------------------------------------------
CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  author text NOT NULL CHECK (char_length(author) BETWEEN 1 AND 60),
  message text NOT NULL CHECK (char_length(message) BETWEEN 10 AND 500),
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feedback TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read published or own feedback" ON public.feedback FOR SELECT TO anon, authenticated
  USING (approved OR user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "member writes feedback" ON public.feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND approved = false AND public.is_member(auth.uid()));
CREATE POLICY "admin moderates feedback" ON public.feedback FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own or admin deletes feedback" ON public.feedback FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------
-- 8. Statistiques publiques (page d'accueil, visibles sans compte)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_stats()
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'pcs_sent', (SELECT count(*) FROM public.devices WHERE status IN ('expedie', 'demande') AND type IN ('PC portable', 'Tour'))
  )
$$;
GRANT EXECUTE ON FUNCTION public.public_stats() TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 9. Stockage privé des justificatifs (un dossier par utilisateur)
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('justificatifs', 'justificatifs', false, 5242880, ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "upload own justificatifs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'justificatifs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "read own or admin justificatifs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'justificatifs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));
