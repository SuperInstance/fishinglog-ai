/**
 * Cloudflare Worker — Cloud Backend for FishingLog.ai
 *
 * Handles: species classification (Workers AI), catch data storage (D1),
 * image storage (R2), vessel memory (KV), and API endpoints.
 */

import { classifyCloud } from './vision/classifier.js';
import { transcribeCloud } from './audio/stt.js';
import { parseIntent } from './audio/intent.js';

export interface Env {
  AI: any;
  VESSEL_KV: KVNamespace;
  IMAGES: R2Bucket;
  CATCH_DB: D1Database;
  VESSEL_ID: string;
  REGION: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // Health check
    if (path === '/api/health') {
      return jsonResponse({
        status: 'ok',
        vessel: env.VESSEL_ID,
        region: env.REGION,
        timestamp: new Date().toISOString(),
      });
    }

    // Vision: classify image
    if (path === '/api/vision/classify' && request.method === 'POST') {
      const imageData = await request.arrayBuffer();
      const result = await classifyCloud(imageData, env);
      if (!result) {
        return jsonResponse({ error: 'Cloud classification unavailable' }, 503);
      }
      return jsonResponse(result);
    }

    // Audio: transcribe
    if (path === '/api/audio/transcribe' && request.method === 'POST') {
      const audioData = await request.arrayBuffer();
      const result = await transcribeCloud(audioData, env);
      if (!result) {
        return jsonResponse({ error: 'Cloud transcription unavailable' }, 503);
      }
      return jsonResponse(result);
    }

    // Audio: parse intent
    if (path === '/api/audio/intent' && request.method === 'POST') {
      const { text } = await request.json() as { text: string };
      const intent = parseIntent(text);
      return jsonResponse(intent);
    }

    // Catch: log a catch record
    if (path === '/api/catch' && request.method === 'POST') {
      const catchData = await request.json() as Record<string, unknown>;
      await env.CATCH_DB.prepare(
        'INSERT INTO catches (id, species, count, confidence, location, timestamp, source, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        crypto.randomUUID(),
        catchData.species,
        catchData.count ?? 1,
        catchData.confidence ?? 0,
        JSON.stringify(catchData.location),
        new Date().toISOString(),
        catchData.source ?? 'cloud',
        catchData.notes ?? '',
      ).run();
      return jsonResponse({ success: true });
    }

    // Catch: get daily log
    if (path === '/api/catch/daily' && request.method === 'GET') {
      const date = url.searchParams.get('date') ?? new Date().toISOString().split('T')[0];
      const results = await env.CATCH_DB.prepare(
        'SELECT * FROM catches WHERE DATE(timestamp) = ? ORDER BY timestamp DESC'
      ).bind(date).all();
      return jsonResponse(results.results);
    }

    // Images: upload
    if (path === '/api/images' && request.method === 'POST') {
      const imageData = await request.arrayBuffer();
      const key = `img_${Date.now()}_${crypto.randomUUID()}`;
      await env.IMAGES.put(key, imageData);
      return jsonResponse({ key });
    }

    // Images: get
    if (path.startsWith('/api/images/') && request.method === 'GET') {
      const key = path.replace('/api/images/', '');
      const object = await env.IMAGES.get(key);
      if (!object) return jsonResponse({ error: 'Not found' }, 404);
      return new Response(object.body, {
        headers: { 'Content-Type': 'image/jpeg', ...CORS_HEADERS },
      });
    }

    // Training: status
    if (path === '/api/training/status' && request.method === 'GET') {
      const data = await env.VESSEL_KV.get(`training:${env.VESSEL_ID}`);
      return jsonResponse(data ? JSON.parse(data) : { samples: 0, accuracy: 0 });
    }

    // Static files — serve from public/
    if (path === '/' || path === '/index.html') {
      return fetch(new URL('/index.html', request.url));
    }
    if (path === '/app' || path === '/app.html') {
      return fetch(new URL('/app.html', request.url));
    }

    return jsonResponse({ error: 'Not found' }, 404);
  },
};
