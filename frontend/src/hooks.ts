import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

export function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || "Something went wrong");
}

export function useAsync<T>(loader: () => Promise<T>, deps: unknown[]): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: true });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(() => {
    let alive = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    loaderRef
      .current()
      .then((data) => {
        if (alive) setState({ data, error: null, loading: false });
      })
      .catch((error) => {
        if (alive) setState({ data: null, error: errorText(error), loading: false });
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(run, deps);

  return { ...state, reload: run };
}

export function useToast(): [string | null, (message: string | null) => void] {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 4200);
    return () => window.clearTimeout(timer);
  }, [message]);
  return [message, setMessage];
}
