-- ============================================================
-- Eventos Especiais + Configurações da Empresa
-- ============================================================

-- ── 1. Tabela company_settings (dados da empresa por usuário) ──
CREATE TABLE IF NOT EXISTS public.company_settings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  company_name    text NOT NULL DEFAULT '',
  company_phone   text NOT NULL DEFAULT '',
  company_address text NOT NULL DEFAULT '',
  company_website text NOT NULL DEFAULT '',
  company_description text NOT NULL DEFAULT '',
  ai_base_prompt  text NOT NULL DEFAULT '',
  created_at      timestamptz DEFAULT now() NOT NULL,
  updated_at      timestamptz DEFAULT now() NOT NULL
);

-- ── 2. Tabela special_events (injeção de prompt por data) ──
CREATE TABLE IF NOT EXISTS public.special_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text NOT NULL DEFAULT '',
  prompt_text text NOT NULL,
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT special_events_dates_check CHECK (end_date >= start_date)
);

-- ── 3. RLS ──
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_events   ENABLE ROW LEVEL SECURITY;

-- company_settings: cada usuário só acessa seus próprios dados
DROP POLICY IF EXISTS "Users manage own company settings" ON public.company_settings;
CREATE POLICY "Users manage own company settings"
  ON public.company_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- special_events: todos os autenticados acessam (tabela global, igual ao padrão atual)
DROP POLICY IF EXISTS "Authenticated can read special_events"   ON public.special_events;
DROP POLICY IF EXISTS "Authenticated can insert special_events" ON public.special_events;
DROP POLICY IF EXISTS "Authenticated can update special_events" ON public.special_events;
DROP POLICY IF EXISTS "Authenticated can delete special_events" ON public.special_events;

CREATE POLICY "Authenticated can read special_events"
  ON public.special_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert special_events"
  ON public.special_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update special_events"
  ON public.special_events FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete special_events"
  ON public.special_events FOR DELETE TO authenticated USING (true);

-- ── 4. Triggers updated_at ──
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS company_settings_updated_at ON public.company_settings;
CREATE TRIGGER company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS special_events_updated_at ON public.special_events;
CREATE TRIGGER special_events_updated_at
  BEFORE UPDATE ON public.special_events
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── 5. Realtime ──
ALTER TABLE public.company_settings REPLICA IDENTITY FULL;
ALTER TABLE public.special_events   REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.company_settings;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.special_events;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
