/**
 * Offline Mode Management
 *
 * Detects connectivity status, queues cloud tasks for when online,
 * manages local model fallback, and syncs training data when reconnected.
 */

export type ConnectivityStatus = 'online' | 'offline' | 'degraded';

export interface OfflineQueue<T = unknown> {
  items: Array<{ payload: T; addedAt: string; retries: number; priority: number }>;
  maxSize: number;
}

export interface SyncConfig {
  syncIntervalMs: number;
  batchSize: number;
  maxRetries: number;
  priorityOrder: Array<'alerts' | 'corrections' | 'catch_data' | 'images'>;
}

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  syncIntervalMs: 30000, // 30 seconds
  batchSize: 20,
  maxRetries: 3,
  priorityOrder: ['alerts', 'corrections', 'catch_data', 'images'],
};

/**
 * Create an offline task queue.
 */
export function createQueue<T>(maxSize: number = 1000): OfflineQueue<T> {
  return { items: [], maxSize };
}

/**
 * Enqueue a task for later sync.
 */
export function enqueue<T>(
  queue: OfflineQueue<T>,
  payload: T,
  priority: number = 0,
): OfflineQueue<T> {
  const item = { payload, addedAt: new Date().toISOString(), retries: 0, priority };

  // Insert sorted by priority (higher first)
  const insertIdx = queue.items.findIndex(i => i.priority < priority);
  if (insertIdx === -1) {
    queue.items.push(item);
  } else {
    queue.items.splice(insertIdx, 0, item);
  }

  // Evict oldest low-priority items if over capacity
  while (queue.items.length > queue.maxSize) {
    const lowestIdx = queue.items.reduce(
      (min, item, idx) => (item.priority < queue.items[min].priority ? idx : min),
      0,
    );
    queue.items.splice(lowestIdx, 1);
  }

  return queue;
}

/**
 * Dequeue the next batch of tasks for sync.
 */
export function dequeueBatch<T>(
  queue: OfflineQueue<T>,
  batchSize: number = 20,
): Array<{ payload: T; addedAt: string; retries: number; priority: number }> {
  return queue.items.splice(0, batchSize);
}

/**
 * Detect current connectivity status.
 * In production, this checks actual network connectivity.
 */
export function detectConnectivity(): ConnectivityStatus {
  if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
    return navigator.onLine ? 'online' : 'offline';
  }
  // Server-side: assume online, actual check would ping cloud endpoint
  return 'online';
}

/**
 * Process the sync queue — attempt to upload queued items to cloud.
 */
export async function processSyncQueue<T>(
  queue: OfflineQueue<T>,
  uploadFn: (items: T[]) => Promise<number>,
  config: SyncConfig = DEFAULT_SYNC_CONFIG,
): Promise<{ synced: number; failed: number; remaining: number }> {
  let synced = 0;
  let failed = 0;

  while (queue.items.length > 0) {
    const batch = dequeueBatch(queue, config.batchSize);
    if (batch.length === 0) break;

    try {
      const uploaded = await uploadFn(batch.map(b => b.payload));
      synced += uploaded;
    } catch {
      // Re-enqueue failed items with incremented retry count
      for (const item of batch) {
        if (item.retries < config.maxRetries) {
          queue.items.push({ ...item, retries: item.retries + 1 });
        } else {
          failed++;
        }
      }
      break; // Stop processing on failure
    }
  }

  return { synced, failed, remaining: queue.items.length };
}
