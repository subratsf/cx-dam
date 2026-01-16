import os
from typing import List, Dict, Optional
from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
import logging
import uuid

logger = logging.getLogger(__name__)


class VectorSearchService:
    """
    Vector search using CLIP embeddings and Qdrant
    """

    def __init__(self):
        # Support both local and cloud Qdrant
        self.qdrant_url = os.getenv("QDRANT_URL")  # For Qdrant Cloud (e.g., https://xxx.qdrant.io)
        self.qdrant_api_key = os.getenv("QDRANT_API_KEY")  # For Qdrant Cloud
        self.qdrant_host = os.getenv("QDRANT_HOST", "localhost")  # For local
        self.qdrant_port = int(os.getenv("QDRANT_PORT", "6333"))  # For local
        self.collection_name = "asset_images"
        self.embedding_model = None
        self.qdrant_client = None
        self._is_available = False

        self._initialize()

    def _initialize(self):
        """Initialize CLIP model and Qdrant client"""
        try:
            # Initialize CLIP model for embeddings
            logger.info("Loading CLIP model...")
            self.embedding_model = SentenceTransformer('clip-ViT-B-32')
            logger.info("CLIP model loaded successfully")

            # Initialize Qdrant client (Cloud or Local)
            if self.qdrant_url:
                # Use Qdrant Cloud
                logger.info(f"Connecting to Qdrant Cloud at {self.qdrant_url}...")
                self.qdrant_client = QdrantClient(
                    url=self.qdrant_url,
                    api_key=self.qdrant_api_key,
                    timeout=10
                )
            else:
                # Use local Qdrant
                logger.info(f"Connecting to local Qdrant at {self.qdrant_host}:{self.qdrant_port}...")
                self.qdrant_client = QdrantClient(
                    host=self.qdrant_host,
                    port=self.qdrant_port,
                    timeout=5
                )

            # Check if collection exists, create if not
            try:
                collections = self.qdrant_client.get_collections()
                collection_exists = any(
                    c.name == self.collection_name
                    for c in collections.collections
                )

                if not collection_exists:
                    logger.info(f"Creating collection: {self.collection_name}")
                    self.qdrant_client.create_collection(
                        collection_name=self.collection_name,
                        vectors_config=VectorParams(
                            size=512,  # CLIP ViT-B/32 embedding size
                            distance=Distance.COSINE
                        )
                    )
                    logger.info(f"Collection {self.collection_name} created")
                else:
                    logger.info(f"Collection {self.collection_name} already exists")

                self._is_available = True
                logger.info("Vector search service initialized successfully")

            except Exception as e:
                logger.error(f"Qdrant collection error: {e}")
                self._is_available = False

        except Exception as e:
            logger.error(f"Failed to initialize vector search: {e}")
            self._is_available = False

    def is_available(self) -> bool:
        """Check if service is available"""
        return self._is_available

    async def generate_embedding(self, text: str) -> List[float]:
        """
        Generate CLIP embedding for text

        Args:
            text: Description text

        Returns:
            List of floats (embedding vector)
        """
        try:
            if not self.embedding_model:
                raise Exception("Embedding model not initialized")

            embedding = self.embedding_model.encode(text)
            return embedding.tolist()

        except Exception as e:
            logger.error(f"Embedding generation error: {e}")
            raise

    async def index_asset(
        self,
        asset_id: str,
        description: str,
        embedding: List[float],
        metadata: Dict
    ):
        """
        Index an asset in Qdrant

        Args:
            asset_id: Unique asset ID
            description: Asset description
            embedding: Vector embedding
            metadata: Additional metadata (workspace, name, etc.)
        """
        try:
            if not self.qdrant_client:
                raise Exception("Qdrant client not initialized")

            point = PointStruct(
                id=str(uuid.uuid4()),  # Qdrant point ID
                vector=embedding,
                payload={
                    "asset_id": asset_id,
                    "description": description,
                    **metadata
                }
            )

            self.qdrant_client.upsert(
                collection_name=self.collection_name,
                points=[point]
            )

            logger.info(f"Indexed asset {asset_id} in Qdrant")

        except Exception as e:
            logger.error(f"Indexing error: {e}")
            raise

    async def search(self, query: str, limit: int = 20) -> List[Dict]:
        """
        Search for similar assets using text query

        Args:
            query: Search query text
            limit: Number of results to return

        Returns:
            List of dicts with asset_id, score, and description
        """
        try:
            if not self.qdrant_client or not self.embedding_model:
                raise Exception("Vector search not available")

            # Generate embedding for query
            query_embedding = await self.generate_embedding(query)

            # Search in Qdrant using the new API (qdrant-client >= 1.8)
            response = self.qdrant_client.query_points(
                collection_name=self.collection_name,
                query=query_embedding,
                limit=limit
            )
            results = response.points

            # Format results
            formatted_results = []
            for point in results:
                # ScoredPoint has .score and .payload attributes
                formatted_results.append({
                    "asset_id": point.payload.get("asset_id"),
                    "score": float(point.score),
                    "description": point.payload.get("description", ""),
                    "workspace": point.payload.get("workspace", ""),
                    "name": point.payload.get("name", "")
                })

            logger.info(f"Search for '{query}' returned {len(formatted_results)} results")
            return formatted_results

        except Exception as e:
            logger.error(f"Search error: {e}")
            raise

    async def delete_asset(self, asset_id: str):
        """
        Delete an asset from the index

        Args:
            asset_id: Asset ID to delete
        """
        try:
            if not self.qdrant_client:
                raise Exception("Qdrant client not initialized")

            # Delete by filtering on asset_id
            self.qdrant_client.delete(
                collection_name=self.collection_name,
                points_selector=Filter(
                    must=[
                        FieldCondition(
                            key="asset_id",
                            match=MatchValue(value=asset_id)
                        )
                    ]
                )
            )

            logger.info(f"Deleted asset {asset_id} from index")

        except Exception as e:
            logger.error(f"Delete error: {e}")
            raise
