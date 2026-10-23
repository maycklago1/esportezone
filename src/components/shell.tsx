import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Building2, CalendarDays, Compass, Shield, Users } from "lucide-react";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMe, type Me } from "@/lib/quadra/api";
import { APP_NAME } from "@/lib/quadra/format";
import { cn } from "@/lib/utils";
import { ErrorNote, Skeleton } from "@/components/ui";

type ShellValue = { me: Me; reloadMe: () => void };

const ShellContext = createContext<ShellValue | null>(null);

export function useMe(): ShellValue {
  const value = useContext(ShellContext);
  if (!value) throw new Error("Perfil indisponível.");
  return value;
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display text-xl tracking-tight text-ink", className)}>
      Quadra<span className="text-pine">Livre</span>
    </span>
  );
}

function AppSkeleton() {
  return (
    <div className="min-h-dvh bg-paper">
      <div className="mx-auto max-w-5xl px-4 py-5">
        <Skeleton className="h-8 w-36" />
        <div className="mt-8 space-y-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const path = useRouterState({ select: (state) => state.location.pathname });
  const userId = user?.id;
  const suggestedName = user?.displayName ?? "";

  useEffect(() => {
    if (!userId) return;
    let live = true;
    getMe({ data: { displayName: suggestedName } })
      .then((value) => {
        if (!live) return;
        setMe(value);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!live) return;
        setError(err instanceof Error ? err.message : "Não foi possível carregar o perfil.");
      });
    return () => {
      live = false;
    };
  }, [userId, suggestedName, nonce]);

  if (isPending || (user && !me && !error)) return <AppSkeleton />;
  if (!user || error === "Unauthorized") return <RedirectToSignIn />;
  if (!me) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <ErrorNote>{error ?? "Não foi possível carregar."}</ErrorNote>
      </main>
    );
  }

  const items = [
    { to: "/explorar", label: "Explorar", icon: Compass },
    { to: "/jogos", label: "Jogos", icon: Users },
    { to: "/agenda", label: "Agenda", icon: CalendarDays },
  ];
  if (me.role === "owner" || me.role === "admin") items.push({ to: "/dono", label: "Quadras", icon: Building2 });
  if (me.role === "admin") items.push({ to: "/admin", label: "Admin", icon: Shield });

  const highlighted = (to: string) => {
    if (to === "/explorar") return path.startsWith("/explorar") || path.startsWith("/quadra");
    if (to === "/jogos") return path.startsWith("/jogos") || path.startsWith("/jogo");
    if (to === "/agenda") return path.startsWith("/agenda") || path.startsWith("/pagar");
    return path.startsWith(to);
  };

  return (
    <ShellContext.Provider value={{ me, reloadMe: () => setNonce((current) => current + 1) }}>
      <div className="min-h-dvh bg-paper">
        <header className="sticky top-0 z-20 border-b border-line bg-paper">
          <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
            <Link to="/" aria-label={APP_NAME} className="shrink-0">
              <Wordmark />
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium",
                    highlighted(item.to) ? "bg-moss text-pine" : "text-muted hover:bg-moss hover:text-ink",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto min-w-0 [&_span]:max-w-32 [&_span]:truncate">
              <UserButton />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-nav">
          {me.status === "suspended" ? (
            <p className="mb-4 rounded-md border border-line bg-card px-3 py-2 text-sm text-danger">
              Esta conta está suspensa. Dá para consultar, mas não reservar nem alterar quadras.
            </p>
          ) : null}
          {children}
        </main>
        <nav
          className={cn(
            "fixed inset-x-0 bottom-0 z-20 grid border-t border-line bg-card md:hidden",
            items.length >= 5 ? "grid-cols-5" : items.length === 4 ? "grid-cols-4" : "grid-cols-3",
          )}
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {items.map((item) => {
            const Icon = item.icon;
            const on = highlighted(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn("flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-medium", on ? "text-pine" : "text-muted")}
              >
                <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </ShellContext.Provider>
  );
}
