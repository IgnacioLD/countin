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
        """Get explicit CORS origins based on environment.

        Wildcard entries (e.g. https://*.countin.ignacio.tech) are handled by the
        allow_origin_regex in main.py, so they're dropped here. Empty/malformed
        entries are filtered and the result is de-duplicated. The known frontend
        origins are always included as a safety net against env misconfiguration.
        """
        raw = [o.strip() for o in self.BACKEND_CORS_ORIGINS.split(",")]
        origins = []
        for origin in raw:
            if not origin or "*" in origin:
                continue
            origins.append(origin)

        # Always ensure the production frontend origins are allowed, even if the
        # env var is empty or only contains wildcards.
        origins.extend([
            "https://countin.ignacio.tech",
            "https://preview.countin.ignacio.tech",
        ])

        # Add localhost in development
        if self.ENV == "development":
            origins.extend([
                "http://localhost",
                "http://localhost:3000",
                "http://localhost:5173",
                "http://localhost:8080",
                "http://127.0.0.1:3000",
            ])

        # De-duplicate while preserving order
        seen = set()
        return [o for o in origins if not (o in seen or seen.add(o))]

    class Config:
        case_sensitive = True
        env_file = ".env"


settings = Settings()
