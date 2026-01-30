import logging
import sys
import json

def setup_logging(log_level: str = "info"):
    """Configure structured JSON logging.

    Args:
        log_level: Logging level (debug, info, warning, error)
    """
    level = getattr(logging, log_level.upper())

    # Custom formatter for structured logging
    class JSONFormatter(logging.Formatter):
        def format(self, record):
            log_data = {
                "timestamp": self.formatTime(record, self.datefmt),
                "level": record.levelname,
                "service": "ai-service",
                "message": record.getMessage(),
                "module": record.name
            }
            if record.exc_info:
                log_data["exception"] = self.formatException(record.exc_info)
            return json.dumps(log_data)

    # Configure handler
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    root_logger.addHandler(handler)

    # Set third-party loggers to WARNING
    logging.getLogger("uvicorn").setLevel(logging.WARNING)
    logging.getLogger("fastapi").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
