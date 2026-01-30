# Auth Service Dockerfile
# Django REST Framework microservice for authentication

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt requirements-dev.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir -r requirements-dev.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 authuser && \
    chown -R authuser:authuser /app

# Switch to non-root user
USER authuser

# Expose port
EXPOSE 3001

# Start Django development server
CMD ["python", "manage.py", "runserver", "0.0.0.0:3001"]
