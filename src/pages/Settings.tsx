import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Building2, Loader2, Save, Sparkles } from "lucide-react";
import { isAfter, isBefore, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";

type CompanySettings = {
  id: string;
  user_id: string;
  company_name: string;
  company_phone: string;
  company_address: string;
  company_website: string;
  company_description: string;
  ai_base_prompt: string;
};

type SpecialEvent = {
  id: string;
  title: string;
  prompt_text: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
};

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const parts = [e["message"], e["details"]].filter(Boolean).map(String);
    return parts.join(" — ") || "Erro desconhecido";
  }
  return "Erro desconhecido";
}

function getActiveEvents(events: SpecialEvent[]): SpecialEvent[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return events.filter((e) => {
    if (!e.is_active) return false;
    const start = parseISO(e.start_date);
    const end = parseISO(e.end_date);
    return !isBefore(today, start) && !isAfter(today, end);
  });
}

export default function Settings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const settingsKey = ["company_settings"];
  const eventsKey = ["special_events"];

  const { data: settings, isLoading, isError } = useQuery({
    queryKey: settingsKey,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as CompanySettings | null;
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: eventsKey,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("special_events")
        .select("id, title, prompt_text, start_date, end_date, is_active")
        .order("start_date");
      if (error) throw error;
      return data as SpecialEvent[];
    },
  });

  const [form, setForm] = useState({
    company_name: "",
    company_phone: "",
    company_address: "",
    company_website: "",
    company_description: "",
    ai_base_prompt: "",
  });

  useEffect(() => {
    if (settings) {
      setForm({
        company_name: settings.company_name,
        company_phone: settings.company_phone,
        company_address: settings.company_address,
        company_website: settings.company_website,
        company_description: settings.company_description,
        ai_base_prompt: settings.ai_base_prompt,
      });
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase
        .from("company_settings")
        .upsert(
          { user_id: user.id, ...form },
          { onConflict: "user_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Configurações salvas com sucesso" });
      queryClient.invalidateQueries({ queryKey: settingsKey });
    },
    onError: (err) => {
      toast({ title: "Erro ao salvar", description: extractErrorMessage(err), variant: "destructive" });
    },
  });

  const activeEvents = getActiveEvents(events);

  const assembledPrompt = [
    form.ai_base_prompt.trim(),
    activeEvents.length > 0
      ? "\n\n--- INFORMAÇÕES ESPECIAIS (vigentes hoje) ---\n" +
        activeEvents.map((e) => `[${e.title}] ${e.prompt_text}`).join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("");

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
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
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Configurações</h1>
          <p className="text-sm text-muted-foreground">
            Dados da empresa e prompt base do agente AI
          </p>
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
        className="space-y-6"
      >
        {/* Company Info */}
        <Card>
          <CardHeader>
            <CardTitle>Dados da Empresa</CardTitle>
            <CardDescription>
              Informações que identificam esta conta no sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company_name">Nome da empresa *</Label>
                <Input
                  id="company_name"
                  placeholder="Pousada Chalézinho"
                  value={form.company_name}
                  onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_phone">Telefone / WhatsApp</Label>
                <Input
                  id="company_phone"
                  placeholder="(11) 99999-9999"
                  value={form.company_phone}
                  onChange={(e) => setForm((f) => ({ ...f, company_phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_address">Endereço</Label>
              <Input
                id="company_address"
                placeholder="Rua das Flores, 123 — Campos do Jordão, SP"
                value={form.company_address}
                onChange={(e) => setForm((f) => ({ ...f, company_address: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_website">Site</Label>
              <Input
                id="company_website"
                placeholder="https://pousadachalezinho.com.br"
                value={form.company_website}
                onChange={(e) => setForm((f) => ({ ...f, company_website: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_description">Descrição curta</Label>
              <Textarea
                id="company_description"
                placeholder="Pousada familiar com chalés rústicos, piscina aquecida e café da manhã incluso..."
                rows={3}
                value={form.company_description}
                onChange={(e) => setForm((f) => ({ ...f, company_description: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* AI Base Prompt */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Prompt Base do Agente AI
            </CardTitle>
            <CardDescription>
              Instruções permanentes enviadas ao agente em todas as conversas.
              Os eventos especiais ativos são adicionados automaticamente abaixo deste texto.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ai_base_prompt">Prompt base</Label>
              <Textarea
                id="ai_base_prompt"
                placeholder={`Você é o assistente virtual da Pousada Chalézinho. Seja simpático, use linguagem informal mas profissional. Responda dúvidas sobre hospedagem, pacotes, check-in/out e reservas. Telefone para reservas: (11) 99999-9999.`}
                rows={8}
                value={form.ai_base_prompt}
                onChange={(e) => setForm((f) => ({ ...f, ai_base_prompt: e.target.value }))}
              />
            </div>

            {assembledPrompt && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Sparkles className="h-3 w-3" />
                    Prompt completo enviado ao agente agora
                    {activeEvents.length > 0 && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700 font-medium">
                        +{activeEvents.length} evento{activeEvents.length > 1 ? "s" : ""} ativo{activeEvents.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </Label>
                  <Textarea
                    readOnly
                    rows={Math.min(12, assembledPrompt.split("\n").length + 2)}
                    value={assembledPrompt}
                    className="font-mono text-xs bg-muted resize-none"
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar configurações
          </Button>
        </div>
      </form>
    </div>
  );
}
