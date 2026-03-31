print("Starting ML Service...")
from fastapi import FastAPI
from pydantic import BaseModel
import pickle
import joblib
import xgboost as xgb
import numpy as np
import uvicorn
import os
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

app = FastAPI(title="Nexus Sovereign ML Microservice")

security = HTTPBearer()
ML_SERVICE_TOKEN = os.environ.get("ML_SERVICE_TOKEN", "dummy-token")

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials.credentials != ML_SERVICE_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials.credentials

# Load models
print("Loading models...")
with open('models/isolation_forest.pkl', 'rb') as f:
    iso_model = pickle.load(f)
print("Models loaded.")
with open('models/random_forest.pkl', 'rb') as f:
    rf_model = pickle.load(f)
xgb_model = xgb.XGBRegressor()
xgb_model.load_model('models/xgboost_premium.json')

class OracleInput(BaseModel):
    zone_h3: str
    history_days: int = 84

class FraudInput(BaseModel):
    claim_data: dict

class RiskInput(BaseModel):
    platform: str
    declared_earnings: float
    device_age_months: int
    account_age_months: int

class PremiumInput(BaseModel):
    base_rate: float = 2.0
    traffic_density: float = 1.0
    weather_impact: float = 1.0
    elevation_risk: float = 1.0
    trust_score: float = 800.0
    persona: str = "Blinkit"

@app.post("/predict/oracle", dependencies=[Depends(verify_token)])
def predict_oracle(data: OracleInput):
    # Simulated Dual-Head LSTM logic
    seed = sum(ord(c) for c in data.zone_h3)
    prob = min(0.95, max(0.05, (seed % 100) / 100.0))
    return {
        "model": "Dual-Head LSTM",
        "zone": data.zone_h3,
        "disruption_probability": round(prob, 3),
        "surge_alert_active": prob > 0.7,
        "recommended_surge_premium": 15 if prob > 0.7 else 0
    }

@app.post("/predict/fraud", dependencies=[Depends(verify_token)])
def predict_fraud(data: FraudInput):
    cd = data.claim_data
    features = np.array([[
        cd.get('gps_distance_km', 0),
        cd.get('order_pings_last_60m', 10),
        cd.get('claims_last_7d', 0)
    ]])
    
    # Isolation forest returns 1 for normal, -1 for anomaly
    score = iso_model.decision_function(features)[0]
    
    # Normalize score roughly to 0-1 where >0.7 is bad
    anomaly_score = round(max(0, min(1, 0.5 - score)), 2)
    
    action = "payout"
    if anomaly_score > 0.7: action = "auto-reject"
    elif anomaly_score >= 0.4: action = "manual-review"
    
    return {
        "model": "Isolation Forest",
        "anomaly_score": anomaly_score,
        "action": action,
        "reasons": ["Anomaly detected by Isolation Forest"] if anomaly_score > 0.4 else []
    }

@app.post("/predict/risk", dependencies=[Depends(verify_token)])
def predict_risk(data: RiskInput):
    features = np.array([[data.declared_earnings, data.device_age_months, data.account_age_months]])
    risk_class = rf_model.predict(features)[0]
    
    tiers = ["Low", "Medium", "High"]
    waiting = [0, 48, 72]
    trust = [0.8, 0.6, 0.4]
    
    return {
        "model": "Random Forest",
        "initial_trust_score": trust[risk_class],
        "risk_tier": tiers[risk_class],
        "waiting_period_hrs": waiting[risk_class]
    }

@app.post("/predict/premium", dependencies=[Depends(verify_token)])
def predict_premium(data: PremiumInput):
    persona_map = {"Blinkit": 1.2, "Swiggy": 1.0, "Amazon": 0.8}
    p_val = persona_map.get(data.persona, 1.0)
    
    features = np.array([[data.base_rate, data.traffic_density, data.weather_impact, data.elevation_risk, data.trust_score, p_val]])
    premium = xgb_model.predict(features)[0]
    
    return {
        "model": "XGBoost Regression",
        "status": "success",
        "premium": round(float(premium), 2),
        "coverage_cap": round(float(premium) * 8.5, 0),
        "factors": {"trust_factor": data.trust_score/1000, "risk_multiplier": data.weather_impact}
    }

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8005)
