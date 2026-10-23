import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, Shield, Users, Wallet } from "lucide-react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getSnapshot, type Snapshot } from "@/lib/quadra/api";
import { formatDay, greeting, statusLabel } from "@/lib/quadra/format";
import { AppShell, useMe, Wordmark } from "@/components/shell";
import { Button, Card, PageHeader, Skeleton } from "@/components/ui";

export const Route = createFileRoute("/")({ component: Home });

const facts = [
  { label: "Reserva", value: "60 min", detail: "Horário fechado ou dividido num jogo aberto." },
  { label: "Pagamento", value: "Na hora", detail: "PIX em análise ou cartão autorizado na plataforma." },
  { label: "Controle", value: "Por quadra", detail: "O dono define dias, preço e o que está livre." },
];

const roles = [
  { icon: CalendarClock, title: "Jogador", text: "Escolhe esporte, dia e horário. A vaga fica retida até o pagamento." },
  { icon: Users, title: "Jogo aberto", text: "Publica as vagas ou entra numa partida que ainda cabe no seu horário." },
  { icon: Wallet, title: "Dono da quadra", text: "Cadastra a arena, pausa um dia cheio e acompanha quem reservou." },
  { icon: Shield, title: "Administração", text: "Valida pagamentos, ajusta preços e suspende contas sem ver e-mail." },
];

function Marketing() {
  return (
    <div className="min-h-dvh bg-paper">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <Wordmark />
        <Button asChild>
          <Link to="/login">Entrar</Link>
        </Button>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16">
        <p className="text-sm font-medium text-pine">Quadras, horários e gente para jogar</p>
        <h1 className="mt-3 max-w-3xl text-4xl text-ink md:text-5xl">A quadra certa, no horário que ainda está livre.</h1>
        <p className="mt-4 max-w-xl text-muted">
          QuadraLivre liga quem tem a quadra e quem quer jogar. Reserve para o seu grupo, abra vagas ou acompanhe a agenda de cada arena.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link to="/login">Entrar para jogar</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link to="/login">Cadastrar minha quadra</Link>
          </Button>
        </div>
        <dl className="mt-10 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
          {facts.map((fact) => (
            <div key={fact.label} className="bg-card p-4">
              <dt className="text-sm text-muted">{fact.label}</dt>
              <dd className="mt-1 font-display text-2xl text-ink">{fact.value}</dd>
              <p className="mt-2 text-sm text-muted">{fact.detail}</p>
            </div>
          ))}
        </dl>
        <section className="mt-12 grid gap-4 md:grid-cols-2">
          {roles.map((role) => {
            const Icon = role.icon;
            return (
              <Card key={role.title}>
                <Icon className="size-5 text-pine" strokeWidth={1.75} aria-hidden="true" />
                <h2 className="mt-3 text-xl">{role.title}</h2>
                <p className="mt-2 text-sm text-muted">{role.text}</p>
              </Card>
            );
          })}
        </section>
        <p className="mt-8 text-sm text-faint">Futsal, society, tênis, beach tennis, vôlei, basquete, padel e futevôlei.</p>
        <p className="mt-2 text-sm text-faint">Pagamentos nesta versão são simulados. Nenhum valor real é cobrado.</p>
      </main>
    </div>
  );
}

function HomeDash() {
  const { me } = useMe();
  const [hello, setHello] = useState(`Olá, ${me.displayName}`);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHello(greeting(me.displayName));
  }, [me.displayName]);

  useEffect(() => {
    let live = true;
    getSnapshot()
      .then((value) => {
        if (live) setSnap(value);
      })
      .catch((err: unknown) => {
        if (live) setError(err instanceof Error ? err.message : "Não foi possível carregar.");
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <>
      <PageHeader kicker="Hoje" title={hello} lede="Reserve um horário, entre num jogo aberto ou cuide das suas quadras." />
      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
      {!snap ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <p className="text-sm text-muted">Quadras publicadas</p>
            <p className="mt-1 font-display text-3xl tabular-nums">{snap.catalog}</p>
          </Card>
          <Card>
            <p className="text-sm text-muted">Jogos abertos</p>
            <p className="mt-1 font-display text-3xl tabular-nums">{snap.openGames}</p>
          </Card>
          <Card>
            <p className="text-sm text-muted">Na sua agenda</p>
            <p className="mt-1 font-display text-3xl tabular-nums">{snap.myUpcoming}</p>
          </Card>
        </div>
      )}
      {snap?.next ? (
        <Card className="mt-4">
          <p className="text-sm text-muted">Próximo horário</p>
          <h2 className="mt-1 text-2xl">{snap.next.courtName}</h2>
          <p className="mt-1 text-sm text-muted">
            {formatDay(snap.next.date)} · {snap.next.start} · {snap.next.kind === "open" ? "Jogo aberto" : "Reserva fechada"} · {statusLabel(snap.next.status)}
          </p>
          <Link to="/pagar/$bookingId" params={{ bookingId: snap.next.id }} className="mt-4 inline-block">
            <Button variant="secondary">Ver pagamento</Button>
          </Link>
        </Card>
      ) : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link to="/explorar" className="block">
          <Card className="h-full hover:bg-moss">
            <h2 className="text-xl">Explorar quadras</h2>
            <p className="mt-2 text-sm text-muted">Filtre por esporte e cidade e escolha um horário de 60 minutos.</p>
          </Card>
        </Link>
        <Link to="/jogos" className="block">
          <Card className="h-full hover:bg-moss">
            <h2 className="text-xl">Jogos abertos</h2>
            <p className="mt-2 text-sm text-muted">Entre numa partida que já tem gente, pagando só a sua parte.</p>
          </Card>
        </Link>
        <Link to="/dono" className="block">
          <Card className="h-full hover:bg-moss">
            <h2 className="text-xl">{me.role === "player" ? "Cadastrar uma quadra" : "Minhas quadras"}</h2>
            <p className="mt-2 text-sm text-muted">
              {me.courtCount > 0 ? `${me.courtCount} quadra(s) na sua conta.` : "Publique horários, preço e o endereço da arena."}
            </p>
          </Card>
        </Link>
        {me.role === "admin" || me.adminCount === 0 ? (
          <Link to="/admin" className="block">
            <Card className="h-full hover:bg-moss">
              <h2 className="text-xl">{me.role === "admin" ? "Administração" : "Assumir a administração"}</h2>
              <p className="mt-2 text-sm text-muted">Pagamentos, preços e contas. Sem e-mail e sem telefone na tela.</p>
            </Card>
          </Link>
        ) : null}
      </div>
    </>
  );
}

function Home() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <div className="min-h-dvh bg-paper px-4 py-6">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="mt-8 h-16 w-full max-w-xl" />
      </div>
    );
  }
  if (!user) return <Marketing />;
  return (
    <AppShell>
      <HomeDash />
    </AppShell>
  );
}
