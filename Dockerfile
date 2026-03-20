FROM python:3.12-slim

WORKDIR /app

# Copy dependencies first for better layer caching
COPY backend/requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy all project files
COPY . .

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Optional: Add an entrypoint if needed, otherwise CMD handles it
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT}"]
