/*
  Overpass Query — Xe buýt Tây Hồ, Hà Nội
  ==========================================
  Cách dùng:
    1. Mở https://overpass-turbo.eu/
    2. Paste query này vào editor
    3. Click "Run"
    4. Export → Download as GeoJSON
    5. Lưu file vào: data/tay-ho-datas.geojson

  Để query vùng khác: thay "Tây Hồ" bằng tên quận/huyện mong muốn
  và admin_level="8" (quận) hoặc "6" (thành phố), "7" (huyện).
*/

[out:json][timeout:90];

area["name"="Tây Hồ"]["admin_level"="8"]->.searchArea;

(
  relation["type"="route"]["route"="bus"](area.searchArea);
  node["highway"="bus_stop"](area.searchArea);
);

out geom;
