"""Resolve the client IP from an incoming HTTP request."""

from fastapi import Request


def get_client_ip(request: Request) -> str | None:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        ip = forwarded_for.split(",")[0].strip()
        if ip:
            return ip[:64]
    if request.client and request.client.host:
        return request.client.host[:64]
    return None
