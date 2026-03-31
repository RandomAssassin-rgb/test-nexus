import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import path from "path";
import { spawn } from "child_process";
import Razorpay from "razorpay";
import jwt from "jsonwebtoken";
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import dotenv from "dotenv";
import axios from "axios";
import { supabaseServer } from "./src/lib/supabaseServer.js";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

import fs from "fs";

// Start Python ML Microservice
const pythonProcess = spawn("python3", ["-m", "uvicorn", "ml_service:app", "--host", "127.0.0.1", "--port", "8005"]);
pythonProcess.stdout.on('data', (data) => {
  console.log(`[ML Service] ${data.toString().trim()}`);
  fs.appendFileSync("python_log.txt", data.toString());
});
pythonProcess.stderr.on('data', (data) => {
  const msg = data.toString().trim();
  if (msg.includes("ERROR") || msg.includes("Exception") || msg.includes("Traceback")) {
    console.error(`[ML Service Error] ${msg}`);
  } else {
    console.log(`[ML Service Log] ${msg}`);
  }
  fs.appendFileSync("python_error.txt", data.toString());
});
pythonProcess.on('close', (code) => {
  console.log(`[ML Service] Exited with code ${code}`);
  fs.appendFileSync("python_error.txt", `Exited with code ${code}\n`);
});

// Razorpay Instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "rzp_test_secret_placeholder",
});

// In-memory store for WebAuthn challenges and credentials (for demo purposes)
const userStore: Record<string, any> = {};

// --- WebAuthn Endpoints ---
app.post("/api/auth/webauthn/generate-registration-options", async (req, res) => {
  const { userId, username } = req.body;
  
  const options = await generateRegistrationOptions({
    rpName: "Nexus Sovereign",
    rpID: req.hostname === "localhost" ? "localhost" : req.hostname,
    userID: new Uint8Array(Buffer.from(userId)),
    userName: username,
    attestationType: "none",
    authenticatorSelection: {
      userVerification: "preferred",
      residentKey: "required",
    },
  });

  userStore[userId] = { ...userStore[userId], currentChallenge: options.challenge };
  res.json(options);
});

app.post("/api/auth/webauthn/verify-registration", async (req, res) => {
  const { userId, body } = req.body;
  const expectedChallenge = userStore[userId]?.currentChallenge;

  try {
    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: req.headers.origin || `http://${req.hostname}:3000`,
      expectedRPID: req.hostname === "localhost" ? "localhost" : req.hostname,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credential, credentialType } = verification.registrationInfo;
      userStore[userId].devices = [{ 
        credentialID: credential.id, 
        credentialPublicKey: credential.publicKey, 
        counter: 0 // signCount is not always available on registration, defaulting to 0
      }];
      
      // Generate JWT
      const token = jwt.sign({ userId }, process.env.SUPABASE_JWT_SECRET || "secret", { expiresIn: "1h" });
      res.json({ verified: true, token });
    } else {
      res.status(400).json({ verified: false });
    }
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/auth/webauthn/generate-authentication-options", async (req, res) => {
  const { userId } = req.body;
  const user = userStore[userId];

  if (!user || !user.devices) {
    return res.status(404).json({ error: "User not found or no devices registered" });
  }

  const options = await generateAuthenticationOptions({
    rpID: req.hostname === "localhost" ? "localhost" : req.hostname,
    allowCredentials: user.devices.map((dev: any) => ({
      id: dev.credentialID,
      type: "public-key",
      transports: ["internal"],
    })),
    userVerification: "preferred",
  });

  userStore[userId].currentChallenge = options.challenge;
  res.json(options);
});

app.post("/api/auth/webauthn/verify-authentication", async (req, res) => {
  const { userId, body } = req.body;
  const user = userStore[userId];
  const expectedChallenge = user?.currentChallenge;

  if (!user || !user.devices) {
    return res.status(404).json({ error: "User not found" });
  }

  const device = user.devices.find((d: any) => d.credentialID === body.id);

  try {
    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: req.headers.origin || `http://${req.hostname}:3000`,
      expectedRPID: req.hostname === "localhost" ? "localhost" : req.hostname,
      credential: {
        id: device.credentialID,
        publicKey: device.credentialPublicKey,
        counter: device.counter,
        transports: device.transports,
      },
    });

    if (verification.verified) {
      // Generate JWT
      const token = jwt.sign({ userId }, process.env.SUPABASE_JWT_SECRET || "secret", { expiresIn: "1h" });
      res.json({ verified: true, token });
    } else {
      res.status(400).json({ verified: false });
    }
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// --- Aadhaar OTP Fallback Endpoints ---
app.post("/api/auth/aadhaar-otp/send", async (req, res) => {
  const { phone } = req.body;
  // Simulate sending OTP
  console.log(`Sending Aadhaar OTP to ${phone}`);
  res.json({ success: true, message: "OTP sent" });
});

app.post("/api/auth/aadhaar-otp/verify", async (req, res) => {
  const { phone, otp } = req.body;
  // Simulate verifying OTP
  if (otp === "123456") {
    res.json({ success: true, token: "aadhaar_verified_token" });
  } else {
    res.status(400).json({ success: false, message: "Invalid OTP" });
  }
});

// --- Partner ID Verification Endpoint ---
app.post("/api/partner/verify", async (req, res) => {
  const { partnerId, platform } = req.body;
  // Simulate cross-referencing against a partner database
  const validPartners = ["BLINKIT_123", "SWIGGY_456", "AMAZON_789"];
  if (validPartners.includes(partnerId.toUpperCase())) {
    res.json({ verified: true, partnerId });
  } else {
    res.status(404).json({ verified: false, message: "Partner ID not found" });
  }
});

// --- Dispute Mechanism Endpoint ---
app.post("/api/claims/dispute", async (req, res) => {
  const { claimId, reason } = req.body;
  // In a real app, this would insert into a 'dispute_log' table in Supabase
  console.log(`Dispute logged for claim ${claimId}: ${reason}`);
  res.json({ success: true, message: "Dispute submitted for manual review" });
});

// --- 6-Layer Verification Orchestrator ---
app.post("/api/claims/verify-all", async (req, res) => {
  const { claimData, workerData } = req.body;
  
  // This orchestrates L1-L6
  // L1: Environmental Trigger (Already checked by ML)
  // L2: Mobility Veto (Already checked by ML)
  // L3: Order Fingerprint
  const l3_pass = workerData.orderPings > 0;
  // L4: Location Proof
  const l4_pass = workerData.gpsInZone;
  // L5: Anomaly Detection (Already checked by ML)
  const l5_pass = claimData.fraud_score < 0.4;
  // L6: Payout Execution (Razorpay)
  const l6_pass = true; // Mocked

  const results = {
    l1: true, // Mocked
    l2: true, // Mocked
    l3: l3_pass,
    l4: l4_pass,
    l5: l5_pass,
    l6: l6_pass
  };

  const allPassed = Object.values(results).every(val => val === true);
  
  res.json({
    allPassed,
    results
  });
});

// --- Razorpay Endpoints ---

app.post("/api/razorpay/create-subscription", async (req, res) => {
  try {
    // Simulate UPI Autopay subscription creation
    // In a real app, you'd create a plan and then a subscription
    const subscription = await razorpay.subscriptions.create({
      plan_id: "plan_placeholder", // Replace with actual plan ID
      customer_notify: 1,
      total_count: 12,
      start_at: Math.floor(Date.now() / 1000) + 86400, // Starts tomorrow
    });
    res.json(subscription);
  } catch (error: any) {
    // Since we don't have a real plan_id, we'll mock a success response for the UI
    res.json({
      id: "sub_" + Math.random().toString(36).substring(7),
      status: "created",
      short_url: "https://rzp.io/i/mock",
    });
  }
});

// --- OAuth Endpoints (Simulated Partner Portals) ---
app.get("/api/auth/url", (req, res) => {
  console.log("OAuth URL requested for provider:", req.query.provider);
  const { provider } = req.query; // blinkit, swiggy, amazon
  const redirectUri = `${req.protocol}://${req.get("host")}/auth/callback`;
  
  // Simulate an OAuth authorization URL
  const authUrl = `${req.protocol}://${req.get("host")}/api/auth/mock-provider?provider=${provider}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  res.json({ url: authUrl });
});

app.get("/api/auth/mock-provider", (req, res) => {
  const { provider, redirect_uri } = req.query;
  // This is a mock UI that the popup will render
  res.send(`
    <html>
      <head><title>Login to ${provider}</title></head>
      <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #f9fafb;">
        <div style="background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
          <h2 style="margin-top: 0;">Connect your ${provider} account</h2>
          <p style="color: #6b7280; margin-bottom: 2rem;">Nexus Sovereign is requesting access to your delivery profile.</p>
          <button onclick="window.location.href='${redirect_uri}?code=mock_auth_code_123&provider=${provider}'" style="background: #10b981; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: bold; cursor: pointer; width: 100%;">
            Authorize & Connect
          </button>
        </div>
      </body>
    </html>
  `);
});

app.get("/auth/callback", (req, res) => {
  const { code, provider } = req.query;
  
  // Simulate token exchange
  const mockPartnerId = `${provider}_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  
  res.send(`
    <html>
      <body>
        <script>
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'OAUTH_AUTH_SUCCESS', 
              payload: { provider: '${provider}', partnerId: '${mockPartnerId}' }
            }, '*');
            window.close();
          } else {
            window.location.href = '/';
          }
        </script>
        <p>Authentication successful. This window should close automatically.</p>
      </body>
    </html>
  `);
});

// --- Full ML Pipeline Integration (Python Microservice) ---

const PYTHON_ML_URL = "http://127.0.0.1:8005";
const ML_SERVICE_TOKEN = process.env.ML_SERVICE_TOKEN || "dummy-token";

// 1. Predictive Oracle (Dual-Head LSTM)
app.post("/api/ml/predictive-oracle", async (req, res) => {
  try {
    const response = await axios.post(`${PYTHON_ML_URL}/predict/oracle`, req.body, {
      headers: {
        Authorization: `Bearer ${ML_SERVICE_TOKEN}`
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error("ML Service Error:", error);
    res.status(500).json({ error: "Failed to reach ML engine" });
  }
});

// 2. Fraud Anomaly Detector (Isolation Forest)
app.post("/api/ml/fraud-anomaly", async (req, res) => {
  try {
    const response = await axios.post(`${PYTHON_ML_URL}/predict/fraud`, req.body, {
      headers: {
        Authorization: `Bearer ${ML_SERVICE_TOKEN}`
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error("ML Service Error:", error);
    res.status(500).json({ error: "Failed to reach ML engine" });
  }
});

// 3. Onboarding Risk Profiler (Random Forest)
app.post("/api/ml/risk-profiler", async (req, res) => {
  try {
    const response = await axios.post(`${PYTHON_ML_URL}/predict/risk`, req.body, {
      headers: {
        Authorization: `Bearer ${ML_SERVICE_TOKEN}`
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error("ML Service Error:", error);
    res.status(500).json({ error: "Failed to reach ML engine" });
  }
});

// 4. Weekly Premium Calculator (XGBoost Regression)
app.post("/api/ml/calculate-premium", async (req, res) => {
  try {
    const response = await axios.post(`${PYTHON_ML_URL}/predict/premium`, req.body, {
      headers: {
        Authorization: `Bearer ${ML_SERVICE_TOKEN}`
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error("ML Service Error:", error);
    res.status(500).json({ error: "Failed to reach ML engine" });
  }
});

// --- Actuarial & Business Logic ---

// Auto-trigger Engine (Parametric Insurance)
setInterval(async () => {
  console.log("[Auto-trigger] Checking for disruptions...");
  try {
    // 1. Fetch active workers (assuming a 'workers' table in Supabase)
    const { data: workers, error } = await supabaseServer
      .from('workers')
      .select('*')
      .eq('status', 'active');
    
    if (error) throw error;
    if (!workers) return;

    for (const worker of workers) {
      // 2. Check weather for worker's zone
      const weatherRes = await axios.get(`http://localhost:${PORT}/api/weather?lat=${worker.lat}&lon=${worker.lon}`);
      const weather = weatherRes.data;

      // Threshold: Rain
      if (weather.weather?.[0]?.main === 'Rain') {
        console.log(`[Auto-trigger] Disruption detected for worker ${worker.id}. Filing claim...`);
        
        // 3. Auto-create claim, run verification, fire Razorpay
        // This is a simplified sequence
        const claimResponse = await axios.post(`http://localhost:${PORT}/api/claims/auto-file`, {
          workerId: worker.id,
          trigger: "Heavy Rain"
        });
        
        if (claimResponse.data.success) {
          console.log(`[Auto-trigger] Claim filed and paid for worker ${worker.id}`);
        }
      }
    }
  } catch (error) {
    console.error("[Auto-trigger] Error:", error);
  }
}, 5 * 60 * 1000); // Every 5 minutes

// Mock Policy Store for Lockout Policy
const policyStore: Record<string, any> = {};

// Predictive Shield Notification
setInterval(async () => {
  // Check if it's Sunday night (e.g., 8 PM)
  const now = new Date();
  if (now.getDay() === 0 && now.getHours() === 20) {
    console.log("[Predictive Shield] Checking forecast...");
    
    // 1. Fetch active workers
    const { data: workers } = await supabaseServer
      .from('workers')
      .select('*')
      .eq('status', 'active');
    
    if (!workers) return;

    for (const worker of workers) {
      // 2. Check forecast
      const forecastRes = await axios.get(`http://localhost:${PORT}/api/weather/forecast?lat=${worker.lat}&lon=${worker.lon}`);
      const disruptionProb = forecastRes.data.disruptionProbability || 0;

      // 3. If > 70%, push notification
      if (disruptionProb > 0.7) {
        console.log(`[Predictive Shield] High disruption probability for worker ${worker.id}. Pushing notification...`);
        // Push notification logic here
      }
    }
  }
}, 60 * 60 * 1000); // Every hour

// Lockout Policy Check
app.post("/api/actuarial/check-lockout", (req, res) => {
  const { userId } = req.body;
  const policy = policyStore[userId];
  
  if (policy && policy.status === "terminated" && policy.term_remaining > 0) {
    res.json({ locked_out: true, message: "Barred from purchasing new policy until original term expires." });
  } else {
    res.json({ locked_out: false });
  }
});

// Pmax Solvency Formula
app.post("/api/actuarial/pmax", (req, res) => {
  const { w_base, income_loss_pct, b_res, n_active, t_w } = req.body;
  // Formula: P_payout = min(W_base * income_loss_pct, (B_res * 0.15 / N_active) * T_w)
  
  const standard_payout = w_base * (income_loss_pct / 100);
  const liquidity_safety_factor = 0.15;
  const available_pool_per_worker = (b_res * liquidity_safety_factor) / Math.max(1, n_active);
  const adjusted_pool_payout = available_pool_per_worker * t_w;

  const final_payout = Math.min(standard_payout, adjusted_pool_payout);
  const circuit_breaker_active = adjusted_pool_payout < standard_payout;

  res.json({
    formula: "P_payout = min(W_base * income_loss_pct, (B_res * 0.15 / N_active) * T_w)",
    standard_payout,
    adjusted_pool_payout,
    final_payout: Number(final_payout.toFixed(2)),
    circuit_breaker_active
  });
});

// 3-Year Revenue Projection
app.get("/api/actuarial/revenue-projection", (req, res) => {
  res.json({
    year_1: { workers: "10K", platforms: 1, revenue_cr: 3.6, milestone: "Prove the model. Build the data moat." },
    year_2: { workers: "100K", platforms: 3, sdk_licenses: 1, revenue_cr: 36.5, milestone: "Scale distribution. First carrier SDK license." },
    year_3: { workers: "500K", platforms: 3, sdk_licenses: 3, revenue_cr: 185, milestone: "Category leadership. Data moat mature." },
    tam: { market: "Indian non-life parametric", addressable_cr: 45000 }
  });
});

// --- Offline Queue Time-Shifted Validation ---
app.post("/api/claims/time-shifted", (req, res) => {
  const { claim_id, cached_gps, cached_shift_status, submitted_at, original_timestamp } = req.body;
  
  // In a real system, this would query historical weather/traffic databases for `original_timestamp`
  const timeDiffHours = (new Date(submitted_at).getTime() - new Date(original_timestamp).getTime()) / (1000 * 60 * 60);
  
  res.json({
    status: "validated",
    claim_id,
    time_shifted_hours: Number(timeDiffHours.toFixed(2)),
    historical_weather_match: true,
    historical_traffic_match: true,
    message: "Offline claim successfully validated against historical disruption data."
  });
});

// --- External APIs (Weather, AQI, Traffic) ---
app.get("/api/weather", async (req, res) => {
  const { lat, lon } = req.query;
  const apiKey = process.env.VITE_OPENWEATHER_API_KEY?.trim();
  
  const seed = (Number(lat) || 0) + (Number(lon) || 0);
  const isRainy = (Math.sin(seed) > 0.5);
  
  const mockWeather = {
    weather: [{ main: isRainy ? "Rain" : "Clear", description: isRainy ? "moderate rain" : "clear sky" }],
    main: { temp: 290 + (Math.cos(seed) * 10), humidity: 50 + (Math.sin(seed) * 30) },
    wind: { speed: 3 + Math.abs(Math.sin(seed) * 5) },
    mock: true
  };

  try {
    if (!apiKey || apiKey === 'placeholder_openweather_key' || apiKey === '') {
      return res.json(mockWeather);
    }

    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}`
    );
    res.json(response.data);
  } catch (error: any) {
    if (error.response && error.response.status === 401) {
      // Invalid API key, fallback to mock data silently
      return res.json(mockWeather);
    }
    console.error("Weather API Error:", error.message);
    return res.json(mockWeather);
  }
});

app.get("/api/aqi", async (req, res) => {
  const { lat, lon } = req.query;
  const token = process.env.AQI_TOKEN?.trim();
  
  try {
    if (!token) throw new Error("No AQI token");
    const response = await axios.get(`https://api.waqi.info/feed/geo:${lat};${lon}/?token=${token}`);
    if (response.data.status === "ok") {
      res.json({ aqi: response.data.data.aqi });
    } else {
      throw new Error("AQI API returned error status");
    }
  } catch (error: any) {
    if (error.response && error.response.status === 401) {
      return res.json({ aqi: 45 + Math.floor(Math.random() * 50), mock: true });
    }
    console.error("AQI API Error:", error.message);
    // Fallback AQI
    res.json({ aqi: 45 + Math.floor(Math.random() * 50), mock: true });
  }
});

app.get("/api/traffic", async (req, res) => {
  const { lat, lon } = req.query;
  const apiKey = process.env.HERE_TRAFFIC_API_KEY?.trim();
  
  try {
    if (!apiKey) throw new Error("No HERE Traffic API key");
    // Calculate a bounding box around the coordinates (approx 5km)
    const latNum = Number(lat);
    const lonNum = Number(lon);
    const bbox = `${lonNum - 0.05},${latNum - 0.05},${lonNum + 0.05},${latNum + 0.05}`;
    
    const response = await axios.get(`https://data.traffic.hereapi.com/v7/flow?locationReferencing=shape&in=bbox:${bbox}&apiKey=${apiKey}`);
    
    // Simple heuristic: check if there are any flow items and average their jam factor (0-10)
    let totalJam = 0;
    let count = 0;
    
    if (response.data?.results) {
      response.data.results.forEach((result: any) => {
        if (result.currentFlow?.jamFactor !== undefined) {
          totalJam += result.currentFlow.jamFactor;
          count++;
        }
      });
    }
    
    const avgJamFactor = count > 0 ? totalJam / count : 0;
    // Map jam factor (0-10) to a traffic density multiplier (0.5 to 2.0)
    const trafficDensity = 0.5 + (avgJamFactor / 10) * 1.5;
    
    res.json({ jamFactor: avgJamFactor, trafficDensity });
  } catch (error: any) {
    if (error.response && error.response.status === 401) {
      return res.json({ jamFactor: 2.5, trafficDensity: 1.0, mock: true });
    }
    console.error("Traffic API Error:", error.message);
    // Fallback traffic density
    res.json({ jamFactor: 2.5, trafficDensity: 1.0, mock: true });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
