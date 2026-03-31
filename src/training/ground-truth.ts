/**
 * Ground Truth Label Management
 *
 * Manages training labels from multiple sources:
 * - Captain voice corrections
 * - Crew sorting corrections via alerts
 * - Cloud model validations
 * - Regulatory data
 */

export interface GroundTruthLabel {
  id: string;
  imageHash: string;
  species: string;
  source: 'captain_voice' | 'crew_correction' | 'cloud_validation' | 'regulatory';
  confidence: number;
  timestamp: string;
  metadata: {
    vesselId: string;
    location: [number, number];
    waterTemp: number;
    depth: number;
    gearType: string;
  };
  validated: boolean;
}

export interface GroundTruthStore {
  labels: GroundTruthLabel[];
  lastUpdated: string;
  totalBySpecies: Record<string, number>;
  totalBySource: Record<string, number>;
}

/**
 * Create a ground truth label from a captain voice correction.
 */
export function createFromVoiceCorrection(
  imageHash: string,
  species: string,
  metadata: GroundTruthLabel['metadata'],
): GroundTruthLabel {
  return {
    id: crypto.randomUUID(),
    imageHash,
    species,
    source: 'captain_voice',
    confidence: 1.0, // Captain corrections are highest confidence
    timestamp: new Date().toISOString(),
    metadata,
    validated: true, // Captain corrections are auto-validated
  };
}

/**
 * Create a ground truth label from a crew correction.
 */
export function createFromCrewCorrection(
  imageHash: string,
  species: string,
  metadata: GroundTruthLabel['metadata'],
): GroundTruthLabel {
  return {
    id: crypto.randomUUID(),
    imageHash,
    species,
    source: 'crew_correction',
    confidence: 0.9,
    timestamp: new Date().toISOString(),
    metadata,
    validated: false, // Needs captain or cloud validation
  };
}

/**
 * Create from cloud model validation.
 */
export function createFromCloudValidation(
  imageHash: string,
  species: string,
  confidence: number,
  metadata: GroundTruthLabel['metadata'],
): GroundTruthLabel {
  return {
    id: crypto.randomUUID(),
    imageHash,
    species,
    source: 'cloud_validation',
    confidence,
    timestamp: new Date().toISOString(),
    metadata,
    validated: confidence >= 0.9,
  };
}

/**
 * Calculate statistics for the ground truth store.
 */
export function calculateStats(labels: GroundTruthLabel[]): {
  totalBySpecies: Record<string, number>;
  totalBySource: Record<string, number>;
  validatedCount: number;
  pendingValidation: number;
} {
  const totalBySpecies: Record<string, number> = {};
  const totalBySource: Record<string, number> = {};
  let validatedCount = 0;

  for (const label of labels) {
    totalBySpecies[label.species] = (totalBySpecies[label.species] ?? 0) + 1;
    totalBySource[label.source] = (totalBySource[label.source] ?? 0) + 1;
    if (label.validated) validatedCount++;
  }

  return {
    totalBySpecies,
    totalBySource,
    validatedCount,
    pendingValidation: labels.length - validatedCount,
  };
}

/**
 * Export labels for model training in standard format.
 */
export function exportForTraining(
  labels: GroundTruthLabel[],
  format: 'json' | 'csv' = 'json',
): string {
  if (format === 'csv') {
    const header = 'id,image_hash,species,source,confidence,validated,timestamp';
    const rows = labels.map(l =>
      `${l.id},${l.imageHash},${l.species},${l.source},${l.confidence},${l.validated},${l.timestamp}`
    );
    return [header, ...rows].join('\n');
  }

  return JSON.stringify(labels, null, 2);
}
