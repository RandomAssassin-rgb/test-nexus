import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { cn } from "../lib/utils";

export default function VerificationPanel({ progress }: { progress: number }) {
  const layers = [
    { id: 'L1', name: 'Biometric', icon: ShieldCheck },
    { id: 'L2', name: 'Geo-Fence', icon: ShieldCheck },
    { id: 'L3', name: 'Time-Stamp', icon: ShieldCheck },
    { id: 'L4', name: 'Device-ID', icon: ShieldCheck },
    { id: 'L5', name: 'Network-Hash', icon: ShieldCheck },
    { id: 'L6', name: 'AI-Analysis', icon: ShieldCheck },
  ];
  
  return (
    <div className="w-full max-w-md mx-auto p-6 bg-card rounded-3xl shadow-xl border border-border/50">
      <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
        <ShieldCheck className="text-primary" />
        Verification Engine
      </h3>
      <div className="space-y-3">
        <AnimatePresence>
          {layers.map((layer, index) => {
            const isPassed = progress > (index + 1) * 16.6;
            const isProcessing = progress > index * 16.6 && progress <= (index + 1) * 16.6;
            const isPending = progress <= index * 16.6;
            
            return (
              <motion.div 
                key={layer.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.2, duration: 0.5 }}
                className={cn(
                  "flex items-center p-4 rounded-2xl border transition-all duration-300",
                  isPassed ? "bg-emerald-500/10 border-emerald-500/30" : 
                  isProcessing ? "bg-primary/5 border-primary/30" : "bg-muted/50 border-border/20"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center mr-4",
                  isPassed ? "bg-emerald-500/20" : isProcessing ? "bg-primary/20" : "bg-muted"
                )}>
                  {isPassed ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  ) : isProcessing ? (
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                  ) : (
                    <span className="font-bold text-muted-foreground">{layer.id}</span>
                  )}
                </div>
                <div className="flex-1">
                  <span className={cn(
                    "font-semibold",
                    isPassed ? "text-emerald-500" : isProcessing ? "text-primary" : "text-muted-foreground"
                  )}>
                    {layer.name}
                  </span>
                  {isProcessing && <p className="text-xs text-primary/70">Analyzing...</p>}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}