import io
import os
import base64
import requests
from typing import Optional
from PIL import Image
import logging

logger = logging.getLogger(__name__)


class ImageDescriptionService:
    """
    Generate image descriptions using Ollama + LLaVA
    """

    def __init__(self):
        self.ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.model = "llava"
        self._is_available = self._check_availability()

    def _check_availability(self) -> bool:
        """Check if Ollama service is available"""
        try:
            response = requests.get(f"{self.ollama_url}/api/tags", timeout=2)
            if response.status_code == 200:
                models = response.json().get("models", [])
                # Check if llava model is available
                has_llava = any(self.model in m.get("name", "") for m in models)
                if has_llava:
                    logger.info("Ollama with LLaVA model is available")
                    return True
                else:
                    logger.warning(f"Ollama is running but {self.model} model not found")
                    return False
            return False
        except Exception as e:
            logger.warning(f"Ollama not available: {e}")
            return False

    def is_available(self) -> bool:
        """Check if service is available"""
        return self._is_available

    async def generate_description(self, image_bytes: bytes) -> str:
        """
        Generate a detailed description of the image for search indexing

        Args:
            image_bytes: Image file as bytes

        Returns:
            str: Detailed image description
        """
        try:
            if not self._is_available:
                return "Image description unavailable - Ollama service not running"

            # Convert image to base64
            image = Image.open(io.BytesIO(image_bytes))

            # Convert RGBA to RGB if needed
            if image.mode == 'RGBA':
                background = Image.new('RGB', image.size, (255, 255, 255))
                background.paste(image, mask=image.split()[3])
                image = background
            elif image.mode != 'RGB':
                image = image.convert('RGB')

            # Resize if too large (LLaVA works better with smaller images)
            max_size = 512
            if max(image.size) > max_size:
                ratio = max_size / max(image.size)
                new_size = tuple(int(dim * ratio) for dim in image.size)
                image = image.resize(new_size, Image.Resampling.LANCZOS)

            # Convert to base64
            buffer = io.BytesIO()
            image.save(buffer, format="JPEG", quality=85)
            image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

            # Call Ollama API
            prompt = """Describe this image in detail for search indexing purposes.
Include: objects, people, actions, setting, colors, text visible, and overall theme.
Keep it concise but comprehensive (2-3 sentences)."""

            response = requests.post(
                f"{self.ollama_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "images": [image_base64],
                    "stream": False
                },
                timeout=30
            )

            if response.status_code == 200:
                result = response.json()
                description = result.get("response", "").strip()

                logger.info(f"Generated description: {description[:100]}...")
                return description
            else:
                logger.error(f"Ollama API error: {response.status_code}")
                return "Failed to generate image description"

        except Exception as e:
            logger.error(f"Image description error: {e}")
            return f"Error generating description: {str(e)}"
