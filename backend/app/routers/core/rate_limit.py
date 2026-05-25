import time
from collections import defaultdict

from fastapi import HTTPException, Request, status

_log: dict[str, list[float]] = defaultdict(list)


def check_login_rate(request: Request, limit: int = 5, window: int = 60) -> None:
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    _log[ip] = [t for t in _log[ip] if now - t < window]
    if len(_log[ip]) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Trop de tentatives. Réessayez dans {window} secondes.",
        )
    _log[ip].append(now)
