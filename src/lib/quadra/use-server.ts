import { useEffect, useState } from "react";

export function useServerData<T>(loader: () => Promise<T>, deps: readonly unknown[]) {
  const [nonce, setNonce] = useState(0);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    loader()
      .then((value) => {
        if (!live) return;
        setData(value);
        setError(null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!live) return;
        setError(err instanceof Error ? err.message : "Não foi possível carregar.");
        setLoading(false);
      });
    return () => {
      live = false;
    };
    // loader identity changes every render; deps carry the real inputs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, ...deps]);

  return { data, error, loading, reload: () => setNonce((current) => current + 1) };
}
