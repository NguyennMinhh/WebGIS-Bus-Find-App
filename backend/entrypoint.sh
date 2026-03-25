#!/bin/bash
# entrypoint.sh — Chạy trước khi start Django server
# Mục đích: tự động migrate database khi container khởi động lần đầu
# hoặc khi có migration mới, không cần chạy tay.
#
# Cách hoạt động:
#   ENTRYPOINT ["/entrypoint.sh"]   ← script này chạy trước
#   CMD ["python", "manage.py", ...]  ← CMD được truyền vào "$@" bên dưới
#
# Lệnh "set -e" nghĩa là: nếu bất kỳ lệnh nào lỗi thì dừng ngay,
# không tiếp tục chạy → tránh server start khi migrate thất bại.
set -e

echo "==> Running database migrations..."
python manage.py migrate --no-input

echo "==> Migrations done. Starting server..."
# exec "$@" thay thế process này bằng CMD (python manage.py runserver ...)
# Quan trọng: dùng exec để signal (Ctrl+C, docker stop) được forward đúng
exec "$@"
