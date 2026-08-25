import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.api import api_router
from app.core.config import settings
from app.models import (  # noqa: F401 (imports register all models for Alembic)
    CameraStation,
    CountingLine,
    CountSnapshot,
    CrossingEvent,
    HubSession,
    Session,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=settings.DESCRIPTION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    redirect_slashes=False,  # Disable automatic slash redirects that break CORS
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_origin_regex=r"https://([a-zA-Z0-9-]+\.)?countin\.ignacio\.tech"
)

# Include API routes
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    """Root endpoint"""
    return {
        "message": "CountIn API",
        "version": settings.VERSION,
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.get(f"{settings.API_V1_STR}/health")
def health_check_v1():
    """Health check endpoint for API v1"""
    return {"status": "healthy", "version": settings.VERSION}


@app.on_event("startup")
async def startup_event():
    """Log configuration on startup"""
    logger.info(f"Starting {settings.PROJECT_NAME} v{settings.VERSION}")
    logger.info(f"Environment: {settings.ENV}")
    logger.info(f"Database URL: {settings.DATABASE_URL.split('@')[-1]}")  # Log without credentials
    logger.info(f"CORS Origins: {settings.get_cors_origins()}")
    logger.info("API is ready to accept requests")
