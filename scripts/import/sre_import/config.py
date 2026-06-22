"""Environment-backed settings. Fail fast if required values are missing."""

from __future__ import annotations

import os
from pydantic import BaseModel, Field, ValidationError


class Settings(BaseModel):
    supabase_url: str = Field(min_length=1)
    supabase_service_role_key: str = Field(min_length=1)

    @classmethod
    def from_env(cls) -> "Settings":
        try:
            return cls(
                supabase_url=os.environ["SUPABASE_URL"].rstrip("/"),
                supabase_service_role_key=os.environ["SUPABASE_SERVICE_ROLE_KEY"],
            )
        except KeyError as missing:
            raise RuntimeError(
                f"Missing required env var: {missing.args[0]}. "
                "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running."
            ) from missing
        except ValidationError as e:
            raise RuntimeError(f"Invalid settings: {e}") from e
