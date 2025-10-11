import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""

    # Environment
    ENV: str = os.getenv("ENV", "production")

    # API
    PROJECT_NAME: str = "CountIn API"
    VERSION: str = "1.0.0"
    DESCRIPTION: str = "Backend API for CountIn people counting application"
    API_V1_STR: str = "/api/v1"

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://countin:countin@localhost:5432/countin"
    )

    # CORS
    BACKEND_CORS_ORIGINS: str = os.getenv(
        "BACKEND_CORS_ORIGINS",
        "https://countin.ignacio.tech,https://*.countin.ignacio.tech"
    )

    def get_cors_origins(self) -> list[str]:
        """Get CORS origins based on environment"""
        origins = [origin.strip() for origin in self.BACKEND_CORS_ORIGINS.split(",")]

        # Add localhost in development
        if self.ENV == "development":
            origins.extend([
                "http://localhost",
                "http://localhost:3000",
                "http://localhost:5173",
                "http://localhost:8080"
            ])

        return origins

    class Config:
        case_sensitive = True
        env_file = ".env"


settings = Settings()
