import React from "react";
import { Outlet, NavLink } from "react-router-dom";
import { Home, Shield, ReceiptText, User, Wallet } from "lucide-react";
import { cn } from "../lib/utils";

export default function MainLayout() {
  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>
      
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border/50 h-16 flex items-center justify-around px-2 z-50">
        <NavItem to="/home" icon={<Home size={20} />} label="HOME" />
        <NavItem to="/coverage" icon={<Shield size={20} />} label="COVERAGE" />
        <NavItem to="/claims" icon={<ReceiptText size={20} />} label="CLAIMS" />
        <NavItem to="/wallet" icon={<Wallet size={20} />} label="WALLET" />
        <NavItem to="/profile" icon={<User size={20} />} label="PROFILE" />
      </nav>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex flex-col items-center justify-center w-16 h-full space-y-1 transition-colors",
          isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )
      }
    >
      {icon}
      <span className="text-[10px] font-medium tracking-wider">{label}</span>
    </NavLink>
  );
}
