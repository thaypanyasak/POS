import React from 'react';
import { Storefront, Sparkle } from '@phosphor-icons/react';

export default function AuthLoadingSplash() {
  return (
    <div className="fixed inset-0 z-[300] bg-gradient-to-br from-slate-50 via-teal-50/20 to-slate-100 flex flex-col items-center justify-center p-6 text-slate-800 select-none overflow-hidden font-sans">
      {/* Dynamic Background Ambient Glow Orbs */}
      <div
        className="absolute -top-32 -left-32 w-80 h-80 bg-teal-400/15 rounded-full blur-3xl pointer-events-none animate-pulse"
        style={{ animationDuration: '4s' }}
      />
      <div
        className="absolute -bottom-32 -right-32 w-80 h-80 bg-emerald-400/15 rounded-full blur-3xl pointer-events-none animate-pulse"
        style={{ animationDuration: '5s' }}
      />

      {/* Main Glassmorphism Card - Compact, Clean & Minimal */}
      <div className="relative z-10 w-full max-w-xs bg-white/90 backdrop-blur-2xl rounded-3xl p-7 border border-white/80 shadow-[0_20px_50px_-15px_rgba(13,148,136,0.18)] flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
        
        {/* Animated Brand Emblem with Orbiting Rings */}
        <div className="relative mb-5 flex items-center justify-center">
          {/* Outer Pulsing Wave */}
          <div
            className="absolute inset-0 rounded-3xl bg-teal-500/20 animate-ping opacity-30"
            style={{ animationDuration: '2.5s' }}
          />
          
          {/* Orbiting Dashed Ring */}
          <div className="absolute -inset-2.5 rounded-3xl border-2 border-dashed border-teal-500/40 animate-spin-slow pointer-events-none" />

          {/* Center Brand Icon Badge */}
          <div className="relative w-18 h-18 rounded-2xl bg-gradient-to-tr from-teal-700 via-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-xl shadow-teal-600/30 animate-float-gentle">
            <Storefront size={38} weight="fill" className="drop-shadow-sm" />
            
            {/* Sparkle Accent */}
            {/* <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center shadow-sm animate-pulse">
              <Sparkle size={11} weight="fill" />
            </div> */}
          </div>
        </div>

        {/* Brand Name */}
        <h1 className="text-lg font-black tracking-tight text-slate-900 mb-4">
          MeiiShop POS
        </h1>

        {/* High-End Fluid Shimmer Loading Bar */}
        <div className="w-full max-w-[180px] mb-3">
          <div className="relative h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/80 p-0.5 shadow-inner">
            <div className="h-full w-full bg-slate-100 rounded-full overflow-hidden relative">
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-teal-500 to-transparent animate-shimmer-beam rounded-full" />
            </div>
          </div>
        </div>

        {/* Status Text with Animated Bouncing Dots */}
        <div className="flex items-center justify-center gap-1 text-xs font-bold text-slate-600">
          <span>ກຳລັງກວດສອບການເຂົ້າສູ່ລະບົບ</span>
          <span className="inline-flex tracking-wider text-teal-600 font-black">
            <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
            <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
            <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
          </span>
        </div>
      </div>
    </div>
  );
}
