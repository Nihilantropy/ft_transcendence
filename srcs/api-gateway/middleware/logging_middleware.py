from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import time
import json
import logging
from datetime import datetime, timezone

class JsonFormatter(logging.Formatter):
    """Emit one flat, valid JSON object per line.

    The previous format string interpolated %(message)s unquoted, so a
    json.dumps() payload was nested under a "message" key. Logstash's json
    filter lifts that object to the event root, where Elasticsearch's index
    template maps `message` as `text` — the mapping conflict made it reject
    every request log, and Logstash dropped it. Flattening the payload keeps
    `message` a string (only for plain records) and the request fields at the
    top level, which is what the template already expects.
    """

    def format(self, record: logging.LogRecord) -> str:
        if isinstance(record.msg, dict):
            payload = dict(record.msg)
        else:
            payload = {"message": record.getMessage()}
        payload.setdefault("level", record.levelname)
        payload.setdefault("logger", record.name)
        payload.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
        if record.exc_info:
            payload["error"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


_handler = logging.StreamHandler()
_handler.setFormatter(JsonFormatter())
logging.basicConfig(level=logging.INFO, handlers=[_handler], force=True)
logger = logging.getLogger("api-gateway")

class LoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log all requests with structured data.
    Includes request details, user context, duration, and status code.
    """

    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        # Record start time
        start_time = time.time()

        # Get request details
        method = request.method
        path = request.url.path
        client_ip = request.client.host if request.client else "unknown"

        # Get request ID and user context if available
        request_id = getattr(request.state, "request_id", "no-request-id")
        user_id = getattr(request.state, "user_id", "anonymous")

        # Process request
        response = await call_next(request)

        # Calculate duration
        duration_ms = (time.time() - start_time) * 1000

        # Log request
        log_data = {
            "request_id": request_id,
            "method": method,
            "path": path,
            "status_code": response.status_code,
            "duration_ms": round(duration_ms, 2),
            "client_ip": client_ip,
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        # Passed as a dict, not a pre-serialised string: JsonFormatter merges it
        # into the top level of the emitted object.
        logger.info(log_data)

        # Add request ID to response headers
        response.headers["X-Request-ID"] = request_id

        return response
