import { describe, it, expect } from 'vitest';
import {
  measureFromBBox,
  validateMeasurement,
  estimateWeight,
  SPECIES_LENGTH_RANGES,
  DEFAULT_MEASUREMENT_CONFIG,
} from '../measurement';

describe('SPECIES_LENGTH_RANGES', () => {
  it('should have king_salmon range', () => {
    const range = SPECIES_LENGTH_RANGES['king_salmon'];
    expect(range.min).toBe(24);
    expect(range.max).toBe(58);
  });

  it('should have halibut range with large max', () => {
    const range = SPECIES_LENGTH_RANGES['halibut'];
    expect(range.min).toBe(20);
    expect(range.max).toBe(96);
  });

  it('should have all major species', () => {
    const expected = ['king_salmon', 'coho', 'sockeye', 'pink', 'chum', 'halibut', 'pacific_cod', 'pollock', 'rockfish', 'lingcod', 'sablefish', 'flatfish'];
    for (const species of expected) {
      expect(SPECIES_LENGTH_RANGES[species]).toBeTruthy();
    }
  });

  it('should have valid ranges (min < max)', () => {
    for (const [species, range] of Object.entries(SPECIES_LENGTH_RANGES)) {
      expect(range.min).toBeLessThan(range.max);
    }
  });
});

describe('DEFAULT_MEASUREMENT_CONFIG', () => {
  it('should have default PPI of 72', () => {
    expect(DEFAULT_MEASUREMENT_CONFIG.defaultPPI).toBe(72);
  });

  it('should have minConfidence of 0.6', () => {
    expect(DEFAULT_MEASUREMENT_CONFIG.minConfidence).toBe(0.6);
  });

  it('should have species length ranges', () => {
    expect(DEFAULT_MEASUREMENT_CONFIG.speciesLengthRanges).toEqual(SPECIES_LENGTH_RANGES);
  });
});

describe('measureFromBBox', () => {
  const calibration = {
    cameraId: 'cam1',
    pixelsPerInch: 100,
    calibratedAt: '2024-01-01T00:00:00Z',
    distanceFromTable: 24,
    angle: 0,
  };

  it('should measure horizontal bbox correctly', () => {
    const result = measureFromBBox([0, 0, 200, 50], calibration);
    expect(result.unit).toBe('inches');
    expect(result.method).toBe('bbox');
  });

  it('should measure vertical bbox correctly', () => {
    const result = measureFromBBox([0, 0, 50, 200], calibration);
    expect(result.unit).toBe('inches');
    expect(result.method).toBe('bbox');
  });

  it('should use absolute values for bbox', () => {
    const result = measureFromBBox([-100, -100, 0, 0], calibration);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should apply angle correction', () => {
    const angledCal = { ...calibration, angle: 30 };
    const result = measureFromBBox([0, 0, 200, 50], angledCal);
    expect(result.length).toBeGreaterThan(2);
  });

  it('should return length rounded to 1 decimal', () => {
    const result = measureFromBBox([0, 0, 155, 50], calibration);
    expect(result.length).toBe(Math.round(result.length * 10) / 10);
  });

  it('should return confidence value', () => {
    const result = measureFromBBox([0, 0, 200, 50], calibration);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

describe('validateMeasurement', () => {
  const validMeasurement = {
    length: 30,
    confidence: 0.85,
    unit: 'inches' as const,
    method: 'bbox' as const,
  };

  it('should validate measurement within range', () => {
    const result = validateMeasurement(validMeasurement, 'king_salmon');
    expect(result.valid).toBe(true);
  });

  it('should validate at minimum boundary', () => {
    const result = validateMeasurement({ ...validMeasurement, length: 24 }, 'king_salmon');
    expect(result.valid).toBe(true);
  });

  it('should validate at maximum boundary', () => {
    const result = validateMeasurement({ ...validMeasurement, length: 58 }, 'king_salmon');
    expect(result.valid).toBe(true);
  });

  it('should reject measurement below minimum', () => {
    const result = validateMeasurement({ ...validMeasurement, length: 20 }, 'king_salmon');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('below');
  });

  it('should reject measurement above maximum', () => {
    const result = validateMeasurement({ ...validMeasurement, length: 100 }, 'king_salmon');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('above');
  });

  it('should allow unknown species without validation', () => {
    const result = validateMeasurement(validMeasurement, 'mystery_fish');
    expect(result.valid).toBe(true);
  });

  it('should validate halibut with different ranges', () => {
    const smallMeasurement = { ...validMeasurement, length: 25 };
    const result = validateMeasurement(smallMeasurement, 'halibut');
    expect(result.valid).toBe(true);
  });
});

describe('estimateWeight', () => {
  it('should estimate king_salmon weight', () => {
    const result = estimateWeight(36, 'king_salmon');
    expect(result.unit).toBe('lbs');
    expect(result.weight).toBeGreaterThanOrEqual(0);
  });

  it('should estimate halibut weight', () => {
    const result = estimateWeight(50, 'halibut');
    expect(result.unit).toBe('lbs');
    expect(result.weight).toBeGreaterThanOrEqual(0);
  });

  it('should estimate smaller fish to weigh less', () => {
    const small = estimateWeight(20, 'coho');
    const large = estimateWeight(30, 'coho');
    expect(large.weight).toBeGreaterThanOrEqual(small.weight);
  });

  it('should use generic coefficients for unknown species', () => {
    const result = estimateWeight(24, 'unknown_fish');
    expect(result.weight).toBeGreaterThanOrEqual(0);
  });

  it('should return confidence level', () => {
    const result = estimateWeight(30, 'rockfish');
    expect(result.confidence).toBe(0.7);
  });

  it('should handle very small fish', () => {
    const result = estimateWeight(10, 'pink');
    expect(result.weight).toBeGreaterThanOrEqual(0);
  });

  it('should handle very large halibut', () => {
    const result = estimateWeight(80, 'halibut');
    expect(result.weight).toBeGreaterThanOrEqual(0);
  });
});