from django.contrib.gis.db import models


class BusRoute(models.Model):
    """
    Một chiều của tuyến xe buýt.
    Mỗi tuyến có 2 chiều đi/về → 2 bản ghi riêng (vd: ref=09A chiều đi và chiều về).

    path lưu toàn bộ đường đi dưới dạng MultiLineString (PostGIS).
    Dùng MultiLineString thay vì LineString vì OSM đôi khi chia đường thành nhiều đoạn.
    """
    osm_id = models.CharField(max_length=30, unique=True, db_index=True)
    ref = models.CharField(max_length=20, db_index=True)    # vd: "09A", "50"
    name = models.CharField(max_length=300)                 # vd: "Bờ Hồ - Đại học Mỏ"
    from_stop = models.CharField(max_length=200)            # điểm xuất phát
    to_stop = models.CharField(max_length=200)              # điểm kết thúc
    operator = models.CharField(max_length=200, blank=True)
    opening_hours = models.CharField(max_length=100, blank=True)
    charge = models.CharField(max_length=50, blank=True)    # giá vé
    interval = models.CharField(max_length=50, blank=True)  # tần suất

    # Lộ trình được lưu dưới dạng MultiLineString (SRID=4326 = WGS84 lat/lng)
    path = models.MultiLineStringField(srid=4326)

    class Meta:
        ordering = ['ref']

    def __str__(self):
        return f"[{self.ref}] {self.name}"


class BusStop(models.Model):
    """
    Trạm dừng xe buýt.
    location là PointField PostGIS → cho phép dùng ST_DWithin để tìm trạm gần điểm.
    """
    osm_id = models.CharField(max_length=30, unique=True, db_index=True)
    name = models.CharField(max_length=200, blank=True)

    # Vị trí địa lý (PostGIS Point, SRID=4326)
    location = models.PointField(srid=4326)

    # Các trạm thuộc những tuyến nào (M2M qua RouteStop)
    routes = models.ManyToManyField(BusRoute, through='RouteStop', related_name='stops')

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name or f"Stop {self.osm_id}"


class RouteStop(models.Model):
    """
    Trạm thứ N thuộc tuyến X.
    Bảng trung gian BusRoute ↔ BusStop, lưu thứ tự dừng.
    """
    route = models.ForeignKey(BusRoute, on_delete=models.CASCADE, related_name='route_stops')
    stop = models.ForeignKey(BusStop, on_delete=models.CASCADE, related_name='stop_routes')
    sequence = models.PositiveIntegerField(default=0)   # thứ tự trạm trong tuyến

    class Meta:
        ordering = ['route', 'sequence']
        unique_together = [('route', 'stop')]

    def __str__(self):
        return f"{self.route.ref} → {self.stop.name} (#{self.sequence})"
