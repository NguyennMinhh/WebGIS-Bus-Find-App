from django.contrib.gis import admin
from .models import BusRoute, BusStop, RouteStop


@admin.register(BusRoute)
class BusRouteAdmin(admin.GISModelAdmin):
    list_display = ['ref', 'name', 'from_stop', 'to_stop', 'operator']
    search_fields = ['ref', 'name', 'from_stop', 'to_stop']
    list_filter = ['operator']


@admin.register(BusStop)
class BusStopAdmin(admin.GISModelAdmin):
    list_display = ['name', 'osm_id']
    search_fields = ['name']


@admin.register(RouteStop)
class RouteStopAdmin(admin.ModelAdmin):
    list_display = ['route', 'stop', 'sequence']
    list_filter = ['route']
