FROM python:3.12-slim

# GDAL và các thư viện địa lý cần cho GeoDjango
RUN apt-get update && apt-get install -y \
    binutils \
    libproj-dev \
    gdal-bin \
    libgdal-dev \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

# Cài GDAL Python binding khớp với version hệ thống
RUN pip install --no-cache-dir \
    "GDAL==$(gdal-config --version)" \
    -r requirements.txt

COPY . .
