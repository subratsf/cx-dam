#!/bin/bash

echo "========================================="
echo "Image Analysis Service Setup"
echo "========================================="

# Check Python version
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)

echo "Detected Python version: $PYTHON_VERSION"

if [ "$PYTHON_MAJOR" -ge 3 ] && [ "$PYTHON_MINOR" -ge 14 ]; then
    echo "⚠️  Warning: Python 3.14+ detected"
    echo "   Some packages may not have pre-built wheels for Python 3.14 yet."
    echo "   If installation fails, consider using Python 3.11 or 3.12:"
    echo "   - Install via pyenv: pyenv install 3.12.0 && pyenv local 3.12.0"
    echo "   - Or use Homebrew: brew install python@3.12"
    echo ""
fi

# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     MACHINE=Linux;;
    Darwin*)    MACHINE=Mac;;
    *)          MACHINE="UNKNOWN:${OS}"
esac

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "❌ Ollama is not installed"
    echo "Installing Ollama for ${MACHINE}..."

    if [ "$MACHINE" = "Mac" ]; then
        # macOS installation using Homebrew
        if command -v brew &> /dev/null; then
            echo "Installing via Homebrew..."
            brew install ollama
        else
            echo "⚠️  Homebrew not found. Please install Ollama manually:"
            echo "   Visit: https://ollama.com/download/mac"
            echo "   Or install Homebrew first: https://brew.sh"
            exit 1
        fi
    elif [ "$MACHINE" = "Linux" ]; then
        # Linux installation
        curl https://ollama.ai/install.sh | sh
    else
        echo "❌ Unsupported operating system: ${MACHINE}"
        echo "Please install Ollama manually from: https://ollama.com/download"
        exit 1
    fi

    if [ $? -ne 0 ]; then
        echo "❌ Failed to install Ollama"
        exit 1
    fi
fi

echo "✅ Ollama is installed"

# Check if Ollama is running
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "⚠️  Ollama is not running"
    echo "Starting Ollama in background..."

    if [ "$MACHINE" = "Mac" ]; then
        # On macOS, Ollama might be an app that needs to be opened
        if [ -d "/Applications/Ollama.app" ]; then
            open -a Ollama 2>/dev/null || ollama serve > /dev/null 2>&1 &
        else
            ollama serve > /dev/null 2>&1 &
        fi
    else
        ollama serve > /dev/null 2>&1 &
    fi

    echo "Waiting for Ollama to start..."
    for i in {1..10}; do
        if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
            echo "✅ Ollama is running"
            break
        fi
        sleep 1
    done

    if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "⚠️  Ollama may not be running properly"
        echo "   Try starting it manually: ollama serve"
    fi
else
    echo "✅ Ollama is already running"
fi

# Pull LLaVA model
echo "Checking for LLaVA model..."
if ollama list | grep -q "llava"; then
    echo "✅ LLaVA model already exists"
else
    echo "Pulling LLaVA model (this may take a while)..."
    ollama pull llava

    if [ $? -ne 0 ]; then
        echo "❌ Failed to pull LLaVA model"
        exit 1
    fi
    echo "✅ LLaVA model downloaded"
fi

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv

    if [ $? -ne 0 ]; then
        echo "❌ Failed to create virtual environment"
        exit 1
    fi
    echo "✅ Virtual environment created"
fi

# Activate virtual environment
source venv/bin/activate

# Install Python dependencies
echo "Installing Python dependencies..."
pip install --upgrade pip > /dev/null 2>&1

# Use custom install script that checks Python version
./install-deps.sh

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    echo ""
    echo "If you're using Python 3.14, please switch to Python 3.12:"
    echo "  brew install python@3.12"
    echo "  deactivate  # if in venv"
    echo "  rm -rf venv"
    echo "  python3.12 -m venv venv"
    echo "  source venv/bin/activate"
    echo "  ./setup.sh"
    exit 1
fi
echo "✅ Python dependencies installed"

# Pre-download ML models
echo "Pre-downloading ML models..."
python -c "from nudenet import NudeDetector; print('Loading NudeNet...'); NudeDetector(); print('✅ NudeNet ready')"
python -c "from sentence_transformers import SentenceTransformer; print('Loading CLIP...'); SentenceTransformer('clip-ViT-B-32'); print('✅ CLIP ready')"

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo "✅ .env file created"
fi

# Start Qdrant using Docker
echo "Starting Qdrant vector database..."
if docker ps | grep -q qdrant; then
    echo "✅ Qdrant is already running"
else
    docker-compose up -d qdrant

    if [ $? -ne 0 ]; then
        echo "❌ Failed to start Qdrant"
        exit 1
    fi

    echo "Waiting for Qdrant to be ready..."
    sleep 5
    echo "✅ Qdrant is running"
fi

echo ""
echo "========================================="
echo "✅ Setup Complete!"
echo "========================================="
echo ""
echo "To start the service:"
echo "  1. Activate venv: source venv/bin/activate"
echo "  2. Run service: python main.py"
echo ""
echo "Or use Docker Compose:"
echo "  docker-compose up -d"
echo ""
echo "API will be available at: http://localhost:8001"
echo "Qdrant UI: http://localhost:6333/dashboard"
echo "========================================="
