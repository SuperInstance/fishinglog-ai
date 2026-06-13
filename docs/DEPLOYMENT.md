# Deployment Guide — FishingLog.ai

## Hardware Setup

### Required Equipment

| Component | Specification | Notes |
|-----------|--------------|-------|
| Compute | NVIDIA Jetson Orin Nano 8GB | Developer kit or production module |
| Cameras | 2-4x IP67-rated 4K fisheye | Deck + catch area coverage |
| Audio | Waterproof headset microphone | Directional, noise-cancelling |
| Navigation | GPS/NMEA 2000 interface | For location data |
| Connectivity | Dual SIM 4G router + Starlink RV | Cloud sync when available |
| Storage | 1TB NVMe SSD | 30-day rolling buffer |

### Jetson Setup

1. Flash Jetson Orin Nano with JetPack 6.0+
2. Enable max performance mode: `sudo nvpmodel -m 0`
3. Install TensorRT and DeepStream
4. Connect cameras and verify with `v4l2-ctl --list-devices`

## Software Deployment

### Option 1: Docker Compose (Recommended)

```bash
# Clone the repo
git clone https://github.com/Lucineer/fishinglog-ai.git
cd fishinglog-ai

# Configure your vessel
cp docker/.env.example docker/.env
# Edit docker/.env with your vessel details

# Deploy
docker compose -f docker/docker-compose.yml up -d

# Verify
curl http://localhost:3000/api/health
```

### Option 2: Cloudflare Workers (Cloud Backend)

```bash
npm install

# Configure wrangler.toml with your KV, R2, and D1 bindings
npx wrangler deploy
```

### Option 3: Manual Installation

```bash
npm install
npm run build
NODE_ENV=production node dist/worker.js
```

## Camera Configuration

Edit `cocapn/cocapn.json` to configure cameras:

```json
{
  "vision": {
    "cameras": [
      { "id": "deck-cam", "position": "deck", "type": "ip", "address": "rtsp://192.168.1.100:554/stream" },
      { "id": "catch-cam", "position": "catch_area", "type": "ip", "address": "rtsp://192.168.1.101:554/stream" }
    ]
  }
}
```

For USB cameras, use the device path: `"type": "usb", "address": "/dev/video0"`

## Calibration

After deployment, calibrate the vision system:

1. Place a known-size object (ruler/calibration board) on the sorting table
2. Run calibration: `curl -X POST http://localhost:3000/api/vision/calibrate`
3. Verify measurements match within 5%

## Network Configuration

### Starlink Setup
1. Connect Starlink RV to power and give it clear sky view
2. Configure WiFi on the vessel's router
3. Set Starlink as primary WAN, 4G as failover

### Offline Preparation
Before heading out:
1. Verify latest model is loaded: `curl http://localhost:3000/api/edge/status`
2. Check storage capacity: 30-day buffer requires ~500GB free
3. Test all cameras and audio

## Monitoring

| Endpoint | Purpose |
|----------|---------|
| `/api/health` | System health check |
| `/api/edge/status` | Jetson status (temp, GPU, models) |
| `/api/training/status` | Model accuracy, samples collected |
| `/api/catch/daily` | Today's catch log |

## Troubleshooting

### Jetson Overheating
- Ensure adequate ventilation
- Check fan: `sudo jetson_clocks --show`
- Reduce inference FPS if needed

### Camera Issues
- Check RTSP stream: `ffplay rtsp://camera-address/stream`
- USB: verify with `lsusb` and `v4l2-ctl`
- Salt buildup: trigger wash system

### Audio Not Working
- Check microphone: `arecord -l`
- Test with: `arecord -d 3 test.wav && aplay test.wav`
- Verify RNNoise is active

## Updates

### OTA Model Updates
Models update automatically when connected. Check status:
```bash
curl http://localhost:3000/api/training/status
```

### Software Updates
```bash
cd fishinglog-ai
git pull origin main
docker compose -f docker/docker-compose.yml up -d --build
```
