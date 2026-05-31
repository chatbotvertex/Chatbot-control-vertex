import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2, MoonStar, Save, type LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";

type Platform = "whatsapp" | "instagram";

const DAYS = [
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

interface Props {
  platform: Platform;
  title: string;
  description: string;
  icon: LucideIcon;
}

type LocalSchedule = {
  is_active: boolean;
  start_time: string;
  end_time: string;
};

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const msg = e["message"];
    const details = e["details"];
    const code = e["code"];
    const parts = [msg, details].filter(Boolean).map(String);
    if (parts.length) return `${parts.join(" — ")}${code ? ` (${code})` : ""}`;
  }
  return "Erro desconhecido";
}

export default function BotConfig({ platform, title, description, icon: Icon }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const settingsKey = ["settings", platform];
  const schedulesKey = ["schedules", platform];

  const { data: settings, isLoading: loadingSettings, isError: errorSettings } = useQuery({
    queryKey: settingsKey,
    enabled: !!user,
    queryFn: async () => {
      if (platform === "whatsapp") {
        const { data, error } = await supabase
          .from("bot_settings")
          .select("*")
          .eq("bot_type", "whatsapp")
          .maybeSingle();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("instagram_settings")
          .select("*")
          .maybeSingle();
        if (error) throw error;
        return data;
      }
    },
  });

  const { data: schedules, isLoading: loadingSchedules, isError: errorSchedules } = useQuery({
    queryKey: schedulesKey,
    enabled: !!user,
    queryFn: async () => {
      if (platform === "whatsapp") {
        const { data, error } = await supabase
          .from("bot_schedules")
          .select("*")
          .eq("bot_type", "whatsapp");
        if (error) throw error;
        return data ?? [];
      } else {
        const { data, error } = await supabase
          .from("instagram_schedules")
          .select("*");
        if (error) throw error;
        return data ?? [];
      }
    },
  });

  const [isActive, setIsActive] = useState(false);
  const [offlineMessage, setOfflineMessage] = useState("");
  const [days, setDays] = useState<Record<number, LocalSchedule>>({});

  useEffect(() => {
    if (settings) {
      setIsActive(settings.is_active);
      setOfflineMessage(settings.offline_message);
    }
  }, [settings]);

  useEffect(() => {
    if (schedules) {
      const map: Record<number, LocalSchedule> = {};
      for (const d of DAYS) {
        const found = schedules.find((s) => s.day_of_week === d.value);
        map[d.value] = {
          is_active: found?.is_active ?? false,
          start_time: (found?.start_time ?? "09:00:00").slice(0, 5),
          end_time: (found?.end_time ?? "18:00:00").slice(0, 5),
        };
      }
      setDays(map);
    }
  }, [schedules]);

  useEffect(() => {
    if (!user) return;
    const settingsTable = platform === "whatsapp" ? "bot_settings" : "instagram_settings";
    const schedulesTable = platform === "whatsapp" ? "bot_schedules" : "instagram_schedules";

    const channel = supabase
      .channel(`bot-config-${platform}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: settingsTable },
        () => queryClient.invalidateQueries({ queryKey: settingsKey }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: schedulesTable },
        () => queryClient.invalidateQueries({ queryKey: schedulesKey }),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, platform]);

  const updateDay = (day: number, patch: Partial<LocalSchedule>) =>
    setDays((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");

      if (platform === "whatsapp") {
        const { error: settingsErr } = await supabase
          .from("bot_settings")
          .upsert(
            { bot_type: "whatsapp" as const, is_active: isActive, offline_message: offlineMessage },
            { onConflict: "bot_type" },
          );
        if (settingsErr) throw settingsErr;

        const schedRows = DAYS.map((d) => ({
          bot_type: "whatsapp" as const,
          day_of_week: d.value,
          is_active: days[d.value]?.is_active ?? false,
          start_time: days[d.value]?.start_time ?? "09:00",
          end_time: days[d.value]?.end_time ?? "18:00",
        }));
        const { error: schedErr } = await supabase
          .from("bot_schedules")
          .upsert(schedRows, { onConflict: "bot_type,day_of_week" });
        if (schedErr) throw schedErr;
      } else {
        // singleton=true é a chave de conflito — garante upsert correto
        const { error: settingsErr } = await supabase
          .from("instagram_settings")
          .upsert(
            { singleton: true, is_active: isActive, offline_message: offlineMessage },
            { onConflict: "singleton" },
          );
        if (settingsErr) throw settingsErr;

        const schedRows = DAYS.map((d) => ({
          day_of_week: d.value,
          is_active: days[d.value]?.is_active ?? false,
          start_time: days[d.value]?.start_time ?? "09:00",
          end_time: days[d.value]?.end_time ?? "18:00",
        }));
        const { error: schedErr } = await supabase
          .from("instagram_schedules")
          .upsert(schedRows, { onConflict: "day_of_week" });
        if (schedErr) throw schedErr;
      }
    },
    onSuccess: () => {
      toast({ title: "Configurações salvas" });
      queryClient.invalidateQueries({ queryKey: settingsKey });
      queryClient.invalidateQueries({ queryKey: schedulesKey });
    },
    onError: (err) => {
      console.error("Erro ao salvar:", err);
      toast({
        title: "Erro ao salvar",
        description: extractErrorMessage(err),
        variant: "destructive",
      });
    },
  });

  const isLoading = loadingSettings || loadingSchedules;
  const hasError = errorSettings || errorSchedules;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-destructive">
        <AlertCircle className="h-8 w-8" />
        <p className="text-sm">Erro ao carregar configurações. Tente recarregar a página.</p>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="space-y-6"
      >
        <Card>
          <CardHeader>
            <CardTitle>Status geral</CardTitle>
            <CardDescription>Liga ou desliga o bot por completo</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <Label htmlFor={`active-${platform}`} className="text-base">
              Bot ativo
            </Label>
            <Switch
              id={`active-${platform}`}
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Horários por dia da semana</CardTitle>
            <CardDescription>
              Ative cada dia e defina o intervalo de funcionamento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {DAYS.map((d) => {
              const cfg = days[d.value] ?? {
                is_active: false,
                start_time: "09:00",
                end_time: "18:00",
              };
              return (
                <div
                  key={d.value}
                  className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3 sm:w-44">
                    <Switch
                      checked={cfg.is_active}
                      onCheckedChange={(v) => updateDay(d.value, { is_active: v })}
                    />
                    <span className="font-medium">{d.label}</span>
                  </div>
                  <div className="grid flex-1 grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Início</Label>
                      <Input
                        type="time"
                        value={cfg.start_time}
                        disabled={!cfg.is_active}
                        onChange={(e) => updateDay(d.value, { start_time: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <Label className="text-xs text-muted-foreground">Término</Label>
                        {cfg.is_active && cfg.end_time && cfg.start_time && cfg.end_time < cfg.start_time && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 cursor-default">
                                <MoonStar className="h-2.5 w-2.5" />
                                +1 dia
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              O bot ficará ativo até {cfg.end_time} do dia seguinte
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      <Input
                        type="time"
                        value={cfg.end_time}
                        disabled={!cfg.is_active}
                        onChange={(e) => updateDay(d.value, { end_time: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mensagem de Offline</CardTitle>
            <CardDescription>Resposta enviada fora do horário</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={offlineMessage}
              onChange={(e) => setOfflineMessage(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Estou ausente no momento..."
            />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar
          </Button>
        </div>
      </form>
    </div>
  );
}
