import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  Building2,
  Calendar,
  CheckCircle2,
  Instagram,
  MessageCircle,
  Sparkles,
  XCircle,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";

function getActiveEvents(events: Array<{ id: string; title: string; is_active: boolean; start_date: string; end_date: string }>) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return events.filter((e) => {
    if (!e.is_active) return false;
    const start = parseISO(e.start_date);
    const end = parseISO(e.end_date);
    return !isBefore(today, start) && !isAfter(today, end);
  });
}

const Index = () => {
  const { user } = useAuth();

  const { data: company } = useQuery({
    queryKey: ["company_settings"],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("company_settings")
        .select("company_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: whatsapp } = useQuery({
    queryKey: ["settings", "whatsapp"],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("bot_settings")
        .select("is_active")
        .eq("user_id", user!.id)
        .eq("bot_type", "whatsapp")
        .maybeSingle();
      return data;
    },
  });

  const { data: instagram } = useQuery({
    queryKey: ["settings", "instagram"],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("instagram_settings")
        .select("is_active")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["special_events"],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("special_events")
        .select("id, title, is_active, start_date, end_date");
      return data ?? [];
    },
  });

  const activeEvents = getActiveEvents(events);
  const companyName = company?.company_name || null;

  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">
          {companyName ? `Bem-vindo, ${companyName}` : "Painel de Controle"}
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Visão geral dos seus bots e eventos ativos
        </p>
      </div>

      {/* Platform status cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
                <MessageCircle className="h-4 w-4 text-green-700" />
              </div>
              Bot WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between pt-0">
            {whatsapp?.is_active ? (
              <div className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Ativo
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <XCircle className="h-4 w-4" />
                {whatsapp === undefined ? "Carregando..." : "Inativo"}
              </div>
            )}
            <Button asChild variant="outline" size="sm">
              <Link to="/bot">Configurar</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-100">
                <Instagram className="h-4 w-4 text-pink-700" />
              </div>
              Bot Instagram
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between pt-0">
            {instagram?.is_active ? (
              <div className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Ativo
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <XCircle className="h-4 w-4" />
                {instagram === undefined ? "Carregando..." : "Inativo"}
              </div>
            )}
            <Button asChild variant="outline" size="sm">
              <Link to="/bot/instagram">Configurar</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Active events */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Eventos Especiais Ativos
          </CardTitle>
          <CardDescription>
            Textos sendo injetados no prompt do agente AI hoje
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum evento ativo no momento.{" "}
              <Link to="/eventos" className="text-primary hover:underline">
                Gerenciar eventos
              </Link>
            </p>
          ) : (
            <div className="space-y-2">
              {activeEvents.map((e) => (
                <div key={e.id} className="flex items-center gap-2">
                  <Badge className="bg-green-500 hover:bg-green-600 text-white shrink-0">Ativo</Badge>
                  <span className="text-sm font-medium">{e.title}</span>
                </div>
              ))}
              <Link to="/eventos" className="block pt-1 text-xs text-primary hover:underline">
                Ver todos os eventos →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
          <Link to="/bot">
            <Bot className="h-5 w-5" />
            <span className="text-xs">Configurar WhatsApp</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
          <Link to="/eventos">
            <Calendar className="h-5 w-5" />
            <span className="text-xs">Eventos Especiais</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2">
          <Link to="/configuracoes">
            <Building2 className="h-5 w-5" />
            <span className="text-xs">Configurações</span>
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default Index;
