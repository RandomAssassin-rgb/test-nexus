import { motion } from "framer-motion";
import { ArrowLeft, Shield, Camera, CheckCircle2, AlertCircle, Fingerprint, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useRef, useEffect, useCallback } from "react";
import Webcam from "react-webcam";
import * as faceapi from "face-api.js";
import { cn } from "../lib/utils";

export default function FaceVerification() {
  const navigate = useNavigate();
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [status, setStatus] = useState<"idle" | "scanning" | "success" | "failed">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [showNoFaceWarning, setShowNoFaceWarning] = useState(false);

  // Load models from CDN
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setIsModelLoaded(true);
      } catch (error) {
        console.error("Failed to load face-api models:", error);
        setErrorMessage("Failed to initialize biometric system.");
      }
    };
    loadModels();
  }, []);

  const handleVerify = async () => {
    if (!webcamRef.current || !isModelLoaded) return;

    setIsVerifying(true);
    setStatus("scanning");
    setProgress(0);
    setErrorMessage("");
    setShowNoFaceWarning(false);

    const startTime = Date.now();
    let isScanning = true;

    // Simulate progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return 90; // Hold at 90% until success
        return prev + 5;
      });
    }, 500);

    try {
      while (isScanning) {
        if (!webcamRef.current) break; // Component unmounted

        if (Date.now() - startTime > 60000) {
          throw new Error("Verification timed out. Please try again.");
        }

        if (Date.now() - startTime > 5000) {
          setShowNoFaceWarning(true);
        }

        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) {
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }

        const img = await faceapi.fetchImage(imageSrc);
        const detections = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();

        if (!detections) {
          await new Promise(resolve => setTimeout(resolve, 200));
          continue;
        }

        // Face detected!
        setShowNoFaceWarning(false);

        // Draw landmarks on canvas
        if (canvasRef.current && webcamRef.current && webcamRef.current.video) {
          const video = webcamRef.current.video;
          const canvas = canvasRef.current;
          const displaySize = { width: video.videoWidth, height: video.videoHeight };
          
          canvas.width = displaySize.width;
          canvas.height = displaySize.height;
          
          faceapi.matchDimensions(canvas, displaySize);
          const resizedDetections = faceapi.resizeResults(detections, displaySize);
          
          // Clear previous drawings
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Draw bounding box
          const box = resizedDetections.detection.box;
          const drawBox = new faceapi.draw.DrawBox(box, { 
            label: 'Face Detected', 
            lineWidth: 2, 
            boxColor: '#10B981' // Emerald 500
          });
          drawBox.draw(canvas);

          // Draw the landmarks
          faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
        }

        const savedDescriptorStr = localStorage.getItem("face_descriptor");
        const savedFaceImage = localStorage.getItem("face_image");

        if (!savedDescriptorStr || !savedFaceImage) {
          // First time: Save face
          localStorage.setItem("face_descriptor", JSON.stringify(Array.from(detections.descriptor)));
          localStorage.setItem("face_image", imageSrc);
          
          // Update profile picture in local storage
          const session = JSON.parse(localStorage.getItem("dummy_session") || "{}");
          session.user = { ...session.user, photoURL: imageSrc };
          localStorage.setItem("dummy_session", JSON.stringify(session));
          
          setProgress(100);
          setStatus("success");
          isScanning = false;
          setTimeout(() => navigate("/home"), 1500);
        } else {
          // Subsequent times: Compare
          const savedDescriptor = new Float32Array(JSON.parse(savedDescriptorStr));
          const distance = faceapi.euclideanDistance(detections.descriptor, savedDescriptor);

          // Configurable threshold
          const matchThreshold = parseFloat(import.meta.env.VITE_FACE_MATCH_THRESHOLD || "0.5");

          if (distance < matchThreshold) {
            setProgress(100);
            setStatus("success");
            isScanning = false;
            setTimeout(() => navigate("/home"), 1500);
          } else {
            throw new Error("Face mismatch. Access denied. Logging out...");
          }
        }
      }
    } catch (error: any) {
      console.error("Verification error:", error);
      
      if (error.message.includes("timed out")) {
        setStatus("idle");
        setErrorMessage(error.message);
      } else {
        setStatus("failed");
        setErrorMessage(error.message || "Verification failed.");
      }
      
      // Clear canvas on error
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      
      if (error.message.includes("Face mismatch")) {
        // Log out if face mismatch
        setTimeout(() => {
          localStorage.removeItem("dummy_session");
          window.dispatchEvent(new Event("auth-change"));
          navigate("/");
        }, 2500);
      }
    } finally {
      setIsVerifying(false);
      clearInterval(interval);
      setShowNoFaceWarning(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col font-sans">
      {/* Header */}
      <header className="flex items-center justify-between p-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
          <ArrowLeft size={24} className="text-[#D4A056]" />
        </button>
        <h1 className="text-xl font-semibold tracking-tight">Identity Verification</h1>
        <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center">
          <Lock size={18} className="text-[#D4A056]" />
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-6 pt-12">
        <div className="text-center mb-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#D4A056]/60 mb-2">Biometric Shield</p>
          <h2 className="text-4xl font-bold tracking-tight">Secure Access</h2>
        </div>

        {/* Camera Frame */}
        <div className="relative w-full max-w-[320px] aspect-square mb-12">
          {/* Decorative Corners */}
          <div className="absolute -top-2 -right-2 w-12 h-12 border-t-2 border-r-2 border-[#D4A056]/40 rounded-tr-2xl" />
          <div className="absolute -bottom-2 -left-2 w-12 h-12 border-b-2 border-l-2 border-[#D4A056]/40 rounded-bl-2xl" />

          {/* Circular Frame */}
          <div className={cn(
            "w-full h-full rounded-full border-4 p-2 transition-colors duration-500 overflow-hidden relative",
            status === "scanning" && !showNoFaceWarning ? "border-[#D4A056] animate-pulse" : 
            status === "scanning" && showNoFaceWarning ? "border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.6)] animate-pulse" :
            status === "success" ? "border-emerald-500" :
            status === "failed" ? "border-destructive" : "border-[#D4A056]/20"
          )}>
            <div className="w-full h-full rounded-full overflow-hidden bg-black/40 relative">
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "user" }}
                className="w-full h-full object-cover grayscale opacity-60"
                mirrored={false}
                screenshotQuality={0.92}
                imageSmoothing={true}
                forceScreenshotSourceSize={false}
                disablePictureInPicture={true}
                onUserMedia={() => {}}
                onUserMediaError={() => {}}
              />
              
              {/* Canvas for Landmarks */}
              <canvas 
                ref={canvasRef} 
                className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none" 
              />
              
              {/* Overlay Pattern */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-20">
                <div className="w-48 h-48 border border-[#D4A056]/30 rounded-full flex items-center justify-center">
                  <div className="w-32 h-32 border border-[#D4A056]/20 rounded-full" />
                </div>
              </div>

              {/* Scanning Line */}
              {status === "scanning" && (
                <motion.div
                  initial={{ top: "0%" }}
                  animate={{ top: "100%" }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="absolute left-0 right-0 h-0.5 bg-[#D4A056] shadow-[0_0_15px_#D4A056] z-10"
                />
              )}
            </div>
          </div>
        </div>

        <div className="text-center max-w-[280px] mb-12">
          <p className="text-white/60 text-lg leading-relaxed">
            {status === "idle" && (errorMessage || "Center your face within the frame for automatic authentication.")}
            {status === "scanning" && !showNoFaceWarning && "Analyzing facial features..."}
            {status === "scanning" && showNoFaceWarning && <span className="text-amber-500">No face detected. Please adjust your position.</span>}
            {status === "success" && "Identity verified successfully."}
            {status === "failed" && errorMessage}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full max-w-[320px] h-1 bg-white/5 rounded-full mb-12 overflow-hidden">
          <motion.div 
            className="h-full bg-[#D4A056]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
          />
        </div>

        {/* Action Button */}
        <button
          onClick={handleVerify}
          disabled={!isModelLoaded || isVerifying || status === "success"}
          className={cn(
            "w-full max-w-[320px] py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-2xl",
            status === "success" ? "bg-emerald-500 text-white" : "bg-[#D4A056] text-black hover:bg-[#E5B167]"
          )}
        >
          {status === "success" ? (
            <CheckCircle2 size={24} />
          ) : (
            <Fingerprint size={24} />
          )}
          {status === "success" ? "IDENTITY VERIFIED" : "VERIFY IDENTITY"}
        </button>

        <div className="mt-8 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/30">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Vault Connection: Secure
        </div>
      </main>
    </div>
  );
}
