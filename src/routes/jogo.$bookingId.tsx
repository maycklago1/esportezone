import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { cancelBooking, getGame, joinGame, leaveGame } from "@/lib/quadra/api";
import { formatDay, sportLabel, statusLabel } from "@/lib/quadra/format";
import { useServerData } from "@/lib/quadra/use-server";
import { AppShell } from "@/components/shell";
import { Badge, Button, ErrorNote, Money, PageSkeleton } from "@/components/ui";

export const Route = createFileRoute("/jogo/$bookingId")({ component: GamePage });

function GamePage() {
  const { bookingId } = Route.useParams();
  return (
    <AppShell>
      <GameScreen bookingId={bookingId} />
    </AppShell>
  );
}

function GameScreen({ bookingId }: { bookingId: string }) {
  const navigate = useNavigate();
  const game = useServerData(() => getGame({ data: { bookingId } }), [bookingId]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function act(run: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await run();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }

  if (game.loading && !game.data) return <PageSkeleton />;
  if (game.error || !game.data) return <ErrorNote>{game.error ?? "Jogo não encontrado."}</ErrorNote>;
  const detail = game.data;
  const full = detail.filled >= detail.spots;

  return (
    <>
      <p className="text-sm font-medium text-pine">{sportLabel(detail.sport)} · jogo aberto</p>
      <h1 className="mt-1 text-3xl">{detail.courtName}</h1>
      <p className="mt-2 text-sm text-muted">
        {formatDay(detail.date)} · {detail.start}–{detail.end} · {detail.neighborhood}, {detail.city}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge status={detail.bookingStatus}>{statusLabel(detail.bookingStatus)}</Badge>
        <Badge>
          {detail.filled} de {detail.spots}
        </Badge>
      </div>
      {detail.note ? <p className="mt-4 max-w-xl text-muted">{detail.note}</p> : null}
      <p className="mt-4 text-sm text-muted">
        Organiza {detail.hostName}. Sua parte: <Money cents={detail.shareCents} />. Quadra inteira: <Money cents={detail.priceCents} />.
      </p>
      {detail.address ? <p className="mt-1 text-sm text-faint">{detail.address}</p> : null}
      <h2 className="mt-6 text-xl">Confirmados</h2>
      <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-card">
        {detail.participants.map((name, index) => (
          <li key={`${name}-${index}`} className="px-4 py-3 text-sm">
            {name}
          </li>
        ))}
      </ul>
      {error ? <div className="mt-4"><ErrorNote>{error}</ErrorNote></div> : null}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {!detail.joined && !full && detail.bookingStatus !== "cancelled" ? (
          <Button disabled={busy} onClick={() => void act(async () => {
            const result = await joinGame({ data: { bookingId } });
            await navigate({ to: "/pagar/$bookingId", params: { bookingId: result.bookingId } });
          })}>
            Entrar e pagar
          </Button>
        ) : null}
        {detail.joined ? (
          <Button asChild variant="secondary">
            <Link to="/pagar/$bookingId" params={{ bookingId }}>Ver pagamento</Link>
          </Button>
        ) : null}
        {detail.joined && !detail.isHost ? (
          <Button variant="danger" disabled={busy} onClick={() => void act(async () => {
            await leaveGame({ data: { bookingId } });
            game.reload();
          })}>
            Sair do jogo
          </Button>
        ) : null}
        {detail.isHost && detail.bookingStatus !== "cancelled" ? (
          confirmCancel ? (
            <Button variant="danger" disabled={busy} onClick={() => void act(async () => {
              await cancelBooking({ data: { bookingId } });
              game.reload();
              setConfirmCancel(false);
            })}>
              Confirmar cancelamento
            </Button>
          ) : (
            <Button variant="danger" onClick={() => setConfirmCancel(true)}>Cancelar jogo</Button>
          )
        ) : null}
      </div>
      {full && !detail.joined ? <p className="mt-3 text-sm text-muted">As vagas acabaram.</p> : null}
    </>
  );
}
