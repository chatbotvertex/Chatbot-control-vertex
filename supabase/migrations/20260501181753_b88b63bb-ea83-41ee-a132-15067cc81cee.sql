
-- 1. Identifica o usuário "fonte" (mais antigo com dados em bot_settings)
-- e mantém apenas as linhas dele, depois remove user_id

-- WhatsApp settings: manter 1 linha (do usuário mais antigo)
DELETE FROM public.bot_settings
WHERE id NOT IN (
  SELECT DISTINCT ON (bot_type) id
  FROM public.bot_settings
  ORDER BY bot_type, created_at ASC
);

-- WhatsApp schedules: manter 1 linha por dia (do usuário mais antigo)
DELETE FROM public.bot_schedules
WHERE id NOT IN (
  SELECT DISTINCT ON (bot_type, day_of_week) id
  FROM public.bot_schedules
  ORDER BY bot_type, day_of_week, created_at ASC
);

-- Instagram settings: manter 1 linha
DELETE FROM public.instagram_settings
WHERE id NOT IN (
  SELECT id FROM public.instagram_settings
  ORDER BY created_at ASC LIMIT 1
);

-- Instagram schedules: manter 1 linha por dia
DELETE FROM public.instagram_schedules
WHERE id NOT IN (
  SELECT DISTINCT ON (day_of_week) id
  FROM public.instagram_schedules
  ORDER BY day_of_week, created_at ASC
);

-- 2. Remover policies antigas (que dependem de user_id)
DROP POLICY IF EXISTS "Users can view own bot settings" ON public.bot_settings;
DROP POLICY IF EXISTS "Users can insert own bot settings" ON public.bot_settings;
DROP POLICY IF EXISTS "Users can update own bot settings" ON public.bot_settings;
DROP POLICY IF EXISTS "Users can delete own bot settings" ON public.bot_settings;

DROP POLICY IF EXISTS "Users can view own bot schedules" ON public.bot_schedules;
DROP POLICY IF EXISTS "Users can insert own bot schedules" ON public.bot_schedules;
DROP POLICY IF EXISTS "Users can update own bot schedules" ON public.bot_schedules;
DROP POLICY IF EXISTS "Users can delete own bot schedules" ON public.bot_schedules;

DROP POLICY IF EXISTS "Users can view own instagram settings" ON public.instagram_settings;
DROP POLICY IF EXISTS "Users can insert own instagram settings" ON public.instagram_settings;
DROP POLICY IF EXISTS "Users can update own instagram settings" ON public.instagram_settings;
DROP POLICY IF EXISTS "Users can delete own instagram settings" ON public.instagram_settings;

DROP POLICY IF EXISTS "Users can view own instagram schedules" ON public.instagram_schedules;
DROP POLICY IF EXISTS "Users can insert own instagram schedules" ON public.instagram_schedules;
DROP POLICY IF EXISTS "Users can update own instagram schedules" ON public.instagram_schedules;
DROP POLICY IF EXISTS "Users can delete own instagram schedules" ON public.instagram_schedules;

-- 3. Remover coluna user_id
ALTER TABLE public.bot_settings DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.bot_schedules DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.instagram_settings DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.instagram_schedules DROP COLUMN IF EXISTS user_id;

-- 4. Garantir unicidade global
ALTER TABLE public.bot_settings DROP CONSTRAINT IF EXISTS bot_settings_user_id_bot_type_key;
ALTER TABLE public.bot_schedules DROP CONSTRAINT IF EXISTS bot_schedules_user_id_bot_type_day_of_week_key;
ALTER TABLE public.instagram_settings DROP CONSTRAINT IF EXISTS instagram_settings_user_id_key;
ALTER TABLE public.instagram_schedules DROP CONSTRAINT IF EXISTS instagram_schedules_user_id_day_of_week_key;

CREATE UNIQUE INDEX IF NOT EXISTS bot_settings_bot_type_key ON public.bot_settings(bot_type);
CREATE UNIQUE INDEX IF NOT EXISTS bot_schedules_bot_type_day_key ON public.bot_schedules(bot_type, day_of_week);
CREATE UNIQUE INDEX IF NOT EXISTS instagram_settings_singleton_key ON public.instagram_settings((true));
CREATE UNIQUE INDEX IF NOT EXISTS instagram_schedules_day_key ON public.instagram_schedules(day_of_week);

-- 5. Garantir que existe 1 linha por tipo / 1 por dia (caso esteja vazio)
INSERT INTO public.bot_settings (bot_type)
SELECT 'whatsapp'::public.bot_type
WHERE NOT EXISTS (SELECT 1 FROM public.bot_settings WHERE bot_type = 'whatsapp');

INSERT INTO public.bot_schedules (bot_type, day_of_week)
SELECT 'whatsapp'::public.bot_type, d.day
FROM generate_series(0,6) AS d(day)
WHERE NOT EXISTS (
  SELECT 1 FROM public.bot_schedules WHERE bot_type='whatsapp' AND day_of_week = d.day
);

INSERT INTO public.instagram_settings DEFAULT VALUES
ON CONFLICT DO NOTHING;
INSERT INTO public.instagram_settings (offline_message)
SELECT 'Estou ausente no momento. Retornarei em breve.'
WHERE NOT EXISTS (SELECT 1 FROM public.instagram_settings);

INSERT INTO public.instagram_schedules (day_of_week)
SELECT d.day FROM generate_series(0,6) AS d(day)
WHERE NOT EXISTS (
  SELECT 1 FROM public.instagram_schedules WHERE day_of_week = d.day
);

-- 6. Novas policies: qualquer authenticated pode tudo
CREATE POLICY "Authenticated can read bot_settings" ON public.bot_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert bot_settings" ON public.bot_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update bot_settings" ON public.bot_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can read bot_schedules" ON public.bot_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert bot_schedules" ON public.bot_schedules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update bot_schedules" ON public.bot_schedules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can read instagram_settings" ON public.instagram_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert instagram_settings" ON public.instagram_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update instagram_settings" ON public.instagram_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can read instagram_schedules" ON public.instagram_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert instagram_schedules" ON public.instagram_schedules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update instagram_schedules" ON public.instagram_schedules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 7. Realtime
ALTER TABLE public.bot_settings REPLICA IDENTITY FULL;
ALTER TABLE public.bot_schedules REPLICA IDENTITY FULL;
ALTER TABLE public.instagram_settings REPLICA IDENTITY FULL;
ALTER TABLE public.instagram_schedules REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_settings;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_schedules;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.instagram_settings;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.instagram_schedules;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 8. Atualizar handle_new_user para não criar mais linhas por usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$function$;
