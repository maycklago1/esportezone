import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { listGames } from "@/lib/quadra/api";
import { formatDay, SPORTS, sportLabel } from "@/lib/quadra/format";
import { useServerData } from "@/lib/quadra/use-server";
import { AppShell } from "@/components/shell";
import { Badge, Empty, ErrorNote, Money, PageHeader, PageSkeleton } from "@/components/ui";

export const Route = createFileRoute("/jogos")({ component: JogosPage });

function JogosPage() {
  return (
    <AppShell>
      <Jogos />
    </AppShell>
  );
}

function Jogos() {
  const [sport, setSport] = useState("");
  const games = useServerData(() => listGames({ data: { sport } }), [sport]);
  return (
    <>
      <PageHeader kicker="Jogos abertos" title="Partidas com vaga" lede="Entre pagando só a sua parte. Quem abre o jogo organiza o horário." />
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        <Chip on={sport === ""} onClick={() => setSport("")}>Todos</Chip>
        {SPORTS.map((item) => (
          <Chip key={item.id} on={sport === item.id} onClick={() => setSport(item.id)}>
            {item.label}
          </Chip>
        ))}
      </div>
      {games.loading && !games.data ? <PageSkeleton /> : null}
      {games.error ? <ErrorNote>{games.error}</ErrorNote> : null}
      {games.data && games.data.length === 0 ? (
        <Empty title="Nenhum jogo aberto" lede="Reserve uma quadra como jogo aberto e as vagas aparecem aqui." action={<Link to="/explorar" className="text-sm font-medium text-pine">Ver quadras</Link>} />
      ) : null}
      <div className="grid gap-3">
        {games.data?.map((game) => (
          <Link key={game.id} to="/jogo/$bookingId" params={{ bookingId: game.id }}>
            <article className="rounded-xl border border-line bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl">{game.courtName}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {formatDay(game.date)} · {game.start}–{game.end} · {game.neighborhood}
                  </p>
                </div>
                <Money cents={game.shareCents} className="text-sm font-medium" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge>{sportLabel(game.sport)}</Badge>
                <Badge status={game.filled >= game.spots ? "busy" : "pending"}>
                  {game.filled} de {game.spots}
                </Badge>
                {game.joined ? <Badge status="active">Você está dentro</Badge> : null}
              </div>
              <p className="mt-3 text-sm text-muted">{game.note || `Organiza ${game.hostName}.`}</p>
            </article>
          </Link>
        ))}
      </div>
    </>
  );
}

function Chip({ on, children, onClick }: { on: boolean; children: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={on ? "h-10 shrink-0 rounded-md bg-pine px-3 text-sm font-medium text-mist" : "h-10 shrink-0 rounded-md border border-line bg-card px-3 text-sm font-medium"}>
      {children}
    </button>
  );
}
