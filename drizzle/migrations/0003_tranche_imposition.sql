-- =====================================================================
-- 0003 : éligibilité « revenus modestes » par simple déclaration de la
--        tranche d'imposition (aucun avis d'imposition n'est demandé).
-- Script rejouable : il peut être exécuté plusieurs fois sans erreur.
-- =====================================================================

ALTER TABLE public.eligibilities ADD COLUMN IF NOT EXISTS declared_tax_bracket text;
ALTER TABLE public.eligibilities DROP CONSTRAINT IF EXISTS eligibilities_tax_bracket_check;
ALTER TABLE public.eligibilities ADD CONSTRAINT eligibilities_tax_bracket_check
  CHECK (declared_tax_bracket IS NULL OR declared_tax_bracket IN ('0 %', '11 %', '30 %', '41 %', '45 %'));

-- Recharge le schéma pour que le site voie la nouvelle colonne.
NOTIFY pgrst, 'reload schema';
