/**
 * Seasonal Pattern Tracker
 *
 * Tracks catch patterns across seasons, tides, and conditions.
 * Helps predict where fish will be based on historical data.
 * This is the "scout memory" — remembering where fish were last year.
 */

export interface CatchEvent {
  species: string;
  count: number;
  location: [number, number]; // lat, lon
  timestamp: string;
  depth: number;
  waterTemp: number;
  tideStage: 'slack' | 'flood' | 'ebb';
  gearType: string;
}

export interface SeasonalPattern {
  species: string;
  month: number;
  avgCount: number;
  avgDepth: number;
  avgWaterTemp: number;
  bestTideStage: string;
  hotspotLocations: [number, number][];
  confidence: number; // based on sample size
  sampleSize: number;
}

export interface SeasonReport {
  season: 'spring' | 'summer' | 'fall' | 'winter';
  year: number;
  topSpecies: Array<{ species: string; totalCatch: number; trend: 'up' | 'down' | 'stable' }>;
  hotspots: Array<{ location: [number, number]; species: string; avgCount: number }>;
  patterns: SeasonalPattern[];
}

export function getMonth(month: number): number {
  return Math.max(1, Math.min(12, month));
}

export function getSeason(month: number): 'spring' | 'summer' | 'fall' | 'winter' {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'fall';
  return 'winter';
}

/**
 * Analyze historical catches to find seasonal patterns.
 */
export function analyzePatterns(catches: CatchEvent[]): SeasonalPattern[] {
  // Group by species + month
  const groups = new Map<string, CatchEvent[]>();
  for (const c of catches) {
    const month = new Date(c.timestamp).getMonth() + 1;
    const key = `${c.species}:${month}`;
    const existing = groups.get(key) ?? [];
    existing.push(c);
    groups.set(key, existing);
  }

  const patterns: SeasonalPattern[] = [];
  for (const [key, events] of groups) {
    const [species, monthStr] = key.split(':');
    const month = parseInt(monthStr);

    const avgCount = events.reduce((s, e) => s + e.count, 0) / events.length;
    const avgDepth = events.reduce((s, e) => s + e.depth, 0) / events.length;
    const avgTemp = events.reduce((s, e) => s + e.waterTemp, 0) / events.length;

    // Find best tide stage
    const tideCounts: Record<string, number> = {};
    for (const e of events) {
      tideCounts[e.tideStage] = (tideCounts[e.tideStage] ?? 0) + e.count;
    }
    const bestTide = Object.entries(tideCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown';

    // Find hotspot locations (top 3 by catch count)
    const locationCounts = new Map<string, { loc: [number, number]; count: number }>();
    for (const e of events) {
      const locKey = `${e.location[0].toFixed(3)},${e.location[1].toFixed(3)}`;
      const existing = locationCounts.get(locKey) ?? { loc: e.location, count: 0 };
      existing.count += e.count;
      locationCounts.set(locKey, existing);
    }
    const hotspots = [...locationCounts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(h => h.loc);

    // Confidence based on sample size (diminishing returns)
    const confidence = Math.min(1, events.length / 30);

    patterns.push({
      species,
      month,
      avgCount: Math.round(avgCount * 10) / 10,
      avgDepth: Math.round(avgDepth),
      avgWaterTemp: Math.round(avgTemp * 10) / 10,
      bestTideStage: bestTide,
      hotspotLocations: hotspots,
      confidence,
      sampleSize: events.length,
    });
  }

  return patterns.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Generate a season report comparing current year to historical data.
 */
export function generateSeasonReport(
  catches: CatchEvent[],
  year: number,
  season?: 'spring' | 'summer' | 'fall' | 'winter',
): SeasonReport {
  const now = new Date();
  const currentMonth = season ? { spring: 4, summer: 7, fall: 10, winter: 1 }[season] : now.getMonth() + 1;
  const effectiveSeason = season ?? getSeason(currentMonth);

  // Filter to this season across all years
  const seasonMonths = {
    spring: [3, 4, 5], summer: [6, 7, 8],
    fall: [9, 10, 11], winter: [12, 1, 2],
  }[effectiveSeason];

  const seasonCatches = catches.filter(c => {
    const m = new Date(c.timestamp).getMonth() + 1;
    return seasonMonths.includes(m);
  });

  // Current year vs previous
  const currentYearCatches = seasonCatches.filter(c => new Date(c.timestamp).getFullYear() === year);
  const previousCatches = seasonCatches.filter(c => new Date(c.timestamp).getFullYear() < year);

  // Species totals
  const speciesTotals = new Map<string, { current: number; previous: number }>();
  for (const c of currentYearCatches) {
    const entry = speciesTotals.get(c.species) ?? { current: 0, previous: 0 };
    entry.current += c.count;
    speciesTotals.set(c.species, entry);
  }
  for (const c of previousCatches) {
    const entry = speciesTotals.get(c.species) ?? { current: 0, previous: 0 };
    entry.previous += c.count;
    speciesTotals.set(c.species, entry);
  }

  const topSpecies = [...speciesTotals.entries()]
    .sort((a, b) => b[1].current - a[1].current)
    .slice(0, 10)
    .map(([species, totals]) => ({
      species,
      totalCatch: totals.current,
      trend: totals.current > totals.previous * 1.1 ? 'up' as const
        : totals.current < totals.previous * 0.9 ? 'down' as const
        : 'stable' as const,
    }));

  // Hotspots across all years in this season
  const locationSpecies = new Map<string, { loc: [number, number]; species: string; count: number }>();
  for (const c of seasonCatches) {
    const key = `${c.location[0].toFixed(3)},${c.location[1].toFixed(3)},${c.species}`;
    const entry = locationSpecies.get(key) ?? { loc: c.location, species: c.species, count: 0 };
    entry.count += c.count;
    locationSpecies.set(key, entry);
  }
  const hotspots = [...locationSpecies.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(({ loc, species, count }) => ({ location: loc, species, avgCount: Math.round(count / Math.max(previousCatches.length, 1)) }));

  return {
    season: effectiveSeason,
    year,
    topSpecies,
    hotspots,
    patterns: analyzePatterns(seasonCatches),
  };
}

/**
 * Suggest where to fish based on current conditions and historical patterns.
 * This is the "scout" — telling the captain where fish were last year at this time.
 */
export function suggestLocation(
  catches: CatchEvent[],
  targetSpecies: string[],
  currentMonth: number,
  currentDepth: number,
  currentTemp: number,
  currentTide: string,
): Array<{
  location: [number, number];
  species: string;
  reason: string;
  confidence: number;
}> {
  const patterns = analyzePatterns(catches);
  const relevantPatterns = patterns.filter(
    p => targetSpecies.includes(p.species) && p.month === currentMonth && p.confidence > 0
  );

  const suggestions: Array<{
    location: [number, number];
    species: string;
    reason: string;
    confidence: number;
  }> = [];

  for (const pattern of relevantPatterns) {
    for (const loc of pattern.hotspotLocations) {
      // Score based on condition match
      let score = pattern.confidence;
      if (Math.abs(pattern.avgDepth - currentDepth) < 10) score += 0.1;
      if (Math.abs(pattern.avgWaterTemp - currentTemp) < 3) score += 0.1;
      if (pattern.bestTideStage === currentTide) score += 0.15;

      suggestions.push({
        location: loc,
        species: pattern.species,
        reason: `Historical avg ${pattern.avgCount}/trip at ${pattern.avgDepth}f, ${pattern.avgWaterTemp}°F, best on ${pattern.bestTideStage} tide (${pattern.sampleSize} trips)`,
        confidence: Math.min(1, score),
      });
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}
