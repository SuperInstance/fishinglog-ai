/**
 * Incremental Learning Pipeline
 *
 * Fine-tunes the local model with new ground truth data.
 * Uses replay buffer to prevent catastrophic forgetting.
 * Validates on held-out set before deploying. Rollback if accuracy drops.
 */

export interface TrainingConfig {
  replayBufferSize: number;
  validationSplit: number;
  minAccuracyImprovement: number;
  maxRetrainSamples: number;
  rollbackOnDegradation: boolean;
}

export const DEFAULT_TRAINING_CONFIG: TrainingConfig = {
  replayBufferSize: 200,
  validationSplit: 0.2,
  minAccuracyImprovement: 0.01,
  maxRetrainSamples: 500,
  rollbackOnDegradation: true,
};

export interface TrainingResult {
  success: boolean;
  previousAccuracy: number;
  newAccuracy: number;
  samplesUsed: number;
  speciesImproved: string[];
  speciesDegraded: string[];
  modelVersion: string;
  timestamp: string;
}

export interface ReplayBufferEntry {
  imageHash: string;
  species: string;
  timestamp: string;
  source: 'original' | 'correction';
}

/**
 * Build a replay buffer from historical data to prevent catastrophic forgetting.
 * Selects diverse samples across all known species.
 */
export function buildReplayBuffer(
  historicalLabels: Array<{ imageHash: string; species: string; timestamp: string }>,
  config: TrainingConfig = DEFAULT_TRAINING_CONFIG,
): ReplayBufferEntry[] {
  // Group by species
  const bySpecies = new Map<string, typeof historicalLabels>();
  for (const label of historicalLabels) {
    const existing = bySpecies.get(label.species) ?? [];
    existing.push(label);
    bySpecies.set(label.species, existing);
  }

  // Allocate slots proportionally
  const slotsPerSpecies = Math.max(
    5, // minimum 5 samples per species
    Math.floor(config.replayBufferSize / Math.max(bySpecies.size, 1)),
  );

  const buffer: ReplayBufferEntry[] = [];
  for (const [species, labels] of bySpecies) {
    const selected = labels.slice(0, slotsPerSpecies);
    buffer.push(
      ...selected.map(l => ({
        imageHash: l.imageHash,
        species,
        timestamp: l.timestamp,
        source: 'original' as const,
      })),
    );
  }

  return buffer.slice(0, config.replayBufferSize);
}

/**
 * Validate a new model against a held-out test set.
 */
export function validateModel(
  testSet: Array<{ imageHash: string; species: string }>,
  predictions: Array<{ imageHash: string; predictedSpecies: string; confidence: number }>,
): {
  overallAccuracy: number;
  perSpecies: Record<string, { correct: number; total: number; accuracy: number }>;
  confusionMatrix: Record<string, Record<string, number>>;
} {
  let correct = 0;
  const perSpecies: Record<string, { correct: number; total: number; accuracy: number }> = {};
  const confusionMatrix: Record<string, Record<string, number>> = {};

  for (const testItem of testSet) {
    const prediction = predictions.find(p => p.imageHash === testItem.imageHash);
    const predicted = prediction?.predictedSpecies ?? 'unknown';
    const actual = testItem.species;

    if (!perSpecies[actual]) perSpecies[actual] = { correct: 0, total: 0, accuracy: 0 };
    perSpecies[actual].total++;

    if (!confusionMatrix[actual]) confusionMatrix[actual] = {};
    confusionMatrix[actual][predicted] = (confusionMatrix[actual][predicted] ?? 0) + 1;

    if (predicted === actual) {
      correct++;
      perSpecies[actual].correct++;
    }
  }

  for (const species of Object.keys(perSpecies)) {
    const s = perSpecies[species];
    s.accuracy = s.total > 0 ? s.correct / s.total : 0;
  }

  return {
    overallAccuracy: testSet.length > 0 ? correct / testSet.length : 0,
    perSpecies,
    confusionMatrix,
  };
}

/**
 * Determine if a new model should be deployed or rolled back.
 */
export function shouldDeploy(
  result: {
    previousAccuracy: number;
    newAccuracy: number;
    perSpecies: Record<string, { accuracy: number }>;
    previousPerSpecies: Record<string, { accuracy: number }>;
  },
  config: TrainingConfig = DEFAULT_TRAINING_CONFIG,
): { deploy: boolean; reason: string } {
  const improvement = result.newAccuracy - result.previousAccuracy;

  if (improvement < -0.02 && config.rollbackOnDegradation) {
    return {
      deploy: false,
      reason: `Accuracy dropped by ${Math.abs(improvement).toFixed(3)}. Rolling back.`,
    };
  }

  if (improvement < config.minAccuracyImprovement) {
    return {
      deploy: false,
      reason: `Improvement ${improvement.toFixed(3)} below threshold ${config.minAccuracyImprovement}. Skipping.`,
    };
  }

  // Check for any species with major degradation
  const degradedSpecies: string[] = [];
  for (const [species, metrics] of Object.entries(result.perSpecies)) {
    const prev = result.previousPerSpecies[species];
    if (prev && metrics.accuracy < prev.accuracy - 0.05) {
      degradedSpecies.push(species);
    }
  }

  if (degradedSpecies.length > 0) {
    return {
      deploy: false,
      reason: `Species degraded: ${degradedSpecies.join(', ')}. Review before deploying.`,
    };
  }

  return {
    deploy: true,
    reason: `Accuracy improved by ${improvement.toFixed(3)}. Deploying.`,
  };
}
