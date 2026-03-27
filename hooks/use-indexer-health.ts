'use client';

import { useState, useEffect } from 'react';
import { fetchIndexerHealth } from '@/lib/api/backend';
import type { IndexerHealth } from '@/lib/api/backend';

/**
 * Polls GET /health every 15 seconds.
 * Returns indexerOk=true optimistically until the first response arrives,
 * so the UI doesn't flash-disable on initial load.
 */
export function useIndexerHealth() {
  const [health, setHealth] = useState<IndexerHealth | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const data = await fetchIndexerHealth();
        if (!cancelled) setHealth(data);
      } catch {
        if (!cancelled) {
          setHealth({ indexer_ok: false, last_heartbeat: 0, seconds_since_heartbeat: 0 });
        }
      }
    }

    poll();
    const id = setInterval(poll, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Optimistic default: treat as ok until we hear otherwise
  const indexerOk = health === null ? true : health.indexer_ok;
  return { health, indexerOk };
}
