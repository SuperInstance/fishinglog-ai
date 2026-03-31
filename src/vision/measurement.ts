/**
 * Fish Length Measurement from Camera
 *
 * Uses camera calibration data and bounding box size
 * to estimate fish length in inches.
 */

export interface MeasurementResult {
  length: number;
  confidence: number;
  unit: 'inches';
  method: 'bbox' | 'manual';
}

export interface CameraCalibration {
  cameraId: string;
  pixelsPerInch: number;
  calibratedAt: string;
  distanceFromTable: number; // inches
  angle: number; // degrees from perpendicular
}

export interface MeasurementConfig {
  defaultPPI: number;
  minConfidence: number;
  speciesLengthRanges: Record<string, { min: number; max: number }>;
}

export const SPECIES_LENGTH_RANGES: Record<string, { min: number; max: number }> = {
  king_salmon: { min: 24, max: 58 },
  coho: { min: 18, max: 36 },
  sockeye: { min: 18, max: 33 },
  pink: { min: 14, max: 24 },
  chum: { min: 20, max: 40 },
  halibut: { min: 20, max: 96 },
  pacific_cod: { min: 14, max: 42 },
  pollock: { min: 12, max: 36 },
  rockfish: { min: 10, max: 40 },
  lingcod: { min: 20, max: 60 },
  sablefish: { min: 18, max: 42 },
  flatfish: { min: 10, max: 48 },
};

export const DEFAULT_MEASUREMENT_CONFIG: MeasurementConfig = {
  defaultPPI: 72,
  minConfidence: 0.6,
  speciesLengthRanges: SPECIES_LENGTH_RANGES,
};

/**
 * Measure fish length from bounding box.
 * Uses camera calibration to convert pixel dimensions to inches.
 */
export function measureFromBBox(
  bbox: [number, number, number, number],
  calibration: CameraCalibration,
  config: MeasurementConfig = DEFAULT_MEASUREMENT_CONFIG,
): MeasurementResult {
  const [x1, y1, x2, y2] = bbox;
  const pixelLength = Math.max(
    Math.abs(x2 - x1),
    Math.abs(y2 - y1),
  );

  const angleFactor = Math.cos((calibration.angle * Math.PI) / 180);
  const adjustedPPI = calibration.pixelsPerInch * angleFactor;
  const lengthInches = pixelLength / adjustedPPI;

  // Confidence based on whether measurement falls in expected range
  let confidence = 0.8;

  const range = Object.values(config.speciesLengthRanges)[0];
  if (range) {
    if (lengthInches >= range.min && lengthInches <= range.max) {
      confidence = 0.9;
    } else if (lengthInches < range.min * 0.5 || lengthInches > range.max * 1.5) {
      confidence = 0.3;
    }
  }

  return {
    length: Math.round(lengthInches * 10) / 10,
    confidence,
    unit: 'inches',
    method: 'bbox',
  };
}

/**
 * Validate a measurement against species-specific size limits.
 */
export function validateMeasurement(
  measurement: MeasurementResult,
  species: string,
  config: MeasurementConfig = DEFAULT_MEASUREMENT_CONFIG,
): { valid: boolean; reason?: string } {
  const range = config.speciesLengthRanges[species];
  if (!range) return { valid: true };

  if (measurement.length < range.min) {
    return {
      valid: false,
      reason: `${species} measured at ${measurement.length}" — below expected minimum of ${range.min}"`,
    };
  }

  if (measurement.length > range.max) {
    return {
      valid: false,
      reason: `${species} measured at ${measurement.length}" — above expected maximum of ${range.max}"`,
    };
  }

  return { valid: true };
}

/**
 * Estimate weight from length using species-specific length-weight relationships.
 * Formula: weight = a * length^b (standard fisheries formula)
 */
export function estimateWeight(
  lengthInches: number,
  species: string,
): { weight: number; unit: 'lbs'; confidence: number } {
  // Approximate length-weight coefficients (a, b) per species
  const coefficients: Record<string, { a: number; b: number }> = {
    king_salmon: { a: 0.0000123, b: 3.06 },
    coho: { a: 0.0000098, b: 3.10 },
    sockeye: { a: 0.0000089, b: 3.12 },
    halibut: { a: 0.0000340, b: 2.95 },
    pacific_cod: { a: 0.0000156, b: 3.02 },
    pollock: { a: 0.0000142, b: 3.00 },
    rockfish: { a: 0.0000189, b: 3.05 },
    lingcod: { a: 0.0000267, b: 2.98 },
  };

  const coeff = coefficients[species] || { a: 0.000015, b: 3.0 };
  const weightLbs = coeff.a * Math.pow(lengthInches, coeff.b) * 0.0022; // convert from grams

  return {
    weight: Math.round(weightLbs * 100) / 100,
    unit: 'lbs',
    confidence: 0.7, // Weight estimates are always approximate
  };
}
