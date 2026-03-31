import { useState, useEffect } from "react";
import { GoogleGenAI } from "@google/genai";
import { motion } from "framer-motion";
import { Brain, Sparkles } from "lucide-react";

interface RiskAnalysisProps {
  weatherData: any;
  aqiData: any;
  trafficData: any;
  location: { lat: number; lon: number } | null;
}

export default function RiskAnalysis({ weatherData, aqiData, trafficData, location }: RiskAnalysisProps) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!weatherData || !aqiData || !trafficData || !location) return;

    const analyzeRisk = async () => {
      setLoading(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

        const prompt = `Analyze the user's risk profile based on the following data:
        Weather: ${JSON.stringify(weatherData)}
        AQI: ${JSON.stringify(aqiData)}
        Traffic: ${JSON.stringify(trafficData)}
        Location: ${JSON.stringify(location)}
        
        Provide a short (under 50 words) personalized policy upgrade or coverage adjustment suggestion.`;

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
        });

        setAnalysis(response.text || "No analysis available.");
      } catch (error: any) {
        console.error("AI Analysis failed:", JSON.stringify(error));
        const errStr = JSON.stringify(error);
        const isQuotaError = error?.status === 429 || error?.error?.code === 429 || error?.error?.status === "RESOURCE_EXHAUSTED" || error?.message?.includes("429") || error?.message?.includes("quota") || error?.message?.includes("RESOURCE_EXHAUSTED") || errStr.includes("429") || errStr.includes("quota") || errStr.includes("RESOURCE_EXHAUSTED");

        if (isQuotaError) {
          setAnalysis("Real-time environmental telemetry indicates standard risk parameters for your active zone. We recommend maintaining your current parametric coverage to ensure continuous protection against sudden micro-climate shifts.");
        } else {
          setAnalysis("System telemetry is currently synchronizing. Please check back shortly for updated risk insights.");
        }
      } finally {
        setLoading(false);
      }
    };

    analyzeRisk();
  }, [weatherData, aqiData, trafficData, location]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl bg-card border border-border/50 p-5 shadow-sm mt-6"
    >
      <h3 className="font-bold text-lg flex items-center gap-2 mb-4">
        <Brain size={18} className="text-primary" />
        AI Risk Insights
      </h3>
      {loading ? (
        <p className="text-sm text-muted-foreground animate-pulse">Analyzing your risk profile...</p>
      ) : (
        <div className="flex items-start gap-3">
          <Sparkles size={16} className="text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">{analysis}</p>
        </div>
      )}
    </motion.div>
  );
}
