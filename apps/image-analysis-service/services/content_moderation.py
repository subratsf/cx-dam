import io
import os
from typing import Dict
from PIL import Image
from nudenet import NudeDetector
import logging

logger = logging.getLogger(__name__)


class ContentModerationService:
    """
    Content moderation using NudeNet to detect inappropriate images
    """

    def __init__(self):
        self.threshold = float(os.getenv("CONTENT_MODERATION_THRESHOLD", "0.6"))
        self.detector = None
        self._initialize_detector()

    def _initialize_detector(self):
        """Initialize NudeNet detector"""
        try:
            logger.info("Initializing NudeNet detector...")
            self.detector = NudeDetector()
            logger.info("NudeNet detector initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize NudeNet: {e}")
            raise

    async def check_image(self, image_bytes: bytes) -> Dict:
        """
        Check if image contains inappropriate content

        Args:
            image_bytes: Image file as bytes

        Returns:
            Dict with keys:
            - is_safe: boolean
            - message: str
            - detections: list of detected labels
            - confidence_scores: dict of label -> score
        """
        try:
            # Convert bytes to PIL Image
            image = Image.open(io.BytesIO(image_bytes))

            # Convert RGBA to RGB if needed
            if image.mode == 'RGBA':
                # Create white background
                background = Image.new('RGB', image.size, (255, 255, 255))
                background.paste(image, mask=image.split()[3])  # 3 is the alpha channel
                image = background
            elif image.mode != 'RGB':
                image = image.convert('RGB')

            # Save to temporary path for NudeNet
            temp_path = "/tmp/temp_image.jpg"
            image.save(temp_path, format='JPEG')

            # Run detection
            detections = self.detector.detect(temp_path)

            # Clean up temp file
            os.remove(temp_path)

            # Unsafe content labels
            unsafe_labels = [
                'EXPOSED_BREAST_F',
                'EXPOSED_GENITALIA_F',
                'EXPOSED_GENITALIA_M',
                'EXPOSED_BUTTOCKS',
                'EXPOSED_ANUS'
            ]

            # Check for unsafe content
            detected_unsafe = []
            confidence_scores = {}

            for detection in detections:
                label = detection['class']
                score = detection['score']

                confidence_scores[label] = score

                if label in unsafe_labels and score > self.threshold:
                    detected_unsafe.append({
                        'label': label,
                        'confidence': score,
                        'box': detection.get('box', {})
                    })

            is_safe = len(detected_unsafe) == 0

            message = "Image is safe for upload" if is_safe else \
                      f"Image contains inappropriate content: {', '.join([d['label'] for d in detected_unsafe])}"

            return {
                "is_safe": is_safe,
                "message": message,
                "detections": detected_unsafe,
                "confidence_scores": confidence_scores,
                "all_detections": detections
            }

        except Exception as e:
            logger.error(f"Content moderation error: {e}")
            # Default to safe if error (don't block uploads on technical errors)
            # In production, you might want different behavior
            return {
                "is_safe": True,
                "message": f"Moderation check failed: {str(e)}. Defaulting to safe.",
                "detections": [],
                "confidence_scores": {},
                "error": str(e)
            }
