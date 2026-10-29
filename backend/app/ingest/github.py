from __future__ import annotations

import io
import zipfile
from pathlib import Path
from typing import Any

import httpx

from ..config import settings


class GitHub:
    def __init__(self) -> None:
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "whycoded-prototype",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if settings.github_token:
            headers["Authorization"] = f"Bearer {settings.github_token}"
        self.client = httpx.Client(headers=headers, timeout=30.0, follow_redirects=True)

    def close(self) -> None:
        self.client.close()

    def _get(self, path: str, **params: Any) -> Any:
        response = self.client.get(f"{settings.github_api}{path}", params=params)
        response.raise_for_status()
        return response.json()

    def repo(self, owner: str, name: str) -> dict[str, Any]:
        return self._get(f"/repos/{owner}/{name}")

    def latest_sha(self, owner: str, name: str, branch: str | None = None) -> dict[str, Any]:
        return self._get(f"/repos/{owner}/{name}/commits", sha=branch or "", per_page=1)[0]

    def commits(self, owner: str, name: str, ref: str, limit: int) -> list[dict[str, Any]]:
        return self._get(f"/repos/{owner}/{name}/commits", sha=ref, per_page=min(limit, 100))

    def pulls(self, owner: str, name: str, limit: int) -> list[dict[str, Any]]:
        return self._get(
            f"/repos/{owner}/{name}/pulls",
            state="closed",
            sort="updated",
            direction="desc",
            per_page=min(limit, 100),
        )

    def pull(self, owner: str, name: str, number: int) -> dict[str, Any]:
        return self._get(f"/repos/{owner}/{name}/pulls/{number}")

    def pull_files(self, owner: str, name: str, number: int) -> list[dict[str, Any]]:
        return self._get(f"/repos/{owner}/{name}/pulls/{number}/files", per_page=50)

    def issues(self, owner: str, name: str, limit: int) -> list[dict[str, Any]]:
        return self._get(
            f"/repos/{owner}/{name}/issues",
            state="open",
            sort="updated",
            direction="desc",
            per_page=min(limit, 100),
        )

    def download_zipball(self, owner: str, name: str, ref: str, dest: Path) -> Path:
        if dest.exists() and any(dest.iterdir()):
            return dest
        dest.mkdir(parents=True, exist_ok=True)
        url = f"https://codeload.github.com/{owner}/{name}/zip/{ref}"
        with self.client.stream("GET", url, timeout=120.0) as response:
            response.raise_for_status()
            payload = b"".join(response.iter_bytes())
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            root = dest.resolve()
            for member in archive.infolist():
                target = (dest / member.filename).resolve()
                if not str(target).startswith(str(root)):
                    continue
                archive.extract(member, dest)
        children = [p for p in dest.iterdir() if p.is_dir()]
        return children[0] if len(children) == 1 else dest
