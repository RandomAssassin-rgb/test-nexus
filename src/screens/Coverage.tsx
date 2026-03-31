import { motion } from "framer-motion";
import { Shield, Map as MapIcon, Info, Activity, AlertTriangle, CloudRain, ThermometerSun, ServerCrash, XCircle } from "lucide-react";
import { cn } from "../lib/utils";
import { useState, useEffect } from "react";
import Map, { Source, Layer, FillLayer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const riskLayerStyle: FillLayer = {
  id: 'risk-layer',
  type: 'fill',
  source: 'risk-data',
  paint: {
    'fill-color': [
      'match',
      ['get', 'riskLevel'],
      1, '#10b981', // Emerald 500
      2, '#f59e0b', // Amber 500
      3, '#ef4444', // Destructive
      '#10b981' // Default
    ],
    'fill-opacity': 0.4
  }
};

const generateHexagons = (baseLat: number, baseLng: number) => {
  return {
    type: 'FeatureCollection',
    features: Array.from({ length: 24 }).map((_, i) => {
      const row = Math.floor(i / 6);
      const col = i % 6;
      const lngOffset = col * 0.005 + (row % 2 === 0 ? 0 : 0.0025) - 0.015;
      const latOffset = row * 0.004 - 0.008;
      
      let riskLevel = 1;
      if (i % 5 === 0) riskLevel = 3;
      else if (i % 3 === 0) riskLevel = 2;

      const center = [baseLng + lngOffset, baseLat + latOffset];
      const radius = 0.0025;
      const coordinates = [];
      for (let j = 0; j <= 6; j++) {
        const angle = (j * 60 * Math.PI) / 180;
        coordinates.push([
          center[0] + radius * Math.cos(angle),
          center[1] + radius * Math.sin(angle) * 0.8
        ]);
      }

      return {
        type: 'Feature',
        properties: { riskLevel },
        geometry: {
          type: 'Polygon',
          coordinates: [coordinates]
        }
      };
    })
  };
};

export default function Coverage() {
  const [showDataLayer, setShowDataLayer] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [zoneName, setZoneName] = useState<string>("Locating...");
  const mapboxToken = import.meta.env?.VITE_MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN;

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation({ lat: 12.9350, lon: 77.6150 }); // Fallback
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      (error) => {
        console.error("Location error:", error);
        setLocation({ lat: 12.9350, lon: 77.6150 }); // Fallback
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (!location) return;

    const fetchZoneName = async () => {
      if (mapboxToken && mapboxToken !== 'placeholder_mapbox_token') {
        try {
          const mapboxRes = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${location.lon},${location.lat}.json?access_token=${mapboxToken}&types=neighborhood,locality,place`
          );
          const data = await mapboxRes.json();
          if (data.features && data.features.length > 0) {
            const place = data.features[0];
            setZoneName(place.text || place.place_name.split(',')[0]);
          } else {
            setZoneName("Unknown Zone");
          }
        } catch (err) {
          console.error("Geocoding failed", err);
          setZoneName("Unknown Zone");
        }
      } else {
        setZoneName("Mock Zone");
      }
    };
    fetchZoneName();
  }, [location, mapboxToken]);

  return (
    <div className="min-h-full bg-background flex flex-col">
      <header className="flex items-center justify-between p-4 border-b border-border/10 sticky top-0 bg-background/80 backdrop-blur-md z-10">
        <h1 className="font-bold tracking-tight text-xl">Coverage Map</h1>
        <button className="p-2 hover:bg-secondary rounded-full">
          <Info size={20} />
        </button>
      </header>

      <main className="flex-1 p-4 space-y-6">
        {/* Map Visualization */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative h-64 rounded-3xl overflow-hidden border border-border/50 shadow-sm bg-secondary/20"
        >
          {mapboxToken && mapboxToken !== 'placeholder_mapbox_token' && location ? (
            <Map
              mapboxAccessToken={mapboxToken}
              initialViewState={{
                longitude: location.lon,
                latitude: location.lat,
                zoom: 13,
                pitch: 45,
              }}
              mapStyle="mapbox://styles/mapbox/dark-v11"
              attributionControl={false}
            >
              {showDataLayer && (
                <Source id="risk-data" type="geojson" data={generateHexagons(location.lat, location.lon) as any}>
                  <Layer {...riskLayerStyle} />
                </Source>
              )}
            </Map>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary/50 p-4 text-center">
              <MapIcon className="w-12 h-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {!location ? "Locating..." : "Mapbox token not configured."}
              </p>
            </div>
          )}

          <div className="absolute top-4 left-4 pointer-events-none z-10">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-background/80 px-3 py-1 rounded-full backdrop-blur-md border border-border/50">
              H3 Resolution 11
            </span>
          </div>

          <button
            onClick={() => setShowDataLayer(!showDataLayer)}
            className="absolute bottom-4 right-4 bg-background/90 backdrop-blur-md border border-border/50 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg hover:bg-secondary transition-colors z-10"
          >
            {showDataLayer ? "Hide Risk Vectors" : "Show Risk Vectors"}
          </button>
        </motion.div>

        {/* HazardHub Insight */}
        {showDataLayer && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="bg-destructive/5 border border-destructive/20 rounded-2xl p-4"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-destructive shrink-0 mt-0.5" size={18} />
              <div>
                <h4 className="font-bold text-sm text-destructive mb-1">Micro-Topographical Risk Detected</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Elevation-weighted flood velocity vectors indicate a 14% higher risk on your current route. Premium adjusted by +₹0.40.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Policy Details */}
        <div className="space-y-4">
          <h3 className="font-bold text-lg">Active Policy</h3>
          
          <div className="bg-card border border-border/50 rounded-3xl p-5 shadow-sm">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h4 className="font-bold text-xl mb-1">Sovereign Shield</h4>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Parametric Income Protection</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <Shield className="w-5 h-5 text-emerald-500" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Policy Term</span>
                <span className="font-bold">3 Months</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Payment Cycle</span>
                <span className="font-bold text-primary">Weekly Premium</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Coverage Area</span>
                <span className="font-bold">{zoneName}</span>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                <p className="text-xs text-amber-600 font-medium">
                  <span className="font-bold">Lockout Policy:</span> If weekly premium payments are stopped or cancelled before the 3-month term ends, you cannot purchase a new policy until the original 3-month period has elapsed.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Coverage Limits */}
        <div className="space-y-4 mb-6">
          <h3 className="font-bold text-lg">Parametric Coverage Limits</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <CloudRain size={16} className="text-blue-500" />
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Heavy Rain</span>
              </div>
              <p className="text-xl font-bold">₹1,500/day</p>
              <p className="text-[10px] text-muted-foreground mt-1">Trigger: &gt;20mm/hr</p>
            </div>
            
            <div className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <ThermometerSun size={16} className="text-amber-500" />
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Extreme Heat</span>
              </div>
              <p className="text-xl font-bold">₹1,000/day</p>
              <p className="text-[10px] text-muted-foreground mt-1">Trigger: &gt;40°C</p>
            </div>

            <div className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <ServerCrash size={16} className="text-purple-500" />
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Platform Outage</span>
              </div>
              <p className="text-xl font-bold">₹2,000/day</p>
              <p className="text-[10px] text-muted-foreground mt-1">Trigger: &gt;2hrs downtime</p>
            </div>
          </div>

          <div className="mt-6">
            <h4 className="font-bold text-sm text-destructive mb-3 flex items-center gap-2">
              <XCircle size={16} /> Strict Exclusions
            </h4>
            <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                This is a parametric income protection policy. It strictly <strong>excludes</strong> coverage for:
              </p>
              <ul className="list-disc list-inside text-xs text-muted-foreground mt-2 space-y-1">
                <li>Health & Medical Expenses</li>
                <li>Life Insurance / Death Benefits</li>
                <li>Accident & Hospitalization</li>
                <li>Vehicle Repairs & Damage</li>
                <li>War & Terrorism</li>
                <li>Pandemics & Epidemics</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

