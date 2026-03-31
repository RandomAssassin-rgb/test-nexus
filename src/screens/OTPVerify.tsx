import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Bell, KeyRound, Fingerprint } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function OTPVerify() {
  const navigate = useNavigate();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(0, 1);
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    if (otp.every((digit) => digit !== "")) {
      setLoading(true);
      try {
        const response = await fetch("/api/auth/aadhaar-otp/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: "dummy_phone", otp: otp.join("") }),
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.message);

        localStorage.setItem('dummy_session', JSON.stringify({ user: { id: '123', name: 'Rahul Kumar' } }));
        window.dispatchEvent(new Event('auth-change'));
        
        navigate("/biometrics");
      } catch (error: any) {
        console.error("Verification failed:", error);
        alert("Verification failed: " + error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBiometric = async () => {
    try {
      // In a real app, you would use navigator.credentials.get() here.
      // However, WebAuthn is not supported in cross-origin iframes without explicit permission policies.
      // For this prototype, we will simulate a successful biometric authentication.
      
      // Simulate a small delay for the "scan"
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Simulate successful biometric auth
      localStorage.setItem('dummy_session', JSON.stringify({ user: { id: '123', name: 'Rahul Kumar' } }));
      window.dispatchEvent(new Event('auth-change'));

      navigate("/biometrics");
    } catch (error) {
      console.error("Biometric auth failed", error);
      alert("Biometric authentication failed or is not supported.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between p-4 border-b border-border/10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-secondary rounded-full">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary/20 rounded-md flex items-center justify-center">
              <span className="text-primary text-xs font-bold">N</span>
            </div>
            <span className="font-bold tracking-tight">Nexus Sovereign</span>
          </div>
        </div>
        <button className="p-2 hover:bg-secondary rounded-full relative">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full" />
        </button>
      </header>

      <main className="flex-1 p-6 flex flex-col">
        <div className="flex justify-center gap-2 mb-8">
          <div className="h-1 w-2 bg-secondary rounded-full" />
          <div className="h-1 w-2 bg-secondary rounded-full" />
          <div className="h-1 w-8 bg-primary rounded-full" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <KeyRound className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-3">
            Enter OTP
          </h1>
          <p className="text-muted-foreground">
            We've sent a 6-digit code to your registered mobile number ending in **89.
          </p>
        </motion.div>

        <div className="flex justify-center gap-2 mb-8">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="number"
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-12 h-14 text-center text-2xl font-bold bg-card border border-border/50 rounded-xl focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          ))}
        </div>

        <div className="text-center mb-auto">
          <p className="text-sm text-muted-foreground mb-4">
            Didn't receive the code?
          </p>
          <button className="text-primary font-semibold text-sm hover:underline">
            Resend OTP
          </button>
        </div>

        <div className="flex flex-col gap-4 mt-8">
          <button
            onClick={handleBiometric}
            className="w-full bg-secondary text-foreground font-semibold py-4 rounded-xl hover:bg-secondary/80 transition-colors flex items-center justify-center gap-2"
          >
            <Fingerprint size={20} />
            Use Biometrics
          </button>
          
          <button
            onClick={handleVerify}
            disabled={!otp.every((digit) => digit !== "") || loading}
            className="w-full bg-primary text-primary-foreground font-semibold py-4 rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25 disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? "Verifying..." : "Confirm & Proceed"}
          </button>
        </div>
      </main>
    </div>
  );
}
