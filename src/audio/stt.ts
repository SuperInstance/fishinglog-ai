/**
 * Speech-to-Text — Captain Voice Commands
 *
 * Uses local Whisper-tiny for on-device transcription
 * with RNNoise noise suppression. Falls back to cloud
 * Whisper API when available for better accuracy.
 */

export interface STTResult {
  text: string;
  confidence: number;
  language: string;
  processingTime: number;
  source: 'local' | 'cloud';
}

export interface STTConfig {
  localModel: string;
  language: string;
  maxDurationSeconds: number;
  noiseSuppression: boolean;
  sampleRate: number;
}

export const DEFAULT_STT_CONFIG: STTConfig = {
  localModel: 'whisper-tiny',
  language: 'en',
  maxDurationSeconds: 5,
  noiseSuppression: true,
  sampleRate: 16000,
};

/**
 * Transcribe audio using local Whisper model on Jetson.
 */
export async function transcribeLocal(
  audioData: ArrayBuffer,
  config: STTConfig = DEFAULT_STT_CONFIG,
): Promise<STTResult> {
  const start = performance.now();

  // In production: POST to Jetson's local Whisper endpoint
  const response = await fetch('http://localhost:8080/stt', {
    method: 'POST',
    headers: { 'Content-Type': 'audio/pcm' },
    body: audioData,
  });

  if (!response.ok) {
    throw new Error(`Local STT failed: ${response.status}`);
  }

  const result = await response.json() as { text: string; confidence: number };

  return {
    text: result.text.trim(),
    confidence: result.confidence,
    language: config.language,
    processingTime: performance.now() - start,
    source: 'local',
  };
}

/**
 * Transcribe using cloud Whisper API for higher accuracy.
 */
export async function transcribeCloud(
  audioData: ArrayBuffer,
  env?: { AI?: any },
): Promise<STTResult | null> {
  if (!env?.AI) return null;

  const start = performance.now();

  try {
    const result = await env.AI.run('@cf/openai/whisper', {
      audio: Array.from(new Uint8Array(audioData)),
    });

    return {
      text: result.text?.trim() ?? '',
      confidence: 0.9,
      language: 'en',
      processingTime: performance.now() - start,
      source: 'cloud',
    };
  } catch {
    return null;
  }
}

/**
 * Preprocess audio: apply noise suppression and format conversion.
 * In production, RNNoise runs on the Jetson's audio pipeline.
 */
export function preprocessAudio(
  rawAudio: ArrayBuffer,
  _config: STTConfig = DEFAULT_STT_CONFIG,
): ArrayBuffer {
  // In production: route through RNNoise on Jetson
  // This is a passthrough — actual DSP happens on the edge device
  return rawAudio;
}
