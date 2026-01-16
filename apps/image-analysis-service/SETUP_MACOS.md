# macOS Setup Guide - Image Analysis Service

## ⚠️ Important: Python Version Requirement

This service requires **Python 3.11 or 3.12** (not 3.14) because some ML libraries don't support Python 3.14 yet:
- `onnxruntime` (used by NudeNet) - no Python 3.14 wheels
- `torch` - limited Python 3.14 support

## Quick Setup (Recommended)

### 1. Install Python 3.12

```bash
# Install Python 3.12 via Homebrew
brew install python@3.12

# Verify installation
python3.12 --version
# Should output: Python 3.12.x
```

### 2. Set Up the Service

```bash
# Navigate to service directory
cd apps/image-analysis-service

# Remove any existing virtual environment
rm -rf venv

# Create virtual environment with Python 3.12
python3.12 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Verify you're using the correct Python
python --version
# Should output: Python 3.12.x

# Run setup script
./setup.sh
```

## Manual Setup (If Automated Setup Fails)

### 1. Install Ollama

```bash
# Install via Homebrew
brew install ollama

# Start Ollama (in a separate terminal, keep it running)
ollama serve

# Pull the LLaVA model (in another terminal)
ollama pull llava
```

### 2. Install Python Dependencies

```bash
cd apps/image-analysis-service
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Run custom install script (checks Python version)
./install-deps.sh
```

### 3. Start Qdrant

```bash
# Make sure Docker Desktop is running
docker-compose up -d qdrant

# Check if it's running
docker ps | grep qdrant
```

### 4. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit if needed (defaults should work)
nano .env
```

### 5. Pre-download ML Models (Optional)

```bash
# This will download NudeNet and CLIP models
python -c "from nudenet import NudeDetector; NudeDetector()"
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('clip-ViT-B-32')"
```

### 6. Start the Service

```bash
python main.py

# Service will be available at:
# http://localhost:8001
```

## Alternative: Using pyenv

If you need to manage multiple Python versions:

```bash
# Install pyenv
brew install pyenv

# Add to your shell profile (~/.zshrc or ~/.bash_profile)
echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.zshrc
echo 'command -v pyenv >/dev/null || export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.zshrc
echo 'eval "$(pyenv init -)"' >> ~/.zshrc

# Restart shell
source ~/.zshrc

# Install Python 3.12
pyenv install 3.12.0

# Set Python 3.12 for this project
cd apps/image-analysis-service
pyenv local 3.12.0

# Verify
python --version

# Now proceed with setup
./setup.sh
```

## Troubleshooting

### Issue: "onnxruntime" installation fails

**Cause**: You're using Python 3.14 or higher

**Solution**: Switch to Python 3.12 (see instructions above)

### Issue: Ollama not found

```bash
# Install manually
brew install ollama

# Or download from: https://ollama.com/download/mac
```

### Issue: Qdrant won't start

```bash
# Make sure Docker Desktop is running
open -a Docker

# Restart Qdrant
docker-compose down
docker-compose up -d qdrant

# Check logs
docker logs qdrant
```

### Issue: "Module not found" errors

```bash
# Make sure virtual environment is activated
source venv/bin/activate

# Reinstall dependencies
./install-deps.sh
```

### Issue: PyTorch installation is slow

```bash
# Install CPU-only version (faster download)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
```

## Testing the Service

### 1. Check Health

```bash
curl http://localhost:8001/health
```

Expected response:
```json
{
  "status": "healthy",
  "services": {
    "content_moderation": "ready",
    "image_description": "ready",
    "vector_search": "ready"
  }
}
```

### 2. Test Content Moderation

```bash
# Test with an image
curl -X POST http://localhost:8001/api/moderate \
  -F "file=@/path/to/your/image.jpg"
```

### 3. Test Image Analysis

```bash
curl -X POST http://localhost:8001/api/analyze \
  -F "file=@/path/to/your/image.jpg"
```

## System Requirements

- **OS**: macOS 12.0 or later
- **Python**: 3.11 or 3.12 (NOT 3.14)
- **RAM**: 8GB minimum, 16GB recommended
- **Disk**: ~10GB for models and dependencies
- **Docker**: Docker Desktop for Qdrant

## What Gets Installed

1. **Ollama** (~500MB) - Runs LLaVA model for image description
2. **LLaVA Model** (~4.5GB) - Vision-language model
3. **NudeNet** (~60MB) - Content moderation model
4. **CLIP** (~350MB) - Image embedding model
5. **PyTorch** (~200MB CPU version) - ML framework
6. **Qdrant** - Vector database (runs in Docker)

Total: ~6GB of downloads

## Next Steps

Once the service is running:

1. Update backend `.env`:
   ```bash
   IMAGE_ANALYSIS_SERVICE_URL=http://localhost:8001
   ```

2. Run database migration:
   ```bash
   cd ../..  # back to project root
   psql $DATABASE_URL -f apps/backend/src/db/migrations/003_add_ai_description.sql
   ```

3. Start the backend:
   ```bash
   npm run dev:backend
   ```

4. Test image upload with AI analysis!
