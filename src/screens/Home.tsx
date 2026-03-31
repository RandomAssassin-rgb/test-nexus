import { motion } from "framer-motion";
import { Bell, Shield, TrendingUp, AlertTriangle, ChevronRight, Activity, Zap, MapPin, Wallet as WalletIcon, Sun, Moon, CloudRain, ArrowRight, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "../lib/utils";
import { useEffect, useState } from "react";
import axios from "axios";
import { useTheme } from "../components/theme-provider";
import { syncOfflineClaims, getOfflineClaims } from "../lib/offlineQueue";
import RiskAnalysis from "../components/RiskAnalysis";

export default function Home() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const [weatherData, setWeatherData] = useState<any>(null);
  const [premiumRate, setPremiumRate] = useState<number>(2.40);
  const [location, setLocation] = useState<{lat: number, lon: number} | null>(null);
  const [zoneName, setZoneName] = useState<string>("Locating...");
  const [zoneId, setZoneId] = useState<string>("---");
  const [locationError, setLocationError] = useState<string>("");
  const [aqiData, setAqiData] = useState<any>(null);
  const [trafficData, setTrafficData] = useState<any>(null);
  const [showAutoTrigger, setShowAutoTrigger] = useState(false);
  const [showPredictiveShield, setShowPredictiveShield] = useState(true);

  // Offline Sync
  useEffect(() => {
    const handleOnline = async () => {
      const claims = getOfflineClaims();
      if (claims.length > 0) {
        console.log("Syncing offline claims...");
        const results = await syncOfflineClaims();
        if (results && results.length > 0) {
          alert(`Successfully synced ${results.length} offline claims!`);
        }
      }
    };

    window.addEventListener('online', handleOnline);
    
    // Also check on mount in case they came online while app was closed
    if (navigator.onLine) {
      handleOnline();
    }

    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // 1. Real-time Location Accessor (Bypasses VPNs by using device GPS)
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported");
      // Fallback to default
      setLocation({ lat: 12.9716, lon: 77.5946 });
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude
        });
        setLocationError("");
      },
      (error) => {
        console.error("Location error:", error);
        setLocationError("Using default location");
        // Fallback to default if permission denied or error
        if (!location) {
          setLocation({ lat: 12.9716, lon: 77.5946 });
        }
      },
      {
        enableHighAccuracy: true, // Forces GPS usage, bypassing IP-based VPN location
        maximumAge: 0,
        timeout: 10000
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // 2. Fetch Zone (Mapbox) and Risk Data when location changes
  useEffect(() => {
    if (!location) return;

    const fetchLocationData = async () => {
      try {
        const { lat, lon } = location;
        
        // Fetch Zone from Mapbox Reverse Geocoding
        const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
        if (mapboxToken && mapboxToken !== 'placeholder_mapbox_token') {
          try {
            const mapboxRes = await axios.get(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?access_token=${mapboxToken}&types=neighborhood,locality,place`
            );
            
            if (mapboxRes.data.features && mapboxRes.data.features.length > 0) {
              const place = mapboxRes.data.features[0];
              setZoneName(place.text || place.place_name.split(',')[0]);
              
              // Generate a deterministic pseudo-H3 zone ID based on coordinates for the UI
              const latStr = Math.abs(lat).toFixed(2).replace('.', '');
              const lonStr = Math.abs(lon).toFixed(2).replace('.', '');
              setZoneId(`H3-${latStr.slice(-2)}${lonStr.slice(-2)}`);
            }
          } catch (mapboxErr) {
            console.error("Mapbox geocoding failed:", mapboxErr);
            setZoneName("Unknown Zone");
            setZoneId("H3-XX");
          }
        } else {
          setZoneName("Koramangala, BLR (Mock)");
          setZoneId("H3-11");
        }
        
        // Fetch weather
        const weatherRes = await axios.get(`/api/weather?lat=${lat}&lon=${lon}`);
        setWeatherData(weatherRes.data);

        // Fetch AQI
        const aqiRes = await axios.get(`/api/aqi?lat=${lat}&lon=${lon}`);
        setAqiData(aqiRes.data);

        // Fetch Traffic
        const trafficRes = await axios.get(`/api/traffic?lat=${lat}&lon=${lon}`);
        setTrafficData(trafficRes.data);

        // Calculate weather impact
        let weatherImpact = 1.0;
        if (weatherRes.data.weather?.[0]?.main === 'Rain') {
          weatherImpact = 1.5;
        }

        // Fetch premium calculation
        const premiumRes = await axios.post('/api/ml/calculate-premium', {
          base_rate: 2.0,
          traffic_density: trafficRes.data.trafficDensity || 1.2,
          weather_impact: weatherImpact,
          elevation_risk: 1.1,
          trust_score: 850,
          persona: "Blinkit"
        });

        if (premiumRes.data.premium) {
          setPremiumRate(premiumRes.data.premium);
        }
      } catch (error) {
        console.error("Failed to fetch risk data:", error);
        // Fallback data if API fails
        if (!weatherData) {
          setWeatherData({
            weather: [{ main: "Clear", description: "clear sky" }],
            main: { temp: 298.15, humidity: 50 },
            wind: { speed: 3.5 },
            mock: true
          });
        }
      }
    };

    fetchLocationData();
  }, [location?.lat, location?.lon]); // Only re-run if coordinates change

  const getWeatherDisplay = () => {
    if (!weatherData) return { text: "Loading...", color: "text-muted-foreground" };
    
    const condition = weatherData.weather?.[0]?.main || "Clear";
    if (condition === "Rain") {
      return { text: "Rain (+50%)", color: "text-amber-500" };
    }
    return { text: "Clear (+0%)", color: "text-emerald-500" };
  };

  const getTrafficDisplay = () => {
    if (!trafficData) return { text: "Loading...", color: "text-muted-foreground" };
    const jam = trafficData.jamFactor || 0;
    if (jam > 7) return { text: `Heavy (+${(trafficData.trafficDensity * 10 - 10).toFixed(1)}%)`, color: "text-destructive" };
    if (jam > 3) return { text: `Moderate (+${(trafficData.trafficDensity * 10 - 10).toFixed(1)}%)`, color: "text-amber-500" };
    return { text: "Light (+0%)", color: "text-emerald-500" };
  };

  const getAqiDisplay = () => {
    if (!aqiData) return { text: "Loading...", color: "text-muted-foreground" };
    const aqi = aqiData.aqi || 0;
    if (aqi > 150) return { text: `Poor (${aqi})`, color: "text-destructive" };
    if (aqi > 100) return { text: `Moderate (${aqi})`, color: "text-amber-500" };
    return { text: `Good (${aqi})`, color: "text-emerald-500" };
  };

  const weatherDisplay = getWeatherDisplay();
  const trafficDisplay = getTrafficDisplay();
  const aqiDisplay = getAqiDisplay();

  // Simulate Zero-touch automatic trigger
  useEffect(() => {
    if (weatherData && weatherData.weather?.[0]?.main === 'Rain') {
      const timer = setTimeout(() => {
        setShowAutoTrigger(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
    // For demo purposes, let's randomly trigger it if it's not raining after 5 seconds
    const demoTimer = setTimeout(() => {
      if (!showAutoTrigger) {
        setShowAutoTrigger(true);
      }
    }, 5000);
    return () => clearTimeout(demoTimer);
  }, [weatherData]);

  return (
    <div className="min-h-full bg-background flex flex-col">
      <header className="flex items-center justify-between p-4 border-b border-border/10 sticky top-0 bg-background/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
            <span className="text-primary font-bold">N</span>
          </div>
          <div>
            <h1 className="font-bold tracking-tight leading-none mb-1">Nexus Sovereign</h1>
            <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active Shield
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate("/admin")} className="p-2 hover:bg-secondary rounded-full text-xs font-bold text-muted-foreground flex items-center">
            Admin
          </button>
          <button onClick={() => setTheme(isDark ? "light" : "dark")} className="p-2 hover:bg-secondary rounded-full">
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button className="p-2 hover:bg-secondary rounded-full relative">
            <Bell size={20} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-background" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-6">
        {/* Predictive Shield Notification */}
        {showPredictiveShield && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-2xl p-4 relative overflow-hidden"
          >
            <button 
              onClick={() => setShowPredictiveShield(false)}
              className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                <CloudRain className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm flex items-center gap-1">
                  Predictive Shield <Zap size={12} className="text-amber-400" />
                </h3>
                <p className="text-xs text-muted-foreground mt-1 mb-3">
                  Heavy rain forecasted for your zone tomorrow (80% probability). Upgrade coverage by ₹15 to protect ₹2,500 earnings.
                </p>
                <button className="bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold py-2 px-4 rounded-lg transition-colors">
                  Upgrade Coverage
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Zero-touch Auto Trigger Modal */}
        {showAutoTrigger && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card border border-primary/50 rounded-3xl p-6 shadow-2xl max-w-sm w-full relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-emerald-500 to-primary animate-pulse" />
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center border-2 border-emerald-500/50">
                  <Zap className="w-8 h-8 text-emerald-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Zero-Touch Trigger</h2>
                  <p className="text-sm text-muted-foreground mt-2">
                    Severe disruption detected in your zone. We've automatically filed a claim on your behalf.
                  </p>
                </div>
                <div className="w-full bg-secondary/50 rounded-xl p-3 border border-border/50 flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Est. Payout</span>
                  <span className="font-bold text-emerald-500">₹1,200</span>
                </div>
                <button 
                  onClick={() => {
                    setShowAutoTrigger(false);
                    navigate("/payout-success/auto-123");
                  }}
                  className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
                >
                  View Claim Status <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Hero Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-card border border-border/50 p-6 shadow-sm"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10" />
          
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Protected Earnings</p>
              <h2 className="text-4xl font-bold tracking-tight flex items-baseline gap-1">
                <span className="text-primary">₹</span>12,450
              </h2>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Shield className="w-6 h-6 text-primary" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 relative z-10">
            <div className="bg-secondary/50 rounded-2xl p-3 border border-border/50">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={14} className="text-emerald-500" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Est. Payout</span>
              </div>
              <p className="text-lg font-semibold">₹1,200/day</p>
            </div>
            <div className="bg-secondary/50 rounded-2xl p-3 border border-border/50">
              <div className="flex items-center gap-2 mb-1">
                <Activity size={14} className="text-blue-500" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Coverage</span>
              </div>
              <p className="text-lg font-semibold">98.5%</p>
            </div>
          </div>
        </motion.div>

        {/* Dynamic Risk Assessment */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-3xl bg-card border border-border/50 p-5 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Zap size={18} className="text-primary" />
              Live Risk Oracle
            </h3>
            <span className="text-xs font-bold px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500 uppercase tracking-wider">
              Low Risk
            </span>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <MapPin size={14} />
                Current Zone ({zoneId})
              </span>
              <div className="flex flex-col items-end">
                <span className="font-medium">{zoneName}</span>
                {locationError && <span className="text-[10px] text-amber-500">{locationError}</span>}
              </div>
            </div>
            <div className="flex items-center justify-between text-sm group relative">
              <span className="text-muted-foreground flex items-center gap-1">
                Weather Impact
                <div className="relative">
                  <Zap size={12} className="text-muted-foreground cursor-help" />
                  <div className="absolute left-full ml-2 top-0 w-48 p-2 bg-popover text-popover-foreground text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-20 border border-border">
                    Higher impact during rain or storms increases risk.
                  </div>
                </div>
              </span>
              <span className={cn("font-medium", weatherDisplay.color)}>{weatherDisplay.text}</span>
            </div>
            <div className="flex items-center justify-between text-sm group relative">
              <span className="text-muted-foreground flex items-center gap-1">
                Traffic Density
                <div className="relative">
                  <Zap size={12} className="text-muted-foreground cursor-help" />
                  <div className="absolute left-full ml-2 top-0 w-48 p-2 bg-popover text-popover-foreground text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-20 border border-border">
                    Higher traffic density increases collision risk.
                  </div>
                </div>
              </span>
              <span className={cn("font-medium", trafficDisplay.color)}>{trafficDisplay.text}</span>
            </div>
            <div className="flex items-center justify-between text-sm group relative">
              <span className="text-muted-foreground flex items-center gap-1">
                Air Quality (AQI)
                <div className="relative">
                  <Zap size={12} className="text-muted-foreground cursor-help" />
                  <div className="absolute left-full ml-2 top-0 w-48 p-2 bg-popover text-popover-foreground text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-20 border border-border">
                    Poor air quality may impact health and increase claim risk.
                  </div>
                </div>
              </span>
              <span className={cn("font-medium", aqiDisplay.color)}>{aqiDisplay.text}</span>
            </div>
            
            <div className="pt-4 border-t border-border/50">
              <div className="flex justify-between items-end mb-2">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Weekly Premium</span>
                <span className="text-lg font-bold text-primary">₹{(premiumRate * 50).toFixed(2)}/week</span>
              </div>
              <button className="w-full mt-2 text-xs font-bold text-primary hover:text-primary/80 flex items-center justify-center gap-1">
                Explore Upgrade Options <ChevronRight size={12} />
              </button>
              <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden mt-2">
                <div className="h-full bg-primary w-[20%]" />
              </div>
            </div>
          </div>
        </motion.div>

        <RiskAnalysis 
          weatherData={weatherData}
          aqiData={aqiData}
          trafficData={trafficData}
          location={location}
        />

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => navigate("/claims")}
            className="bg-card border border-border/50 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 hover:border-primary/50 transition-colors shadow-sm"
          >
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
              <AlertTriangle size={20} />
            </div>
            <span className="font-semibold text-xs text-center">Claims Center</span>
          </button>
          <button
            onClick={() => navigate("/coverage")}
            className="bg-card border border-border/50 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 hover:border-primary/50 transition-colors shadow-sm"
          >
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
              <Shield size={20} />
            </div>
            <span className="font-semibold text-xs text-center">View Policy</span>
          </button>
          <button
            onClick={() => navigate("/wallet")}
            className="bg-card border border-border/50 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 hover:border-primary/50 transition-colors shadow-sm"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <WalletIcon size={20} />
            </div>
            <span className="font-semibold text-xs text-center">Wallet</span>
          </button>
        </div>

        {/* Recent Activity */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">Recent Activity</h3>
            <button className="text-xs font-bold text-primary uppercase tracking-wider flex items-center">
              View All <ChevronRight size={14} />
            </button>
          </div>
          
          <div className="space-y-3">
            {[
              { title: "Weekly Policy Active", desc: "Term: 3 Months • Valid till Jun 29", time: "Active", icon: "🛡️", color: "bg-emerald-500/10 text-emerald-500" },
              { title: "Weekly Premium Deducted", desc: `₹${(premiumRate * 50).toFixed(2)} • Wallet Balance`, time: "Monday", icon: "💸", color: "bg-destructive/10 text-destructive" },
              { title: "Claim Approved", desc: "Heatwave Alert • ₹1,000.00", time: "Last Week", icon: "✅", color: "bg-primary/10 text-primary" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-2xl bg-card border border-border/50">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0", item.color)}>
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm truncate">{item.title}</h4>
                  <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
                </div>
                <span className="text-[10px] font-medium text-muted-foreground shrink-0">{item.time}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
