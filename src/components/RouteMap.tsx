// components/RouteMap.tsx (partial update)
import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Info, MapPin, Route as RouteIcon } from "lucide-react";
import { process.env.NEXT_PUBLIC_MAPBOX_TOKEN } from "@/config/env"; // Adjust path as needed

const routes = [
  { id: "llw-btn", name: "Lilongwe → Blantyre", color: "#3b82f6", coords: [[33.7741, -13.9626], [35.0058, -15.7861]] },
  { id: "btn-mgz", name: "Blantyre → Mangochi", color: "#8b5cf6", coords: [[35.0058, -15.7861], [35.2610, -14.4780]] },
];

const DEFAULT_CENTER: [number, number] = [33.8, -13.9];

const RouteMap: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [token, setToken] = useState<string | null>(process.env.NEXT_PUBLIC_MAPBOX_TOKEN || null);

  const bounds = useMemo(() => {
    const b = new mapboxgl.LngLatBounds();
    routes.forEach((r) => r.coords.forEach((c) => b.extend(c)));
    return b;
  }, []);

  useEffect(() => {
    if (!mapContainer.current || !token) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: DEFAULT_CENTER,
      zoom: 5.2,
      cooperativeGestures: true,
      projection: "mercator",
    });

    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");

    map.on("load", () => {
      map.fitBounds(bounds, { padding: 40, duration: 600 });

      routes.forEach((r) => {
        const sourceId = `route-src-${r.id}`;
        const layerId = `route-layer-${r.id}`;

        map.addSource(sourceId, {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: { type: "LineString", coordinates: r.coords },
            properties: {},
          },
        });

        map.addLayer({
          id: layerId,
          type: "line",
          source: sourceId,
          paint: {
            "line-width": 4,
            "line-color": r.color,
          },
        });

        const start = r.coords[0];
        const end = r.coords[r.coords.length - 1];

        new mapboxgl.Marker({ color: "#16a34a" })
          .setLngLat(start)
          .setPopup(new mapboxgl.Popup().setHTML(`<strong>${r.name.split(" → ")[0]}</strong>`))
          .addTo(map);

        new mapboxgl.Marker({ color: "#ef4444" })
          .setLngLat(end)
          .setPopup(new mapboxgl.Popup().setHTML(`<strong>${r.name.split(" → ")[1]}</strong>`))
          .addTo(map);
      });
    });

    return () => map.remove();
  }, [token, bounds]);

  return (
    <section aria-labelledby="routes-map-heading" className="py-12 bg-white/90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 id="routes-map-heading" className="text-2xl sm:text-3xl font-bold text-gray-900">Interactive Route Map</h2>
            <p className="text-gray-600">Explore our most popular routes across Malawi</p>
          </div>
        </div>

        {!token ? (
          <div className="card-elevated p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <Info className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">Add your Mapbox public token</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Paste your Mapbox public token to load the interactive map. You can find it in your Mapbox dashboard under Tokens.
                </p>
                <div className="grid sm:grid-cols-[1fr_auto] gap-2">
                  <input
                    type="text"
                    value={token || ""}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="pk.eyJ1Ijoi..."
                    className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    aria-label="Mapbox public token"
                  />
                  <button
                    onClick={() => setToken(process.env.NEXT_PUBLIC_MAPBOX_TOKEN || null)}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white shadow-soft hover:bg-blue-700 h-10"
                  >
                    Save token
                  </button>
                </div>
                <p className="mt-3 text-xs text-gray-600">
                  Tip: In production, store this in environment variables securely.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative h-[420px] rounded-2xl overflow-hidden border border-gray-200">
            <div ref={mapContainer} className="absolute inset-0" />
            <div className="absolute top-3 left-3 inline-flex items-center gap-2 rounded-full bg-white/90 backdrop-blur px-3 py-1.5 text-xs text-gray-900 border border-gray-200">
              <RouteIcon className="w-3.5 h-3.5 text-blue-600" /> Live routes
            </div>
            <div className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-full bg-white/90 backdrop-blur px-3 py-1.5 text-xs text-gray-900 border border-gray-200">
              <MapPin className="w-3.5 h-3.5 text-purple-600" /> Malawi
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default RouteMap;