FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies for NetCDF4, HDF5, and compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libnetcdf-dev \
    libhdf5-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install CPU-only PyTorch first to keep Docker image lightweight, then other packages
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt

# Copy repository source code and assets
COPY . .

# Expose web application ports
EXPOSE 8000 7860

# Start Uvicorn ASGI server with dynamic port support (uses Railway's $PORT if provided, else defaults to 8000)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
