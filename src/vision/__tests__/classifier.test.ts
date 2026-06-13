import { describe, it, expect } from 'vitest';
import {
  SPECIES,
  SPECIES_DISPLAY,
  confidenceAction,
  DEFAULT_CLASSIFIER_CONFIG,
  type SpeciesName,
} from '../classifier';

describe('SPECIES', () => {
  it('should contain all expected species', () => {
    const expected = [
      'king_salmon', 'coho', 'sockeye', 'pink', 'chum',
      'halibut', 'pacific_cod', 'pollock', 'rockfish',
      'lingcod', 'sablefish', 'flatfish',
    ];
    expect(SPECIES).toEqual(expected);
  });

  it('should have 12 species', () => {
    expect(SPECIES.length).toBe(12);
  });

  it('should be readonly tuple', () => {
    expect(SPECIES.includes('king_salmon')).toBe(true);
    expect(SPECIES.includes('unknown')).toBe(false);
  });
});

describe('SPECIES_DISPLAY', () => {
  it('should have display name for king_salmon', () => {
    expect(SPECIES_DISPLAY.king_salmon).toBe('King Salmon');
  });

  it('should have display name for all salmon species', () => {
    expect(SPECIES_DISPLAY.coho).toBe('Coho Salmon');
    expect(SPECIES_DISPLAY.sockeye).toBe('Sockeye Salmon');
    expect(SPECIES_DISPLAY.pink).toBe('Pink Salmon');
    expect(SPECIES_DISPLAY.chum).toBe('Chum Salmon');
  });

  it('should have display names for all groundfish', () => {
    expect(SPECIES_DISPLAY.halibut).toBe('Halibut');
    expect(SPECIES_DISPLAY.pacific_cod).toBe('Pacific Cod');
    expect(SPECIES_DISPLAY.pollock).toBe('Pollock');
    expect(SPECIES_DISPLAY.rockfish).toBe('Rockfish');
    expect(SPECIES_DISPLAY.lingcod).toBe('Lingcod');
    expect(SPECIES_DISPLAY.sablefish).toBe('Sablefish');
    expect(SPECIES_DISPLAY.flatfish).toBe('Flatfish');
  });

  it('should have matching keys with SPECIES', () => {
    for (const species of SPECIES) {
      expect(SPECIES_DISPLAY[species as SpeciesName]).toBeTruthy();
    }
  });
});

describe('confidenceAction', () => {
  it('should return confirm for high confidence', () => {
    expect(confidenceAction(0.9)).toBe('confirm');
    expect(confidenceAction(0.85)).toBe('confirm');
    expect(confidenceAction(1.0)).toBe('confirm');
  });

  it('should return confirm for CONFIDENCE_CONFIRM threshold', () => {
    expect(confidenceAction(0.7)).toBe('confirm');
  });

  it('should return ask for medium confidence', () => {
    expect(confidenceAction(0.65)).toBe('ask');
    expect(confidenceAction(0.6)).toBe('ask');
    expect(confidenceAction(0.55)).toBe('ask');
  });

  it('should return ask for CONFIDENCE_REVIEW threshold', () => {
    expect(confidenceAction(0.5)).toBe('ask');
  });

  it('should return review for low confidence', () => {
    expect(confidenceAction(0.45)).toBe('review');
    expect(confidenceAction(0.3)).toBe('review');
    expect(confidenceAction(0.1)).toBe('review');
    expect(confidenceAction(0.0)).toBe('review');
  });

  it('should handle edge case at 0', () => {
    expect(confidenceAction(0)).toBe('review');
  });
});

describe('DEFAULT_CLASSIFIER_CONFIG', () => {
  it('should have confidenceThreshold of 0.7', () => {
    expect(DEFAULT_CLASSIFIER_CONFIG.confidenceThreshold).toBe(0.7);
  });

  it('should have reviewThreshold of 0.5', () => {
    expect(DEFAULT_CLASSIFIER_CONFIG.reviewThreshold).toBe(0.5);
  });

  it('should have edge model set', () => {
    expect(DEFAULT_CLASSIFIER_CONFIG.edgeModel).toBe('yolov8-nano-fp16');
  });

  it('should have cloud enabled by default', () => {
    expect(DEFAULT_CLASSIFIER_CONFIG.cloudEnabled).toBe(true);
  });

  it('should have all species in config', () => {
    expect(DEFAULT_CLASSIFIER_CONFIG.species).toEqual(SPECIES);
  });
});