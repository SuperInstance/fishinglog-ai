import { describe, it, expect } from 'vitest';
import { analyzePatterns, generateSeasonReport, suggestLocation, getSeason } from './seasonal';
import type { CatchEvent } from './seasonal';

const mockCatches: CatchEvent[] = [
  { species: 'king_salmon', count: 12, location: [57.5, -152.3], timestamp: '2025-06-15T10:00:00Z', depth: 45, waterTemp: 48, tideStage: 'flood', gearType: 'troll' },
  { species: 'king_salmon', count: 8, location: [57.5, -152.3], timestamp: '2025-06-16T11:00:00Z', depth: 50, waterTemp: 47, tideStage: 'flood', gearType: 'troll' },
  { species: 'king_salmon', count: 15, location: [57.6, -152.4], timestamp: '2025-07-10T09:00:00Z', depth: 40, waterTemp: 50, tideStage: 'ebb', gearType: 'troll' },
  { species: 'coho', count: 25, location: [57.7, -152.5], timestamp: '2025-07-20T08:00:00Z', depth: 30, waterTemp: 52, tideStage: 'slack', gearType: 'troll' },
  { species: 'coho', count: 30, location: [57.7, -152.5], timestamp: '2025-08-05T07:00:00Z', depth: 25, waterTemp: 54, tideStage: 'flood', gearType: 'troll' },
  { species: 'halibut', count: 3, location: [57.4, -152.1], timestamp: '2025-06-20T14:00:00Z', depth: 120, waterTemp: 42, tideStage: 'slack', gearType: 'longline' },
  { species: 'halibut', count: 5, location: [57.4, -152.1], timestamp: '2025-07-15T13:00:00Z', depth: 110, waterTemp: 44, tideStage: 'slack', gearType: 'longline' },
];

describe('seasonal', () => {
  describe('getSeason', () => {
    it('returns correct seasons', () => {
      expect(getSeason(1)).toBe('winter');
      expect(getSeason(4)).toBe('spring');
      expect(getSeason(7)).toBe('summer');
      expect(getSeason(10)).toBe('fall');
    });
  });

  describe('analyzePatterns', () => {
    it('finds patterns grouped by species and month', () => {
      const patterns = analyzePatterns(mockCatches);
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns.every(p => p.confidence > 0)).toBe(true);
      expect(patterns.every(p => p.sampleSize > 0)).toBe(true);
    });

    it('ranks patterns by confidence', () => {
      const patterns = analyzePatterns(mockCatches);
      for (let i = 1; i < patterns.length; i++) {
        expect(patterns[i].confidence).toBeLessThanOrEqual(patterns[i - 1].confidence);
      }
    });
  });

  describe('generateSeasonReport', () => {
    it('generates a summer report', () => {
      const report = generateSeasonReport(mockCatches, 2025, 'summer');
      expect(report.season).toBe('summer');
      expect(report.year).toBe(2025);
      expect(report.topSpecies.length).toBeGreaterThan(0);
      expect(report.patterns.length).toBeGreaterThan(0);
    });

    it('calculates species trends', () => {
      const report = generateSeasonReport(mockCatches, 2025, 'summer');
      expect(report.topSpecies.every(s => ['up', 'down', 'stable'].includes(s.trend))).toBe(true);
    });
  });

  describe('suggestLocation', () => {
    it('suggests locations based on historical patterns', () => {
      const suggestions = suggestLocation(
        mockCatches,
        ['king_salmon', 'coho'],
        7, // July
        45,
        50,
        'flood',
      );
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.every(s => s.confidence > 0)).toBe(true);
      expect(suggestions.every(s => s.reason.length > 0)).toBe(true);
    });

    it('returns empty for wrong month', () => {
      const suggestions = suggestLocation(
        mockCatches,
        ['king_salmon'],
        1, // January — no data
        45,
        50,
        'flood',
      );
      expect(suggestions.length).toBe(0);
    });
  });
});
