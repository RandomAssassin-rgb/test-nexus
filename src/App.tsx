import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ThemeProvider } from "./components/theme-provider";
import { supabase } from "./lib/supabase";
import Splash from "./screens/Splash";
import PlatformSelect from "./screens/PlatformSelect";
import PartnerVerify from "./screens/PartnerVerify";
import OTPVerify from "./screens/OTPVerify";
import FaceVerification from "./screens/FaceVerification";
import UPILink from "./screens/UPILink";
import MainLayout from "./components/MainLayout";
import Home from "./screens/Home";
import Coverage from "./screens/Coverage";
import Claims from "./screens/Claims";
import Profile from "./screens/Profile";
import ClaimEvidence from "./screens/ClaimEvidence";
import FileClaim from "./screens/FileClaim";
import PayoutSuccess from "./screens/PayoutSuccess";
import Wallet from "./screens/Wallet";
import AdminDashboard from "./screens/AdminDashboard";
import JEPScreen from "./screens/JEPScreen";

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for a dummy session
    const dummySession = localStorage.getItem('dummy_session');
    if (dummySession) {
      try {
        setSession(JSON.parse(dummySession));
      } catch (e) {
        console.error("Failed to parse session", e);
        localStorage.removeItem('dummy_session');
      }
    }
    setLoading(false);

    // Listen for custom login/logout events
    const handleAuthChange = () => {
      const updatedSession = localStorage.getItem('dummy_session');
      setSession(updatedSession ? JSON.parse(updatedSession) : null);
    };

    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="nexus-theme">
      <Router>
        <Routes>
          <Route path="/" element={session ? <Navigate to="/home" replace /> : <Splash />} />
          <Route path="/platform" element={<PlatformSelect />} />
          <Route path="/verify" element={<PartnerVerify />} />
          <Route path="/otp" element={<OTPVerify />} />
          <Route path="/biometrics" element={<FaceVerification />} />
          
          {/* Protected Routes */}
          <Route path="/upi" element={session ? <UPILink /> : <Navigate to="/" replace />} />
          
          <Route element={session ? <MainLayout /> : <Navigate to="/" replace />}>
            <Route path="/home" element={<Home />} />
            <Route path="/coverage" element={<Coverage />} />
            <Route path="/claims" element={<Claims />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/wallet" element={<Wallet />} />
          </Route>
          
          <Route path="/file-claim" element={session ? <FileClaim /> : <Navigate to="/" replace />} />
          <Route path="/claim-evidence/:id" element={session ? <ClaimEvidence /> : <Navigate to="/" replace />} />
          <Route path="/claim-evidence" element={session ? <ClaimEvidence /> : <Navigate to="/" replace />} />
          <Route path="/payout-success/:id" element={session ? <PayoutSuccess /> : <Navigate to="/" replace />} />
          <Route path="/payout-success" element={session ? <PayoutSuccess /> : <Navigate to="/" replace />} />
          <Route path="/admin" element={session ? <AdminDashboard /> : <Navigate to="/" replace />} />
          <Route path="/jep/:id" element={session ? <JEPScreen /> : <Navigate to="/" replace />} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}
