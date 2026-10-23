import { useState, type FormEvent } from "react";
import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Wordmark } from "@/components/shell";
import { Button, ErrorNote, Field, Input, Skeleton } from "@/components/ui";

export const Route = createFileRoute("/login")({ component: LoginPage });

function translateAuth(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("pop-up") || lower.includes("popup")) return "O navegador bloqueou a janela de entrada. Permita pop-ups e tente de novo.";
  if (lower.includes("cancel")) return "Entrada cancelada.";
  if (lower.includes("already") || lower.includes("exist")) return "Já existe uma conta com este e-mail.";
  if (lower.includes("invalid email")) return "E-mail inválido.";
  if (lower.includes("password") || lower.includes("credential")) return "E-mail ou senha não conferem.";
  if (lower.includes("origin")) return "Não foi possível entrar deste endereço.";
  return "Não foi possível entrar. Confira os dados e tente de novo.";
}

function LoginPage() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"entrar" | "criar">("entrar");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isPending) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="mt-6 h-48 w-full" />
      </main>
    );
  }
  if (user) return <Navigate to="/explorar" />;
  if (!authEnabled) return <main className="p-8 text-sm text-muted">O acesso está desligado.</main>;

  async function onEmail(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (mode === "criar" && name.trim().length < 2) {
      setError("Diga como você quer aparecer na quadra.");
      return;
    }
    setBusy(true);
    try {
      const result =
        mode === "criar"
          ? await authClient.signUp.email({ email: email.trim(), password, name: name.trim() })
          : await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) {
        setError(translateAuth(result.error.message ?? ""));
        return;
      }
      await navigate({ to: "/explorar" });
    } catch (err) {
      setError(translateAuth(err instanceof Error ? err.message : ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-8">
      <Link to="/" className="w-fit">
        <Wordmark />
      </Link>
      <h1 className="mt-10 text-3xl">{mode === "criar" ? "Criar conta" : "Entrar"}</h1>
      <p className="mt-2 text-sm text-muted">Jogadores e donos de quadra usam o mesmo acesso. A gestão da arena fica depois do login.</p>
      <div className="mt-6 grid gap-2">
        {GROK_PROVIDERS.map((provider) => (
          <Button
            key={provider.providerId}
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setError(null);
              setBusy(true);
              void signIn(provider.providerId, { callbackURL: "/explorar" })
                .catch((err: unknown) => setError(translateAuth(err instanceof Error ? err.message : "")))
                .finally(() => setBusy(false));
            }}
          >
            Continuar com {provider.label}
          </Button>
        ))}
      </div>
      <p className="my-5 text-center text-sm text-faint">ou com e-mail</p>
      <form className="grid gap-4" onSubmit={(event) => void onEmail(event)}>
        {mode === "criar" ? (
          <Field label="Nome na quadra">
            <Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
          </Field>
        ) : null}
        <Field label="E-mail">
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
        </Field>
        <Field label="Senha" hint="Mínimo de 8 caracteres.">
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "criar" ? "new-password" : "current-password"} required />
        </Field>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <Button type="submit" disabled={busy}>
          {busy ? "Aguarde…" : mode === "criar" ? "Criar conta" : "Entrar"}
        </Button>
      </form>
      <button
        type="button"
        className="mt-4 text-sm font-medium text-pine"
        onClick={() => {
          setMode(mode === "criar" ? "entrar" : "criar");
          setError(null);
        }}
      >
        {mode === "criar" ? "Já tenho conta" : "Ainda não tenho conta"}
      </button>
    </main>
  );
}
