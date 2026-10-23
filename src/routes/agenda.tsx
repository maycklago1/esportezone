import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { cancelBooking, listAgenda, renameMe } from "@/lib/quadra/api";
import { formatDay, sportLabel, statusLabel } from "@/lib/quadra/format";
import { useServerData } from "@/lib/quadra/use-server";
import { AppShell, useMe } from "@/components/shell";
import { Badge, Button, Empty, ErrorNote, Field, Input, Money, PageHeader, PageSkeleton } from "@/components/ui";

export const Route = createFileRoute("/agenda")({ component: AgendaPage });

function AgendaPage() {
  return (
    <AppShell>
      <Agenda />
    </AppShell>
  );
}

function Agenda() {
  const { me, reloadMe } = useMe();
  const agenda = useServerData(() => listAgenda(), []);
  const [name, setName] = useState(me.displayName);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <>
      <PageHeader kicker="Agenda" title="Seus horários" lede={`Conta ${me.accountCode}. O nome abaixo é o que os outros jogadores veem.`} />
      <form
        className="mb-6 flex flex-col gap-3 rounded-xl border border-line bg-card p-4 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          setBusy("name");
          setError(null);
          void renameMe({ data: { displayName: name } })
            .then(() => reloadMe())
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "Não foi possível salvar."))
            .finally(() => setBusy(null));
        }}
      >
        <div className="flex-1">
          <Field label="Nome na quadra">
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
        </div>
        <Button type="submit" variant="secondary" disabled={busy === "name"}>Salvar nome</Button>
      </form>
      {error ? <div className="mb-4"><ErrorNote>{error}</ErrorNote></div> : null}
      {agenda.loading && !agenda.data ? <PageSkeleton /> : null}
      {agenda.error ? <ErrorNote>{agenda.error}</ErrorNote> : null}
      {agenda.data && agenda.data.length === 0 ? (
        <Empty title="Nada marcado" lede="Quando você reservar ou entrar num jogo, o horário aparece aqui." action={<Link to="/explorar" className="text-sm font-medium text-pine">Explorar quadras</Link>} />
      ) : null}
      <div className="grid gap-3">
        {agenda.data?.map((item) => (
          <article key={item.id} className="rounded-xl border border-line bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl">{item.courtName}</h2>
                <p className="mt-1 text-sm text-muted">
                  {formatDay(item.date)} · {item.start}–{item.end} · {item.neighborhood}, {item.city}
                </p>
              </div>
              <Money cents={item.amountCents} className="text-sm font-medium" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge>{sportLabel(item.sport)}</Badge>
              <Badge>{item.kind === "open" ? "Jogo aberto" : "Fechada"}</Badge>
              <Badge status={item.status}>{statusLabel(item.status)}</Badge>
              <Badge status={item.paymentStatus ?? "draft"}>{item.paymentStatus ? statusLabel(item.paymentStatus) : "Sem pagamento"}</Badge>
              {item.kind === "open" ? <Badge>{item.filled} de {item.spots}</Badge> : null}
            </div>
            {item.note ? <p className="mt-3 text-sm text-muted">{item.note}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/pagar/$bookingId" params={{ bookingId: item.id }} className="text-sm font-medium text-pine">Pagamento</Link>
              {item.kind === "open" ? (
                <Link to="/jogo/$bookingId" params={{ bookingId: item.id }} className="text-sm font-medium text-pine">Jogo</Link>
              ) : null}
              {item.isHost && item.status !== "cancelled" ? (
                <button
                  type="button"
                  className="text-sm font-medium text-danger"
                  disabled={busy === item.id}
                  onClick={() => {
                    setBusy(item.id);
                    setError(null);
                    void cancelBooking({ data: { bookingId: item.id } })
                      .then(() => agenda.reload())
                      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Não foi possível cancelar."))
                      .finally(() => setBusy(null));
                  }}
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
