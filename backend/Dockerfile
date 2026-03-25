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

# entrypoint.sh: chạy migrate tự động trước khi start server
# chmod +x: cấp quyền "executable" cho script (Linux bắt buộc)
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# ENTRYPOINT: lệnh luôn chạy đầu tiên khi container start
# CMD: tham số mặc định truyền vào ENTRYPOINT (có thể override qua docker-compose)
ENTRYPOINT ["/entrypoint.sh"]
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
