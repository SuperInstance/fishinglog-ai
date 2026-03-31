/**
 * Catch Tracking
 *
 * Real-time catch logging with daily/weekly/monthly summaries.
 * Exports to CSV and JSON formats.
 */

export interface CatchRecord {
  id: string;
  species: string;
  count: number;
  sizes: number[]; // lengths in inches
  estimatedWeights: number[]; // weights in lbs
  confidence: number;
  location: [number, number];
  timestamp: string;
  gearType: string;
  source: 'vision' | 'voice' | 'manual';
  images: string[]; // image hashes
  notes: string;
}

export interface DailySummary {
  date: string;
  vesselId: string;
  records: CatchRecord[];
  totalsBySpecies: Record<string, { count: number; totalWeight: number; avgSize: number }>;
  totalCatch: number;
  totalWeight: number;
  location: { start: [number, number]; end: [number, number] };
  weatherConditions: {
    windSpeed: number;
    waveHeight: number;
    waterTemp: number;
  };
}

/**
 * Create a new catch record.
 */
export function createCatchRecord(params: {
  species: string;
  count?: number;
  sizes?: number[];
  estimatedWeights?: number[];
  confidence?: number;
  location?: [number, number];
  gearType?: string;
  source?: CatchRecord['source'];
  images?: string[];
  notes?: string;
}): CatchRecord {
  return {
    id: crypto.randomUUID(),
    species: params.species,
    count: params.count ?? 1,
    sizes: params.sizes ?? [],
    estimatedWeights: params.estimatedWeights ?? [],
    confidence: params.confidence ?? 0,
    location: params.location ?? [0, 0],
    timestamp: new Date().toISOString(),
    gearType: params.gearType ?? 'unknown',
    source: params.source ?? 'vision',
    images: params.images ?? [],
    notes: params.notes ?? '',
  };
}

/**
 * Generate a daily summary from catch records.
 */
export function generateDailySummary(
  records: CatchRecord[],
  date: string,
  vesselId: string,
  weather?: DailySummary['weatherConditions'],
): DailySummary {
  const totalsBySpecies: Record<string, { count: number; totalWeight: number; avgSize: number; sizes: number[] }> = {};

  for (const record of records) {
    const existing = totalsBySpecies[record.species];
    if (existing) {
      existing.count += record.count;
      existing.totalWeight += record.estimatedWeights.reduce((a, b) => a + b, 0);
      existing.sizes.push(...record.sizes);
    } else {
      totalsBySpecies[record.species] = {
        count: record.count,
        totalWeight: record.estimatedWeights.reduce((a, b) => a + b, 0),
        sizes: [...record.sizes],
        avgSize: 0,
      };
    }
  }

  // Calculate averages
  for (const entry of Object.values(totalsBySpecies)) {
    entry.avgSize = entry.sizes.length > 0
      ? Math.round((entry.sizes.reduce((a, b) => a + b, 0) / entry.sizes.length) * 10) / 10
      : 0;
    delete (entry as any).sizes;
  }

  const totalCatch = Object.values(totalsBySpecies).reduce((sum, t) => sum + t.count, 0);
  const totalWeight = Object.values(totalsBySpecies).reduce((sum, t) => sum + t.totalWeight, 0);

  return {
    date,
    vesselId,
    records,
    totalsBySpecies: totalsBySpecies as DailySummary['totalsBySpecies'],
    totalCatch,
    totalWeight: Math.round(totalWeight * 100) / 100,
    location: { start: [0, 0], end: [0, 0] },
    weatherConditions: weather ?? { windSpeed: 0, waveHeight: 0, waterTemp: 0 },
  };
}

/**
 * Export catch records to CSV format.
 */
export function exportCSV(records: CatchRecord[]): string {
  const header = 'id,species,count,avg_size,estimated_weight,confidence,location,timestamp,gear_type,source,notes';
  const rows = records.map(r => {
    const avgSize = r.sizes.length > 0
      ? Math.round((r.sizes.reduce((a, b) => a + b, 0) / r.sizes.length) * 10) / 10
      : '';
    const totalWeight = Math.round(r.estimatedWeights.reduce((a, b) => a + b, 0) * 100) / 100;
    return [
      r.id, r.species, r.count, avgSize, totalWeight,
      r.confidence, `"${r.location.join(',')}"`, r.timestamp,
      r.gearType, r.source, `"${r.notes.replace(/"/g, '""')}"`,
    ].join(',');
  });
  return [header, ...rows].join('\n');
}

/**
 * Export catch records to JSON format.
 */
export function exportJSON(records: CatchRecord[]): string {
  return JSON.stringify(records, null, 2);
}
