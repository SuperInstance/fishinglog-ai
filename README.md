# FishingLog.ai

> Edge AI that sees, learns, and alerts. From the wheelhouse to the back deck.

**FishingLog.ai** is an edge AI system for commercial fishing vessels. It watches every fish that crosses the sorting table, learns from the captain's corrections, alerts on species mismatches, and generates regulatory catch reports — all running locally on a Jetson Orin Nano.

## Why Edge AI for Fishing?

- **No internet required** — All vision, voice, and classification runs on-board
- **Real-time alerts** — Species mismatch warnings in under 200ms
- **Learns your vessel** — Adapts to your crew's sorting patterns and local species
- **Regulatory compliance** — Auto-generates ADFG/NOAA reports in the correct format
- **Captain-first** — Voice controlled, glove-compatible UI, maritime terminology

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Vessel (Edge)                   │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Cameras  │  │  Mic     │  │  Jetson Orin  │  │
│  │  (2-4x)   │  │ (Headset)│  │  Nano 8GB     │  │
│  └─────┬─────┘  └────┬─────┘  └───────┬───────┘  │
│        │              │                │          │
│        ▼              ▼                ▼          │
│  ┌──────────────────────────────────────────┐    │
│  │           Vision Pipeline                │    │
│  │  Frame Selection → YOLOv8-nano → Detect  │    │
│  └──────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────┐    │
│  │           Audio Pipeline                 │    │
│  │  Noise Suppression → Whisper → Intent    │    │
│  └──────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────┐    │
│  │        Alert & Reporting Engine          │    │
│  │  Species Mismatch → Catch Log → ADFG    │    │
│  └──────────────────────────────────────────┘    │
│                      │ (when connected)           │
└──────────────────────┼───────────────────────────┘
                       ▼
              ┌─────────────────┐
              │   Cloud (CF)    │
              │  Workers + AI   │
              │  Model Training │
              └─────────────────┘
```

## Hardware Requirements

| Component | Specification | Purpose |
|-----------|--------------|---------|
| **Compute** | Jetson Orin Nano 8GB | Edge AI inference |
| **Cameras** | 2-4x IP67 4K fisheye | Deck + catch area monitoring |
| **Audio** | Waterproof headset mic | Captain voice commands |
| **Navigation** | GPS/NMEA 2000 interface | Location + vessel data |
| **Connectivity** | Dual SIM 4G + Starlink RV | Cloud sync when available |
| **Storage** | 1TB NVMe SSD | 30-day rolling buffer |

## Quick Start

### 1. Fork & Clone

```bash
git clone https://github.com/Lucineer/fishinglog-ai.git
cd fishinglog-ai
```

### 2. Configure Your Vessel

```bash
cp cocapn/cocapn.json.example cocapn/cocapn.json
# Edit cocapn.json with your vessel name, region, and target species
```

### 3. Deploy on Vessel (Jetson)

```bash
# On your Jetson Orin Nano
docker compose -f docker/docker-compose.yml up --build
```

### 4. Deploy Cloud Backend (Optional)

```bash
npm install
npx wrangler deploy
```

## Vision Pipeline

The dual-model architecture ensures accuracy whether online or offline:

| Model | Runs On | Species | Speed | When |
|-------|---------|---------|-------|------|
| **Edge** (YOLOv8-nano FP16) | Jetson Orin | 25 common species | 15 FPS | Always |
| **Cloud** (ResNet50 + ViT ensemble) | Cloudflare AI | 300+ species | 2 FPS async | When connected |

Supported species include: King Salmon, Coho, Sockeye, Pink, Chum, Halibut, Pacific Cod, Pollock, Rockfish (multiple species), Lingcod, and more.

### Classification Flow

1. Camera captures frames at 2Hz
2. Edge model runs real-time detection
3. If confidence < 70%, captain is asked to confirm
4. If confidence < 50%, flagged for manual review
5. Cloud model validates when connectivity available
6. Corrections feed back into training pipeline

## Captain Voice

Voice-first interface using natural maritime commands:

| Command | Intent | Action |
|---------|--------|--------|
| "King salmon bin one" | Label catch | Record king salmon in bin 1 |
| "That was a coho" | Correction | Correct last classification |
| "Why is that a king?" | Question | Explain classification reasoning |
| "How many kings today?" | Query | Report daily king salmon count |
| "Show me the catch log" | Navigation | Open catch log on tablet |

Uses local Whisper-tiny for transcription with noise suppression (RNNoise). Physical button override available for all voice functions.

## Training the System

FishingLog learns from corrections:

1. Captain corrects a classification (voice or tablet)
2. System captures the image + correction + context (GPS, depth, water temp)
3. Creates training triplet: (image, wrong_label, correct_label)
4. Queued for cloud retraining
5. Next OTA update improves edge model for your vessel

```bash
# View training data collected
cat cocapn/training-data.json

# Check model accuracy
curl http://localhost:8080/api/training/status
```

## Alert Configuration

Three priority levels:

| Priority | Example | Delivery |
|----------|---------|----------|
| **CRITICAL** | Protected species bycatch | Voice + visual + SMS |
| **OPERATIONAL** | Quota approaching 80% | Voice + tablet |
| **INFORMATIONAL** | Price change for target species | Tablet only |

Alert fatigue prevention: adaptive thresholding based on captain response rate. False alerts can be marked to improve the model.

## Catch Reporting

Automated catch log with regulatory export:

- **ADFG** — Alaska Department of Fish & Game format
- **NOAA** — National Oceanic format with eVTR
- **DFO** — Canadian Fisheries and Oceans format

```bash
# Generate daily report
curl http://localhost:8080/api/report/daily

# Export for ADFG
curl http://localhost:8080/api/report/regional/adfg

# Export eVTR for NOAA
curl http://localhost:8080/api/report/regional/noaa
```

## Multi-Vessel Coordination (A2A)

When vessels are in range:

- **VHF Data Exchange** — Fishing hotspots (anonymized), weather, hazard warnings
- **Cloud Fleet Features** — Species sightings heatmap, collective price data, search patterns

Privacy controls: captain selects sharing level (none / anonymous / full).

## Offline Operation

All critical functions work without internet:

- Vision classification (edge model)
- Voice commands (local Whisper)
- Catch logging (local SQLite)
- Alert generation (local rules)
- Training data collection (queued for upload)

When connectivity returns, data syncs automatically with priority: Alerts > Corrections > Catch data > Images.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Camera salt occlusion | Trigger camera wash system, check daily calibration |
| Low-light conditions | IR illuminators auto-trigger at dusk |
| Voice not recognizing | Speak closer to mic, reduce background noise |
| Model accuracy dropping | Check training data quality, request OTA update |
| Jetson overheating | Ensure ventilation, monitor with `/api/edge/status` |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'feat: add new species support'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

All contributions must follow maritime safety standards and regulatory compliance requirements.

## License

MIT License — see [LICENSE](LICENSE) for details.

---

**FishingLog.ai** — Because the best AI is the one that earns its sea legs alongside you.
