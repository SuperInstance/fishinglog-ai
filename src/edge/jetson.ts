/**
 * Jetson Orin Nano Integration
 *
 * Camera management, GPU memory management,
 * model loading/switching, and temperature monitoring.
 */

export interface JetsonConfig {
  deviceModel: string;
  gpuMemoryGB: number;
  cameras: CameraConfig[];
  models: ModelConfig[];
  maxTempCelsius: number;
  inferencePort: number;
}

export interface CameraConfig {
  id: string;
  position: 'deck' | 'catch_area' | 'port_side' | 'starboard';
  type: 'usb' | 'ip';
  resolution: string;
  fps: number;
  address: string; // URL for IP cameras, device path for USB
}

export interface ModelConfig {
  name: string;
  path: string;
  type: 'detection' | 'classification' | 'segmentation';
  precision: 'fp16' | 'int8' | 'fp32';
  memoryMB: number;
  loaded: boolean;
}

export interface JetsonStatus {
  gpuUtilization: number;
  gpuMemoryUsed: number;
  gpuMemoryTotal: number;
  cpuTemp: number;
  gpuTemp: number;
  inferenceLatencyMs: number;
  activeCameras: number;
  loadedModels: string[];
  uptime: number;
}

export const DEFAULT_JETSON_CONFIG: JetsonConfig = {
  deviceModel: 'jetson-orin-nano-8gb',
  gpuMemoryGB: 8,
  cameras: [
    { id: 'deck-cam', position: 'deck', type: 'ip', resolution: '4k', fps: 2, address: 'rtsp://192.168.1.100:554/stream' },
    { id: 'catch-cam', position: 'catch_area', type: 'ip', resolution: '4k', fps: 2, address: 'rtsp://192.168.1.101:554/stream' },
  ],
  models: [
    { name: 'yolov8-nano-fp16', path: '/models/yolov8n-fp16.engine', type: 'detection', precision: 'fp16', memoryMB: 512, loaded: false },
    { name: 'whisper-tiny', path: '/models/whisper-tiny/', type: 'classification', precision: 'fp16', memoryMB: 256, loaded: false },
  ],
  maxTempCelsius: 80,
  inferencePort: 8080,
};

/**
 * Get the current status of the Jetson device.
 */
export async function getJetsonStatus(config: JetsonConfig = DEFAULT_JETSON_CONFIG): Promise<JetsonStatus> {
  const response = await fetch(`http://localhost:${config.inferencePort}/status`);
  if (!response.ok) {
    throw new Error(`Jetson status check failed: ${response.status}`);
  }
  return response.json() as Promise<JetsonStatus>;
}

/**
 * Check if the Jetson is overheating.
 */
export function isOverheating(status: JetsonStatus, maxTemp: number = 80): boolean {
  return status.gpuTemp > maxTemp || status.cpuTemp > maxTemp;
}

/**
 * Load a model onto the GPU.
 */
export async function loadModel(
  modelName: string,
  config: JetsonConfig = DEFAULT_JETSON_CONFIG,
): Promise<boolean> {
  const response = await fetch(`http://localhost:${config.inferencePort}/models/load`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelName }),
  });
  return response.ok;
}

/**
 * Unload a model from the GPU to free memory.
 */
export async function unloadModel(
  modelName: string,
  config: JetsonConfig = DEFAULT_JETSON_CONFIG,
): Promise<boolean> {
  const response = await fetch(`http://localhost:${config.inferencePort}/models/unload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelName }),
  });
  return response.ok;
}

/**
 * Get a snapshot from a specific camera.
 */
export async function getCameraSnapshot(
  cameraId: string,
  config: JetsonConfig = DEFAULT_JETSON_CONFIG,
): Promise<ArrayBuffer> {
  const response = await fetch(`http://localhost:${config.inferencePort}/camera/${cameraId}/snapshot`);
  if (!response.ok) {
    throw new Error(`Camera snapshot failed for ${cameraId}: ${response.status}`);
  }
  return response.arrayBuffer();
}
