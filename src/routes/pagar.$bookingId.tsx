import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getCheckout, preparePix, submitCard, submitPix } from "@/lib/quadra/api";
import { formatDay, luhnOk, pixDemoCode, sportLabel, statusLabel } from "@/lib/quadra/format";
import { useServerData } from "@/lib/quadra/use-server";
import { AppShell } from "@/components/shell";
import { Badge, Button, ErrorNote, Field, Input, Money, PageSkeleton } from "@/components/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pagar/$bookingId")({ component: PayPage });

function PayPage() {
  const { bookingId } = Route.useParams();
  return (
    <AppShell>
      <PayScreen bookingId={bookingId} />
    </AppShell>
  );
}

function PayScreen({ bookingId }: { bookingId: string }) {
  const checkout = useServerData(() => getCheckout({ data: { bookingId } }), [bookingId]);
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  if (checkout.loading && !checkout.data) return <PageSkeleton />;
  if (checkout.error || !checkout.data) return <ErrorNote>{checkout.error ?? "Pagamento indisponível."}</ErrorNote>;
  const data = checkout.data;
  const payment = data.payment;
  const settled = payment && ["pending", "paid", "validated"].includes(payment.status);

  async function showPix() {
    setBusy(true);
    setError(null);
    try {
      await preparePix({ data: { bookingId } });
      checkout.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível gerar o PIX.");
    } finally {
      setBusy(false);
    }
  }

  async function payPix() {
    setBusy(true);
    setError(null);
    try {
      await submitPix({ data: { bookingId } });
      checkout.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível registrar o PIX.");
    } finally {
      setBusy(false);
    }
  }

  async function payCard(event: FormEvent) {
    event.preventDefault();
    const digits = number.replace(/\D/g, "");
    if (name.trim().length < 3) return setError("Informe o nome impresso no cartão.");
    if (!luhnOk(digits)) return setError("Número de cartão inválido. No teste, use 4242 4242 4242 4242.");
    if (!/^\d{2}\/\d{2}$/.test(expiry)) return setError("Validade no formato MM/AA.");
    if (!/^\d{3,4}$/.test(cvv)) return setError("CVV inválido.");
    setBusy(true);
    setError(null);
    try {
      await submitCard({ data: { bookingId, last4: digits.slice(-4) } });
      checkout.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível autorizar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="text-sm font-medium text-pine">Pagamento</p>
      <h1 className="mt-1 text-3xl">{data.courtName}</h1>
      <p className="mt-2 text-sm text-muted">
        {sportLabel(data.sport)} · {formatDay(data.date)} · {data.start}–{data.end} · {data.neighborhood}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge status={data.status}>{statusLabel(data.status)}</Badge>
        <Badge>{data.kind === "open" ? "Jogo aberto" : "Reserva fechada"}</Badge>
        {payment ? <Badge status={payment.status}>{statusLabel(payment.status)}</Badge> : null}
      </div>
      <div className="mt-6 rounded-xl border border-line bg-card p-4">
        <p className="text-sm text-muted">{data.isHost && data.kind === "open" ? "Sua parte de anfitrião" : data.kind === "open" ? "Sua parte" : "Horário da quadra"}</p>
        <p className="mt-1 font-display text-4xl"><Money cents={data.amountCents} /></p>
        {data.kind === "open" ? (
          <p className="mt-2 text-sm text-faint">
            {data.filled} de {data.spots} confirmados · total da quadra <Money cents={data.priceCents} />
          </p>
        ) : null}
      </div>
      {settled && payment ? (
        <div className="mt-4 rounded-xl border border-line bg-card p-4">
          {payment.method === "pix" && payment.status === "pending" ? (
            <>
              <h2 className="text-xl">PIX informado</h2>
              <p className="mt-2 text-sm text-muted">A quadra continua retida até a administração validar. Referência {payment.reference}.</p>
              <p className="mt-3 break-all rounded-md bg-paper p-3 font-mono text-xs leading-relaxed">{pixDemoCode(payment.reference, data.amountCents)}</p>
            </>
          ) : (
            <>
              <h2 className="text-xl">{payment.status === "validated" ? "Pagamento validado" : "Pagamento registrado"}</h2>
              <p className="mt-2 text-sm text-muted">
                {payment.method === "card" ? `Cartão final ${payment.last4}` : `Referência ${payment.reference}`}. {statusLabel(payment.status)}.
              </p>
            </>
          )}
          {data.viewerIsAdmin && payment.status === "pending" ? (
            <Link to="/admin" className="mt-4 inline-block text-sm font-medium text-pine">Validar em Administração</Link>
          ) : null}
          <Button asChild variant="secondary" className="mt-4">
            <Link to="/agenda">Ir para a agenda</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMethod("pix")} className={cn("h-11 rounded-md border text-sm font-medium", method === "pix" ? "border-pine bg-pine text-mist" : "border-line bg-card")}>PIX</button>
            <button type="button" onClick={() => setMethod("card")} className={cn("h-11 rounded-md border text-sm font-medium", method === "card" ? "border-pine bg-pine text-mist" : "border-line bg-card")}>Cartão</button>
          </div>
          {method === "pix" ? (
            <div className="mt-4 rounded-xl border border-line bg-card p-4">
              <h2 className="text-xl">Pagar com PIX</h2>
              <p className="mt-2 text-sm text-muted">
                {data.pixValidation
                  ? "Gere o código, confirme o envio e aguarde a validação. A reserva segue retida."
                  : "Nesta configuração o PIX confirma na hora."}
              </p>
              {payment?.reference ? (
                <p className="mt-3 break-all rounded-md bg-paper p-3 font-mono text-xs leading-relaxed">
                  {pixDemoCode(payment.reference, data.amountCents)}
                </p>
              ) : null}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                {payment?.reference ? (
                  <>
                    <Button disabled={busy} onClick={() => void payPix()}>{busy ? "Registrando…" : "Já enviei o PIX"}</Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const value = pixDemoCode(payment.reference, data.amountCents);
                        void navigator.clipboard.writeText(value).then(
                          () => {
                            setCopied(true);
                            window.setTimeout(() => setCopied(false), 1500);
                          },
                          () => setError("Não foi possível copiar."),
                        );
                      }}
                    >
                      {copied ? "Copiado" : "Copiar código"}
                    </Button>
                  </>
                ) : (
                  <Button disabled={busy} onClick={() => void showPix()}>{busy ? "Gerando…" : "Gerar código PIX"}</Button>
                )}
              </div>
            </div>
          ) : (
            <form className="mt-4 grid gap-4 rounded-xl border border-line bg-card p-4" onSubmit={(event) => void payCard(event)}>
              <h2 className="text-xl">Cartão</h2>
              <Field label="Nome no cartão">
                <Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="cc-name" />
              </Field>
              <Field label="Número" hint="Teste: 4242 4242 4242 4242. O número completo não sai deste aparelho.">
                <Input inputMode="numeric" value={number} onChange={(event) => setNumber(event.target.value)} autoComplete="cc-number" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Validade">
                  <Input placeholder="MM/AA" value={expiry} onChange={(event) => setExpiry(event.target.value)} autoComplete="cc-exp" />
                </Field>
                <Field label="CVV">
                  <Input inputMode="numeric" value={cvv} onChange={(event) => setCvv(event.target.value)} autoComplete="cc-csc" />
                </Field>
              </div>
              <Button type="submit" disabled={busy}>{busy ? "Autorizando…" : "Autorizar cartão"}</Button>
            </form>
          )}
        </div>
      )}
      {error ? <div className="mt-4"><ErrorNote>{error}</ErrorNote></div> : null}
      {data.kind === "open" ? (
        <Link to="/jogo/$bookingId" params={{ bookingId }} className="mt-4 inline-block text-sm font-medium text-pine">Ver o jogo</Link>
      ) : null}
      <p className="mt-6 text-sm text-faint">Simulação: nenhum valor é enviado a um banco.</p>
    </>
  );
}
