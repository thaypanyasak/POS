import React, { useState } from 'react';
import {
  Storefront,
  User,
  Users,
  ShieldCheck,
  Lock,
  Envelope,
  Eye,
  EyeSlash,
  Backspace,
  Warning,
  CheckCircle,
  Key,
  ArrowRight,
  ArrowLeft,
} from '@phosphor-icons/react';
import { useAuth } from '../../contexts/AuthContext';
import { playActionClickBeep, playSuccessBeep, playErrorBeep } from '../../utils/audioFeedback';

export default function LoginScreen() {
  const {
    activeCashiersList,
    switchCashier,
    login,
  } = useAuth();

  const [authMode, setAuthMode] = useState('pin'); // 'pin' | 'email'

  // PIN mode state
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(null);
  const [isPinSubmitting, setIsPinSubmitting] = useState(false);

  // Email mode state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState(null);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);

  // --- Handlers for PIN ---
  const handleSelectStaff = (st) => {
    playActionClickBeep();
    setSelectedStaff(st);
    setPin('');
    setPinError(null);
  };

  const handleDigit = (digit) => {
    if (pin.length >= 4 || isPinSubmitting) return;
    playActionClickBeep();
    setPinError(null);
    const nextPin = pin + digit;
    setPin(nextPin);
    if (nextPin.length === 4 && selectedStaff) {
      handleConfirmPin(nextPin);
    }
  };

  const handleBackspace = () => {
    playActionClickBeep();
    setPin((prev) => prev.slice(0, -1));
    setPinError(null);
  };

  const handleClear = () => {
    playActionClickBeep();
    setPin('');
    setPinError(null);
  };

  const handleConfirmPin = async (enteredPin = pin) => {
    if (!selectedStaff) {
      setPinError('ກະລຸນາເລືອກພະນັກງານ');
      return;
    }

    setIsPinSubmitting(true);
    setPinError(null);

    const res = await switchCashier(selectedStaff.id, enteredPin);
    setIsPinSubmitting(false);

    if (!res.success) {
      setPinError(res.error || 'ລະຫັດ PIN ບໍ່ຖືກຕ້ອງ!');
      setPin('');
    }
  };

  // --- Handlers for Email ---
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setEmailError('ກະລຸນາປ້ອນ Email ແລະ ລະຫັດຜ່ານ');
      return;
    }

    setIsEmailSubmitting(true);
    setEmailError(null);

    const res = await login(email, password);
    setIsEmailSubmitting(false);

    if (!res.success) {
      let friendly = res.error;
      if (res.error?.includes('Invalid login credentials')) {
        friendly = 'Email ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ!';
      }
      setEmailError(friendly);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] bg-gradient-to-br from-slate-100 via-teal-50/30 to-slate-200/90 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto font-sans select-none">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-radial from-teal-500/5 via-slate-100/50 to-slate-200/40 pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col text-slate-900 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 bg-gradient-to-br from-teal-800 via-teal-700 to-slate-900 text-white flex flex-col items-center text-center relative border-b border-teal-600/30">
          <div className="w-14 h-14 rounded-2xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300 mb-3 shadow-lg shadow-teal-950/30">
            <Storefront size={32} weight="fill" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-white">
            MeiiShop POS
          </h1>
          <p className="text-xs text-teal-100/80 mt-1">
            ກະລຸນາເຂົ້າສູ່ລະບົບເພື່ອເລີ່ມຕົ້ນການຂາຍໜ້າຮ້ານ
          </p>

          {/* Mode Switcher Tabs */}
          <div className="mt-4 p-1 bg-teal-950/50 rounded-xl flex items-center gap-1 border border-teal-700/40">
            <button
              type="button"
              onClick={() => {
                playActionClickBeep();
                setAuthMode('pin');
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                authMode === 'pin'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Key size={14} weight="bold" />
              <span>ເຂົ້າສູ່ລະບົບດ້ວຍ PIN</span>
            </button>
            <button
              type="button"
              onClick={() => {
                playActionClickBeep();
                setAuthMode('email');
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                authMode === 'email'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Envelope size={14} weight="bold" />
              <span>ເຂົ້າສູ່ລະບົບດ້ວຍ Email</span>
            </button>
          </div>
        </div>

        {/* Body: Mode 1 - PIN Login */}
        {authMode === 'pin' && (
          <div className="p-5 flex flex-col gap-4">
            {!selectedStaff ? (
              <>
                <div className="text-center mb-1">
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    ເລືອກພະນັກງານເຂົ້າປະຈຳການ
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    ກົດເລືອກຊື່ພະນັກງານດ້ານລຸ່ມເພື່ອປ້ອນລະຫັດ PIN
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
                  {activeCashiersList && activeCashiersList.length > 0 ? (
                    activeCashiersList.map((st) => {
                      const isAdm = st.role === 'admin';
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => handleSelectStaff(st)}
                          className="p-3 rounded-2xl bg-slate-50 hover:bg-teal-50/60 border border-slate-200 hover:border-teal-300 flex items-center justify-between transition-all cursor-pointer active:scale-98 shadow-2xs group text-left"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm text-white shrink-0 shadow-xs ${
                                isAdm
                                  ? 'bg-gradient-to-tr from-amber-600 to-amber-500'
                                  : 'bg-gradient-to-tr from-teal-600 to-emerald-500'
                              }`}
                            >
                              {st.full_name?.charAt(0) || 'S'}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-black text-slate-900 group-hover:text-teal-900 truncate">
                                {st.full_name}
                              </div>
                              <div className="text-[11px] text-slate-500 font-medium">
                                {isAdm ? 'ຜູ້ຈັດການ (Admin)' : 'ພະນັກງານຂາຍ (Cashier)'}
                              </div>
                            </div>
                          </div>

                          <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 group-hover:border-teal-300 text-slate-400 group-hover:text-teal-700 flex items-center justify-center shrink-0">
                            <ArrowRight size={15} weight="bold" />
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-center flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
                        <Users size={20} weight="bold" />
                      </div>
                      <p className="text-xs font-bold text-slate-700">ບໍ່ພົບລາຍຊື່ພະນັກງານ</p>
                      <p className="text-[11px] text-slate-400">ກະລຸນາເຂົ້າສູ່ລະບົບດ້ວຍ Email ຂອງ Admin</p>
                      <button
                        type="button"
                        onClick={() => {
                          playActionClickBeep();
                          setAuthMode('email');
                        }}
                        className="mt-1 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                      >
                        ເຂົ້າສູ່ລະບົບດ້ວຍ Email
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center">
                {/* Selected Staff Badge */}
                <div className="w-full flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-2xl mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-teal-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                      {selectedStaff.full_name?.charAt(0) || 'S'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-slate-900 truncate">
                        {selectedStaff.full_name}
                      </div>
                      <div className="text-[10px] text-teal-700 font-bold">
                        {selectedStaff.role === 'admin' ? 'Admin' : 'Cashier'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedStaff(null)}
                    className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-[10.5px] font-bold text-slate-600 flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft size={12} weight="bold" />
                    <span>ປ່ຽນຄົນ</span>
                  </button>
                </div>

                {/* PIN Dots */}
                <div className="flex items-center justify-center gap-3.5 py-2.5 mb-2">
                  {[0, 1, 2, 3].map((idx) => {
                    const isFilled = pin.length > idx;
                    return (
                      <div
                        key={idx}
                        className={`w-4 h-4 rounded-full transition-all duration-150 ${
                          isFilled
                            ? 'bg-teal-600 scale-110 shadow-xs'
                            : 'bg-slate-200 border border-slate-300'
                        }`}
                      />
                    );
                  })}
                </div>

                {/* Error */}
                <div className="h-5 mb-2 flex items-center justify-center">
                  {pinError ? (
                    <p className="text-rose-600 text-xs font-bold flex items-center gap-1 animate-in fade-in">
                      <Warning size={14} weight="fill" />
                      <span>{pinError}</span>
                    </p>
                  ) : (
                    <p className="text-slate-400 text-[11px] font-medium">
                      ປ້ອນລະຫັດ PIN 4 ຕົວເລກເພື່ອເຂົ້າສູ່ລະບົບ
                    </p>
                  )}
                </div>

                {/* Numpad */}
                <div className="grid grid-cols-3 gap-2 w-full max-w-[280px]">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleDigit(String(num))}
                      disabled={isPinSubmitting}
                      className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-teal-100 border border-slate-200 text-lg font-bold font-mono text-slate-800 flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleClear}
                    disabled={isPinSubmitting || pin.length === 0}
                    className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-500 flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-30"
                  >
                    ລຶບ (C)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDigit('0')}
                    disabled={isPinSubmitting}
                    className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-teal-100 border border-slate-200 text-lg font-bold font-mono text-slate-800 flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleBackspace}
                    disabled={isPinSubmitting || pin.length === 0}
                    className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-30"
                  >
                    <Backspace size={18} weight="bold" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Body: Mode 2 - Email & Password Login */}
        {authMode === 'email' && (
          <form onSubmit={handleEmailSubmit} className="p-5 flex flex-col gap-3.5">
            {emailError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <Warning size={16} weight="fill" className="text-rose-600 shrink-0" />
                <span>{emailError}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                ອີເມວ (Email)
              </label>
              <div className="relative">
                <Envelope
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@meiishop.la"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                ລະຫັດຜ່ານ (Password)
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600 font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isEmailSubmitting}
              className="mt-2 w-full py-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-98"
            >
              <span>{isEmailSubmitting ? 'ກຳລັງເຂົ້າສູ່ລະບົບ...' : 'ເຂົ້າສູ່ລະບົບ'}</span>
              <ArrowRight size={15} weight="bold" />
            </button>
          </form>
        )}

        {/* Footer Hint */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
          
        </div>
      </div>
    </div>
  );
}
