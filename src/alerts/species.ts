/**
 * Species Mismatch Alerts
 *
 * Detects and alerts when classification disagrees with
 * crew sorting or captain labeling. Visual + audio alerts.
 */

export type AlertPriority = 'CRITICAL' | 'OPERATIONAL' | 'INFORMATIONAL';
export type AlertCategory = 'BYCATCH' | 'SPECIES_MISMATCH' | 'QUOTA' | 'WEATHER' | 'EQUIPMENT';

export interface SpeciesAlert {
  id: string;
  priority: AlertPriority;
  category: AlertCategory;
  message: string;
  details: {
    predictedSpecies: string;
    predictedConfidence: number;
    humanLabel: string;
    cameraId: string;
    binNumber: number | null;
  };
  audioMessage: string;
  requiresAcknowledgement: boolean;
  timestamp: string;
  acknowledged: boolean;
}

export interface MismatchRule {
  /** Species pair where mismatch is critical (e.g., protected vs similar-looking) */
  pair: [string, string];
  priority: AlertPriority;
  audioTemplate: string;
}

/** Critical mismatches — species that look similar but have different regulations */
export const CRITICAL_MISMATCHES: MismatchRule[] = [
  {
    pair: ['king_salmon', 'coho'],
    priority: 'CRITICAL',
    audioTemplate: 'Warning: Possible {predicted} detected. Labeled as {humanLabel}.',
  },
  {
    pair: ['halibut', 'flatfish'],
    priority: 'OPERATIONAL',
    audioTemplate: 'Note: Classification says {predicted} but sorted as {humanLabel}.',
  },
  {
    pair: ['rockfish', 'lingcod'],
    priority: 'OPERATIONAL',
    audioTemplate: 'Note: Possible {predicted} in {humanLabel} bin.',
  },
];

/**
 * Detect a species mismatch between AI prediction and human action.
 */
export function detectMismatch(
  predictedSpecies: string,
  predictedConfidence: number,
  humanLabel: string,
  context: { cameraId: string; binNumber: number | null },
): SpeciesAlert | null {
  // No mismatch if they agree
  if (predictedSpecies === humanLabel) return null;

  // Check against critical mismatch rules
  for (const rule of CRITICAL_MISMATCHES) {
    const [a, b] = rule.pair;
    if (
      (predictedSpecies === a && humanLabel === b) ||
      (predictedSpecies === b && humanLabel === a)
    ) {
      return {
        id: crypto.randomUUID(),
        priority: rule.priority,
        category: 'SPECIES_MISMATCH',
        message: `Species mismatch: AI says ${predictedSpecies} (${Math.round(predictedConfidence * 100)}%), crew sorted as ${humanLabel}`,
        details: {
          predictedSpecies,
          predictedConfidence,
          humanLabel,
          cameraId: context.cameraId,
          binNumber: context.binNumber,
        },
        audioMessage: rule.audioTemplate
          .replace('{predicted}', predictedSpecies)
          .replace('{humanLabel}', humanLabel),
        requiresAcknowledgement: rule.priority === 'CRITICAL',
        timestamp: new Date().toISOString(),
        acknowledged: false,
      };
    }
  }

  // Generic mismatch for any disagreement
  if (predictedConfidence >= 0.7) {
    return {
      id: crypto.randomUUID(),
      priority: 'OPERATIONAL',
      category: 'SPECIES_MISMATCH',
      message: `Classification disagreement: ${predictedSpecies} vs ${humanLabel}`,
      details: {
        predictedSpecies,
        predictedConfidence,
        humanLabel,
        cameraId: context.cameraId,
        binNumber: context.binNumber,
      },
      audioMessage: `AI classified as ${predictedSpecies}, sorted as ${humanLabel}. Please verify.`,
      requiresAcknowledgement: false,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };
  }

  return null;
}

/**
 * Format alert for audio announcement (TTS input).
 */
export function formatAudioAlert(alert: SpeciesAlert): string {
  const prefix = alert.priority === 'CRITICAL' ? 'Attention. ' : '';
  return prefix + alert.audioMessage;
}

/**
 * Format alert for visual display on dashboard.
 */
export function formatVisualAlert(alert: SpeciesAlert): {
  color: string;
  icon: string;
  title: string;
  subtitle: string;
} {
  const colorMap: Record<AlertPriority, string> = {
    CRITICAL: '#ef4444',
    OPERATIONAL: '#f59e0b',
    INFORMATIONAL: '#0ea5e9',
  };

  const iconMap: Record<AlertPriority, string> = {
    CRITICAL: '⚠️',
    OPERATIONAL: '⚡',
    INFORMATIONAL: 'ℹ️',
  };

  return {
    color: colorMap[alert.priority],
    icon: iconMap[alert.priority],
    title: alert.message,
    subtitle: alert.timestamp,
  };
}
