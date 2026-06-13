/**
 * Cloud → Local Model Distillation
 *
 * Collects cloud predictions + human corrections,
 * formats for local fine-tuning, tracks distillation progress.
 */

export interface DistillationSample {
  imageHash: string;
  edgePrediction: string;
  cloudPrediction: string;
  humanCorrection: string | null;
  timestamp: string;
  context: {
    location: [number, number];
    waterTemp: number;
    depth: number;
  };
}

export interface DistillationProgress {
  totalSamples: number;
  correctedSamples: number;
  pendingUpload: number;
  lastUpload: string | null;
  modelVersion: string;
  accuracyBefore: number;
  accuracyAfter: number | null;
}

export interface DistillationConfig {
  maxPendingSamples: number;
  batchSize: number;
  minSamplesForRetrain: number;
  uploadPriority: 'corrections' | 'all';
}

export const DEFAULT_DISTILLATION_CONFIG: DistillationConfig = {
  maxPendingSamples: 100,
  batchSize: 20,
  minSamplesForRetrain: 50,
  uploadPriority: 'corrections',
};

/**
 * Create a distillation sample from a classification event.
 */
export function createSample(
  imageHash: string,
  edgePrediction: string,
  cloudPrediction: string,
  humanCorrection: string | null,
  context: { location: [number, number]; waterTemp: number; depth: number },
): DistillationSample {
  return {
    imageHash,
    edgePrediction,
    cloudPrediction,
    humanCorrection,
    timestamp: new Date().toISOString(),
    context,
  };
}

/**
 * Format samples for local fine-tuning.
 * Creates training triplets: (image, wrong_label, correct_label).
 */
export function formatForTraining(
  samples: DistillationSample[],
): Array<{
  imageHash: string;
  wrongLabel: string;
  correctLabel: string;
  source: 'cloud_disagreement' | 'human_correction';
}> {
  const trainingData: Array<{
    imageHash: string;
    wrongLabel: string;
    correctLabel: string;
    source: 'cloud_disagreement' | 'human_correction';
  }> = [];

  for (const sample of samples) {
    // Human corrections are highest priority
    if (sample.humanCorrection) {
      trainingData.push({
        imageHash: sample.imageHash,
        wrongLabel: sample.edgePrediction,
        correctLabel: sample.humanCorrection,
        source: 'human_correction',
      });
      continue;
    }

    // Cloud-edge disagreements
    if (sample.cloudPrediction !== sample.edgePrediction) {
      trainingData.push({
        imageHash: sample.imageHash,
        wrongLabel: sample.edgePrediction,
        correctLabel: sample.cloudPrediction,
        source: 'cloud_disagreement',
      });
    }
  }

  return trainingData;
}

/**
 * Calculate distillation progress metrics.
 */
export function calculateProgress(
  samples: DistillationSample[],
  lastUpload: string | null,
  modelVersion: string,
  accuracyBefore: number,
): DistillationProgress {
  const corrected = samples.filter(s => s.humanCorrection !== null);
  const pending = samples.filter(s => !lastUpload || s.timestamp > lastUpload);

  return {
    totalSamples: samples.length,
    correctedSamples: corrected.length,
    pendingUpload: pending.length,
    lastUpload,
    modelVersion,
    accuracyBefore,
    accuracyAfter: null,
  };
}

/**
 * Select samples for upload based on priority config.
 */
export function selectForUpload(
  samples: DistillationSample[],
  config: DistillationConfig = DEFAULT_DISTILLATION_CONFIG,
): DistillationSample[] {
  const sorted = [...samples].sort((a, b) => {
    // Human corrections first
    if (a.humanCorrection && !b.humanCorrection) return -1;
    if (!a.humanCorrection && b.humanCorrection) return 1;
    // Then by timestamp (newest first)
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  return sorted.slice(0, config.batchSize);
}
