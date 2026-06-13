/**
 * Species Classification Pipeline
 *
 * Dual-model architecture: edge YOLOv8-nano (always available, 15 FPS)
 * and cloud ensemble (when connected, 2 FPS async).
 */

export interface Detection {
  species: string;
  confidence: number;
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  trackingId: number;
  lengthPixels: number;
}

export interface ClassificationResult {
  species: string;
  confidence: number;
  alternatives: Array<{ species: string; confidence: number }>;
  bbox: [number, number, number, number];
  source: 'edge' | 'cloud';
  timestamp: string;
  frameId: string;
}

export const SPECIES = [
  'king_salmon', 'coho', 'sockeye', 'pink', 'chum',
  'halibut', 'pacific_cod', 'pollock', 'rockfish',
  'lingcod', 'sablefish', 'flatfish',
] as const;

export type SpeciesName = typeof SPECIES[number];

export const SPECIES_DISPLAY: Record<SpeciesName, string> = {
  king_salmon: 'King Salmon',
  coho: 'Coho Salmon',
  sockeye: 'Sockeye Salmon',
  pink: 'Pink Salmon',
  chum: 'Chum Salmon',
  halibut: 'Halibut',
  pacific_cod: 'Pacific Cod',
  pollock: 'Pollock',
  rockfish: 'Rockfish',
  lingcod: 'Lingcod',
  sablefish: 'Sablefish',
  flatfish: 'Flatfish',
};

const CONFIDENCE_CONFIRM = 0.7;
const CONFIDENCE_REVIEW = 0.5;

export interface ClassifierConfig {
  confidenceThreshold: number;
  reviewThreshold: number;
  species: readonly string[];
  edgeModel: string;
  cloudEnabled: boolean;
}

export const DEFAULT_CLASSIFIER_CONFIG: ClassifierConfig = {
  confidenceThreshold: CONFIDENCE_CONFIRM,
  reviewThreshold: CONFIDENCE_REVIEW,
  species: SPECIES,
  edgeModel: 'yolov8-nano-fp16',
  cloudEnabled: true,
};

/**
 * Classify a frame from the edge model.
 * In production, this calls the Jetson's local inference endpoint.
 */
export async function classifyEdge(
  imageData: ArrayBuffer,
  config: ClassifierConfig = DEFAULT_CLASSIFIER_CONFIG,
): Promise<ClassificationResult> {
  // In production: POST to Jetson inference server
  // POST http://localhost:8080/infer with image payload
  const response = await fetch('http://localhost:8080/infer', {
    method: 'POST',
    headers: { 'Content-Type': 'image/jpeg' },
    body: imageData,
  });

  if (!response.ok) {
    throw new Error(`Edge inference failed: ${response.status}`);
  }

  const detections: Detection[] = await response.json();
  const topDetection = detections
    .sort((a, b) => b.confidence - a.confidence)[0];

  if (!topDetection) {
    return {
      species: 'unknown',
      confidence: 0,
      alternatives: [],
      bbox: [0, 0, 0, 0],
      source: 'edge',
      timestamp: new Date().toISOString(),
      frameId: crypto.randomUUID(),
    };
  }

  const alternatives = detections
    .filter(d => d.species !== topDetection.species)
    .slice(0, 3)
    .map(d => ({ species: d.species, confidence: d.confidence }));

  return {
    species: topDetection.species,
    confidence: topDetection.confidence,
    alternatives,
    bbox: topDetection.bbox,
    source: 'edge',
    timestamp: new Date().toISOString(),
    frameId: crypto.randomUUID(),
  };
}

/**
 * Classify using cloud model (async, higher accuracy).
 * Uses Cloudflare Workers AI when available.
 */
export async function classifyCloud(
  imageData: ArrayBuffer,
  env?: { AI?: any },
): Promise<ClassificationResult | null> {
  if (!env?.AI) return null;

  try {
    const result = await env.AI.run('@cf/meta/detr-resnet-50', {
      image: Array.from(new Uint8Array(imageData)),
    });

    return {
      species: result.label ?? 'unknown',
      confidence: result.score ?? 0,
      alternatives: [],
      bbox: result.bbox ?? [0, 0, 0, 0],
      source: 'cloud',
      timestamp: new Date().toISOString(),
      frameId: crypto.randomUUID(),
    };
  } catch {
    return null;
  }
}

/**
 * Determine action based on confidence level.
 */
export function confidenceAction(confidence: number): 'confirm' | 'review' | 'ask' {
  if (confidence >= CONFIDENCE_CONFIRM) return 'confirm';
  if (confidence >= CONFIDENCE_REVIEW) return 'ask';
  return 'review';
}
