import React, { useState } from 'react';
import {
  Lock,
  Envelope,
  Eye,
  EyeSlash,
  Storefront,
  ArrowRight,
  ShieldCheck,
  Warning,
  CheckCircle,
  X,
} from '@phosphor-icons/react';
import { useAuth } from '../../contexts/AuthContext';
import { playActionClickBeep } from '../../utils/audioFeedback';

export default function LoginModal({ isOpen, onClose }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('ກະລຸນາປ້ອນ Email ແລະ ລະຫັດຜ່ານ');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    const res = await login(email, password);
    setIsLoading(false);

    if (res.success) {
      if (onClose) onClose();
    } else {
      let friendly = res.error;
      if (res.error?.includes('Invalid login credentials')) {
        friendly = 'Email ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ!';
      }
      setErrorMsg(friendly);
    }
  };

  return (
    <div className="fixed inset-0 z-[190] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col text-slate-900 animate-in zoom-in-95 duration-150">
        {/* Header Branding */}
        <div className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 text-white flex flex-col items-center text-center relative">
          {onClose && (
            <button
              type="button"
              onClick={() => {
                playActionClickBeep();
                onClose();
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-slate-700 active:scale-95 shadow-xs"
              title="ປິດ (Đóng)"
            >
              <X size={16} weight="bold" />
            </button>
          )}

          <div className="w-14 h-14 rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 mb-3 shadow-lg shadow-teal-900/40">
            <Storefront size={32} weight="fill" />
          </div>
          <h2 className="text-lg font-black tracking-tight text-white">
            MeiiShop POS
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            ເຂົ້າສູ່ລະບົບຂາຍໜ້າຮ້ານ & ຄຸ້ມຄອງສາງ
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <Warning size={16} weight="fill" className="text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Email Field */}
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

          {/* Password Field */}
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

          {/* Notice about Persistent Session */}
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 flex items-start gap-2">
            <ShieldCheck size={16} className="text-teal-600 shrink-0 mt-0.5" weight="fill" />
            <span>
              ອຸປະກອນນີ້ຈະຮັກສາການເຂົ້າສູ່ລະບົບໄວ້ຕະຫຼອດ ca ຂາຍ. ທ່ານສາມາດປ່ຽນຄົນຂາຍດ້ວຍ PIN 4 ຕົວເລກ.
            </span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-xl text-xs font-extrabold shadow-sm active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>ກຳລັງກວດສອບ...</span>
              </>
            ) : (
              <>
                <span>ເຂົ້າສູ່ລະບົບ (Login)</span>
                <ArrowRight size={15} weight="bold" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
