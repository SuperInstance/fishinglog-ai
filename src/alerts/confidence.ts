/**
 * Low Confidence Alert Handling
 *
 * Manages alerts when the vision model's confidence drops
 * below acceptable thresholds. Tracks confidence trends per species.
 */

export interface ConfidenceAlert {
  species: string;
  confidence: number;
  action: 'confirm' | 'review' | 'skip';
  message: string;
  audioPrompt: string;
}

export interface ConfidenceTrend {
  species: string;
  recentConfidences: number[];
  averageConfidence: number;
  trend: 'improving' | 'stable' | 'declining';
  sampleCount: number;
  lastUpdated: string;
}

const CONFIRM_THRESHOLD = 0.7;
const REVIEW_THRESHOLD = 0.5;

/**
 * Determine action for a low-confidence classification.
 */
export function handleLowConfidence(
  species: string,
  confidence: number,
): ConfidenceAlert {
  if (confidence >= CONFIRM_THRESHOLD) {
    return {
      species,
      confidence,
      action: 'confirm',
      message: `Classification confident: ${species} at ${Math.round(confidence * 100)}%`,
      audioPrompt: '',
    };
  }

  if (confidence >= REVIEW_THRESHOLD) {
    return {
      species,
      confidence,
      action: 'review',
      message: `Captain confirmation requested: ${species} at ${Math.round(confidence * 100)}%`,
      audioPrompt: `Captain, can you confirm ${species}? I'm ${Math.round(confidence * 100)}% sure.`,
    };
  }

  return {
    species,
    confidence,
    action: 'skip',
    message: `Low confidence — flagged for manual review. ${species} at ${Math.round(confidence * 100)}%`,
    audioPrompt: `I'm not confident about this one. Flagged for review.`,
  };
}

/**
 * Track confidence trends for a species over time.
 */
export function updateConfidenceTrend(
  trend: ConfidenceTrend,
  newConfidence: number,
): ConfidenceTrend {
  const recent = [...trend.recentConfidences, newConfidence].slice(-50);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;

  // Calculate trend from last 10 vs previous 10
  let trendDirection: 'improving' | 'stable' | 'declining' = 'stable';
  if (recent.length >= 20) {
    const recent10 = recent.slice(-10).reduce((a, b) => a + b, 0) / 10;
    const prev10 = recent.slice(-20, -10).reduce((a, b) => a + b, 0) / 10;
    const diff = recent10 - prev10;
    if (diff > 0.05) trendDirection = 'improving';
    else if (diff < -0.05) trendDirection = 'declining';
  }

  return {
    species: trend.species,
    recentConfidences: recent,
    averageConfidence: Math.round(avg * 1000) / 1000,
    trend: trendDirection,
    sampleCount: trend.sampleCount + 1,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Create an initial confidence trend for a species.
 */
export function createConfidenceTrend(species: string): ConfidenceTrend {
  return {
    species,
    recentConfidences: [],
    averageConfidence: 0,
    trend: 'stable',
    sampleCount: 0,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Identify species that need attention based on confidence trends.
 */
export function identifyProblematicSpecies(
  trends: ConfidenceTrend[],
): Array<{ species: string; issue: string; severity: 'warning' | 'critical' }> {
  const problems: Array<{ species: string; issue: string; severity: 'warning' | 'critical' }> = [];

  for (const trend of trends) {
    if (trend.trend === 'declining' && trend.averageConfidence < CONFIRM_THRESHOLD) {
      problems.push({
        species: trend.species,
        issue: `Declining confidence (${Math.round(trend.averageConfidence * 100)}% avg). Model may need retraining.`,
        severity: 'critical',
      });
    } else if (trend.averageConfidence < REVIEW_THRESHOLD) {
      problems.push({
        species: trend.species,
        issue: `Low average confidence (${Math.round(trend.averageConfidence * 100)}%). Consider collecting more training data.`,
        severity: 'warning',
      });
    }
  }

  return problems;
}
