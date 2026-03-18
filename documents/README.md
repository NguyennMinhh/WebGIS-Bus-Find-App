# Tài Liệu Dự Án WebGIS-BusRouting

Thư mục này chứa toàn bộ tài liệu kỹ thuật của dự án. Được tổ chức thành 2 loại:

## FD — Functional Documents (Tài liệu chức năng)

Mô tả **WHAT** — hệ thống làm gì, nghiệp vụ là gì.

| File | Nội dung |
|------|---------|
| [FD-01 — Tổng Quan Dự Án](./FD/FD-01_Tong_Quan_Du_An.md) | Mục tiêu, phạm vi, đối tượng người dùng, dữ liệu nguồn |
| [FD-02 — Chức Năng Hệ Thống](./FD/FD-02_Chuc_Nang_He_Thong.md) | Danh sách tính năng, mô tả chi tiết, trạng thái |
| [FD-03 — Quy Trình Nghiệp Vụ](./FD/FD-03_Quy_Trinh_Nghiep_Vu.md) | Import dữ liệu, cài đặt môi trường, xử lý sự cố |

## DD — Design Documents (Tài liệu thiết kế kỹ thuật)

Mô tả **HOW** — hệ thống hoạt động như thế nào, được xây dựng ra sao.

| File | Nội dung |
|------|---------|
| [DD-01 — Kiến Trúc Tổng Thể](./DD/DD-01_Kien_Truc_Tong_The.md) | Stack công nghệ, sơ đồ kiến trúc, luồng dữ liệu |
| [DD-02 — Database Design](./DD/DD-02_Database_Design.md) | Schema, ERD, PostGIS queries quan trọng |
| [DD-03 — Backend Design](./DD/DD-03_Backend_Design.md) | Django models, import pipeline, API design |
| [DD-04 — Frontend Design](./DD/DD-04_Frontend_Design.md) | React components, OpenLayers, hooks |
| [DD-05 — GIS & Spatial Design](./DD/DD-05_GIS_Spatial_Design.md) | PostGIS functions, coordinate systems, GeoServer |
| [DD-06 — Infrastructure](./DD/DD-06_Infrastructure_Deployment.md) | Docker Compose, services, deployment |
| [DD-07 — Developer Guide](./DD/DD-07_Developer_Guide.md) | ⭐ **Đọc cái này trước** nếu bạn mới join |

## Thứ tự đọc cho người mới

```
FD-01 → FD-02 → DD-01 → DD-07 (setup) → DD-02 → DD-03 → DD-04 → DD-05
```
