-- =====================================================================
-- 0002 : étoiles sur les avis, date de chaque étape des demandes,
--        informations SIRET vérifiées, suppression des justificatifs
--        une fois le dossier d'éligibilité traité (RGPD).
-- Script rejouable : il peut être exécuté plusieurs fois sans erreur.
-- =====================================================================

-- 1. Avis : note de 1 à 5 étoiles
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS rating smallint NOT NULL DEFAULT 5;
ALTER TABLE public.feedback DROP CONSTRAINT IF EXISTS feedback_rating_check;
ALTER TABLE public.feedback ADD CONSTRAINT feedback_rating_check CHECK (rating BETWEEN 1 AND 5);

-- 2. Demandes : date de chaque étape, pour la frise de suivi
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

CREATE OR REPLACE FUNCTION public.stamp_request_steps()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'validee' THEN NEW.approved_at := now();
    ELSIF NEW.status = 'expediee' THEN NEW.shipped_at := now();
    ELSIF NEW.status = 'livree' THEN NEW.delivered_at := now();
    ELSIF NEW.status IN ('annulee', 'refusee') THEN NEW.closed_at := now();
    END IF;
  ELSE
    -- Ces dates ne sont écrites que par le système.
    NEW.approved_at := OLD.approved_at; NEW.shipped_at := OLD.shipped_at;
    NEW.delivered_at := OLD.delivered_at; NEW.closed_at := OLD.closed_at;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS requests_stamp_steps ON public.requests;
CREATE TRIGGER requests_stamp_steps BEFORE UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.stamp_request_steps();

-- 3. Éligibilité : informations officielles du SIRET et purge des justificatifs
ALTER TABLE public.eligibilities
  ADD COLUMN IF NOT EXISTS siret_details jsonb,
  ADD COLUMN IF NOT EXISTS documents_deleted_at timestamptz;

-- Le gestionnaire peut supprimer les justificatifs après sa décision.
DROP POLICY IF EXISTS "admin deletes justificatifs" ON storage.objects;
CREATE POLICY "admin deletes justificatifs" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'justificatifs' AND public.has_role(auth.uid(), 'admin'));

-- Recharge le schéma pour que le site voie les nouvelles colonnes.
NOTIFY pgrst, 'reload schema';
