/**
 * Regulatory Report Generation
 *
 * Generates compliance reports for ADFG (Alaska Dept of Fish & Game)
 * and NOAA (National Oceanic and Atmospheric Administration).
 * Includes species size limits, quota tracking, and eVTR generation.
 */

export interface SizeLimit {
  species: string;
  minSizeInches: number;
  maxSizeInches: number | null;
  measurementType: 'total_length' | 'fork_length' | 'carcass';
  seasonal: boolean;
  seasonStart: string | null;
  seasonEnd: string | null;
}

export interface QuotaStatus {
  species: string;
  quotaLbs: number;
  caughtLbs: number;
  percentUsed: number;
  remainingLbs: number;
  seasonEndDate: string;
}

export interface RegulatoryReport {
  reportType: 'ADFG' | 'NOAA_eVTR';
  vesselId: string;
  vesselName: string;
  permitNumber: string;
  dateRange: { start: string; end: string };
  catches: Array<{
    species: string;
    count: number;
    totalWeight: number;
    sizes: number[];
    location: string;
    gearType: string;
  }>;
  violations: Array<{
    type: string;
    species: string;
    detail: string;
    severity: 'warning' | 'violation';
  }>;
  generatedAt: string;
}

/** Alaska species size limits */
export const ADFG_SIZE_LIMITS: SizeLimit[] = [
  { species: 'king_salmon', minSizeInches: 28, maxSizeInches: null, measurementType: 'total_length', seasonal: false, seasonStart: null, seasonEnd: null },
  { species: 'halibut', minSizeInches: 32, maxSizeInches: 80, measurementType: 'fork_length', seasonal: false, seasonStart: null, seasonEnd: null },
  { species: 'lingcod', minSizeInches: 35, maxSizeInches: null, measurementType: 'total_length', seasonal: true, seasonStart: '05-01', seasonEnd: '11-30' },
  { species: 'rockfish', minSizeInches: 0, maxSizeInches: null, measurementType: 'total_length', seasonal: false, seasonStart: null, seasonEnd: null },
];

/** Example quotas for Pacific NW salmon season */
export const DEFAULT_QUOTAS: QuotaStatus[] = [
  { species: 'king_salmon', quotaLbs: 5000, caughtLbs: 0, percentUsed: 0, remainingLbs: 5000, seasonEndDate: '2026-09-30' },
  { species: 'coho', quotaLbs: 8000, caughtLbs: 0, percentUsed: 0, remainingLbs: 8000, seasonEndDate: '2026-09-30' },
  { species: 'sockeye', quotaLbs: 3000, caughtLbs: 0, percentUsed: 0, remainingLbs: 3000, seasonEndDate: '2026-09-30' },
  { species: 'halibut', quotaLbs: 2000, caughtLbs: 0, percentUsed: 0, remainingLbs: 2000, seasonEndDate: '2026-11-15' },
];

/**
 * Check a catch record against size limits.
 */
export function checkSizeCompliance(
  species: string,
  sizeInches: number,
  limits: SizeLimit[] = ADFG_SIZE_LIMITS,
): { compliant: boolean; violations: string[] } {
  const violations: string[] = [];
  const limit = limits.find(l => l.species === species);

  if (!limit) return { compliant: true, violations: [] };

  // Check seasonal restrictions
  if (limit.seasonal && limit.seasonStart && limit.seasonEnd) {
    const now = new Date();
    const monthDay = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (monthDay < limit.seasonStart || monthDay > limit.seasonEnd) {
      violations.push(`${species} season is closed (${limit.seasonStart} to ${limit.seasonEnd})`);
    }
  }

  // Check size limits
  if (limit.minSizeInches > 0 && sizeInches < limit.minSizeInches) {
    violations.push(`${species} at ${sizeInches}" is below minimum ${limit.minSizeInches}" (${limit.measurementType})`);
  }

  if (limit.maxSizeInches && sizeInches > limit.maxSizeInches) {
    violations.push(`${species} at ${sizeInches}" exceeds maximum ${limit.maxSizeInches}" (${limit.measurementType})`);
  }

  return { compliant: violations.length === 0, violations };
}

/**
 * Update quota status with a new catch.
 */
export function updateQuota(
  quota: QuotaStatus,
  additionalWeightLbs: number,
): QuotaStatus {
  const newCaught = quota.caughtLbs + additionalWeightLbs;
  return {
    ...quota,
    caughtLbs: Math.round(newCaught * 100) / 100,
    percentUsed: Math.round((newCaught / quota.quotaLbs) * 100 * 10) / 10,
    remainingLbs: Math.round((quota.quotaLbs - newCaught) * 100) / 100,
  };
}

/**
 * Generate an ADFG-formatted report.
 */
export function generateADFGReport(
  vesselId: string,
  vesselName: string,
  permitNumber: string,
  dateRange: { start: string; end: string },
  catches: RegulatoryReport['catches'],
  violations: RegulatoryReport['violations'],
): RegulatoryReport {
  return {
    reportType: 'ADFG',
    vesselId,
    vesselName,
    permitNumber,
    dateRange,
    catches,
    violations,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate a NOAA eVTR (Electronic Vessel Trip Report).
 */
export function generateEVTR(
  vesselId: string,
  vesselName: string,
  permitNumber: string,
  tripDate: string,
  catches: RegulatoryReport['catches'],
  departure: { port: string; time: string },
  arrival: { port: string; time: string },
): string {
  // eVTR format — structured text report
  const lines: string[] = [
    'ELECTRONIC VESSEL TRIP REPORT',
    '='.repeat(50),
    `Vessel: ${vesselName} (${vesselId})`,
    `Permit: ${permitNumber}`,
    `Trip Date: ${tripDate}`,
    `Departure: ${departure.port} at ${departure.time}`,
    `Arrival: ${arrival.port} at ${arrival.time}`,
    '',
    'CATCH REPORT',
    '-'.repeat(50),
  ];

  for (const entry of catches) {
    lines.push(
      `Species: ${entry.species}`,
      `  Count: ${entry.count}`,
      `  Weight: ${entry.totalWeight} lbs`,
      `  Gear: ${entry.gearType}`,
      `  Area: ${entry.location}`,
      '',
    );
  }

  lines.push('='.repeat(50));
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('FishingLog.ai — Electronic Vessel Trip Report');

  return lines.join('\n');
}
