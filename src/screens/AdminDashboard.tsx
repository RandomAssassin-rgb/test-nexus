import React, { useMemo, useEffect, useState } from 'react';
import { ArrowLeft, Activity, Shield, Map as MapIcon, Users, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Map, { Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { cellToBoundary, latLngToCell, gridDisk } from 'h3-js';
import axios from 'axios';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
  const [revenueData, setRevenueData] = useState<any>(null);
  const [pmaxData, setPmaxData] = useState<any>(null);

  useEffect(() => {
    const fetchActuarialData = async () => {
      try {
        const revRes = await axios.get('/api/actuarial/revenue-projection');
        setRevenueData(revRes.data);

        const pmaxRes = await axios.post('/api/actuarial/pmax', {
          w_base: 500, // Base wage
          income_loss_pct: 100, // 100% loss
          b_res: 1250000, // Reserve pool
          n_active: 8405, // Active policies
          t_w: 1 // Time window
        });
        setPmaxData(pmaxRes.data);
      } catch (e) {
        console.error("Failed to fetch actuarial data", e);
      }
    };
    fetchActuarialData();
  }, []);

  // Generate H3 Hexagons for Bangalore
  const hexData = useMemo(() => {
    const centerLat = 12.9716;
    const centerLng = 77.5946;
    const resolution = 7;
    
    try {
      const centerHex = latLngToCell(centerLat, centerLng, resolution);
      const hexes = gridDisk(centerHex, 4); // Radius 4
      
      const features = hexes.map(hex => {
        const boundary = cellToBoundary(hex, true); // true for geojson format [lng, lat]
        boundary.push(boundary[0]); // close the polygon
        
        // Random risk score for visualization
        const risk = Math.random();
        
        return {
          type: "Feature",
          properties: {
            hexId: hex,
            risk: risk
          },
          geometry: {
            type: "Polygon",
            coordinates: [boundary]
          }
        };
      });

      return {
        type: "FeatureCollection",
        features
      };
    } catch (e) {
      console.error("H3 Generation Error:", e);
      return null;
    }
  }, []);

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-secondary rounded-full">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nexus Sovereign Command Center</h1>
          <p className="text-muted-foreground text-sm">Real-time Insurer & Admin Dashboard</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Activity size={64} /></div>
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Live Claims</h2>
          <p className="text-4xl font-bold text-primary">142</p>
          <p className="text-xs text-emerald-500 mt-2 flex items-center gap-1">↑ 12% from yesterday</p>
        </div>
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Shield size={64} /></div>
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Reserve Pool</h2>
          <p className="text-4xl font-bold">₹12,50,000</p>
          <p className="text-xs text-emerald-500 mt-2 flex items-center gap-1">Healthy</p>
        </div>
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><AlertTriangle size={64} /></div>
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Active Triggers</h2>
          <p className="text-4xl font-bold text-amber-500">3</p>
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">Rain, Traffic, Heat</p>
        </div>
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Users size={64} /></div>
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Active Policies</h2>
          <p className="text-4xl font-bold">8,405</p>
          <p className="text-xs text-emerald-500 mt-2 flex items-center gap-1">↑ 45 new today</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg flex items-center gap-2"><MapIcon size={20} className="text-primary"/> Live H3 Risk Map</h2>
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-md font-bold uppercase">Bengaluru</span>
          </div>
          <div className="flex-1 min-h-[400px] bg-secondary/30 rounded-xl flex items-center justify-center border border-dashed border-border/50 relative overflow-hidden">
            {mapboxToken && hexData ? (
              <Map
                mapboxAccessToken={mapboxToken}
                initialViewState={{
                  longitude: 77.5946,
                  latitude: 12.9716,
                  zoom: 10.5
                }}
                mapStyle="mapbox://styles/mapbox/dark-v11"
                style={{ width: '100%', height: '100%' }}
              >
                <Source id="h3-hexagons" type="geojson" data={hexData as any}>
                  <Layer
                    id="hex-fill"
                    type="fill"
                    paint={{
                      'fill-color': [
                        'interpolate',
                        ['linear'],
                        ['get', 'risk'],
                        0, '#10b981', // Low risk - green
                        0.5, '#f59e0b', // Medium risk - amber
                        1, '#ef4444' // High risk - red
                      ],
                      'fill-opacity': 0.4
                    }}
                  />
                  <Layer
                    id="hex-line"
                    type="line"
                    paint={{
                      'line-color': '#ffffff',
                      'line-width': 1,
                      'line-opacity': 0.2
                    }}
                  />
                </Source>
              </Map>
            ) : (
              <div className="text-center z-10">
                <MapIcon size={48} className="mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground font-medium">H3 Hexagonal Grid Visualization</p>
                <p className="text-xs text-muted-foreground mt-1">Please add VITE_MAPBOX_TOKEN to .env to view the map.</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
          <div>
            <h2 className="font-bold text-lg mb-4">Recent Auto-Claims</h2>
            <div className="space-y-4">
              {[
                { id: "CLM-8921", zone: "H3-11", trigger: "Heavy Rain", amount: "₹1,200", time: "2 mins ago" },
                { id: "CLM-8920", zone: "H3-14", trigger: "Traffic Jam", amount: "₹850", time: "15 mins ago" },
                { id: "CLM-8919", zone: "H3-09", trigger: "Heatwave", amount: "₹500", time: "1 hour ago" },
                { id: "CLM-8918", zone: "H3-11", trigger: "Heavy Rain", amount: "₹1,200", time: "1 hour ago" },
                { id: "CLM-8917", zone: "H3-22", trigger: "Platform Outage", amount: "₹2,000", time: "3 hours ago" },
              ].map((claim, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl border border-border/50">
                  <div>
                    <p className="font-bold text-sm">{claim.id}</p>
                    <p className="text-xs text-muted-foreground">{claim.zone} • {claim.trigger}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-500">{claim.amount}</p>
                    <p className="text-[10px] text-muted-foreground">{claim.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {pmaxData && revenueData && (
            <div className="border-t border-border/50 pt-6">
              <h2 className="font-bold text-lg mb-4">Actuarial Intelligence</h2>
              <div className="space-y-4">
                <div className="p-3 bg-secondary/30 rounded-xl border border-border/50">
                  <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Pmax Solvency Engine</p>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-sm font-medium">Standard Payout</p>
                      <p className="text-lg font-bold">₹{pmaxData.standard_payout}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">Adjusted (Pool)</p>
                      <p className={`text-lg font-bold ${pmaxData.circuit_breaker_active ? 'text-amber-500' : 'text-emerald-500'}`}>
                        ₹{pmaxData.adjusted_pool_payout.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  {pmaxData.circuit_breaker_active && (
                    <p className="text-xs text-amber-500 mt-2 flex items-center gap-1">
                      <AlertTriangle size={12} /> Circuit breaker active to protect liquidity
                    </p>
                  )}
                </div>

                <div className="p-3 bg-secondary/30 rounded-xl border border-border/50">
                  <p className="text-xs text-muted-foreground uppercase font-bold mb-1">3-Year Projection</p>
                  <div className="flex justify-between items-center">
                    <p className="text-sm">Year 3 Target</p>
                    <p className="text-lg font-bold text-primary">₹{revenueData.year_3.revenue_cr} Cr</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{revenueData.year_3.milestone}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
