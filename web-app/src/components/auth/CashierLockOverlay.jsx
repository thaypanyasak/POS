import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  LockOpen,
  User,
  Users,
  Backspace,
  ShieldCheck,
  CheckCircle,
  Warning,
  Storefront,
  X,
} from '@phosphor-icons/react';
import { useAuth } from '../../contexts/AuthContext';
import { playActionClickBeep } from '../../utils/audioFeedback';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export default function CashierLockOverlay() {
  const {
    isLocked,
    activeCashier,
    activeCashiersList,
    unlockWithPin,
    unlockPos,
    switchCashier,
  } = useAuth();

  const [pin, setPin] = useState('');
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shake, setShake] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Clock tick every second
  useEffect(() => {
    if (!isLocked) return;
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [isLocked]);

  // Set initial selected staff to active cashier
  useEffect(() => {
    if (activeCashier) {
      setSelectedStaff(activeCashier);
    } else if (activeCashiersList.length > 0) {
      setSelectedStaff(activeCashiersList[0]);
    }
    setPin('');
    setErrorMsg(null);
  }, [isLocked, activeCashier, activeCashiersList]);

  // Handle hardware keyboard digit typing
  useEffect(() => {
    if (!isLocked) return;

    const handleKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, pin, isSubmitting]);

  // Auto submit when 4 digits entered
  useEffect(() => {
    if (pin.length === 4 && !isSubmitting) {
      verifyAndUnlock(pin);
    }
  }, [pin]);

  const triggerHaptic = async (style = ImpactStyle.Light) => {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.impact({ style });
      } catch (_) {}
    }
  };

  const handleDigit = (digit) => {
    if (pin.length >= 6 || isSubmitting) return;
    playActionClickBeep();
    triggerHaptic(ImpactStyle.Light);
    setErrorMsg(null);
    setPin((prev) => prev + digit);
  };

  const handleBackspace = () => {
    if (isSubmitting) return;
    playActionClickBeep();
    triggerHaptic(ImpactStyle.Light);
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const handleClear = () => {
    playActionClickBeep();
    triggerHaptic(ImpactStyle.Medium);
    setPin('');
    setErrorMsg(null);
  };

  const verifyAndUnlock = async (enteredPin) => {
    setIsSubmitting(true);
    setErrorMsg(null);

    let res;
    if (selectedStaff?.id && selectedStaff.id !== activeCashier?.id) {
      // Switch to selected staff
      res = await switchCashier(selectedStaff.id, enteredPin);
    } else {
      // Unlock current session
      res = await unlockWithPin(enteredPin);
    }

    if (!res.success) {
      setErrorMsg(res.error || 'ລະຫັດ PIN ບໍ່ຖືກຕ້ອງ!');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPin('');
      if (Capacitor.isNativePlatform()) {
        try {
          await Haptics.notification({ type: NotificationType.Error });
        } catch (_) {}
      }
    } else {
      if (Capacitor.isNativePlatform()) {
        try {
          await Haptics.notification({ type: NotificationType.Success });
        } catch (_) {}
      }
    }
    setIsSubmitting(false);
  };

  if (!isLocked) return null;

  const staffDisplayName = selectedStaff?.full_name || activeCashier?.full_name || 'Staff';
  const staffRole = selectedStaff?.role || activeCashier?.role || 'cashier';

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-md flex flex-col justify-between items-center p-4 sm:p-6 text-white select-none animate-in fade-in duration-200">
      {/* Top Header: Clock & Branding */}
      <div className="w-full max-w-sm flex items-center justify-between pt-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <Storefront size={20} weight="fill" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight text-slate-100">MeiiShop POS</h1>
            <p className="text-[11px] text-teal-400 font-mono">ລະບົບຂາຍໜ້າຮ້ານຖືກລັອກ</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-mono font-bold text-slate-200">
              {currentTime.toLocaleTimeString('lo-LA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-[10px] text-slate-400">
              {currentTime.toLocaleDateString('lo-LA', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              playActionClickBeep();
              unlockPos();
            }}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-slate-700 active:scale-95 shadow-xs"
            title="ປິດໜ້າຈໍລັອກ (Đóng khóa màn hình)"
          >
            <X size={16} weight="bold" />
          </button>
        </div>
      </div>

      {/* Center Box: Cashier Avatar, PIN Display & Tactile Numpad */}
      <div className={`w-full max-w-xs flex flex-col items-center my-auto ${shake ? 'animate-shake' : ''}`}>
        {/* Staff Card Avatar */}
        <div className="flex flex-col items-center mb-5">
          <div className="relative mb-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-teal-700 to-emerald-500 border-2 border-teal-300/40 flex items-center justify-center shadow-lg shadow-teal-900/40 text-white font-black text-2xl">
              {staffDisplayName.charAt(0)}
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-900 border-2 border-slate-800 flex items-center justify-center text-amber-400 shadow-xs">
              <Lock size={12} weight="fill" />
            </div>
          </div>

          <h2 className="text-base font-black text-slate-100 text-center tracking-tight">
            {staffDisplayName}
          </h2>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase font-mono ${
                staffRole === 'admin'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
              }`}
            >
              {staffRole === 'admin' ? 'ຜູ້ຈັດການ (Admin)' : 'ພະນັກງານຂາຍ (Cashier)'}
            </span>
          </div>
        </div>

        {/* PIN Dots Display */}
        <div className="flex items-center justify-center gap-3.5 mb-2">
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = pin.length > idx;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-150 ${
                  isFilled
                    ? 'bg-teal-400 scale-110 shadow-md shadow-teal-400/50 ring-2 ring-teal-300/60'
                    : 'bg-slate-800 border border-slate-700'
                }`}
              />
            );
          })}
        </div>

        {/* Error message */}
        <div className="h-5 mb-3 flex items-center justify-center">
          {errorMsg ? (
            <p className="text-rose-400 text-xs font-bold flex items-center gap-1 animate-in fade-in">
              <Warning size={14} weight="fill" />
              <span>{errorMsg}</span>
            </p>
          ) : (
            <p className="text-slate-400 text-[11px] font-medium">
              ປ້ອນລະຫັດ PIN 4 ຕົວເລກເພື່ອປົດລັອກ
            </p>
          )}
        </div>

        {/* Tactile Numpad */}
        <div className="grid grid-cols-3 gap-2.5 w-full">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleDigit(String(num))}
              disabled={isSubmitting}
              className="h-14 rounded-2xl bg-slate-900/90 hover:bg-slate-800 active:bg-teal-700/60 border border-slate-800 hover:border-slate-700 text-xl font-bold font-mono text-slate-100 flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
            >
              {num}
            </button>
          ))}

          {/* Clear Button */}
          <button
            type="button"
            onClick={handleClear}
            disabled={isSubmitting || pin.length === 0}
            className="h-14 rounded-2xl bg-slate-900/40 hover:bg-slate-800 border border-slate-800/80 text-xs font-bold text-slate-400 hover:text-slate-200 flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-30"
          >
            ລຶບ (C)
          </button>

          {/* Zero Button */}
          <button
            type="button"
            onClick={() => handleDigit('0')}
            disabled={isSubmitting}
            className="h-14 rounded-2xl bg-slate-900/90 hover:bg-slate-800 active:bg-teal-700/60 border border-slate-800 hover:border-slate-700 text-xl font-bold font-mono text-slate-100 flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
          >
            0
          </button>

          {/* Backspace Button */}
          <button
            type="button"
            onClick={handleBackspace}
            disabled={isSubmitting || pin.length === 0}
            className="h-14 rounded-2xl bg-slate-900/40 hover:bg-slate-800 border border-slate-800/80 text-slate-300 flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-30"
            title="Backspace"
          >
            <Backspace size={20} weight="bold" />
          </button>
        </div>
      </div>

      {/* Bottom Switch Staff Quick Bar */}
      {activeCashiersList && activeCashiersList.length > 1 && (
        <div className="w-full max-w-sm border-t border-slate-800/80 pt-3 flex flex-col items-center">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
            <Users size={12} weight="bold" />
            <span>ປ່ຽນຄົນຂາຍ (Switch Cashier)</span>
          </span>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full pb-1">
            {activeCashiersList.map((st) => {
              const isCurrent = selectedStaff?.id === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    playActionClickBeep();
                    setSelectedStaff(st);
                    setPin('');
                    setErrorMsg(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap border ${
                    isCurrent
                      ? 'bg-teal-600 text-white border-teal-500 shadow-sm'
                      : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[9px] font-black">
                    {st.full_name?.charAt(0)}
                  </div>
                  <span>{st.full_name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
