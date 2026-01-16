from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import os
from dotenv import load_dotenv

from services.content_moderation import ContentModerationService
from services.image_description import ImageDescriptionService
from services.vector_search import VectorSearchService

load_dotenv()

app = FastAPI(title="Image Analysis Service", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
content_moderator = ContentModerationService()
image_descriptor = ImageDescriptionService()
vector_search = VectorSearchService()


class AnalysisResponse(BaseModel):
    is_safe: bool
    description: Optional[str]
    embedding: Optional[List[float]]
    moderation_details: dict


class SearchRequest(BaseModel):
    query: str
    limit: int = 20


class SearchResult(BaseModel):
    asset_id: str
    score: float
    description: str


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "services": {
            "content_moderation": "ready",
            "image_description": "ready" if image_descriptor.is_available() else "unavailable",
            "vector_search": "ready" if vector_search.is_available() else "unavailable"
        }
    }


@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze_image(file: UploadFile = File(...)):
    """
    Analyze image for content moderation and generate description + embeddings
    """
    try:
        # Read image file
        image_bytes = await file.read()

        # Step 1: Content Moderation (REQUIRED)
        moderation_result = await content_moderator.check_image(image_bytes)

        if not moderation_result["is_safe"]:
            return AnalysisResponse(
                is_safe=False,
                description=None,
                embedding=None,
                moderation_details=moderation_result
            )

        # Step 2: Generate description (if safe)
        description = None
        embedding = None

        if image_descriptor.is_available():
            description = await image_descriptor.generate_description(image_bytes)

            # Step 3: Generate embeddings
            if vector_search.is_available() and description:
                embedding = await vector_search.generate_embedding(description)

        return AnalysisResponse(
            is_safe=True,
            description=description,
            embedding=embedding,
            moderation_details=moderation_result
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/moderate")
async def moderate_image(file: UploadFile = File(...)):
    """
    Check if image is safe (content moderation only)
    """
    try:
        image_bytes = await file.read()
        result = await content_moderator.check_image(image_bytes)

        return {
            "is_safe": result["is_safe"],
            "message": result["message"],
            "details": result
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/describe")
async def describe_image(file: UploadFile = File(...)):
    """
    Generate description for an image
    """
    try:
        if not image_descriptor.is_available():
            raise HTTPException(status_code=503, detail="Image description service unavailable")

        image_bytes = await file.read()
        description = await image_descriptor.generate_description(image_bytes)

        return {"description": description}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/search", response_model=List[SearchResult])
async def search_similar(request: SearchRequest):
    """
    Search for similar images using text query
    """
    try:
        if not vector_search.is_available():
            raise HTTPException(status_code=503, detail="Vector search service unavailable")

        results = await vector_search.search(request.query, request.limit)

        return [
            SearchResult(
                asset_id=r["asset_id"],
                score=r["score"],
                description=r["description"]
            )
            for r in results
        ]

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class IndexAssetRequest(BaseModel):
    asset_id: str
    description: str
    workspace: str
    name: str


@app.post("/api/index")
async def index_asset(request: IndexAssetRequest):
    """
    Index an asset in the vector database
    """
    try:
        if not vector_search.is_available():
            raise HTTPException(status_code=503, detail="Vector search service unavailable")

        embedding = await vector_search.generate_embedding(request.description)
        await vector_search.index_asset(
            asset_id=request.asset_id,
            description=request.description,
            embedding=embedding,
            metadata={
                "workspace": request.workspace,
                "name": request.name
            }
        )

        return {"success": True, "asset_id": request.asset_id}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
