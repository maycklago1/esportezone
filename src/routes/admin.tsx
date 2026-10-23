import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { adminReviewPayment, adminSaveSettings, adminSetCourt, adminSetUser, claimAdmin, getAdminBundle, type AdminBundle } from "@/lib/quadra/api";
import { formatBRL, formatDay, parseReais, reaisInput, roleLabel, sportLabel, statusLabel } from "@/lib/quadra/format";
import { useServerData } from "@/lib/quadra/use-server";
import { AppShell, useMe } from "@/components/shell";
import { Badge, Button, Card, ErrorNote, Field, Input, Money, PageHeader, PageSkeleton } from "@/components/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({ component: AdminPage });

const tabs = ["Resumo", "Quadras", "Jogos", "Pagamentos", "Contas", "Regras"] as const;
type Tab = (typeof tabs)[number];

function AdminPage() {
  return (
    <AppShell>
      <Admin />
    </AppShell>
  );
}

function Admin() {
  const { me, reloadMe } = useMe();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (me.role !== "admin") {
    return (
      <>
        <PageHeader kicker="Administração" title="Ainda não é a sua função" lede="Quem administra vê quadras, jogos, pagamentos e contas. E-mail e telefone não entram nessa tela." />
        {me.adminCount === 0 ? (
          <>
            {error ? <div className="mb-4"><ErrorNote>{error}</ErrorNote></div> : null}
            <Button
              disabled={busy}
              onClick={() => {
                setBusy(true);
                setError(null);
                void claimAdmin()
                  .then(() => reloadMe())
                  .catch((err: unknown) => setError(err instanceof Error ? err.message : "Não foi possível assumir."))
                  .finally(() => setBusy(false));
              }}
            >
              {busy ? "Assumindo…" : "Assumir a administração"}
            </Button>
            <p className="mt-3 text-sm text-faint">Só aparece enquanto ninguém ocupou o papel. Depois, só um admin transfere.</p>
          </>
        ) : (
          <p className="text-sm text-muted">A plataforma já tem administração. Peça a essa pessoa se precisar de acesso.</p>
        )}
      </>
    );
  }

  return <Console />;
}

function Console() {
  const bundle = useServerData(() => getAdminBundle(), []);
  const [tab, setTab] = useState<Tab>("Resumo");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (bundle.loading && !bundle.data) return <PageSkeleton />;
  if (bundle.error || !bundle.data) return <ErrorNote>{bundle.error ?? "Não foi possível carregar."}</ErrorNote>;
  const data = bundle.data;

  async function run(task: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await task();
      bundle.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader kicker="Administração" title="Visão da plataforma" lede="Contas aparecem pelo nome público e por um código. E-mail, telefone e documentos não são exibidos." />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((item) => (
          <button key={item} type="button" onClick={() => setTab(item)} className={cn("h-10 shrink-0 rounded-md px-3 text-sm font-medium", tab === item ? "bg-pine text-mist" : "border border-line bg-card")}>
            {item}
          </button>
        ))}
      </div>
      {error ? <div className="mb-4"><ErrorNote>{error}</ErrorNote></div> : null}
      {tab === "Resumo" ? <Summary data={data} /> : null}
      {tab === "Quadras" ? <Courts data={data} busy={busy} run={run} /> : null}
      {tab === "Jogos" ? <Games data={data} /> : null}
      {tab === "Pagamentos" ? <Payments data={data} busy={busy} run={run} /> : null}
      {tab === "Contas" ? <Users data={data} busy={busy} run={run} /> : null}
      {tab === "Regras" ? <Rules data={data} busy={busy} run={run} /> : null}
    </>
  );
}

function Summary({ data }: { data: AdminBundle }) {
  const stats = [
    ["Quadras", data.stats.courts],
    ["Publicadas", data.stats.activeCourts],
    ["Jogos à frente", data.stats.games],
    ["PIX em análise", data.stats.pendingPayments],
    ["Contas", data.stats.users],
    ["Suspensas", data.stats.suspended],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {stats.map(([label, value]) => (
        <Card key={String(label)}>
          <p className="text-sm text-muted">{label}</p>
          <p className="mt-1 font-display text-3xl tabular-nums">{value}</p>
        </Card>
      ))}
    </div>
  );
}

function Courts({ data, busy, run }: { data: AdminBundle; busy: boolean; run: (task: () => Promise<unknown>) => Promise<void> }) {
  const [prices, setPrices] = useState<Record<string, string>>({});
  return (
    <div className="grid gap-3">
      {data.courts.length === 0 ? <p className="text-sm text-muted">Nenhuma quadra cadastrada.</p> : null}
      {data.courts.map((court) => (
        <Card key={court.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl">{court.name}</h2>
              <p className="mt-1 text-sm text-muted">
                {sportLabel(court.sport)} · {court.neighborhood}, {court.city} · {court.ownerName} · {court.ownerCode}
              </p>
            </div>
            <Money cents={court.priceCents} />
          </div>
          <div className="mt-3"><Badge status={court.status}>{statusLabel(court.status)}</Badge></div>
          <div className="mt-4 flex flex-wrap gap-2">
            {court.status !== "active" ? <Button size="sm" disabled={busy} onClick={() => void run(() => adminSetCourt({ data: { courtId: court.id, status: "active" } }))}>Publicar</Button> : null}
            {court.status === "active" ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => void run(() => adminSetCourt({ data: { courtId: court.id, status: "paused" } }))}>Pausar</Button> : null}
            {court.status !== "rejected" ? <Button size="sm" variant="danger" disabled={busy} onClick={() => void run(() => adminSetCourt({ data: { courtId: court.id, status: "rejected" } }))}>Recusar</Button> : null}
          </div>
          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              const cents = parseReais(prices[court.id] ?? reaisInput(court.priceCents));
              if (!cents) return;
              void run(() => adminSetCourt({ data: { courtId: court.id, priceCents: cents } }));
            }}
          >
            <Input aria-label={`Preço de ${court.name}`} value={prices[court.id] ?? reaisInput(court.priceCents)} onChange={(event) => setPrices({ ...prices, [court.id]: event.target.value })} />
            <Button type="submit" variant="secondary" disabled={busy}>Salvar valor</Button>
          </form>
        </Card>
      ))}
    </div>
  );
}

function Games({ data }: { data: AdminBundle }) {
  return (
    <div className="grid gap-3">
      {data.games.length === 0 ? <p className="text-sm text-muted">Nenhum jogo no período.</p> : null}
      {data.games.map((game) => (
        <Card key={game.id}>
          <h2 className="text-lg">{game.courtName}</h2>
          <p className="mt-1 text-sm text-muted">
            {formatDay(game.date)} · {game.start} · {game.hostName} · {game.filled} de {game.spots}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge>{game.kind === "open" ? "Jogo aberto" : "Fechada"}</Badge>
            <Badge status={game.status}>{statusLabel(game.status)}</Badge>
            <Money cents={game.priceCents} className="text-sm" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function Payments({ data, busy, run }: { data: AdminBundle; busy: boolean; run: (task: () => Promise<unknown>) => Promise<void> }) {
  return (
    <div className="grid gap-3">
      {data.payments.length === 0 ? <p className="text-sm text-muted">Nenhum pagamento.</p> : null}
      {data.payments.map((payment) => (
        <Card key={payment.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg">{payment.payerName}</h2>
              <p className="mt-1 text-sm text-muted">
                {payment.payerCode} · {payment.courtName} · {formatDay(payment.date)} {payment.start}
              </p>
              <p className="mt-1 text-sm text-faint">
                {payment.method === "pix" ? "PIX" : `Cartão ${payment.last4}`} · {payment.reference}
              </p>
            </div>
            <Money cents={payment.amountCents} className="font-medium" />
          </div>
          <div className="mt-3"><Badge status={payment.status}>{statusLabel(payment.status)}</Badge></div>
          <div className="mt-4 flex flex-wrap gap-2">
            {payment.status === "pending" || payment.status === "paid" ? (
              <Button size="sm" disabled={busy} onClick={() => void run(() => adminReviewPayment({ data: { paymentId: payment.id, action: "validate" } }))}>Validar</Button>
            ) : null}
            {payment.status === "pending" || payment.status === "draft" ? (
              <Button size="sm" variant="danger" disabled={busy} onClick={() => void run(() => adminReviewPayment({ data: { paymentId: payment.id, action: "reject" } }))}>Recusar</Button>
            ) : null}
            {payment.status === "paid" || payment.status === "validated" ? (
              <Button size="sm" variant="danger" disabled={busy} onClick={() => void run(() => adminReviewPayment({ data: { paymentId: payment.id, action: "refund" } }))}>Estornar</Button>
            ) : null}
          </div>
        </Card>
      ))}
    </div>
  );
}

function Users({ data, busy, run }: { data: AdminBundle; busy: boolean; run: (task: () => Promise<unknown>) => Promise<void> }) {
  const [roles, setRoles] = useState<Record<string, string>>({});
  return (
    <div className="grid gap-3">
      {data.users.map((user) => (
        <Card key={user.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg">{user.name}</h2>
              <p className="mt-1 text-sm text-muted">{user.code} · desde {formatDay(user.createdOn)} · {user.courts} quadra(s) · {user.games} jogo(s)</p>
            </div>
            <Badge status={user.status}>{user.status === "active" ? "Ativa" : "Suspensa"}</Badge>
          </div>
          <p className="mt-2 text-sm text-faint">{roleLabel(user.role)}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <select
              className="h-11 rounded-md border border-line bg-card px-3 text-sm"
              value={roles[user.id] ?? user.role}
              onChange={(event) => setRoles({ ...roles, [user.id]: event.target.value })}
              aria-label={`Papel de ${user.name}`}
            >
              <option value="player">Jogador</option>
              <option value="owner">Dono de quadra</option>
              <option value="admin">Administração</option>
            </select>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void run(() => adminSetUser({ data: { userId: user.id, role: roles[user.id] ?? user.role } }))}>
              Aplicar papel
            </Button>
            <Button
              size="sm"
              variant={user.status === "active" ? "danger" : "secondary"}
              disabled={busy}
              onClick={() => void run(() => adminSetUser({ data: { userId: user.id, status: user.status === "active" ? "suspended" : "active" } }))}
            >
              {user.status === "active" ? "Suspender" : "Reativar"}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Rules({ data, busy, run }: { data: AdminBundle; busy: boolean; run: (task: () => Promise<unknown>) => Promise<void> }) {
  const [fee, setFee] = useState(String(data.settings.feeBps / 100));
  const [min, setMin] = useState(reaisInput(data.settings.minPriceCents));
  const [max, setMax] = useState(reaisInput(data.settings.maxPriceCents));
  const [pix, setPix] = useState(data.settings.pixValidation);
  return (
    <Card>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const minCents = parseReais(min);
          const maxCents = parseReais(max);
          if (!minCents || !maxCents) return;
          void run(() => adminSaveSettings({ data: { feePercent: Number(fee.replace(",", ".")), minCents, maxCents, pixValidation: pix } }));
        }}
      >
        <Field label="Taxa da plataforma (%)" hint="Descontada do repasse ao dono. O jogador paga o valor da quadra.">
          <Input inputMode="decimal" value={fee} onChange={(event) => setFee(event.target.value)} />
        </Field>
        <Field label="Preço mínimo por hora">
          <Input inputMode="decimal" value={min} onChange={(event) => setMin(event.target.value)} />
        </Field>
        <Field label="Preço máximo por hora">
          <Input inputMode="decimal" value={max} onChange={(event) => setMax(event.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={pix} onChange={(event) => setPix(event.target.checked)} />
          PIX precisa de validação manual
        </label>
        <Button type="submit" disabled={busy}>Salvar regras</Button>
      </form>
    </Card>
  );
}
