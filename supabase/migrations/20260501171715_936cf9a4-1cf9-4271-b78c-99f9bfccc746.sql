-- 1. Rename away_message -> offline_message in bot_settings
ALTER TABLE public.bot_settings RENAME COLUMN away_message TO offline_message;

-- 2. Create instagram_settings table
CREATE TABLE public.instagram_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  offline_message TEXT NOT NULL DEFAULT 'Estou ausente no momento. Retornarei em breve.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.instagram_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own instagram settings" ON public.instagram_settings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own instagram settings" ON public.instagram_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own instagram settings" ON public.instagram_settings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own instagram settings" ON public.instagram_settings
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_instagram_settings_updated_at
  BEFORE UPDATE ON public.instagram_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Create instagram_schedules table
CREATE TABLE public.instagram_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_active BOOLEAN NOT NULL DEFAULT false,
  start_time TIME NOT NULL DEFAULT '09:00:00',
  end_time TIME NOT NULL DEFAULT '18:00:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, day_of_week)
);

ALTER TABLE public.instagram_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own instagram schedules" ON public.instagram_schedules
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own instagram schedules" ON public.instagram_schedules
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own instagram schedules" ON public.instagram_schedules
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own instagram schedules" ON public.instagram_schedules
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_instagram_schedules_updated_at
  BEFORE UPDATE ON public.instagram_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Update handle_new_user to seed instagram tables and keep whatsapp seeding
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  -- WhatsApp (bot_settings/bot_schedules)
  INSERT INTO public.bot_settings (user_id, bot_type) VALUES (NEW.id, 'whatsapp');

  INSERT INTO public.bot_schedules (user_id, bot_type, day_of_week)
  SELECT NEW.id, 'whatsapp'::public.bot_type, d.day
  FROM generate_series(0, 6) AS d(day);

  -- Instagram (dedicated tables)
  INSERT INTO public.instagram_settings (user_id) VALUES (NEW.id);

  INSERT INTO public.instagram_schedules (user_id, day_of_week)
  SELECT NEW.id, d.day FROM generate_series(0, 6) AS d(day);

  RETURN NEW;
END;
$function$;

-- 5. Backfill instagram tables for existing users
INSERT INTO public.instagram_settings (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.instagram_schedules (user_id, day_of_week)
SELECT u.id, d.day FROM auth.users u CROSS JOIN generate_series(0, 6) AS d(day)
ON CONFLICT (user_id, day_of_week) DO NOTHING;

-- 6. Cleanup old instagram rows from shared bot_settings/bot_schedules (no longer used for instagram)
DELETE FROM public.bot_schedules WHERE bot_type = 'instagram';
DELETE FROM public.bot_settings WHERE bot_type = 'instagram';