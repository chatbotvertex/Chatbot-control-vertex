-- Enum para tipo de bot
CREATE TYPE public.bot_type AS ENUM ('whatsapp', 'instagram');

-- Reestruturar bot_settings para suportar múltiplos bots por usuário
ALTER TABLE public.bot_settings
  DROP COLUMN start_time,
  DROP COLUMN end_time,
  ADD COLUMN bot_type public.bot_type NOT NULL DEFAULT 'whatsapp';

-- Garantir 1 linha por (user_id, bot_type)
ALTER TABLE public.bot_settings
  ADD CONSTRAINT bot_settings_user_bot_unique UNIQUE (user_id, bot_type);

-- Atualizar trigger handle_new_user para criar settings dos dois bots e schedules padrão
CREATE TABLE public.bot_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  bot_type public.bot_type NOT NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_active BOOLEAN NOT NULL DEFAULT false,
  start_time TIME NOT NULL DEFAULT '09:00:00',
  end_time TIME NOT NULL DEFAULT '18:00:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, bot_type, day_of_week)
);

ALTER TABLE public.bot_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bot schedules"
  ON public.bot_schedules FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bot schedules"
  ON public.bot_schedules FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bot schedules"
  ON public.bot_schedules FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bot schedules"
  ON public.bot_schedules FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER set_bot_schedules_updated_at
  BEFORE UPDATE ON public.bot_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger updated_at em bot_settings (caso não exista)
DROP TRIGGER IF EXISTS set_bot_settings_updated_at ON public.bot_settings;
CREATE TRIGGER set_bot_settings_updated_at
  BEFORE UPDATE ON public.bot_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Backfill: para cada bot_settings existente, criar a linha do instagram também
INSERT INTO public.bot_settings (user_id, bot_type)
SELECT user_id, 'instagram'::public.bot_type
FROM public.bot_settings
WHERE bot_type = 'whatsapp'
ON CONFLICT DO NOTHING;

-- Backfill schedules: 7 dias x 2 bots para cada usuário existente
INSERT INTO public.bot_schedules (user_id, bot_type, day_of_week)
SELECT s.user_id, b.bot_type, d.day
FROM (SELECT DISTINCT user_id FROM public.bot_settings) s
CROSS JOIN (VALUES ('whatsapp'::public.bot_type), ('instagram'::public.bot_type)) AS b(bot_type)
CROSS JOIN generate_series(0, 6) AS d(day)
ON CONFLICT DO NOTHING;

-- Atualizar handle_new_user para semear settings + schedules dos 2 bots
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  INSERT INTO public.bot_settings (user_id, bot_type) VALUES (NEW.id, 'whatsapp');
  INSERT INTO public.bot_settings (user_id, bot_type) VALUES (NEW.id, 'instagram');

  INSERT INTO public.bot_schedules (user_id, bot_type, day_of_week)
  SELECT NEW.id, b.bot_type, d.day
  FROM (VALUES ('whatsapp'::public.bot_type), ('instagram'::public.bot_type)) AS b(bot_type)
  CROSS JOIN generate_series(0, 6) AS d(day);

  RETURN NEW;
END;
$function$;