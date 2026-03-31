/**
 * Intent Extraction from Speech
 *
 * Parses captain voice commands into structured actions.
 * Maritime-specific NLP for fishing operations.
 */

export type IntentAction = 'label' | 'correct' | 'query' | 'question' | 'report' | 'navigate';

export interface ParsedIntent {
  action: IntentAction;
  species: string | null;
  bin: number | null;
  count: number | null;
  context: string | null;
  rawText: string;
  confidence: number;
}

const SPECIES_ALIASES: Record<string, string> = {
  'king': 'king_salmon', 'king salmon': 'king_salmon', 'chinook': 'king_salmon',
  'coho': 'coho', 'silver': 'coho', 'silver salmon': 'coho',
  'sockeye': 'sockeye', 'red': 'sockeye', 'red salmon': 'sockeye',
  'pink': 'pink', 'humpy': 'pink', 'pink salmon': 'pink',
  'chum': 'chum', 'dog': 'chum', 'dog salmon': 'chum',
  'halibut': 'halibut', 'butts': 'halibut', 'barn door': 'halibut',
  'cod': 'pacific_cod', 'pacific cod': 'pacific_cod',
  'pollock': 'pollock', 'walleye': 'pollock',
  'rockfish': 'rockfish', 'rock': 'rockfish',
  'lingcod': 'lingcod', 'ling': 'lingcod',
  'sablefish': 'sablefish', 'black cod': 'sablefish',
  'flatfish': 'flatfish', 'flounder': 'flatfish', 'sole': 'flatfish',
};

const NUMBER_WORDS: Record<string, number> = {
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
};

/**
 * Parse a transcribed voice command into a structured intent.
 */
export function parseIntent(text: string): ParsedIntent {
  const normalized = text.toLowerCase().trim();

  // Pattern: "[species] bin [number]" → label
  const labelMatch = normalized.match(/(.+?)\s+bin\s+(\w+)/);
  if (labelMatch) {
    const species = resolveSpecies(labelMatch[1].trim());
    const bin = resolveNumber(labelMatch[2]);
    return {
      action: 'label',
      species,
      bin,
      count: null,
      context: null,
      rawText: text,
      confidence: species ? 0.9 : 0.6,
    };
  }

  // Pattern: "that was a [species]" → correction
  const correctMatch = normalized.match(/(?:that was|actually|no it'?s?|that'?s? (?:actually )?(?:a |an )?)?(.+)/);
  if (normalized.includes('that was') || normalized.startsWith('actually') || normalized.startsWith('no it')) {
    const speciesText = normalized
      .replace(/^(that was|actually|no it'?s?)\s+(a\s+|an\s+)?/i, '')
      .trim();
    const species = resolveSpecies(speciesText);
    return {
      action: 'correct',
      species,
      bin: null,
      count: null,
      context: 'last_classification',
      rawText: text,
      confidence: species ? 0.85 : 0.5,
    };
  }

  // Pattern: "why is that a [species]" → question
  if (normalized.startsWith('why')) {
    return {
      action: 'question',
      species: null,
      bin: null,
      count: null,
      context: 'last_classification',
      rawText: text,
      confidence: 0.9,
    };
  }

  // Pattern: "how many [species]" → query
  const queryMatch = normalized.match(/how many\s+(.+?)(?:\s+today)?$/);
  if (queryMatch) {
    const species = resolveSpecies(queryMatch[1].trim());
    return {
      action: 'query',
      species,
      bin: null,
      count: null,
      context: 'daily_count',
      rawText: text,
      confidence: 0.9,
    };
  }

  // Pattern: "show me" → navigate
  if (normalized.startsWith('show me') || normalized.startsWith('open')) {
    return {
      action: 'navigate',
      species: null,
      bin: null,
      count: null,
      context: normalized.replace(/^(show me|open)\s+/i, ''),
      rawText: text,
      confidence: 0.8,
    };
  }

  // Pattern: "log [count] [species]" → label with count
  const logMatch = normalized.match(/(?:log|record|add)\s+(\w+)\s+(.+)/);
  if (logMatch) {
    const count = resolveNumber(logMatch[1]);
    const species = resolveSpecies(logMatch[2].trim());
    return {
      action: 'label',
      species,
      bin: null,
      count,
      context: null,
      rawText: text,
      confidence: species ? 0.85 : 0.5,
    };
  }

  // Default: try to extract species for a general label
  const species = extractSpecies(normalized);
  return {
    action: 'label',
    species,
    bin: null,
    count: null,
    context: null,
    rawText: text,
    confidence: species ? 0.5 : 0.2,
  };
}

function resolveSpecies(text: string): string | null {
  const lower = text.toLowerCase().trim();
  for (const [alias, species] of Object.entries(SPECIES_ALIASES)) {
    if (lower === alias || lower.includes(alias)) {
      return species;
    }
  }
  return null;
}

function resolveNumber(text: string): number | null {
  const lower = text.toLowerCase().trim();
  if (NUMBER_WORDS[lower]) return NUMBER_WORDS[lower];
  const num = parseInt(lower, 10);
  return isNaN(num) ? null : num;
}

function extractSpecies(text: string): string | null {
  for (const [alias, species] of Object.entries(SPECIES_ALIASES)) {
    if (text.includes(alias)) return species;
  }
  return null;
}
