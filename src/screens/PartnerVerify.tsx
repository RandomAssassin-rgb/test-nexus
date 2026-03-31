import { motion } from "framer-motion";
import { ArrowLeft, Bell, Fingerprint, ShieldCheck, Link2, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

export default function PartnerVerify() {
  const navigate = useNavigate();
  const [partnerId, setPartnerId] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [provider, setProvider] = useState("Blinkit");
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin is from AI Studio preview or localhost
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setPartnerId(event.data.payload.partnerId);
        setIsConnecting(false);
        setIsConnected(true);
        // Automatically proceed to OTP after a short delay
        setTimeout(() => navigate("/otp"), 1500);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate]);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      const response = await fetch(`/api/auth/url?provider=${provider}`);
      if (!response.ok) throw new Error('Failed to get auth URL');
      const { url } = await response.json();

      const authWindow = window.open(
        url,
        'oauth_popup',
        'width=600,height=700'
      );

      if (!authWindow) {
        alert('Please allow popups for this site to connect your account.');
        setIsConnecting(false);
      }
    } catch (error) {
      console.error('OAuth error details:', error);
      alert(`OAuth error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsConnecting(false);
    }
  };

  const handleVerify = async () => {
    if (partnerId.length > 3) {
      try {
        const response = await fetch("/api/partner/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ partnerId, platform: provider }),
        });
        const data = await response.json();
        if (!data.verified) throw new Error(data.message);
        
        navigate("/otp");
      } catch (error: any) {
        alert("Verification failed: " + error.message);
      }
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
          <div className="h-1 w-8 bg-primary rounded-full" />
          <div className="h-1 w-2 bg-secondary rounded-full" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Fingerprint className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-3">
            Verify Partner ID
          </h1>
          <p className="text-muted-foreground">
            Connect your {provider} account to sync your earning history securely.
          </p>
        </motion.div>

        <div className="space-y-6 flex-1">
          <div className="flex gap-2 mb-6">
            {['Blinkit', 'Swiggy', 'Amazon'].map((p) => (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${
                  provider === p 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {!isConnected ? (
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full bg-card border border-primary/50 text-primary font-semibold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/10 transition-colors"
            >
              {isConnecting ? (
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Link2 size={20} />
                  Connect {provider} Account
                </>
              )}
            </button>
          ) : (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center gap-2">
              <CheckCircle2 className="text-emerald-500" size={32} />
              <p className="font-bold text-emerald-500">Account Connected</p>
              <p className="text-xs text-muted-foreground font-mono">ID: {partnerId}</p>
            </div>
          )}

          <div className="flex items-center gap-4 my-6">
            <div className="h-px bg-border/50 flex-1" />
            <span className="text-xs text-muted-foreground font-bold uppercase">OR ENTER MANUALLY</span>
            <div className="h-px bg-border/50 flex-1" />
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
              Partner ID
            </label>
            <input
              type="text"
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
              placeholder="e.g. BLK-98234"
              className="w-full bg-card border border-border/50 rounded-xl p-4 text-lg font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>

          <div className="p-4 rounded-2xl bg-secondary/50 border border-border/50 flex gap-3">
            <ShieldCheck className="text-primary shrink-0 mt-0.5" size={18} />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your data is encrypted end-to-end. We only access payout history to calculate your Sovereign Shield premium.
            </p>
          </div>
        </div>

        <button
          onClick={handleVerify}
          disabled={partnerId.length < 4}
          className="w-full bg-primary text-primary-foreground font-semibold py-4 rounded-xl mt-8 hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25 disabled:opacity-50 disabled:shadow-none"
        >
          Verify ID
        </button>
      </main>
    </div>
  );
}
