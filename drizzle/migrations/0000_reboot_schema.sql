CREATE TYPE public.app_role AS ENUM ('donateur', 'beneficiaire', 'admin');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL DEFAULT '',
  profile text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "own or admin read profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "own or admin read roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Création du profil et du rôle à l'inscription.
-- Le rôle gestionnaire n'est accordé qu'au tout premier compte qui le demande.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r text := coalesce(NEW.raw_user_meta_data->>'role', 'donateur');
BEGIN
  IF r = 'admin' THEN
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
      RAISE EXCEPTION 'Un compte gestionnaire existe déjà.';
    END IF;
  ELSIF r NOT IN ('donateur', 'beneficiaire') THEN
    r := 'donateur';
  END IF;
  INSERT INTO public.profiles (id, email, name, profile)
  VALUES (NEW.id, lower(NEW.email), coalesce(NEW.raw_user_meta_data->>'name', ''),
          CASE WHEN r = 'beneficiaire' THEN coalesce(NEW.raw_user_meta_data->>'profile', 'Particulier') END);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, r::public.app_role);
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking text NOT NULL UNIQUE,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  owner text NOT NULL,
  profile text NOT NULL,
  device_type text NOT NULL,
  category text,
  quantity int NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  need text NOT NULL DEFAULT '',
  details text NOT NULL DEFAULT '',
  device_ids uuid[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'recue' CHECK (status IN ('recue','validee','expediee','livree','annulee')),
  notifications boolean NOT NULL DEFAULT true,
  created_at date NOT NULL DEFAULT current_date
);
GRANT SELECT, INSERT, UPDATE ON public.requests TO authenticated;
GRANT ALL ON public.requests TO service_role;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin read requests" ON public.requests FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "beneficiary creates own request" ON public.requests FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND public.has_role(auth.uid(), 'beneficiaire') AND status = 'recue' AND device_ids = '{}');
CREATE POLICY "own or admin update request" ON public.requests FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking text NOT NULL UNIQUE,
  owner_id uuid DEFAULT auth.uid(),
  owner text NOT NULL,
  type text NOT NULL,
  category text,
  brand text NOT NULL,
  ref text NOT NULL DEFAULT '',
  age text NOT NULL DEFAULT '',
  cpu text NOT NULL DEFAULT '',
  powers_on boolean NOT NULL DEFAULT true,
  screen_ok boolean,
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'enregistre' CHECK (status IN ('enregistre','diagnostic','disponible','reserve','expedie','demande')),
  ram text, disk text, os text,
  linked_to text,
  created_at date NOT NULL DEFAULT current_date
);
GRANT SELECT, INSERT, UPDATE ON public.devices TO authenticated;
GRANT ALL ON public.devices TO service_role;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.device_assigned_to_me(_device_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.requests WHERE owner_id = auth.uid() AND _device_id = ANY(device_ids))
$$;

CREATE POLICY "read devices" ON public.devices FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR status = 'disponible' OR public.has_role(auth.uid(), 'admin') OR public.device_assigned_to_me(id));
CREATE POLICY "donor declares device" ON public.devices FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND status = 'enregistre' AND (public.has_role(auth.uid(), 'donateur') OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "admin updates device" ON public.devices FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Règles appliquées côté serveur sur les demandes :
-- un bénéficiaire ne peut que changer ses notifications ou annuler une demande reçue/validée ;
-- toute annulation remet le matériel attribué au catalogue.
CREATE OR REPLACE FUNCTION public.guard_request_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') AND auth.uid() IS NOT NULL THEN
    IF NEW.tracking <> OLD.tracking OR NEW.owner_id <> OLD.owner_id OR NEW.device_type <> OLD.device_type
       OR NEW.category IS DISTINCT FROM OLD.category OR NEW.quantity <> OLD.quantity OR NEW.need <> OLD.need
       OR NEW.details <> OLD.details OR NEW.profile <> OLD.profile THEN
      RAISE EXCEPTION 'Modification non autorisée.';
    END IF;
    IF NEW.status <> OLD.status AND NOT (NEW.status = 'annulee' AND OLD.status IN ('recue','validee')) THEN
      RAISE EXCEPTION 'Seule l''annulation d''une demande reçue ou validée est possible.';
    END IF;
    IF NEW.status <> 'annulee' AND NEW.device_ids <> OLD.device_ids THEN
      RAISE EXCEPTION 'Modification non autorisée.';
    END IF;
  END IF;
  IF NEW.status = 'annulee' AND OLD.status <> 'annulee' THEN
    UPDATE public.devices SET status = 'disponible' WHERE id = ANY(OLD.device_ids);
    NEW.device_ids := '{}';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER requests_guard BEFORE UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_request_update();

-- Matériel de démonstration
INSERT INTO public.devices (tracking, owner_id, owner, type, category, brand, ref, age, cpu, powers_on, screen_ok, notes, status, ram, disk, os, created_at, linked_to) VALUES
('DON-4821', NULL, 'donateur@demo.fr', 'PC portable', NULL, 'Lenovo', 'ThinkPad T480', '5 ans', 'Intel Core i5', true, true, '', 'disponible', '8 Go', 'SSD 256 Go', 'Linux Mint', '2026-09-12', NULL),
('DON-4822', NULL, 'donateur@demo.fr', 'Tour', NULL, 'Dell', 'OptiPlex 7050', '6 ans', 'Intel Core i5', true, NULL, '', 'disponible', '16 Go', 'SSD 512 Go', 'Windows 10', '2026-09-20', NULL),
('DON-4823', NULL, 'donateur@demo.fr', 'PC portable', NULL, 'HP', 'EliteBook 840 G5', '4 ans', 'Intel Core i7', true, false, 'Écran rayé', 'diagnostic', NULL, NULL, NULL, '2026-10-02', NULL),
('DON-4824', NULL, 'donateur@demo.fr', 'Périphérique', 'Clavier', 'Logitech', 'K120', '3 ans', '', true, NULL, '', 'enregistre', NULL, NULL, NULL, '2026-10-18', NULL),
('DON-4825', NULL, 'donateur@demo.fr', 'PC portable', NULL, 'Apple', 'MacBook Air 2017', '9 ans', 'Intel Core i5', true, true, '', 'disponible', '8 Go', 'SSD 128 Go', 'macOS', '2026-09-28', NULL),
('DON-4826', NULL, 'donateur@demo.fr', 'Périphérique', 'Écran', 'Dell', 'P2219H', '6 ans', '', true, true, 'Donné avec la tour DON-4822', 'disponible', NULL, NULL, NULL, '2026-09-20', 'DON-4822');