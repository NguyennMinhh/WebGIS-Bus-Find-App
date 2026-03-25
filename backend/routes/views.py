# backend/routes/views.py

from django.db import connection
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status


# SQL dùng PostGIS để tìm tuyến xe buýt
# CTE (Common Table Expression) = tạm chia query thành 2 bước cho dễ đọc
FIND_ROUTE_SQL = """
WITH stops_near_origin AS (
    -- Bước 1a: tìm các trạm trong bán kính R quanh điểm đi, gần nhất trước
    SELECT DISTINCT ON (rs.route_id)
           rs.route_id, rs.stop_id, rs.sequence,
           bs.name  AS stop_name,
           ST_Y(bs.location::geometry) AS lat,
           ST_X(bs.location::geometry) AS lng
    FROM routes_busstop bs
    JOIN routes_routestop rs ON rs.stop_id = bs.id
    WHERE ST_DWithin(
        bs.location::geography,
        ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
        %s
    )
    ORDER BY rs.route_id,
             ST_Distance(bs.location::geography,
                         ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography)
),
stops_near_dest AS (
    -- Bước 1b: tìm các trạm trong bán kính R quanh điểm đến, gần nhất trước
    SELECT DISTINCT ON (rs.route_id)
           rs.route_id, rs.stop_id, rs.sequence,
           bs.name  AS stop_name,
           ST_Y(bs.location::geometry) AS lat,
           ST_X(bs.location::geometry) AS lng
    FROM routes_busstop bs
    JOIN routes_routestop rs ON rs.stop_id = bs.id
    WHERE ST_DWithin(
        bs.location::geography,
        ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
        %s
    )
    ORDER BY rs.route_id,
             ST_Distance(bs.location::geography,
                         ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography)
)
-- Bước 2: tìm tuyến có trạm lên TRƯỚC trạm xuống (sequence check)
SELECT
    r.id, r.ref, r.name, r.charge, r.interval,
    sa.stop_id AS board_stop_id, sa.stop_name AS board_stop_name,
    sa.lat AS board_lat, sa.lng AS board_lng,
    sb.stop_id AS alight_stop_id, sb.stop_name AS alight_stop_name,
    sb.lat AS alight_lat, sb.lng AS alight_lng
FROM routes_busroute r
JOIN stops_near_origin sa ON sa.route_id = r.id
JOIN stops_near_dest   sb ON sb.route_id = r.id
WHERE sa.sequence < sb.sequence   -- đảm bảo đi đúng chiều
ORDER BY r.ref
"""


class FindRouteView(APIView):
    """
    POST /api/find-route/
    Body: { origin: [lng, lat], destination: [lng, lat], radius?: int }
    Response: list[FindRouteResult]
    """

    def post(self, request):
        # ── Validate input ───────────────────────────────────────────────
        origin = request.data.get('origin')
        destination = request.data.get('destination')
        radius = request.data.get('radius', 500)

        if not origin or not destination:
            return Response(
                {'error': 'origin và destination là bắt buộc'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # origin/destination là list [lng, lat]
        origin_lng, origin_lat = origin[0], origin[1]
        dest_lng, dest_lat = destination[0], destination[1]

        # ── Chạy raw SQL với PostGIS ─────────────────────────────────────
        # Params theo thứ tự %s trong SQL:
        # (origin_lng, origin_lat, radius, dest_lng, dest_lat, radius)
        with connection.cursor() as cursor:
            cursor.execute(FIND_ROUTE_SQL, [
                origin_lng, origin_lat, radius, origin_lng, origin_lat,
                dest_lng, dest_lat, radius, dest_lng, dest_lat,
            ])
            rows = cursor.fetchall()
            columns = [col[0] for col in cursor.description]

        # ── Format response ──────────────────────────────────────────────
        results = []
        for row in rows:
            data = dict(zip(columns, row))   # {column_name: value}
            results.append({
                'id': data['id'],
                'ref': data['ref'],
                'name': data['name'],
                'charge': data['charge'],
                'interval': data['interval'],
                'board_stop': {
                    'id': data['board_stop_id'],
                    'name': data['board_stop_name'],
                    'lat': data['board_lat'],
                    'lng': data['board_lng'],
                },
                'alight_stop': {
                    'id': data['alight_stop_id'],
                    'name': data['alight_stop_name'],
                    'lat': data['alight_lat'],
                    'lng': data['alight_lng'],
                },
            })

        return Response(results)