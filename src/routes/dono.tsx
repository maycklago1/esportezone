import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { getOwnerHome, saveCourt, seedDemo, setCourtPaused, upgradeToOwner, type OwnerCourt } from "@/lib/quadra/api";
import {
  closeHourOptions,
  formatBRL,
  formatDay,
  formatFee,
  openHourOptions,
  payoutCents,
  reaisInput,
  parseReais,
  SPORTS,
  sportLabel,
  statusLabel,
  SURFACES,
  surfaceLabel,
  WEEKDAYS,
} from "@/lib/quadra/format";
import { useServerData } from "@/lib/quadra/use-server";
import { AppShell, useMe } from "@/components/shell";
import { Badge, Button, Card, Empty, ErrorNote, Field, Input, Money, PageHeader, PageSkeleton, Select, TextArea } from "@/components/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dono")({ component: DonoPage });

type Draft = {
  id: string;
  name: string;
  sport: string;
  city: string;
  neighborhood: string;
  address: string;
  description: string;
  surface: string;
  indoor: boolean;
  price: string;
  openFrom: string;
  openUntil: string;
  weekdays: number[];
};

const emptyDraft = (): Draft => ({
  id: "",
  name: "",
  sport: "futsal",
  city: "",
  neighborhood: "",
  address: "",
  description: "",
  surface: "sintetica",
  indoor: false,
  price: "",
  openFrom: "08:00",
  openUntil: "23:00",
  weekdays: [1, 2, 3, 4, 5, 6, 0],
});

function fromCourt(court: OwnerCourt): Draft {
  return {
    id: court.id,
    name: court.name,
    sport: court.sport,
    city: court.city,
    neighborhood: court.neighborhood,
    address: court.address,
    description: court.description,
    surface: court.surface,
    indoor: court.indoor,
    price: reaisInput(court.priceCents),
    openFrom: court.openFrom,
    openUntil: court.openUntil,
    weekdays: court.weekdays,
  };
}

function DonoPage() {
  return (
    <AppShell>
      <Dono />
    </AppShell>
  );
}

function Dono() {
  const { me, reloadMe } = useMe();
  const home = useServerData(() => getOwnerHome(), [me.role]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (me.role === "player") {
    return (
      <>
        <PageHeader kicker="Donos" title="Cadastre a sua quadra" lede="Você continua podendo jogar. A diferença é poder publicar horários e preço." />
        {error ? <div className="mb-4"><ErrorNote>{error}</ErrorNote></div> : null}
        <Button
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError(null);
            void upgradeToOwner()
              .then(() => reloadMe())
              .catch((err: unknown) => setError(err instanceof Error ? err.message : "Não foi possível atualizar."))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "Atualizando…" : "Quero gerenciar quadras"}
        </Button>
      </>
    );
  }

  if (home.loading && !home.data) return <PageSkeleton />;
  if (home.error || !home.data) return <ErrorNote>{home.error ?? "Não foi possível carregar."}</ErrorNote>;
  const data = home.data;

  async function run(task: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await task();
      home.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader kicker="Suas quadras" title="Agenda e preço" lede={`A taxa da plataforma é ${formatFee(data.feeBps)}, descontada do repasse. Você vê o nome público de quem reservou, não o e-mail.`} />
      {error ? <div className="mb-4"><ErrorNote>{error}</ErrorNote></div> : null}
      {data.courts.length === 0 && !draft ? (
        <Empty
          title="Nenhuma quadra ainda"
          lede="Cadastre a sua ou carregue quatro arenas de exemplo, com dois jogos abertos."
          action={
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
              <Button onClick={() => setDraft(emptyDraft())}>Nova quadra</Button>
              <Button variant="secondary" disabled={busy} onClick={() => void run(() => seedDemo())}>Carregar exemplos</Button>
            </div>
          }
        />
      ) : (
        <div className="mb-4 flex flex-wrap gap-2">
          <Button onClick={() => setDraft(emptyDraft())}>Nova quadra</Button>
          {data.courts.length === 0 ? (
            <Button variant="secondary" disabled={busy} onClick={() => void run(() => seedDemo())}>Carregar exemplos</Button>
          ) : null}
        </div>
      )}
      {draft ? (
        <CourtForm
          draft={draft}
          setDraft={setDraft}
          busy={busy}
          hint={`Entre ${formatBRL(data.minPriceCents)} e ${formatBRL(data.maxPriceCents)} por hora.`}
          onCancel={() => setDraft(null)}
          onSave={() => {
            const priceCents = parseReais(draft.price);
            if (!priceCents) {
              setError("Informe o valor por hora. Exemplo: 150 ou 150,00.");
              return;
            }
            void run(async () => {
              await saveCourt({
                data: {
                  id: draft.id || undefined,
                  name: draft.name,
                  sport: draft.sport,
                  city: draft.city,
                  neighborhood: draft.neighborhood,
                  address: draft.address,
                  description: draft.description,
                  surface: draft.surface,
                  indoor: draft.indoor,
                  priceCents,
                  openFrom: draft.openFrom,
                  openUntil: draft.openUntil,
                  weekdays: draft.weekdays,
                },
              });
              setDraft(null);
            });
          }}
        />
      ) : null}
      <div className="mt-4 grid gap-3">
        {data.courts.map((court) => (
          <Card key={court.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl">{court.name}</h2>
                <p className="mt-1 text-sm text-muted">
                  {sportLabel(court.sport)} · {court.neighborhood}, {court.city} · {court.indoor ? "Coberta" : "Aberta"} · {surfaceLabel(court.surface)}
                </p>
              </div>
              <div className="text-right">
                <Money cents={court.priceCents} className="font-medium" />
                <p className="text-xs text-faint">repassa <Money cents={payoutCents(court.priceCents, data.feeBps)} /></p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge status={court.status}>{statusLabel(court.status)}</Badge>
              <Badge>{court.openFrom}–{court.openUntil === "24:00" ? "00:00" : court.openUntil}</Badge>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setDraft(fromCourt(court))}>Editar</Button>
              {court.status === "active" || court.status === "paused" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void run(() => setCourtPaused({ data: { courtId: court.id, paused: court.status === "active" } }))}
                >
                  {court.status === "active" ? "Pausar" : "Publicar de novo"}
                </Button>
              ) : null}
            </div>
          </Card>
        ))}
      </div>
      <h2 className="mt-8 text-2xl">Próximas reservas</h2>
      {data.bookings.length === 0 ? <p className="mt-2 text-sm text-muted">Ninguém reservou ainda.</p> : null}
      <div className="mt-3 grid gap-3">
        {data.bookings.map((booking) => (
          <Card key={booking.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg">{booking.courtName}</h3>
                <p className="mt-1 text-sm text-muted">
                  {formatDay(booking.date)} · {booking.start}–{booking.end} · {booking.hostName}
                </p>
              </div>
              <Money cents={booking.priceCents} className="text-sm" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge>{booking.kind === "open" ? "Jogo aberto" : "Fechada"}</Badge>
              <Badge status={booking.status}>{statusLabel(booking.status)}</Badge>
              <Badge>{booking.paidCount} pago(s) · {booking.filled} de {booking.spots}</Badge>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function CourtForm({
  draft,
  setDraft,
  busy,
  hint,
  onSave,
  onCancel,
}: {
  draft: Draft;
  setDraft: (draft: Draft) => void;
  busy: boolean;
  hint: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  const opens = openHourOptions();
  const closes = closeHourOptions();
  return (
    <Card className="mt-4">
      <h2 className="text-xl">{draft.id ? "Editar quadra" : "Nova quadra"}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Nome">
          <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </Field>
        <Field label="Esporte">
          <Select value={draft.sport} onChange={(event) => setDraft({ ...draft, sport: event.target.value })}>
            {SPORTS.map((sport) => <option key={sport.id} value={sport.id}>{sport.label}</option>)}
          </Select>
        </Field>
        <Field label="Cidade">
          <Input value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} />
        </Field>
        <Field label="Bairro">
          <Input value={draft.neighborhood} onChange={(event) => setDraft({ ...draft, neighborhood: event.target.value })} />
        </Field>
        <Field label="Endereço">
          <Input value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} />
        </Field>
        <Field label="Piso">
          <Select value={draft.surface} onChange={(event) => setDraft({ ...draft, surface: event.target.value })}>
            {SURFACES.map((surface) => <option key={surface.id} value={surface.id}>{surface.label}</option>)}
          </Select>
        </Field>
        <Field label="Valor por hora" hint={hint}>
          <Input inputMode="decimal" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} placeholder="150,00" />
        </Field>
        <label className="flex items-center gap-2 text-sm font-medium sm:mt-7">
          <input type="checkbox" checked={draft.indoor} onChange={(event) => setDraft({ ...draft, indoor: event.target.checked })} />
          Quadra coberta
        </label>
        <Field label="Abre">
          <Select value={draft.openFrom} onChange={(event) => setDraft({ ...draft, openFrom: event.target.value })}>
            {opens.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
          </Select>
        </Field>
        <Field label="Fecha">
          <Select value={draft.openUntil} onChange={(event) => setDraft({ ...draft, openUntil: event.target.value })}>
            {closes.map((hour) => <option key={hour.value} value={hour.value}>{hour.label}</option>)}
          </Select>
        </Field>
      </div>
      <p className="mt-4 text-sm font-medium">Dias</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {WEEKDAYS.map((day) => {
          const on = draft.weekdays.includes(day.id);
          return (
            <button
              key={day.id}
              type="button"
              aria-pressed={on}
              onClick={() =>
                setDraft({
                  ...draft,
                  weekdays: on ? draft.weekdays.filter((value) => value !== day.id) : [...draft.weekdays, day.id],
                })
              }
              className={cn("h-11 rounded-md border px-3 text-sm", on ? "border-pine bg-pine text-mist" : "border-line bg-card")}
            >
              {day.short}
            </button>
          );
        })}
      </div>
      <div className="mt-4">
        <Field label="Descrição">
          <TextArea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={busy} onClick={onSave}>{busy ? "Salvando…" : draft.id ? "Salvar" : "Publicar"}</Button>
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
      </div>
    </Card>
  );
}
