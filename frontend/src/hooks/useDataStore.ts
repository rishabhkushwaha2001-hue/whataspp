/**
 * useDataStore — Global in-memory cache for API data.
 *
 * How it works:
 * - Data is stored in a module-level cache (survives re-renders, not app restarts).
 * - Each cache key has a timestamp. If data is fresh (< STALE_MS old), screen
 *   focus will NOT trigger a re-fetch — it just uses cached data instantly.
 * - If data is stale or missing, it fetches once and caches the result.
 * - When you mutate data (add/renew/delete), call `invalidate(key)` so the
 *   next focus triggers a fresh fetch.
 * - Pull-to-refresh always bypasses the cache.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import { api } from '../services/api';

// How long data stays "fresh" — 5 minutes
const STALE_MS = 5 * 60 * 1000;

// Module-level cache — shared across all component instances
type CacheEntry = {
  data: any;
  fetchedAt: number;
};

const cache: Record<string, CacheEntry> = {};

/**
 * Invalidate one or more cache keys so next focus triggers a re-fetch.
 * Call this after add/update/delete operations.
 */
export const invalidateCache = (...keys: string[]) => {
  keys.forEach(key => {
    delete cache[key];
  });
};

/**
 * Manually update a cache key without re-fetching (optimistic update).
 */
export const updateCache = (key: string, data: any) => {
  cache[key] = { data, fetchedAt: Date.now() };
};

/**
 * Hook: fetches data for a single endpoint with caching.
 *
 * @param key     - Unique cache key (e.g. 'members', 'dashboard_month')
 * @param endpoint - API endpoint string (e.g. '/members/')
 * @param options  - Optional config
 *
 * Returns: { data, loading, refreshing, refresh }
 * - `data`       — cached or freshly fetched data
 * - `loading`    — true only on the very first load (no cached data yet)
 * - `refreshing` — true during pull-to-refresh
 * - `refresh()`  — call to force a fresh fetch (e.g. pull-to-refresh)
 */
export function useCachedFetch<T = any>(
  key: string,
  endpoint: string,
  options?: {
    staleMs?: number;
    transform?: (raw: any) => T;
    skip?: boolean; // set true to not fetch at all
  }
) {
  const staleMs = options?.staleMs ?? STALE_MS;
  const transform = options?.transform;

  const [data, setData] = useState<T | null>(() => {
    const cached = cache[key];
    if (cached) return transform ? transform(cached.data) : cached.data;
    return null;
  });
  const [loading, setLoading] = useState(() => !cache[key]);
  const [refreshing, setRefreshing] = useState(false);
  const isFetching = useRef(false);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (options?.skip) return;
    if (isFetching.current) return; // prevent double-calls

    const cached = cache[key];
    const isFresh = cached && (Date.now() - cached.fetchedAt < staleMs);

    // If data is fresh and this is NOT a forced refresh, skip the API call
    if (isFresh && !forceRefresh) {
      setData(transform ? transform(cached.data) : cached.data);
      setLoading(false);
      return;
    }

    isFetching.current = true;
    if (forceRefresh) {
      setRefreshing(true);
    } else if (!cached) {
      setLoading(true);
    }

    try {
      const res = await api.get(endpoint);
      const raw = res.data;
      cache[key] = { data: raw, fetchedAt: Date.now() };
      setData(transform ? transform(raw) : raw);
    } catch (err) {
      console.warn(`[Cache] Fetch failed for "${key}":`, err);
      // Keep showing old data if available
    } finally {
      isFetching.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [key, endpoint, staleMs, options?.skip]);

  // On screen focus: only fetch if stale or missing
  useFocusEffect(
    useCallback(() => {
      fetchData(false);
    }, [fetchData])
  );

  const refresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  // Always return a non-null data by falling back to null — callers should use ?? []
  return { data: data ?? null, loading, refreshing, refresh } as {
    data: T | null;
    loading: boolean;
    refreshing: boolean;
    refresh: () => void;
  };
}

/**
 * Hook: fetches data for multiple endpoints in parallel, with per-key caching.
 *
 * IMPORTANT: Pass a STABLE array (useMemo or module-level const) to avoid re-renders.
 * The hook internally uses useRef so it handles inline arrays safely.
 */
export function useCachedParallelFetch(
  requests: Array<{ key: string; endpoint: string; transform?: (raw: any) => any }>,
  staleMs = STALE_MS
) {
  // ✅ Store requests in a ref so fetchAll has a stable identity
  // This prevents infinite re-renders when caller passes a new array literal each render
  const requestsRef = useRef(requests);
  requestsRef.current = requests; // always up-to-date, but ref identity is stable

  const initialResults: Record<string, any> = {};
  let anyMissing = false;
  requests.forEach(({ key, transform }) => {
    const cached = cache[key];
    if (cached) {
      initialResults[key] = transform ? transform(cached.data) : cached.data;
    } else {
      anyMissing = true;
    }
  });

  const [results, setResults] = useState<Record<string, any>>(initialResults);
  const [loading, setLoading] = useState(anyMissing);
  const [refreshing, setRefreshing] = useState(false);
  const isFetching = useRef(false);

  // ✅ fetchAll has NO dependency on requests — reads from ref instead
  const fetchAll = useCallback(async (forceRefresh = false) => {
    if (isFetching.current) return;

    const reqs = requestsRef.current; // read current requests from ref

    // Determine which keys actually need fetching
    const toFetch = reqs.filter(({ key }) => {
      if (forceRefresh) return true;
      const cached = cache[key];
      return !cached || (Date.now() - cached.fetchedAt >= staleMs);
    });

    if (toFetch.length === 0) {
      // All data is fresh — re-populate state from cache without any API call
      const freshResults: Record<string, any> = {};
      reqs.forEach(({ key, transform }) => {
        const cached = cache[key];
        if (cached) freshResults[key] = transform ? transform(cached.data) : cached.data;
      });
      setResults(prev => {
        // Only update if data actually changed (prevents unnecessary re-renders)
        const changed = Object.keys(freshResults).some(k => prev[k] !== freshResults[k]);
        return changed ? { ...prev, ...freshResults } : prev;
      });
      setLoading(false);
      return;
    }

    isFetching.current = true;
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const fetched = await Promise.allSettled(
        toFetch.map(({ endpoint }) => api.get(endpoint))
      );

      const newResults: Record<string, any> = {};
      toFetch.forEach(({ key, transform }, i) => {
        const result = fetched[i];
        if (result.status === 'fulfilled') {
          const raw = result.value.data;
          cache[key] = { data: raw, fetchedAt: Date.now() };
          newResults[key] = transform ? transform(raw) : raw;
        } else {
          const cached = cache[key];
          if (cached) newResults[key] = transform ? transform(cached.data) : cached.data;
        }
      });

      setResults(prev => ({ ...prev, ...newResults }));
    } catch (err) {
      console.warn('[Cache] Parallel fetch error:', err);
    } finally {
      isFetching.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [staleMs]); // ✅ No 'requests' in deps — stable identity guaranteed

  useFocusEffect(
    useCallback(() => {
      fetchAll(false);
    }, [fetchAll])
  );

  // Automatically fetch when the requested keys change (e.g. switching period on dashboard)
  const keysString = JSON.stringify(requests.map(r => r.key));
  useEffect(() => {
    fetchAll(false);
  }, [keysString, fetchAll]);

  const refresh = useCallback(() => {
    fetchAll(true);
  }, [fetchAll]);

  return { results, loading, refreshing, refresh };
}
