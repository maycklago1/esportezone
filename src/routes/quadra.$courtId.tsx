import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createBooking, getCourt, getSlots } from "@/lib/quadra/api";
import { formatChip, formatDay, sportLabel, surfaceLabel, upcomingDates, weekdayOpen } from "@/lib/quadra/format";
import { useServerData } from "@/lib/quadra/use-server";
import { CourtMark } from "@/components/court-mark";
import { AppShell } from "@/components/shell";
import { Badge, Button, ErrorNote, Field, Money, PageSkeleton, TextArea } from "@/components/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/quadra/$courtId")({ component: CourtPage });

function CourtPage() {
  const { courtId } = Route.useParams();
  return (
    <AppShell>
      <CourtScreen courtId={courtId} />
    </AppShell>
  );
}

function CourtScreen({ courtId }: { courtId: string }) {
  const navigate = useNavigate();
  const court = useServerData(() => getCourt({ data: { courtId } }), [courtId]);
  const [date, setDate] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const [kind, setKind] = useState<"private" | "open">("private");
  const [spots, setSpots] = useState(10);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const days = upcomingDates(10);
  const slots = useServerData(
    () => (date ? getSlots({ data: { courtId, date } }) : Promise.resolve(null)),
    [courtId, date ?? ""],
  );

  useEffect(() => {
    if (!court.data || date) return;
    const list = upcomingDates(10);
    const weekdays = court.data.weekdays.join(",");
    setDate(list.find((item) => weekdayOpen(weekdays, item)) ?? list[0] ?? null);
  }, [court.data, date]);

  async function reserve() {
    if (!date || !start) return;
    setBusy(true);
    setError(null);
    try {
      const result = await createBooking({ data: { courtId, date, start, kind, spots, note } });
      await navigate({ to: "/pagar/$bookingId", params: { bookingId: result.bookingId } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível reservar.");
    } finally {
      setBusy(false);
    }
  }

  if (court.loading && !court.data) return <PageSkeleton />;
  if (court.error || !court.data) return <ErrorNote>{court.error ?? "Quadra não encontrada."}</ErrorNote>;
  const detail = court.data;
  const share = kind === "open" ? Math.floor(detail.priceCents / spots) : detail.priceCents;

  return (
    <>
      <article className="overflow-hidden rounded-xl border border-line bg-card">
        <CourtMark sport={detail.sport} className="h-36" />
        <div className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl">{detail.name}</h1>
              <p className="mt-1 text-sm text-muted">
                {detail.neighborhood}, {detail.city}
                {detail.address ? ` · ${detail.address}` : ""}
              </p>
            </div>
            <div className="text-right">
              <Money cents={detail.priceCents} className="font-display text-2xl" />
              <p className="text-sm text-faint">por hora</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge>{sportLabel(detail.sport)}</Badge>
            <Badge>{detail.indoor ? "Coberta" : "Aberta"}</Badge>
            <Badge>{surfaceLabel(detail.surface)}</Badge>
            <Badge status={detail.status}>{detail.status === "active" ? "Publicada" : undefined}</Badge>
          </div>
          {detail.description ? <p className="mt-4 text-sm text-muted">{detail.description}</p> : null}
          <p className="mt-3 text-sm text-faint">
            Funciona {detail.openFrom}–{detail.openUntil === "24:00" ? "00:00" : detail.openUntil}. Publicado por {detail.ownerName}.
          </p>
        </div>
      </article>

      {detail.status !== "active" ? (
        <p className="mt-4 text-sm text-warn">Esta quadra ainda não recebe reservas.</p>
      ) : (
        <div className="mt-6">
          <h2 className="text-xl">Escolha o dia</h2>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {days.map((item) => {
              const chip = formatChip(item);
              const open = weekdayOpen(detail.weekdays.join(","), item);
              return (
                <button
                  key={item}
                  type="button"
                  disabled={!open}
                  onClick={() => {
                    setDate(item);
                    setStart(null);
                  }}
                  className={cn(
                    "flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-md border text-sm",
                    date === item ? "border-pine bg-pine text-mist" : "border-line bg-card text-ink",
                    !open && "opacity-40",
                  )}
                >
                  <span className="text-xs">{chip.week}</span>
                  <span className="font-medium tabular-nums">{chip.day}</span>
                </button>
              );
            })}
          </div>
          {date ? <p className="mt-3 text-sm text-muted">{formatDay(date)}</p> : null}
          {slots.data?.closed ? <p className="mt-3 text-sm text-muted">A quadra não abre neste dia.</p> : null}
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.data?.slots.map((slot) => {
              const disabled = slot.state !== "free";
              const selected = start === slot.start;
              return (
                <button
                  key={slot.start}
                  type="button"
                  disabled={disabled && !slot.mine}
                  onClick={() => {
                    if (slot.mine && slot.bookingId) {
                      void navigate({
                        to: slot.kind === "open" ? "/jogo/$bookingId" : "/pagar/$bookingId",
                        params: { bookingId: slot.bookingId },
                      });
                      return;
                    }
                    if (!disabled) setStart(slot.start);
                  }}
                  className={cn(
                    "h-11 rounded-md border text-sm tabular-nums",
                    selected ? "border-pine bg-pine text-mist" : "border-line bg-card",
                    disabled && !slot.mine && "text-faint",
                    slot.mine && "border-pine text-pine",
                  )}
                >
                  {slot.mine ? "Seu" : slot.state === "free" ? slot.start : slot.state === "past" ? slot.start : "Ocupado"}
                </button>
              );
            })}
          </div>
          {slots.data && slots.data.openGames.length > 0 ? (
            <div className="mt-6">
              <h2 className="text-xl">Jogos abertos neste dia</h2>
              <div className="mt-3 grid gap-3">
                {slots.data.openGames.map((game) => (
                  <Link key={game.id} to="/jogo/$bookingId" params={{ bookingId: game.id }}>
                    <div className="rounded-xl border border-line bg-card p-4">
                      <p className="font-medium">
                        {game.start}–{game.end}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        {game.filled} de {game.spots} · {game.hostName}
                        {game.note ? ` · ${game.note}` : ""}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-6 rounded-xl border border-line bg-card p-4">
            <h2 className="text-xl">Como reservar</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setKind("private")} className={cn("h-11 rounded-md border text-sm font-medium", kind === "private" ? "border-pine bg-pine text-mist" : "border-line bg-card")}>
                Só o meu grupo
              </button>
              <button type="button" onClick={() => setKind("open")} className={cn("h-11 rounded-md border text-sm font-medium", kind === "open" ? "border-pine bg-pine text-mist" : "border-line bg-card")}>
                Jogo aberto
              </button>
            </div>
            {kind === "open" ? (
              <div className="mt-4 grid gap-4">
                <Field label="Vagas, contando você" hint="O valor da quadra é dividido entre as vagas.">
                  <div className="flex items-center gap-3">
                    <Button variant="secondary" onClick={() => setSpots((value) => Math.max(2, value - 1))} aria-label="Menos vagas">−</Button>
                    <span className="w-8 text-center tabular-nums">{spots}</span>
                    <Button variant="secondary" onClick={() => setSpots((value) => Math.min(20, value + 1))} aria-label="Mais vagas">+</Button>
                  </div>
                </Field>
                <Field label="Recado do jogo">
                  <TextArea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nível, bola, o que levar" maxLength={280} />
                </Field>
              </div>
            ) : null}
            <p className="mt-4 text-sm text-muted">
              {kind === "open" ? (
                <>
                  Sua parte: <Money cents={share} /> · quadra inteira <Money cents={detail.priceCents} />
                </>
              ) : (
                <>
                  Total do horário: <Money cents={detail.priceCents} />
                </>
              )}
            </p>
            {error ? <div className="mt-3"><ErrorNote>{error}</ErrorNote></div> : null}
            <Button className="mt-4 w-full" disabled={!start || busy} onClick={() => void reserve()}>
              {busy ? "Reservando…" : start ? `Continuar · ${start}` : "Escolha um horário"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
