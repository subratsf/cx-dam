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
    Generate image descriptions using Ollama + LLaVA (local) or OpenAI Vision API (cloud)
    """

    def __init__(self):
        # Check which provider to use
        self.provider = os.getenv("IMAGE_DESCRIPTION_PROVIDER", "ollama")  # "ollama" or "openai"

        # Ollama settings
        self.ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.ollama_model = "llava"

        # OpenAI settings
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.openai_model = os.getenv("OPENAI_VISION_MODEL", "gpt-4o-mini")

        self._is_available = self._check_availability()

    def _check_availability(self) -> bool:
        """Check if the selected image description provider is available"""
        try:
            if self.provider == "openai":
                if self.openai_api_key:
                    logger.info("OpenAI Vision API configured")
                    return True
                else:
                    logger.warning("OpenAI provider selected but OPENAI_API_KEY not set")
                    return False

            elif self.provider == "ollama":
                response = requests.get(f"{self.ollama_url}/api/tags", timeout=2)
                if response.status_code == 200:
                    models = response.json().get("models", [])
                    # Check if llava model is available
                    has_llava = any(self.ollama_model in m.get("name", "") for m in models)
                    if has_llava:
                        logger.info("Ollama with LLaVA model is available")
                        return True
                    else:
                        logger.warning(f"Ollama is running but {self.ollama_model} model not found")
                        return False
                return False
            else:
                logger.warning(f"Unknown provider: {self.provider}")
                return False

        except Exception as e:
            logger.warning(f"Image description service not available: {e}")
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
                return f"Image description unavailable - {self.provider} service not configured"

            if self.provider == "openai":
                return await self._generate_with_openai(image_bytes)
            elif self.provider == "ollama":
                return await self._generate_with_ollama(image_bytes)
            else:
                return "Unknown image description provider"

        except Exception as e:
            logger.error(f"Image description error: {e}")
            return f"Error generating description: {str(e)}"

    async def _generate_with_openai(self, image_bytes: bytes) -> str:
        """Generate description using OpenAI Vision API"""
        try:
            # Prepare image
            image = Image.open(io.BytesIO(image_bytes))

            # Convert RGBA to RGB if needed
            if image.mode == 'RGBA':
                background = Image.new('RGB', image.size, (255, 255, 255))
                background.paste(image, mask=image.split()[3])
                image = background
            elif image.mode != 'RGB':
                image = image.convert('RGB')

            # Resize if too large
            max_size = 1024  # OpenAI supports larger images
            if max(image.size) > max_size:
                ratio = max_size / max(image.size)
                new_size = tuple(int(dim * ratio) for dim in image.size)
                image = image.resize(new_size, Image.Resampling.LANCZOS)

            # Convert to base64
            buffer = io.BytesIO()
            image.save(buffer, format="JPEG", quality=85)
            image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

            # Call OpenAI API
            prompt = """Describe this image in detail for search indexing purposes.
Include: objects, people, actions, setting, colors, text visible, and overall theme.
Keep it concise but comprehensive (2-3 sentences)."""

            response = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.openai_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": self.openai_model,
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/jpeg;base64,{image_base64}"
                                    }
                                }
                            ]
                        }
                    ],
                    "max_tokens": 300
                },
                timeout=30
            )

            if response.status_code == 200:
                result = response.json()
                description = result["choices"][0]["message"]["content"].strip()
                logger.info(f"Generated description (OpenAI): {description[:100]}...")
                return description
            else:
                logger.error(f"OpenAI API error: {response.status_code} - {response.text}")
                return "Failed to generate image description"

        except Exception as e:
            logger.error(f"OpenAI description error: {e}")
            return f"Error with OpenAI: {str(e)}"

    async def _generate_with_ollama(self, image_bytes: bytes) -> str:
        """Generate description using Ollama + LLaVA"""
        try:
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
                    "model": self.ollama_model,
                    "prompt": prompt,
                    "images": [image_base64],
                    "stream": False
                },
                timeout=30
            )

            if response.status_code == 200:
                result = response.json()
                description = result.get("response", "").strip()

                logger.info(f"Generated description (Ollama): {description[:100]}...")
                return description
            else:
                logger.error(f"Ollama API error: {response.status_code}")
                return "Failed to generate image description"

        except Exception as e:
            logger.error(f"Ollama description error: {e}")
            return f"Error with Ollama: {str(e)}"
