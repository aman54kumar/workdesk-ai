import httpx


def provider_error_message(exc: Exception, *, fallback: str = "generation failed") -> str:
    """Extract a safe user-facing message from a provider HTTP error."""
    if isinstance(exc, httpx.HTTPStatusError):
        try:
            body = exc.response.json()
        except Exception:
            return f"Provider request failed (HTTP {exc.response.status_code})."

        if isinstance(body, dict):
            err = body.get("error")
            if isinstance(err, dict):
                msg = err.get("message")
                if msg:
                    return str(msg)
            if isinstance(err, str) and err:
                return err

            msg = body.get("message")
            if msg:
                return str(msg)

            detail = body.get("detail")
            if detail:
                return str(detail)

        return f"Provider request failed (HTTP {exc.response.status_code})."

    return fallback
