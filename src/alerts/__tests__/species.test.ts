import { describe, it, expect } from 'vitest';
import {
  detectMismatch,
  formatAudioAlert,
  formatVisualAlert,
  CRITICAL_MISMATCHES,
} from '../species';

describe('detectMismatch', () => {
  it('should return null when species agree', () => {
    const result = detectMismatch('king_salmon', 0.9, 'king_salmon', {
      cameraId: 'cam1',
      binNumber: 1,
    });
    expect(result).toBeNull();
  });

  it('should detect critical mismatch between king_salmon and coho', () => {
    const result = detectMismatch('king_salmon', 0.85, 'coho', {
      cameraId: 'cam1',
      binNumber: 2,
    });
    expect(result).not.toBeNull();
    expect(result?.category).toBe('SPECIES_MISMATCH');
    expect(result?.priority).toBe('CRITICAL');
    expect(result?.acknowledged).toBe(false);
  });

  it('should detect coho vs king_salmon mismatch', () => {
    const result = detectMismatch('coho', 0.8, 'king_salmon', {
      cameraId: 'cam2',
      binNumber: null,
    });
    expect(result).not.toBeNull();
    expect(result?.priority).toBe('CRITICAL');
  });

  it('should require acknowledgement for critical mismatches', () => {
    const result = detectMismatch('king_salmon', 0.9, 'coho', {
      cameraId: 'cam1',
      binNumber: 1,
    });
    expect(result?.requiresAcknowledgement).toBe(true);
  });

  it('should flag halibut vs flatfish as operational', () => {
    const result = detectMismatch('halibut', 0.75, 'flatfish', {
      cameraId: 'cam3',
      binNumber: 3,
    });
    expect(result).not.toBeNull();
    expect(result?.priority).toBe('OPERATIONAL');
    expect(result?.requiresAcknowledgement).toBe(false);
  });

  it('should flag rockfish vs lingcod as operational', () => {
    const result = detectMismatch('rockfish', 0.7, 'lingcod', {
      cameraId: 'cam4',
      binNumber: 4,
    });
    expect(result).not.toBeNull();
    expect(result?.priority).toBe('OPERATIONAL');
  });

  it('should generate generic mismatch for unknown species pair with high confidence', () => {
    const result = detectMismatch('sockeye', 0.8, 'pink', {
      cameraId: 'cam5',
      binNumber: 5,
    });
    expect(result).not.toBeNull();
    expect(result?.category).toBe('SPECIES_MISMATCH');
    expect(result?.priority).toBe('OPERATIONAL');
  });

  it('should return null for unknown pair with low confidence', () => {
    const result = detectMismatch('sablefish', 0.5, 'pollock', {
      cameraId: 'cam6',
      binNumber: null,
    });
    expect(result).toBeNull();
  });

  it('should include camera context in alert details', () => {
    const result = detectMismatch('king_salmon', 0.85, 'coho', {
      cameraId: 'deck-camera-1',
      binNumber: 7,
    });
    expect(result?.details.cameraId).toBe('deck-camera-1');
    expect(result?.details.binNumber).toBe(7);
  });

  it('should handle null bin number', () => {
    const result = detectMismatch('king_salmon', 0.85, 'coho', {
      cameraId: 'cam1',
      binNumber: null,
    });
    expect(result?.details.binNumber).toBeNull();
  });

  it('should have valid ID in alert', () => {
    const result = detectMismatch('king_salmon', 0.85, 'coho', {
      cameraId: 'cam1',
      binNumber: 1,
    });
    expect(result?.id).toBeTruthy();
    expect(result?.id.length).toBeGreaterThan(0);
  });

  it('should have timestamp in ISO format', () => {
    const result = detectMismatch('halibut', 0.8, 'flatfish', {
      cameraId: 'cam1',
      binNumber: 1,
    });
    expect(result?.timestamp).toBeTruthy();
    expect(new Date(result!.timestamp).toISOString()).toBe(result?.timestamp);
  });

  it('should include audio template substitution', () => {
    const result = detectMismatch('king_salmon', 0.85, 'coho', {
      cameraId: 'cam1',
      binNumber: 1,
    });
    expect(result?.audioMessage).toContain('king_salmon');
    expect(result?.audioMessage).toContain('coho');
  });

  it('should populate message field', () => {
    const result = detectMismatch('rockfish', 0.75, 'lingcod', {
      cameraId: 'cam1',
      binNumber: 1,
    });
    expect(result?.message).toBeTruthy();
    expect(result?.message.length).toBeGreaterThan(0);
  });
});

describe('CRITICAL_MISMATCHES', () => {
  it('should have at least one defined rule', () => {
    expect(CRITICAL_MISMATCHES.length).toBeGreaterThan(0);
  });

  it('should have audio template in each rule', () => {
    for (const rule of CRITICAL_MISMATCHES) {
      expect(rule.audioTemplate).toBeTruthy();
      expect(rule.audioTemplate.length).toBeGreaterThan(0);
    }
  });

  it('should have priority in each rule', () => {
    for (const rule of CRITICAL_MISMATCHES) {
      expect(rule.priority).toBeTruthy();
    }
  });

  it('should have pair with two elements', () => {
    for (const rule of CRITICAL_MISMATCHES) {
      expect(rule.pair.length).toBe(2);
    }
  });
});

describe('formatAudioAlert', () => {
  it('should prepend attention for critical alerts', () => {
    const alert = detectMismatch('king_salmon', 0.9, 'coho', {
      cameraId: 'cam1',
      binNumber: 1,
    })!;
    const audio = formatAudioAlert(alert);
    expect(audio.startsWith('Attention.')).toBe(true);
  });

  it('should not prepend attention for operational alerts', () => {
    const alert = detectMismatch('halibut', 0.8, 'flatfish', {
      cameraId: 'cam1',
      binNumber: 1,
    })!;
    const audio = formatAudioAlert(alert);
    expect(audio.startsWith('Attention.')).toBe(false);
  });

  it('should include the audio message content', () => {
    const alert = detectMismatch('king_salmon', 0.9, 'coho', {
      cameraId: 'cam1',
      binNumber: 1,
    })!;
    const audio = formatAudioAlert(alert);
    expect(audio.length).toBeGreaterThan(alert.audioMessage.length);
  });
});

describe('formatVisualAlert', () => {
  it('should return color for CRITICAL priority', () => {
    const alert = detectMismatch('king_salmon', 0.9, 'coho', {
      cameraId: 'cam1',
      binNumber: 1,
    })!;
    const visual = formatVisualAlert(alert);
    expect(visual.color).toBe('#ef4444');
  });

  it('should return color for OPERATIONAL priority', () => {
    const alert = detectMismatch('halibut', 0.8, 'flatfish', {
      cameraId: 'cam1',
      binNumber: 1,
    })!;
    const visual = formatVisualAlert(alert);
    expect(visual.color).toBe('#f59e0b');
  });

  it('should return icon for CRITICAL priority', () => {
    const alert = detectMismatch('king_salmon', 0.9, 'coho', {
      cameraId: 'cam1',
      binNumber: 1,
    })!;
    const visual = formatVisualAlert(alert);
    expect(visual.icon).toBe('⚠️');
  });

  it('should return icon for OPERATIONAL priority', () => {
    const alert = detectMismatch('halibut', 0.8, 'flatfish', {
      cameraId: 'cam1',
      binNumber: 1,
    })!;
    const visual = formatVisualAlert(alert);
    expect(visual.icon).toBe('⚡');
  });

  it('should include message in title', () => {
    const alert = detectMismatch('king_salmon', 0.85, 'coho', {
      cameraId: 'cam1',
      binNumber: 1,
    })!;
    const visual = formatVisualAlert(alert);
    expect(visual.title).toBe(alert.message);
  });

  it('should include timestamp in subtitle', () => {
    const alert = detectMismatch('king_salmon', 0.85, 'coho', {
      cameraId: 'cam1',
      binNumber: 1,
    })!;
    const visual = formatVisualAlert(alert);
    expect(visual.subtitle).toBe(alert.timestamp);
  });
});