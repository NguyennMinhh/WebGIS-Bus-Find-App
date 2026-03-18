# DD-03 — Thiết Kế Backend

> **Loại tài liệu:** Design Document
> **Phiên bản:** 1.0
> **Cập nhật lần cuối:** 2026-03-18
> **Trạng thái:** Draft

---

## 1. Cấu Trúc Thư Mục Backend

```
backend/
├── backend/                          # Django project configuration
│   ├── settings.py                   # Cấu hình toàn bộ ứng dụng
│   ├── urls.py                       # URL routing gốc
│   └── wsgi.py                       # WSGI entry point (production)
│
├── routes/                           # Django app "routes"
│   ├── models.py                     # BusRoute, BusStop, RouteStop
│   ├── admin.py                      # GIS Admin interface
│   ├── serializers.py               # DRF Serializers (placeholder)
│   ├── views.py                      # API Views (placeholder)
│   ├── urls.py                       # API URL patterns (placeholder)
│   ├── apps.py                       # App configuration
│   ├── fixtures/
│   │   └── sample_route_09a.json    # Sample test data
│   └── management/
│       └── commands/
│           └── import_geojson.py    # Data import pipeline
│
├── manage.py                         # Django CLI
├── requirements.txt                  # Python dependencies
└── Dockerfile                        # Container build instructions
```

---

## 2. Django Settings — Cấu Hình Quan Trọng

### 2.1 Installed Apps (thứ tự quan trọng)
```python
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.gis',        # GeoDjango — phải có trước app custom
    'rest_framework',             # Django REST Framework
    'corsheaders',                # CORS middleware
    'routes',                     # App chứa models BusRoute/BusStop
]
```

### 2.2 Middleware (thứ tự quan trọng)
```python
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',   # CORS: PHẢI đặt trước CommonMiddleware
    'django.middleware.common.CommonMiddleware',
    ...
]
```

### 2.3 Database (GeoDjango requires PostGIS backend)
```python
DATABASES = {
    'default': {
        'ENGINE': 'django.contrib.gis.db.backends.postgis',  # Không phải 'django.db.backends.postgresql'
        'NAME': env('POSTGRES_DB', default='busrouting'),
        'USER': env('POSTGRES_USER', default='postgres'),
        'PASSWORD': env('POSTGRES_PASSWORD', default='postgres'),
        'HOST': env('POSTGRES_HOST', default='db'),
        'PORT': env('POSTGRES_PORT', default='5432'),
    }
}
```

### 2.4 Locale
```python
LANGUAGE_CODE = 'vi'               # Tiếng Việt cho Admin interface
TIME_ZONE = 'Asia/Ho_Chi_Minh'     # Múi giờ Việt Nam (UTC+7)
```

---

## 3. Data Models

### 3.1 `BusRoute`

**File:** [backend/routes/models.py](../../backend/routes/models.py)

```python
class BusRoute(models.Model):
    osm_id       = models.CharField(max_length=30, unique=True, db_index=True)
    ref          = models.CharField(max_length=20, db_index=True)
    name         = models.CharField(max_length=300)
    from_stop    = models.CharField(max_length=200)
    to_stop      = models.CharField(max_length=200)
    operator     = models.CharField(max_length=200, blank=True)
    opening_hours = models.CharField(max_length=100, blank=True)
    charge       = models.CharField(max_length=50, blank=True)
    interval     = models.CharField(max_length=50, blank=True)
    path         = models.MultiLineStringField(srid=4326)  # Spatial field!

    class Meta:
        ordering = ['ref']

    def __str__(self):
        return f"{self.ref} – {self.name}"
```

**Điểm quan trọng:**
- `MultiLineStringField` là field đặc biệt của GeoDjango
- `srid=4326` = WGS84 coordinate system (lat/lng)
- Một tuyến có thể có nhiều đoạn (MultiLineString) do OSM chia đường ra nhiều "ways"

---

### 3.2 `BusStop`

```python
class BusStop(models.Model):
    osm_id   = models.CharField(max_length=30, unique=True, db_index=True)
    name     = models.CharField(max_length=200, blank=True)
    location = models.PointField(srid=4326)  # Spatial field!
    routes   = models.ManyToManyField(BusRoute, through='RouteStop', related_name='stops')

    def __str__(self):
        return self.name or f"Stop {self.osm_id}"
```

---

### 3.3 `RouteStop`

```python
class RouteStop(models.Model):
    route    = models.ForeignKey(BusRoute, on_delete=models.CASCADE, related_name='route_stops')
    stop     = models.ForeignKey(BusStop, on_delete=models.CASCADE, related_name='stop_routes')
    sequence = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['route', 'sequence']
        constraints = [
            models.UniqueConstraint(fields=['route', 'stop'], name='unique_route_stop')
        ]
```

---

## 4. Data Import Pipeline

**File:** [backend/routes/management/commands/import_geojson.py](../../backend/routes/management/commands/import_geojson.py)

### 4.1 Điểm vào (Entry Point)

```python
class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument('filepath', nargs='?', default='/geojson/tay-ho-datas.geojson')
        parser.add_argument('--clear', action='store_true')

    def handle(self, *args, **options):
        if options['clear']:
            BusRoute.objects.all().delete()

        data = json.load(open(filepath))
        features = data['features']

        route_features = [f for f in features if f['properties'].get('type') == 'route']
        stop_features  = [f for f in features if f['geometry']['type'] == 'Point']

        route_map = self._import_routes(route_features)
        self._import_stops(stop_features, route_map)
        self._compute_sequences()
```

### 4.2 `_import_routes(features)` — Import tuyến xe buýt

**Luồng xử lý từng feature:**

```
Feature (type=route)
  ↓
1. Lấy @id: "relation/12726060" → tách "12726060"
2. Extract properties: ref, name, from, to, operator, etc.
3. Convert geometry:
   - LineString → MultiLineString (wrap trong list)
   - MultiLineString → dùng nguyên
   - Khác → bỏ qua (skip)
4. BusRoute.objects.update_or_create(osm_id=osm_id, defaults={...})
5. Lưu vào route_map[osm_id_str] = route_obj
```

**Hàm `_to_multilinestring(geom)`:**
```python
def _to_multilinestring(self, geom):
    gtype = geom['type']
    coords = geom['coordinates']

    if gtype == 'LineString':
        return GEOSGeometry(json.dumps({
            'type': 'MultiLineString',
            'coordinates': [coords]  # Wrap trong list
        }), srid=4326)

    elif gtype == 'MultiLineString':
        return GEOSGeometry(json.dumps(geom), srid=4326)

    else:
        return None  # Skip invalid
```

### 4.3 `_import_stops(features, route_map)` — Import điểm dừng

**Luồng xử lý từng feature:**

```
Feature (geometry.type = "Point")
  ↓
1. Lấy @id: "node/8741294713" → tách "8741294713"
2. Extract: name từ properties
3. Extract coordinates: [longitude, latitude] từ geometry
4. BusStop.objects.update_or_create(
       osm_id=osm_id,
       defaults={'name': name, 'location': Point(lng, lat, srid=4326)}
   )
5. Xử lý @relations:
   properties['@relations'] = [{'rel': '12726060', ...}, ...]
   → Với mỗi relation:
       osm_id_str = str(rel['rel'])
       route = route_map.get(osm_id_str)
       if route: RouteStop.objects.get_or_create(route=route, stop=stop)
```

**Lưu ý về tọa độ:**
- GeoJSON coordinate format: `[longitude, latitude]` (X, Y)
- `Point(lng, lat, srid=4326)` — thứ tự: kinh độ trước, vĩ độ sau
- Ví dụ Hà Nội: `Point(105.8046867, 21.055715, srid=4326)`

### 4.4 `_compute_sequences()` — Tính thứ tự điểm dừng

**Nguyên lý:** Dùng PostGIS để xác định điểm dừng nào gần đầu tuyến, điểm nào gần cuối.

```python
def _compute_sequences(self):
    from django.db import connection
    with connection.cursor() as cursor:
        cursor.execute("""
            UPDATE routes_routestop rs
            SET sequence = sub.seq
            FROM (
                SELECT
                    rs2.id,
                    ROW_NUMBER() OVER (
                        PARTITION BY rs2.route_id
                        ORDER BY ST_LineLocatePoint(ST_LineMerge(r.path), s.location)
                    ) AS seq
                FROM routes_routestop rs2
                JOIN routes_busroute r ON r.id = rs2.route_id
                JOIN routes_busstop s ON s.id = rs2.stop_id
                WHERE ST_GeometryType(ST_LineMerge(r.path)) = 'ST_LineString'
            ) sub
            WHERE rs.id = sub.id
        """)
```

**Giải thích từng bước SQL:**
1. `ST_LineMerge(r.path)` — merge các đoạn MultiLineString thành 1 LineString
2. `WHERE ST_GeometryType(...) = 'ST_LineString'` — chỉ tính cho tuyến có thể merge được
3. `ST_LineLocatePoint(linestring, point)` — tính vị trí điểm dừng trên tuyến (0.0-1.0)
4. `ROW_NUMBER() OVER (PARTITION BY route_id ORDER BY fraction)` — gán số thứ tự
5. `UPDATE ... SET sequence = seq` — cập nhật bảng

**Hạn chế đã biết:**
- Tuyến có geometry không liên tục → `ST_LineMerge` trả về MultiLineString → `sequence` giữ nguyên = 0
- Đây là "known bug" sẽ fix ở phiên bản sau

---

## 5. Django Admin

**File:** [backend/routes/admin.py](../../backend/routes/admin.py)

```python
from django.contrib.gis import admin

@admin.register(BusRoute)
class BusRouteAdmin(admin.GISModelAdmin):
    list_display  = ('ref', 'name', 'from_stop', 'to_stop', 'operator')
    search_fields = ('ref', 'name', 'from_stop', 'to_stop')
    list_filter   = ('operator',)

@admin.register(BusStop)
class BusStopAdmin(admin.GISModelAdmin):
    list_display  = ('name', 'osm_id')
    search_fields = ('name',)

@admin.register(RouteStop)
class RouteStopAdmin(admin.ModelAdmin):
    list_display = ('route', 'stop', 'sequence')
    list_filter  = ('route',)
```

**`GISModelAdmin` vs `ModelAdmin`:**
- `GISModelAdmin` kế thừa từ `ModelAdmin`
- Thêm widget bản đồ tương tác cho spatial fields (geometry, location)
- Admin có thể xem và sửa geometry trực tiếp trên bản đồ

---

## 6. API Design (Kế Hoạch Triển Khai)

### 6.1 URL Structure

**File:** [backend/backend/urls.py](../../backend/backend/urls.py) + [backend/routes/urls.py](../../backend/routes/urls.py)

```python
# backend/urls.py
urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('routes.urls')),
]

# routes/urls.py (kế hoạch)
router = DefaultRouter()
router.register(r'routes', BusRouteViewSet)
router.register(r'stops', BusStopViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('find-route/', FindRouteView.as_view()),
]
```

### 6.2 Serializers (kế hoạch)

```python
# Serializer cho BusStop nhẹ (dùng trong route detail)
class BusStopMinimalSerializer(serializers.ModelSerializer):
    lat = serializers.SerializerMethodField()
    lng = serializers.SerializerMethodField()
    sequence = serializers.IntegerField(source='stop_routes.first().sequence')

    def get_lat(self, obj): return obj.location.y
    def get_lng(self, obj): return obj.location.x

    class Meta:
        model = BusStop
        fields = ['id', 'name', 'lat', 'lng']


# Serializer cho BusRoute đầy đủ
class BusRouteDetailSerializer(serializers.ModelSerializer):
    geometry = serializers.SerializerMethodField()
    stops = serializers.SerializerMethodField()

    def get_geometry(self, obj):
        return json.loads(obj.path.geojson)

    def get_stops(self, obj):
        route_stops = obj.route_stops.select_related('stop').order_by('sequence')
        return [{'id': rs.stop.id, 'name': rs.stop.name,
                 'lat': rs.stop.location.y, 'lng': rs.stop.location.x,
                 'sequence': rs.sequence}
                for rs in route_stops]

    class Meta:
        model = BusRoute
        fields = ['id', 'ref', 'name', 'from_stop', 'to_stop',
                  'operator', 'opening_hours', 'charge', 'interval',
                  'geometry', 'stops']
```

### 6.3 ViewSets (kế hoạch)

```python
class BusRouteViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = BusRoute.objects.all()

    def get_serializer_class(self):
        if self.action == 'list':
            return BusRouteListSerializer
        return BusRouteDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        ref = self.request.query_params.get('ref')
        if ref:
            qs = qs.filter(ref__icontains=ref)
        return qs
```

---

## 7. Requirements

**File:** [backend/requirements.txt](../../backend/requirements.txt)

```
Django==5.2
djangorestframework==3.16.0
django-cors-headers==4.6.0
django-environ==0.12.0
psycopg2-binary==2.9.10
GDAL==3.10.0          # Geospatial library cho GeoDjango
```

**GDAL là gì?**
- Geospatial Data Abstraction Library
- Bắt buộc cho GeoDjango
- Cần cài system library trước khi cài Python package
- Dockerfile xử lý: `apt-get install gdal-bin libgdal-dev`
