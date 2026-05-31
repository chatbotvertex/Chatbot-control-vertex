import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Calendar,
  Edit2,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { format, isAfter, isBefore, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

type SpecialEvent = {
  id: string;
  title: string;
  description: string;
  prompt_text: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type EventForm = {
  title: string;
  description: string;
  prompt_text: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
};

const emptyForm: EventForm = {
  title: "",
  description: "",
  prompt_text: "",
  start_date: "",
  end_date: "",
  is_active: true,
};

type EventStatus = "ativo" | "proximo" | "encerrado" | "inativo";

function getEventStatus(event: SpecialEvent): EventStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = parseISO(event.start_date);
  const end = parseISO(event.end_date);

  if (isAfter(today, end)) return "encerrado";
  if (!event.is_active) return "inativo";
  if (isBefore(today, start)) return "proximo";
  return "ativo";
}

const statusConfig: Record<EventStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  ativo: { label: "Ativo agora", variant: "default", className: "bg-green-500 hover:bg-green-600 text-white" },
  proximo: { label: "Próximo", variant: "secondary", className: "bg-blue-100 text-blue-700 hover:bg-blue-200" },
  encerrado: { label: "Encerrado", variant: "outline", className: "text-muted-foreground" },
  inativo: { label: "Inativo", variant: "outline", className: "text-muted-foreground" },
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

export default function SpecialEvents() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<SpecialEvent | null>(null);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const queryKey = ["special_events"];

  const { data: events = [], isLoading, isError } = useQuery({
    queryKey,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("special_events")
        .select("*")
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data as SpecialEvent[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("special-events")
      .on("postgres_changes", { event: "*", schema: "public", table: "special_events" }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const openAdd = () => {
    setEditingEvent(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (event: SpecialEvent) => {
    setEditingEvent(event);
    setForm({
      title: event.title,
      description: event.description,
      prompt_text: event.prompt_text,
      start_date: event.start_date,
      end_date: event.end_date,
      is_active: event.is_active,
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Título obrigatório");
      if (!form.prompt_text.trim()) throw new Error("Texto do prompt obrigatório");
      if (!form.start_date) throw new Error("Data de início obrigatória");
      if (!form.end_date) throw new Error("Data de término obrigatória");
      if (form.end_date < form.start_date) throw new Error("Data de término deve ser após a data de início");

      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        prompt_text: form.prompt_text.trim(),
        start_date: form.start_date,
        end_date: form.end_date,
        is_active: form.is_active,
      };

      if (editingEvent) {
        const { error } = await supabase
          .from("special_events")
          .update(payload)
          .eq("id", editingEvent.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("special_events")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingEvent ? "Evento atualizado" : "Evento criado" });
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => {
      toast({ title: "Erro ao salvar", description: extractErrorMessage(err), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("special_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Evento removido" });
      setDeleteConfirm(null);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => {
      toast({ title: "Erro ao remover", description: extractErrorMessage(err), variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("special_events")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (err) => {
      toast({ title: "Erro ao atualizar", description: extractErrorMessage(err), variant: "destructive" });
    },
  });

  const activeEvents = events.filter((e) => getEventStatus(e) === "ativo");

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
        <p className="text-sm">Erro ao carregar eventos. Tente recarregar a página.</p>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Eventos Especiais</h1>
            <p className="text-sm text-muted-foreground">
              Informações sazonais injetadas automaticamente no prompt do agente AI
            </p>
          </div>
        </div>
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar
        </Button>
      </div>

      {activeEvents.length > 0 && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-green-800">
              <Sparkles className="h-4 w-4" />
              {activeEvents.length === 1 ? "1 evento ativo agora" : `${activeEvents.length} eventos ativos agora`}
            </CardTitle>
            <CardDescription className="text-green-700">
              O seguinte texto está sendo injetado no prompt do agente:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-white p-3 font-mono text-xs text-slate-700 border border-green-200">
              {activeEvents.map((e) => (
                <div key={e.id} className="mb-2 last:mb-0">
                  <span className="font-semibold text-green-700">[{e.title}]</span>{" "}
                  {e.prompt_text}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {events.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="font-medium text-muted-foreground">Nenhum evento cadastrado</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Crie eventos sazonais para que o agente AI os mencione automaticamente nas datas certas.
            </p>
            <Button variant="outline" className="mt-4" onClick={openAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Criar primeiro evento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((event) => {
            const status = getEventStatus(event);
            const cfg = statusConfig[status];
            return (
              <Card key={event.id} className={status === "encerrado" ? "opacity-60" : ""}>
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold truncate">{event.title}</span>
                        <Badge className={cfg.className}>{cfg.label}</Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                        <Calendar className="h-3 w-3" />
                        {format(parseISO(event.start_date), "dd 'de' MMM", { locale: ptBR })}
                        {" até "}
                        {format(parseISO(event.end_date), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                      </div>
                      {event.description && (
                        <p className="text-sm text-muted-foreground mb-2">{event.description}</p>
                      )}
                      <div className="rounded-md bg-muted p-2.5 text-xs font-mono text-slate-600">
                        {event.prompt_text}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Switch
                        checked={event.is_active}
                        disabled={status === "encerrado" || toggleMutation.isPending}
                        onCheckedChange={(v) => toggleMutation.mutate({ id: event.id, is_active: v })}
                      />
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(event)}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirm(event.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Editar Evento" : "Novo Evento Especial"}</DialogTitle>
            <DialogDescription>
              O texto do prompt será injetado automaticamente no agente AI durante o período informado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ev-title">Título *</Label>
              <Input
                id="ev-title"
                placeholder="Ex: Pacote Dia dos Namorados"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-description">Descrição (opcional)</Label>
              <Input
                id="ev-description"
                placeholder="Nota interna sobre o evento"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ev-start">Data de início *</Label>
                <Input
                  id="ev-start"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ev-end">Data de término *</Label>
                <Input
                  id="ev-end"
                  type="date"
                  value={form.end_date}
                  min={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-prompt">
                Texto para o prompt *
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  (será enviado ao agente AI durante o período)
                </span>
              </Label>
              <Textarea
                id="ev-prompt"
                placeholder={`Ex: Do dia 11 ao dia 14 de junho temos o Pacote Dia dos Namorados com open bar incluso. Valor: R$ 580 por casal. Incentive o hóspede a reservar.`}
                rows={5}
                value={form.prompt_text}
                onChange={(e) => setForm((f) => ({ ...f, prompt_text: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Evento ativo</p>
                <p className="text-xs text-muted-foreground">Desative para pausar sem excluir</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingEvent ? "Salvar alterações" : "Criar evento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir evento?</DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita. O evento será removido permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
