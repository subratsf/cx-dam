#!/bin/bash

echo "Installing Python dependencies..."

# Check Python version
PYTHON_VERSION=$(python --version 2>&1 | awk '{print $2}')
PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)

echo "Python version: $PYTHON_VERSION"

if [ "$PYTHON_MAJOR" -ge 3 ] && [ "$PYTHON_MINOR" -ge 14 ]; then
    echo "❌ Error: Python 3.14+ is not compatible with required packages"
    echo ""
    echo "The following packages do not support Python 3.14:"
    echo "  - onnxruntime (required by NudeNet for content moderation)"
    echo "  - PyTorch may have limited wheel availability"
    echo ""
    echo "Please use Python 3.11 or 3.12. Here's how:"
    echo ""
    echo "Option 1: Use Homebrew"
    echo "  brew install python@3.12"
    echo "  python3.12 -m venv venv"
    echo "  source venv/bin/activate"
    echo ""
    echo "Option 2: Use pyenv"
    echo "  brew install pyenv"
    echo "  pyenv install 3.12.0"
    echo "  pyenv local 3.12.0"
    echo "  python -m venv venv"
    echo "  source venv/bin/activate"
    echo ""
    exit 1
fi

# Install dependencies in order to avoid conflicts
echo "Step 1: Installing core dependencies..."
pip install fastapi uvicorn python-multipart pillow requests python-dotenv

echo "Step 2: Installing vector search dependencies..."
pip install qdrant-client sentence-transformers

echo "Step 3: Installing OpenCV..."
pip install opencv-python-headless

echo "Step 4: Installing PyTorch (CPU version)..."
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

echo "Step 5: Installing ONNX Runtime..."
pip install onnxruntime

echo "Step 6: Installing NudeNet..."
pip install nudenet

echo ""
echo "✅ All dependencies installed successfully!"
