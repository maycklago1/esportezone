import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { listCatalog } from "@/lib/quadra/api";
import { SPORTS, sportLabel, surfaceLabel } from "@/lib/quadra/format";
import { useServerData } from "@/lib/quadra/use-server";
import { CourtMark } from "@/components/court-mark";
import { AppShell } from "@/components/shell";
import { Badge, Button, Empty, ErrorNote, Input, Money, PageHeader, PageSkeleton } from "@/components/ui";

export const Route = createFileRoute("/explorar")({ component: ExplorarPage });

function ExplorarPage() {
  return (
    <AppShell>
      <Explorar />
    </AppShell>
  );
}

function Explorar() {
  const [sport, setSport] = useState("");
  const [city, setCity] = useState("");
  const [q, setQ] = useState("");
  const [draftQ, setDraftQ] = useState("");
  const [draftCity, setDraftCity] = useState("");
  const catalog = useServerData(() => listCatalog({ data: { sport, city, q } }), [sport, city, q]);

  return (
    <>
      <PageHeader kicker="Explorar" title="Quadras publicadas" lede="Escolha o esporte e o dia. Cada horário dura 60 minutos." />
      <form
        className="mb-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          setQ(draftQ);
          setCity(draftCity);
        }}
      >
        <Input value={draftQ} onChange={(event) => setDraftQ(event.target.value)} placeholder="Nome ou bairro" aria-label="Buscar quadra" />
        <Input value={draftCity} onChange={(event) => setDraftCity(event.target.value)} placeholder="Cidade" aria-label="Cidade" />
        <Button type="submit" variant="secondary">Buscar</Button>
      </form>
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        <FilterChip on={sport === ""} onClick={() => setSport("")}>Todos</FilterChip>
        {SPORTS.map((item) => (
          <FilterChip key={item.id} on={sport === item.id} onClick={() => setSport(item.id)}>
            {item.label}
          </FilterChip>
        ))}
      </div>
      {catalog.loading && !catalog.data ? <PageSkeleton /> : null}
      {catalog.error ? <ErrorNote>{catalog.error}</ErrorNote> : null}
      {catalog.data && catalog.data.courts.length === 0 ? (
        <Empty
          title="Nenhuma quadra por aqui"
          lede="Se a arena é sua, cadastre agora. Dá para carregar exemplos e ver a agenda funcionando."
          action={
            <Button asChild>
              <Link to="/dono">Cadastrar quadra</Link>
            </Button>
          }
        />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {catalog.data?.courts.map((court) => (
          <Link key={court.id} to="/quadra/$courtId" params={{ courtId: court.id }} className="block">
            <article className="overflow-hidden rounded-xl border border-line bg-card">
              <CourtMark sport={court.sport} className="h-28" />
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-xl">{court.name}</h2>
                  <Money cents={court.priceCents} className="shrink-0 text-sm font-medium" />
                </div>
                <p className="mt-1 text-sm text-muted">
                  {court.neighborhood}, {court.city}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge>{sportLabel(court.sport)}</Badge>
                  <Badge>{court.indoor ? "Coberta" : "Aberta"}</Badge>
                  <Badge>{surfaceLabel(court.surface)}</Badge>
                  {court.openGames > 0 ? <Badge status="pending">{court.openGames} jogo(s) aberto(s)</Badge> : null}
                </div>
              </div>
            </article>
          </Link>
        ))}
      </div>
      {catalog.data && catalog.data.cities.length > 0 ? (
        <div className="mt-6 flex flex-wrap gap-2">
          {catalog.data.cities.map((item) => (
            <FilterChip
              key={item}
              on={city.toLowerCase() === item.toLowerCase()}
              onClick={() => {
                setCity(item);
                setDraftCity(item);
              }}
            >
              {item}
            </FilterChip>
          ))}
        </div>
      ) : null}
    </>
  );
}

function FilterChip({ on, children, onClick }: { on: boolean; children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        on
          ? "h-10 shrink-0 rounded-md bg-pine px-3 text-sm font-medium text-mist"
          : "h-10 shrink-0 rounded-md border border-line bg-card px-3 text-sm font-medium text-ink"
      }
    >
      {children}
    </button>
  );
}
