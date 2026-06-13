/**
 * Multi-Vessel Coordination (A2A)
 *
 * Peer-to-peer mesh communication between vessels.
 * VHF data exchange when in range, cloud-synced fleet features.
 */

export interface VesselBroadcast {
  vesselId: string;
  timestamp: string;
  position: [number, number];
  speciesCaught: string[];
  weatherObserved: {
    windSpeed: number;
    waveHeight: number;
    waterTemp: number;
  };
  hazards: Array<{ type: string; location: [number, number]; description: string }>;
  sharingLevel: 'none' | 'anonymous' | 'full';
}

export interface FleetMessage {
  id: string;
  from: string;
  to: string | 'fleet';
  type: 'broadcast' | 'direct' | 'alert_relay';
  payload: VesselBroadcast | { species: string; count: number } | { alert: string };
  timestamp: string;
  ttl: number; // seconds
}

export interface FleetIntelligence {
  heatmapData: Array<{ grid: string; species: string[]; intensity: number }>;
  priceIndex: Record<string, number>;
  activeVessels: number;
  lastUpdated: string;
}

/**
 * Create an anonymous vessel broadcast (privacy-preserving).
 */
export function createBroadcast(
  vesselId: string,
  position: [number, number],
  speciesCaught: string[],
  weather: VesselBroadcast['weatherObserved'],
  sharingLevel: VesselBroadcast['sharingLevel'] = 'anonymous',
): VesselBroadcast {
  return {
    vesselId: sharingLevel === 'anonymous' ? hashVesselId(vesselId) : vesselId,
    timestamp: new Date().toISOString(),
    position,
    speciesCaught,
    weatherObserved: weather,
    hazards: [],
    sharingLevel,
  };
}

/**
 * Create a fleet message for broadcast.
 */
export function createFleetMessage(
  from: string,
  payload: FleetMessage['payload'],
  type: FleetMessage['type'] = 'broadcast',
): FleetMessage {
  return {
    id: crypto.randomUUID(),
    from,
    to: type === 'direct' ? '' : 'fleet',
    type,
    payload,
    timestamp: new Date().toISOString(),
    ttl: 3600, // 1 hour default
  };
}

/**
 * Check if a fleet message is still valid (not expired).
 */
export function isValid(message: FleetMessage): boolean {
  const age = (Date.now() - new Date(message.timestamp).getTime()) / 1000;
  return age <= message.ttl;
}

/**
 * Aggregate fleet broadcasts into intelligence.
 */
export function aggregateFleetData(
  broadcasts: VesselBroadcast[],
): FleetIntelligence {
  // Build species heatmap from broadcast positions
  const heatmapData: Array<{ grid: string; species: string[]; intensity: number }> = [];
  const priceIndex: Record<string, number> = {};
  const gridMap = new Map<string, Set<string>>();

  for (const broadcast of broadcasts) {
    const [lat, lon] = broadcast.position;
    const gridKey = `${Math.floor(lat)},${Math.floor(lon)}`;

    if (!gridMap.has(gridKey)) gridMap.set(gridKey, new Set());
    const species = gridMap.get(gridKey)!;
    for (const s of broadcast.speciesCaught) species.add(s);
  }

  for (const [grid, speciesSet] of gridMap) {
    heatmapData.push({
      grid,
      species: [...speciesSet],
      intensity: speciesSet.size,
    });
  }

  return {
    heatmapData,
    priceIndex,
    activeVessels: broadcasts.length,
    lastUpdated: new Date().toISOString(),
  };
}

function hashVesselId(id: string): string {
  // Simple hash for anonymous mode — in production, use SHA-256
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `vessel_${Math.abs(hash).toString(16)}`;
}
