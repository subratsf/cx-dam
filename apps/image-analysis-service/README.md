# Image Analysis Service

AI-powered image analysis microservice with content moderation and RAG-based semantic search.

## Features

- **Content Moderation**: Automatically detect inappropriate content using NudeNet
- **Image Description**: Generate detailed descriptions using Ollama + LLaVA
- **Semantic Search**: Vector-based search using CLIP embeddings and Qdrant
- **Fast API**: RESTful API built with FastAPI

## Prerequisites

1. **Python 3.11+**
2. **Docker & Docker Compose** (for Qdrant)
3. **Ollama** (for image description)
   ```bash
   # Install Ollama
   curl https://ollama.ai/install.sh | sh

   # Pull LLaVA model
   ollama pull llava
   ```

## Quick Start

### Option 1: Using Docker Compose (Recommended)

```bash
# Start Qdrant and the service
docker-compose up -d

# Check logs
docker-compose logs -f image-analysis
```

### Option 2: Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Start Qdrant
docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant

# Start Ollama (in another terminal)
ollama serve

# Run the service
python main.py
```

## API Endpoints

### Health Check
```bash
GET /health
```

### Analyze Image (Full Analysis)
```bash
POST /api/analyze
Content-Type: multipart/form-data

Body: { file: <image file> }

Response:
{
  "is_safe": true,
  "description": "A screenshot of code...",
  "embedding": [0.123, ...],
  "moderation_details": {...}
}
```

### Content Moderation Only
```bash
POST /api/moderate
Content-Type: multipart/form-data

Body: { file: <image file> }

Response:
{
  "is_safe": false,
  "message": "Image contains inappropriate content: EXPOSED_BREAST_F",
  "details": {...}
}
```

### Generate Description
```bash
POST /api/describe
Content-Type: multipart/form-data

Body: { file: <image file> }

Response:
{
  "description": "A detailed description..."
}
```

### Semantic Search
```bash
POST /api/search
Content-Type: application/json

Body:
{
  "query": "blue sky with mountains",
  "limit": 20
}

Response:
[
  {
    "asset_id": "uuid",
    "score": 0.85,
    "description": "..."
  }
]
```

### Index Asset
```bash
POST /api/index
Content-Type: application/json

Body:
{
  "asset_id": "uuid",
  "description": "...",
  "workspace": "repo/name",
  "name": "file.png"
}
```

## Configuration

Environment variables (`.env`):

```bash
QDRANT_HOST=localhost
QDRANT_PORT=6333
OLLAMA_BASE_URL=http://localhost:11434
CONTENT_MODERATION_THRESHOLD=0.6
```

## Testing

```bash
# Test content moderation
curl -X POST http://localhost:8001/api/moderate \
  -F "file=@test_image.jpg"

# Test full analysis
curl -X POST http://localhost:8001/api/analyze \
  -F "file=@test_image.jpg"

# Test semantic search
curl -X POST http://localhost:8001/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "sunset beach", "limit": 10}'
```

## Architecture

```
┌─────────────┐
│   Upload    │
│   Image     │
└──────┬──────┘
       │
       ├─────────────────────────────────┐
       │                                 │
       ▼                                 ▼
┌──────────────┐                 ┌──────────────┐
│   NudeNet    │                 │    LLaVA     │
│  Moderation  │                 │ (via Ollama) │
└──────┬───────┘                 └──────┬───────┘
       │                                 │
       ▼                                 ▼
┌──────────────┐                 ┌──────────────┐
│ Reject if    │                 │     CLIP     │
│ Unsafe       │                 │  Embeddings  │
└──────────────┘                 └──────┬───────┘
                                        │
                                        ▼
                                 ┌──────────────┐
                                 │   Qdrant     │
                                 │  Vector DB   │
                                 └──────────────┘
```

## Models Used

- **NudeNet**: Content moderation (auto-downloaded on first run)
- **CLIP ViT-B/32**: Text/image embeddings (auto-downloaded)
- **LLaVA**: Image description (via Ollama)

## Performance

- Content moderation: ~200-500ms per image
- Image description: ~2-5 seconds (depends on image complexity)
- Embedding generation: ~50-100ms
- Vector search: ~10-50ms

## Troubleshooting

### Ollama not connecting
```bash
# Check if Ollama is running
ollama list

# Start Ollama
ollama serve
```

### Qdrant connection issues
```bash
# Check if Qdrant is running
docker ps | grep qdrant

# Restart Qdrant
docker-compose restart qdrant
```

### Model download issues
```bash
# Pre-download models
python -c "from nudenet import NudeDetector; NudeDetector()"
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('clip-ViT-B-32')"
```

## License

MIT
