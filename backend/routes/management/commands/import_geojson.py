"""
Management command: import toàn bộ dữ liệu từ file GeoJSON vào PostgreSQL/PostGIS.

Cách dùng:
    python manage.py import_geojson                          # dùng file mặc định
    python manage.py import_geojson /data/tay-ho-datas.geojson

Luồng xử lý:
    1. Đọc GeoJSON, tách ra 2 nhóm: routes (LineString/MultiLineString) và stops (Point).
    2. Lưu tất cả BusRoute vào DB, đánh chỉ mục theo osm_id.
    3. Lưu tất cả BusStop vào DB.
    4. Với mỗi stop, đọc trường @relations → tạo liên kết RouteStop.
"""

import json
from pathlib import Path

from django.contrib.gis.geos import MultiLineString, LineString, Point, GEOSGeometry
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction, connection

from routes.models import BusRoute, BusStop, RouteStop

DEFAULT_GEOJSON = '/geojson/tay-ho-datas.geojson'


class Command(BaseCommand):
    help = 'Import tuyến xe buýt và trạm dừng từ file GeoJSON (xuất từ Overpass/OSM)'

    def add_arguments(self, parser):
        parser.add_argument(
            'geojson_path', nargs='?', default=DEFAULT_GEOJSON,
            help=f'Đường dẫn file GeoJSON (mặc định: {DEFAULT_GEOJSON})',
        )
        parser.add_argument(
            '--clear', action='store_true',
            help='Xoá toàn bộ dữ liệu cũ trước khi import',
        )

    def handle(self, *args, **options):
        path = Path(options['geojson_path'])
        if not path.exists():
            raise CommandError(f'Không tìm thấy file: {path}')

        if options['clear']:
            self.stdout.write('Xoá dữ liệu cũ...')
            RouteStop.objects.all().delete()
            BusStop.objects.all().delete()
            BusRoute.objects.all().delete()

        with open(path, encoding='utf-8') as f:
            data = json.load(f)

        features = data['features']
        route_features = [f for f in features if f['properties'].get('type') == 'route']
        stop_features  = [f for f in features if f['geometry']['type'] == 'Point']

        self.stdout.write(f'Tìm thấy: {len(route_features)} tuyến, {len(stop_features)} trạm')

        with transaction.atomic():
            route_map = self._import_routes(route_features)
            self._import_stops(stop_features, route_map)
            self._compute_sequences()

        self.stdout.write(self.style.SUCCESS(
            f'Hoàn tất! '
            f'{BusRoute.objects.count()} tuyến, '
            f'{BusStop.objects.count()} trạm, '
            f'{RouteStop.objects.count()} liên kết tuyến-trạm.'
        ))

    # ------------------------------------------------------------------
    # Import routes
    # ------------------------------------------------------------------
    def _import_routes(self, features):
        """
        Tạo BusRoute từ các feature có geometry LineString hoặc MultiLineString.
        Trả về dict: {osm_numeric_id: BusRoute} để dùng khi liên kết stop.
        """
        route_map = {}   # {osm_id_str: BusRoute instance}
        created = skipped = 0

        for feat in features:
            props = feat['properties']
            geom  = feat['geometry']

            # Lấy osm_id dạng số (vd: "relation/12726060" → "12726060")
            raw_id = props.get('@id', '')
            osm_id = raw_id.split('/')[-1]

            # Chuyển geometry → MultiLineString (chuẩn hoá cả LineString lẫn MultiLineString)
            path = _to_multilinestring(geom)
            if path is None:
                skipped += 1
                continue

            route, is_new = BusRoute.objects.update_or_create(
                osm_id=osm_id,
                defaults={
                    'ref':          props.get('ref', ''),
                    'name':         props.get('name', ''),
                    'from_stop':    props.get('from', ''),
                    'to_stop':      props.get('to', ''),
                    'operator':     props.get('operator', ''),
                    'opening_hours': props.get('opening_hours', ''),
                    'charge':       props.get('charge', ''),
                    'interval':     props.get('interval', ''),
                    'path':         path,
                },
            )
            route_map[osm_id] = route
            if is_new:
                created += 1

        self.stdout.write(f'  Routes: {created} mới, {skipped} bỏ qua (geometry lỗi)')
        return route_map

    # ------------------------------------------------------------------
    # Import stops
    # ------------------------------------------------------------------
    def _import_stops(self, features, route_map):
        """
        Tạo BusStop và RouteStop từ các feature Point.
        Trường @relations trong mỗi stop chứa danh sách tuyến mà trạm thuộc về.
        """
        created = linked = 0

        for feat in features:
            props = feat['properties']
            coords = feat['geometry']['coordinates']   # [lng, lat]

            raw_id = props.get('@id', '')
            osm_id = raw_id.split('/')[-1]

            stop, is_new = BusStop.objects.update_or_create(
                osm_id=osm_id,
                defaults={
                    'name':     props.get('name', ''),
                    'location': Point(coords[0], coords[1], srid=4326),
                },
            )
            if is_new:
                created += 1

            # Liên kết stop với các tuyến qua @relations
            relations = props.get('@relations', [])
            for rel in relations:
                rel_id = str(rel.get('rel', ''))
                route  = route_map.get(rel_id)
                if not route:
                    continue

                RouteStop.objects.get_or_create(
                    route=route,
                    stop=stop,
                )
                linked += 1

        self.stdout.write(f'  Stops: {created} mới, {linked} liên kết tuyến-trạm')

    # ------------------------------------------------------------------
    # Tính sequence
    # ------------------------------------------------------------------
    def _compute_sequences(self):
        """
        Cập nhật RouteStop.sequence dựa trên vị trí của trạm dọc theo tuyến.

        Dùng ST_LineLocatePoint(route.path, stop.location) → trả về số từ 0.0 đến 1.0
        biểu thị trạm đó nằm ở bao nhiêu % dọc tuyến.

        ROW_NUMBER() OVER (PARTITION BY route_id ORDER BY fraction) → thứ tự trạm.

        Ví dụ tuyến 09A:
            Trạm "Bờ Hồ"        → fraction 0.02 → sequence 1
            Trạm "Võ Chí Công"  → fraction 0.45 → sequence 2
            Trạm "Đại học Mỏ"   → fraction 0.98 → sequence 3
        """
        with connection.cursor() as cursor:
            cursor.execute("""
                UPDATE routes_routestop rs
                SET sequence = sub.seq
                FROM (
                    SELECT
                        rs2.id,
                        ROW_NUMBER() OVER (
                            PARTITION BY rs2.route_id
                            ORDER BY ST_LineLocatePoint(
                                ST_LineMerge(r.path),
                                s.location
                            )
                        ) AS seq
                    FROM routes_routestop rs2
                    JOIN routes_busroute r ON r.id = rs2.route_id
                    JOIN routes_busstop  s ON s.id = rs2.stop_id
                    WHERE ST_GeometryType(ST_LineMerge(r.path)) = 'ST_LineString'
                ) sub
                WHERE rs.id = sub.id
            """)
        self.stdout.write(f'  Sequence: đã tính cho {RouteStop.objects.count()} liên kết tuyến-trạm')


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
def _to_multilinestring(geom):
    """
    Chuyển GeoJSON geometry dict → Django MultiLineString.
    Chấp nhận cả LineString và MultiLineString từ OSM.
    Trả về None nếu geometry không hợp lệ.
    """
    try:
        geos = GEOSGeometry(json.dumps(geom), srid=4326)
        if isinstance(geos, LineString):
            return MultiLineString(geos, srid=4326)
        if isinstance(geos, MultiLineString):
            return geos
    except Exception:
        pass
    return None
