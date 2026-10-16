-- ====================================================================
-- MIGRATION INITIALE — SAAS SUIVICOMER
-- Gestion des bons et suivi des chargements des agréés et commerciaux
-- ====================================================================

-- 1. EXTENSIONS & TYPES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLE PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('agree', 'secretaire', 'commercial')),
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. TABLE BUSINESSES
CREATE TABLE IF NOT EXISTS public.businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    address TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3b. TABLE CARRIERES (MULTI-CARRIERES PAR AGREÉ)
CREATE TABLE IF NOT EXISTS public.carrieres (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location TEXT,
    phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. TABLE BUSINESS_MEMBERS
CREATE TABLE IF NOT EXISTS public.business_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    carriere_id UUID REFERENCES public.carrieres(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('agree', 'secretaire', 'commercial')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    can_edit_payments BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (business_id, user_id)
);

-- 5. TABLE COMMERCIALS
CREATE TABLE IF NOT EXISTS public.commercials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    carriere_id UUID REFERENCES public.carrieres(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    access_code TEXT,
    pin TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. TABLE BON_RANGES
CREATE TABLE IF NOT EXISTS public.bon_ranges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    carriere_id UUID REFERENCES public.carrieres(id) ON DELETE CASCADE,
    commercial_id UUID NOT NULL REFERENCES public.commercials(id) ON DELETE CASCADE,
    start_num BIGINT NOT NULL,
    end_num BIGINT NOT NULL,
    total_count INT NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT valid_range CHECK (end_num >= start_num)
);

-- 7. TABLE LOADING_VOUCHERS
CREATE TABLE IF NOT EXISTS public.loading_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    carriere_id UUID REFERENCES public.carrieres(id) ON DELETE CASCADE,
    range_id UUID NOT NULL REFERENCES public.bon_ranges(id) ON DELETE CASCADE,
    commercial_id UUID NOT NULL REFERENCES public.commercials(id) ON DELETE CASCADE,
    voucher_number BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'disponible' CHECK (status IN ('disponible', 'utilise')),
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (business_id, voucher_number)
);

-- 8. TABLE LOADINGS
CREATE TABLE IF NOT EXISTS public.loadings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    carriere_id UUID REFERENCES public.carrieres(id) ON DELETE CASCADE,
    commercial_id UUID NOT NULL REFERENCES public.commercials(id) ON DELETE RESTRICT,
    voucher_id UUID NOT NULL REFERENCES public.loading_vouchers(id) ON DELETE RESTRICT,
    voucher_number BIGINT NOT NULL,
    loading_date DATE NOT NULL DEFAULT CURRENT_DATE,
    product TEXT NOT NULL CHECK (product IN ('Sable 0/5', 'Gravier 5/15', 'Gravier 15/25', 'Moellon')),
    truck_plate TEXT NOT NULL,
    client_name TEXT NOT NULL,
    tonnage NUMERIC(12, 2) NOT NULL CHECK (tonnage > 0),
    price_per_ton NUMERIC(12, 2) NOT NULL CHECK (price_per_ton >= 0),
    total_amount NUMERIC(14, 2) NOT NULL CHECK (total_amount >= 0),
    amount_paid NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0 AND amount_paid <= total_amount),
    payment_ref TEXT,
    sync_id TEXT NOT NULL UNIQUE,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (business_id, voucher_id)
);

-- Index pour optimiser les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_loadings_business ON public.loadings(business_id);
CREATE INDEX IF NOT EXISTS idx_loadings_commercial ON public.loadings(commercial_id);
CREATE INDEX IF NOT EXISTS idx_loadings_voucher_num ON public.loadings(voucher_number);
CREATE INDEX IF NOT EXISTS idx_loadings_truck_plate ON public.loadings(truck_plate);
CREATE INDEX IF NOT EXISTS idx_loadings_date ON public.loadings(loading_date);
CREATE INDEX IF NOT EXISTS idx_vouchers_comm_status ON public.loading_vouchers(commercial_id, status);
CREATE INDEX IF NOT EXISTS idx_vouchers_bus_num ON public.loading_vouchers(business_id, voucher_number);

-- ====================================================================
-- FONCTIONS D'INTÉGRITÉ ET TRANSACTIONS SÉCURISÉES (ATOMICITÉ)
-- ====================================================================

-- 1. Attribution atomique d'une plage de bons avec détection stricte des chevauchements
CREATE OR REPLACE FUNCTION public.attribute_bon_range(
    p_business_id UUID,
    p_commercial_id UUID,
    p_start_num BIGINT,
    p_end_num BIGINT,
    p_user_id UUID,
    p_carriere_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_count INT;
    v_new_range_id UUID;
    v_conflicting_count INT;
BEGIN
    -- Validation cohérence début / fin
    IF p_start_num <= 0 OR p_end_num < p_start_num THEN
        RAISE EXCEPTION 'PLAGE_INVALIDE: Le numéro de fin doit être supérieur ou égal au numéro de début (% -> %)', p_start_num, p_end_num;
    END IF;

    v_total_count := (p_end_num - p_start_num + 1)::INT;

    -- Vérification anti-chevauchement : aucun bon de la plage ne doit déjà exister dans l'entreprise
    SELECT COUNT(*)
    INTO v_conflicting_count
    FROM public.loading_vouchers
    WHERE business_id = p_business_id
      AND voucher_number BETWEEN p_start_num AND p_end_num;

    IF v_conflicting_count > 0 THEN
        RAISE EXCEPTION 'PLAGE_EN_CONFLIT: % bon(s) de cette plage existent déjà ou sont déjà attribués dans votre entreprise', v_conflicting_count;
    END IF;

    -- Création atomique de la plage
    INSERT INTO public.bon_ranges (
        business_id,
        carriere_id,
        commercial_id,
        start_num,
        end_num,
        total_count,
        created_by
    )
    VALUES (
        p_business_id,
        p_carriere_id,
        p_commercial_id,
        p_start_num,
        p_end_num,
        v_total_count,
        p_user_id
    )
    RETURNING id INTO v_new_range_id;

    -- Création de chaque bon individuel de la plage
    INSERT INTO public.loading_vouchers (
        business_id,
        carriere_id,
        range_id,
        commercial_id,
        voucher_number,
        status
    )
    SELECT
        p_business_id,
        p_carriere_id,
        v_new_range_id,
        p_commercial_id,
        s.num,
        'disponible'
    FROM generate_series(p_start_num, p_end_num) AS s(num);

    RETURN jsonb_build_object(
        'success', true,
        'range_id', v_new_range_id,
        'total_created', v_total_count
    );
END;
$$;

-- 2. Enregistrement atomique et idempotent d'un chargement
CREATE OR REPLACE FUNCTION public.record_loading(
    p_sync_id TEXT,
    p_business_id UUID,
    p_commercial_id UUID,
    p_voucher_id UUID,
    p_loading_date DATE,
    p_product TEXT,
    p_truck_plate TEXT,
    p_client_name TEXT,
    p_tonnage NUMERIC,
    p_price_per_ton NUMERIC,
    p_amount_paid NUMERIC,
    p_payment_ref TEXT,
    p_user_id UUID,
    p_carriere_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_voucher RECORD;
    v_total_amount NUMERIC(14,2);
    v_loading_id UUID;
    v_existing_id UUID;
BEGIN
    -- Idempotence : si l'opération avec ce sync_id a déjà été enregistrée
    SELECT id INTO v_existing_id
    FROM public.loadings
    WHERE sync_id = p_sync_id;

    IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'id', v_existing_id,
            'is_duplicate', true,
            'message', 'Chargement déjà synchronisé précédemment'
        );
    END IF;

    -- Calcul du montant total avec précision
    v_total_amount := ROUND((p_tonnage * p_price_per_ton)::numeric, 2);

    -- Validation financière
    IF p_tonnage <= 0 THEN
        RAISE EXCEPTION 'TONNAGE_INVALIDE: Le tonnage doit être strictement positif';
    END IF;

    IF p_price_per_ton < 0 THEN
        RAISE EXCEPTION 'PRIX_INVALIDE: Le prix par tonne ne peut pas être négatif';
    END IF;

    IF p_amount_paid < 0 OR p_amount_paid > v_total_amount THEN
        RAISE EXCEPTION 'MONTANT_PAYE_INVALIDE: Le montant payé doit être entre 0 et le montant total (%)', v_total_amount;
    END IF;

    -- Verrouillage et vérification du bon
    SELECT * INTO v_voucher
    FROM public.loading_vouchers
    WHERE id = p_voucher_id
      AND business_id = p_business_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'BON_INTROUVABLE: Le bon sélectionné n''existe pas dans cette entreprise';
    END IF;

    IF v_voucher.commercial_id != p_commercial_id THEN
        RAISE EXCEPTION 'COMMERCIAL_INVALIDE: Ce bon n''est pas attribué au commercial sélectionné';
    END IF;

    IF v_voucher.status != 'disponible' THEN
        RAISE EXCEPTION 'BON_DEJA_UTILISE: Le bon % a déjà été utilisé pour un autre chargement', v_voucher.voucher_number;
    END IF;

    -- Insertion du chargement
    INSERT INTO public.loadings (
        business_id,
        carriere_id,
        commercial_id,
        voucher_id,
        voucher_number,
        loading_date,
        product,
        truck_plate,
        client_name,
        tonnage,
        price_per_ton,
        total_amount,
        amount_paid,
        payment_ref,
        sync_id,
        created_by
    )
    VALUES (
        p_business_id,
        COALESCE(p_carriere_id, v_voucher.carriere_id),
        p_commercial_id,
        p_voucher_id,
        v_voucher.voucher_number,
        COALESCE(p_loading_date, CURRENT_DATE),
        p_product,
        UPPER(TRIM(p_truck_plate)),
        TRIM(p_client_name),
        p_tonnage,
        p_price_per_ton,
        v_total_amount,
        p_amount_paid,
        p_payment_ref,
        p_sync_id,
        p_user_id
    )
    RETURNING id INTO v_loading_id;

    -- Marquage atomique du bon comme utilisé
    UPDATE public.loading_vouchers
    SET status = 'utilise',
        used_at = now()
    WHERE id = p_voucher_id;

    RETURN jsonb_build_object(
        'success', true,
        'id', v_loading_id,
        'voucher_number', v_voucher.voucher_number,
        'total_amount', v_total_amount,
        'remaining_due', (v_total_amount - p_amount_paid),
        'is_duplicate', false
    );
END;
$$;

-- 3. Mise à jour sécurisée du paiement
CREATE OR REPLACE FUNCTION public.update_loading_payment(
    p_loading_id UUID,
    p_amount_paid NUMERIC,
    p_payment_ref TEXT,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_loading RECORD;
    v_member RECORD;
BEGIN
    SELECT * INTO v_loading
    FROM public.loadings
    WHERE id = p_loading_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'CHARGEMENT_INTROUVABLE: Le chargement spécifié n''existe pas';
    END IF;

    -- Vérification des permissions
    SELECT * INTO v_member
    FROM public.business_members
    WHERE business_id = v_loading.business_id
      AND user_id = p_user_id
      AND is_active = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'PERMISSION_REFUSEE: Utilisateur non membre ou inactif dans l''entreprise';
    END IF;

    IF v_member.role = 'commercial' THEN
        RAISE EXCEPTION 'COMMERCIAL_NON_AUTORISE: Les commerciaux ne sont pas autorisés à modifier les paiements';
    END IF;

    IF v_member.role = 'secretaire' AND v_member.can_edit_payments = false THEN
        RAISE EXCEPTION 'SECRETAIRE_NON_AUTORISE: La modification des paiements est désactivée pour ce secrétaire par l''agréé';
    END IF;

    -- Validation du montant
    IF p_amount_paid < 0 OR p_amount_paid > v_loading.total_amount THEN
        RAISE EXCEPTION 'MONTANT_INVALIDE: Le montant payé doit être compris entre 0 et %', v_loading.total_amount;
    END IF;

    UPDATE public.loadings
    SET amount_paid = p_amount_paid,
        payment_ref = p_payment_ref,
        updated_at = now()
    WHERE id = p_loading_id;

    RETURN jsonb_build_object(
        'success', true,
        'loading_id', p_loading_id,
        'amount_paid', p_amount_paid,
        'remaining_due', (v_loading.total_amount - p_amount_paid)
    );
END;
$$;

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carrieres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bon_ranges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loading_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loadings ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user business id
CREATE OR REPLACE FUNCTION public.current_user_business_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT business_id FROM public.business_members WHERE user_id = auth.uid() AND is_active = true LIMIT 1;
$$;

-- Helper function: get current user role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
    SELECT role FROM public.business_members WHERE user_id = auth.uid() AND is_active = true LIMIT 1;
$$;

-- Helper function: get current commercial id if user is commercial
CREATE OR REPLACE FUNCTION public.current_user_commercial_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT id FROM public.commercials WHERE user_id = auth.uid() AND is_active = true LIMIT 1;
$$;

-- PROFILES POLICIES
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid() AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

-- BUSINESSES POLICIES
CREATE POLICY "Members can view their business"
    ON public.businesses FOR SELECT
    USING (id = public.current_user_business_id());

CREATE POLICY "Agrees can create their business"
    ON public.businesses FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Agrees can update their business"
    ON public.businesses FOR UPDATE
    USING (owner_id = auth.uid());

-- CARRIERES POLICIES
CREATE POLICY "Members can view carrieres in their business"
    ON public.carrieres FOR SELECT
    USING (business_id = public.current_user_business_id());

CREATE POLICY "Agrees can manage carrieres"
    ON public.carrieres FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.businesses
            WHERE id = carrieres.business_id AND owner_id = auth.uid()
        )
    );

-- BUSINESS_MEMBERS POLICIES
CREATE POLICY "Members can view members in their business"
    ON public.business_members FOR SELECT
    USING (business_id = public.current_user_business_id());

CREATE POLICY "Agrees can manage members"
    ON public.business_members FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.businesses
            WHERE id = business_members.business_id AND owner_id = auth.uid()
        )
    );

-- COMMERCIALS POLICIES
CREATE POLICY "Members can view commercials in their business"
    ON public.commercials FOR SELECT
    USING (
        business_id = public.current_user_business_id()
        AND (
            public.current_user_role() IN ('agree', 'secretaire')
            OR user_id = auth.uid()
        )
    );

CREATE POLICY "Agrees can manage commercials"
    ON public.commercials FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.businesses
            WHERE id = commercials.business_id AND owner_id = auth.uid()
        )
    );

-- BON_RANGES POLICIES
CREATE POLICY "Agrees and Secretaires can view ranges"
    ON public.bon_ranges FOR SELECT
    USING (
        business_id = public.current_user_business_id()
        AND public.current_user_role() IN ('agree', 'secretaire')
    );

CREATE POLICY "Agrees can insert ranges"
    ON public.bon_ranges FOR INSERT
    WITH CHECK (
        business_id = public.current_user_business_id()
        AND public.current_user_role() = 'agree'
    );

-- LOADING_VOUCHERS POLICIES
CREATE POLICY "Vouchers view policy"
    ON public.loading_vouchers FOR SELECT
    USING (
        business_id = public.current_user_business_id()
        AND (
            public.current_user_role() IN ('agree', 'secretaire')
            OR commercial_id = public.current_user_commercial_id()
        )
    );

-- LOADINGS POLICIES
CREATE POLICY "Loadings view policy"
    ON public.loadings FOR SELECT
    USING (
        business_id = public.current_user_business_id()
        AND (
            public.current_user_role() IN ('agree', 'secretaire')
            OR commercial_id = public.current_user_commercial_id()
        )
    );

CREATE POLICY "Loadings insert policy"
    ON public.loadings FOR INSERT
    WITH CHECK (
        business_id = public.current_user_business_id()
        AND public.current_user_role() IN ('agree', 'secretaire')
    );

CREATE POLICY "Loadings update policy"
    ON public.loadings FOR UPDATE
    USING (
        business_id = public.current_user_business_id()
        AND (
            public.current_user_role() = 'agree'
            OR (
                public.current_user_role() = 'secretaire'
                AND EXISTS (
                    SELECT 1 FROM public.business_members
                    WHERE user_id = auth.uid() AND business_id = loadings.business_id AND can_edit_payments = true
                )
            )
        )
    );
