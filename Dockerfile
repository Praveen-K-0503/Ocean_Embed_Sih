FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=7860

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

# Expose web application ports (7860 for Hugging Face Spaces, 8000 for Render / local)
EXPOSE 7860 8000

# Start Uvicorn ASGI server with dynamic port support (Hugging Face passes 7860, Render passes custom $PORT)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
