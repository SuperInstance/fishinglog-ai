/**
 * KV-Backed Memory for the Vessel Agent
 *
 * Persistent memory using Cloudflare KV for cloud deployment
 * and local JSON files for edge deployment.
 */

export interface MemoryEntry {
  key: string;
  value: string;
  category: 'fact' | 'correction' | 'preference' | 'observation';
  confidence: number;
  timestamp: string;
  expiresAt: string | null;
}

export interface MemoryStore {
  entries: Map<string, MemoryEntry>;
  maxEntries: number;
}

const MAX_ENTRIES = 1000;

/**
 * Create a new memory store.
 */
export function createMemoryStore(maxEntries: number = MAX_ENTRIES): MemoryStore {
  return {
    entries: new Map(),
    maxEntries,
  };
}

/**
 * Store a memory entry.
 */
export function store(
  store: MemoryStore,
  key: string,
  value: string,
  category: MemoryEntry['category'],
  confidence: number = 1.0,
): MemoryEntry {
  const entry: MemoryEntry = {
    key,
    value,
    category,
    confidence,
    timestamp: new Date().toISOString(),
    expiresAt: null,
  };

  store.entries.set(key, entry);

  // Evict oldest if over capacity
  if (store.entries.size > store.maxEntries) {
    const oldest = [...store.entries.entries()]
      .sort(([, a], [, b]) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];
    if (oldest) store.entries.delete(oldest[0]);
  }

  return entry;
}

/**
 * Retrieve a memory entry.
 */
export function retrieve(store: MemoryStore, key: string): MemoryEntry | null {
  return store.entries.get(key) ?? null;
}

/**
 * Search memory by category or partial key match.
 */
export function search(
  store: MemoryStore,
  query: { category?: MemoryEntry['category']; keyContains?: string },
): MemoryEntry[] {
  let results = [...store.entries.values()];

  if (query.category) {
    results = results.filter(e => e.category === query.category);
  }

  if (query.keyContains) {
    const lower = query.keyContains.toLowerCase();
    results = results.filter(e => e.key.toLowerCase().includes(lower));
  }

  return results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Persist memory to KV namespace (cloud) or JSON file (edge).
 */
export async function persistToKV(
  store: MemoryStore,
  kv: KVNamespace,
  vesselId: string,
): Promise<void> {
  const data = JSON.stringify([...store.entries.entries()]);
  await kv.put(`memory:${vesselId}`, data);
}

/**
 * Load memory from KV namespace.
 */
export async function loadFromKV(
  kv: KVNamespace,
  vesselId: string,
): Promise<MemoryStore> {
  const store = createMemoryStore();
  const data = await kv.get(`memory:${vesselId}`);

  if (data) {
    const entries = JSON.parse(data) as [string, MemoryEntry][];
    for (const [key, entry] of entries) {
      store.entries.set(key, entry);
    }
  }

  return store;
}
