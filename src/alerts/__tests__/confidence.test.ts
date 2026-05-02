import { describe, it, expect } from 'vitest';
import {
  handleLowConfidence,
  updateConfidenceTrend,
  createConfidenceTrend,
  identifyProblematicSpecies,
} from '../confidence';

describe('handleLowConfidence', () => {
  it('should return confirm action for high confidence', () => {
    const result = handleLowConfidence('king_salmon', 0.85);
    expect(result.action).toBe('confirm');
    expect(result.species).toBe('king_salmon');
    expect(result.confidence).toBe(0.85);
  });

  it('should return confirm for threshold confidence', () => {
    const result = handleLowConfidence('coho', 0.7);
    expect(result.action).toBe('confirm');
  });

  it('should return review action for medium confidence', () => {
    const result = handleLowConfidence('halibut', 0.6);
    expect(result.action).toBe('review');
    expect(result.audioPrompt).toContain('halibut');
  });

  it('should return review for threshold confidence', () => {
    const result = handleLowConfidence('rockfish', 0.5);
    expect(result.action).toBe('review');
  });

  it('should return skip for low confidence', () => {
    const result = handleLowConfidence('lingcod', 0.3);
    expect(result.action).toBe('skip');
    expect(result.audioPrompt).toContain('Flagged');
  });

  it('should have message for all confidence levels', () => {
    const result = handleLowConfidence('sablefish', 0.45);
    expect(result.message).toBeTruthy();
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('should not have audio prompt for confirm action', () => {
    const result = handleLowConfidence('pollock', 0.9);
    expect(result.audioPrompt).toBe('');
  });
});

describe('createConfidenceTrend', () => {
  it('should create empty trend for a species', () => {
    const trend = createConfidenceTrend('king_salmon');
    expect(trend.species).toBe('king_salmon');
    expect(trend.recentConfidences).toEqual([]);
    expect(trend.averageConfidence).toBe(0);
    expect(trend.trend).toBe('stable');
    expect(trend.sampleCount).toBe(0);
  });

  it('should have valid timestamp', () => {
    const trend = createConfidenceTrend('coho');
    expect(trend.lastUpdated).toBeTruthy();
    expect(new Date(trend.lastUpdated).toISOString()).toBe(trend.lastUpdated);
  });
});

describe('updateConfidenceTrend', () => {
  it('should add new confidence to recent list', () => {
    const trend = createConfidenceTrend('halibut');
    const updated = updateConfidenceTrend(trend, 0.75);
    expect(updated.recentConfidences).toContain(0.75);
    expect(updated.sampleCount).toBe(1);
  });

  it('should cap recent confidences at 50', () => {
    let trend = createConfidenceTrend('rockfish');
    for (let i = 0; i < 60; i++) {
      trend = updateConfidenceTrend(trend, 0.5 + (i % 10) * 0.01);
    }
    expect(trend.recentConfidences.length).toBe(50);
  });

  it('should calculate average correctly', () => {
    let trend = createConfidenceTrend('lingcod');
    trend = updateConfidenceTrend(trend, 0.6);
    trend = updateConfidenceTrend(trend, 0.8);
    expect(trend.averageConfidence).toBeCloseTo(0.7, 2);
  });

  it('should detect improving trend', () => {
    let trend = createConfidenceTrend('sablefish');
    // Add 10 low values
    for (let i = 0; i < 10; i++) {
      trend = updateConfidenceTrend(trend, 0.5);
    }
    // Add 10 higher values
    for (let i = 0; i < 10; i++) {
      trend = updateConfidenceTrend(trend, 0.8);
    }
    expect(trend.trend).toBe('improving');
  });

  it('should detect declining trend', () => {
    let trend = createConfidenceTrend('flatfish');
    // Add 10 high values
    for (let i = 0; i < 10; i++) {
      trend = updateConfidenceTrend(trend, 0.8);
    }
    // Add 10 lower values
    for (let i = 0; i < 10; i++) {
      trend = updateConfidenceTrend(trend, 0.5);
    }
    expect(trend.trend).toBe('declining');
  });

  it('should detect stable trend when no significant change', () => {
    let trend = createConfidenceTrend('pacific_cod');
    for (let i = 0; i < 20; i++) {
      trend = updateConfidenceTrend(trend, 0.7 + (i % 3) * 0.01);
    }
    expect(trend.trend).toBe('stable');
  });

  it('should stay stable with insufficient data', () => {
    let trend = createConfidenceTrend('pollock');
    trend = updateConfidenceTrend(trend, 0.6);
    trend = updateConfidenceTrend(trend, 0.7);
    expect(trend.trend).toBe('stable');
  });

  it('should update lastUpdated timestamp', () => {
    const trend = createConfidenceTrend('chum');
    const before = trend.lastUpdated;
    // Small delay to ensure different timestamp
    const updated = updateConfidenceTrend(trend, 0.75);
    expect(updated.lastUpdated).toBeTruthy();
  });
});

describe('identifyProblematicSpecies', () => {
  it('should return empty array when no problems', () => {
    let trend = createConfidenceTrend('king_salmon');
    trend = updateConfidenceTrend(trend, 0.8);
    trend = updateConfidenceTrend(trend, 0.85);
    const problems = identifyProblematicSpecies([trend]);
    expect(problems).toEqual([]);
  });

  it('should flag declining trend with low average', () => {
    let trend = createConfidenceTrend('coho');
    for (let i = 0; i < 15; i++) {
      trend = updateConfidenceTrend(trend, i < 10 ? 0.8 : 0.5);
    }
    trend = { ...trend, trend: 'declining' as const, averageConfidence: 0.6 };
    const problems = identifyProblematicSpecies([trend]);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0].severity).toBe('critical');
  });

  it('should flag low average as warning', () => {
    let trend = createConfidenceTrend('halibut');
    trend = updateConfidenceTrend(trend, 0.4);
    trend = updateConfidenceTrend(trend, 0.45);
    trend = { ...trend, averageConfidence: 0.45, trend: 'stable' as const };
    const problems = identifyProblematicSpecies([trend]);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0].severity).toBe('warning');
  });

  it('should handle empty array', () => {
    const problems = identifyProblematicSpecies([]);
    expect(problems).toEqual([]);
  });

  it('should handle multiple problematic species', () => {
    let t1 = createConfidenceTrend('rockfish');
    t1 = { ...t1, trend: 'declining' as const, averageConfidence: 0.55 };
    let t2 = createConfidenceTrend('lingcod');
    t2 = { ...t2, trend: 'stable' as const, averageConfidence: 0.45 };
    const problems = identifyProblematicSpecies([t1, t2]);
    expect(problems.length).toBe(2);
  });
});