import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DependencyList,
} from "react";
import { normalizeErrorMessage } from "../utils/errorMessages";

export interface UseApiQueryOptions<T> {
  enabled?: boolean;
  initialData?: T;
  onError?: (message: string, err: unknown) => void;
}

export interface UseApiQueryResult<T> {
  data: T;
  loading: boolean;
  error: string | null;
  reload: (opts?: { silent?: boolean }) => Promise<void>;
}

export function shouldShowLoading(
  silent: boolean,
  hasExistingData: boolean,
): boolean {
  return !silent || !hasExistingData;
}

export function useApiQuery<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList,
  options?: UseApiQueryOptions<T>,
): UseApiQueryResult<T> {
  const enabled = options?.enabled ?? true;
  const initialData = options?.initialData;
  const onError = options?.onError;

  const [data, setData] = useState<T>(
    () => (initialData !== undefined ? initialData : ([] as unknown as T)),
  );
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const hasLoadedOnceRef = useRef(initialData !== undefined);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const runFetch = useCallback(async (silent = false) => {
    const showLoading = shouldShowLoading(silent, hasLoadedOnceRef.current);

    if (showLoading) {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await fetcherRef.current();
      hasLoadedOnceRef.current = true;
      setData(result);
    } catch (err: unknown) {
      const message = normalizeErrorMessage(err);
      setError(message);
      onErrorRef.current?.(message, err);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void runFetch(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps controlam re-fetch
  }, [enabled, runFetch, ...deps]);

  const reload = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!enabled) return;
      await runFetch(opts?.silent ?? false);
    },
    [enabled, runFetch],
  );

  return { data, loading, error, reload };
}
