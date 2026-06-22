"""Thin Supabase REST client. Uses the service-role key — never expose to clients."""

from __future__ import annotations

from typing import Any
import httpx

from .config import Settings


class SupabaseError(RuntimeError):
    """HTTP-level Supabase REST failure."""


class Client:
    """Minimal wrapper around the Supabase REST and RPC surface.

    All requests authenticate with the service-role key — schema RLS is
    bypassed, so callers are responsible for filtering correctly.
    """

    def __init__(self, settings: Settings | None = None, timeout: float = 30.0) -> None:
        self._settings = settings or Settings.from_env()
        self._http = httpx.Client(
            base_url=self._settings.supabase_url,
            timeout=timeout,
            headers={
                "apikey": self._settings.supabase_service_role_key,
                "Authorization": f"Bearer {self._settings.supabase_service_role_key}",
                "Content-Type": "application/json",
            },
        )

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> "Client":
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    def select(self, table: str, query: str = "") -> list[dict[str, Any]]:
        """GET /rest/v1/{table}?{query}. Returns the raw JSON list."""
        path = f"/rest/v1/{table}"
        if query:
            path = f"{path}?{query}"
        return self._send("GET", path)

    def insert(
        self, table: str, rows: list[dict[str, Any]], *, return_representation: bool = True
    ) -> list[dict[str, Any]]:
        headers = {"Prefer": "return=representation" if return_representation else "return=minimal"}
        return self._send("POST", f"/rest/v1/{table}", json=rows, extra_headers=headers)

    def rpc(self, name: str, payload: dict[str, Any] | None = None) -> Any:
        return self._send("POST", f"/rest/v1/rpc/{name}", json=payload or {})

    def _send(
        self,
        method: str,
        path: str,
        *,
        json: Any = None,
        extra_headers: dict[str, str] | None = None,
    ) -> Any:
        headers = {**(extra_headers or {})}
        response = self._http.request(method, path, json=json, headers=headers)
        if response.status_code >= 400:
            raise SupabaseError(
                f"{method} {path} → {response.status_code}: {response.text[:500]}"
            )
        if not response.content:
            return None
        try:
            return response.json()
        except ValueError:
            return response.text
