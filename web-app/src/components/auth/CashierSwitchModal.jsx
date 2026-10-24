import React, { useState } from 'react';
import {
  X,
  UserSwitch,
  Lock,
  CheckCircle,
  Warning,
  ShieldCheck,
  Backspace,
  Key,
  SignOut,
} from '@phosphor-icons/react';
import { useAuth } from '../../contexts/AuthContext';
import { playActionClickBeep } from '../../utils/audioFeedback';
import ConfirmDialogModal from '../ConfirmDialogModal';

export default function CashierSwitchModal({ isOpen, onClose, onOpenLogin }) {
  const {
    activeCashier,
    activeCashiersList,
    switchCashier,
    lockPos,
    logout,
  } = useAuth();

  const [selectedStaff, setSelectedStaff] = useState(null);
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  if (!isOpen) return null;

  const handleSelectStaff = (st) => {
    playActionClickBeep();
    setSelectedStaff(st);
    setPin('');
    setErrorMsg(null);
  };

  const handleDigit = (digit) => {
    if (pin.length >= 6 || isSubmitting) return;
    playActionClickBeep();
    setErrorMsg(null);
    const nextPin = pin + digit;
    setPin(nextPin);
    if (nextPin.length === 4 && selectedStaff) {
      handleConfirmSwitch(nextPin);
    }
  };

  const handleBackspace = () => {
    playActionClickBeep();
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const handleClear = () => {
    playActionClickBeep();
    setPin('');
    setErrorMsg(null);
  };

  const handleConfirmSwitch = async (enteredPin = pin) => {
    if (!selectedStaff) {
      setErrorMsg('ກະລຸນາເລືອກພະນັກງານ');
      return;
    }
    if (enteredPin.length < 4) {
      setErrorMsg('ກະລຸນາປ້ອນລະຫັດ PIN 4 ຕົວເລກ');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await switchCashier(selectedStaff.id, enteredPin);
    setIsSubmitting(false);

    if (res.success) {
      onClose();
    } else {
      setErrorMsg(res.error || 'ລະຫັດ PIN ບໍ່ຖືກຕ້ອງ!');
      setPin('');
    }
  };

  const handleLockNow = () => {
    playActionClickBeep();
    onClose();
    lockPos();
  };

  return (
    <div className="fixed inset-0 z-[150] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col text-slate-900 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
              <UserSwitch size={18} weight="bold" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">ປ່ຽນກະຂາຍເຄື່ອງ (Switch Shift)</h3>
              <p className="text-[11px] text-slate-500">ເລືອກພະນັກງານ ແລະ ປ້ອນ PIN ເພື່ອປ່ຽນກະ</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all cursor-pointer"
          >
            <X size={15} weight="bold" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 flex flex-col gap-4">
          {/* Active Cashier Notice */}
          <div className="p-3 rounded-2xl bg-teal-50/70 border border-teal-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-600 text-white font-black text-sm flex items-center justify-center shadow-xs">
                {activeCashier?.full_name?.charAt(0) || 'M'}
              </div>
              <div>
                <span className="text-[10px] text-teal-600 font-bold block uppercase tracking-wider">
                  ກຳລັງປະຈຳການ (Active)
                </span>
                <span className="text-xs font-black text-slate-900">
                  {activeCashier?.full_name || 'Staff'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleLockNow}
                className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-teal-200 text-teal-800 text-[11px] font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer active:scale-95"
                title="ລັອກໜ້າຈໍຂາຍທັນທີ"
              >
                <Lock size={13} weight="bold" />
                <span>ລັອກ</span>
              </button>

              <button
                type="button"
                onClick={() => setIsLogoutConfirmOpen(true)}
                className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[11px] font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer active:scale-95"
                title="ອອກຈາກລະບົບ (Logout)"
              >
                <SignOut size={13} weight="bold" />
                <span>ອອກ</span>
              </button>
            </div>
          </div>

          {/* Step 1: Select Staff */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 mb-2 block">
              1. ເລືອກພະນັກງານທີ່ຈະປ່ຽນກະ:
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto no-scrollbar">
              {activeCashiersList.map((st) => {
                const isSelected = selectedStaff?.id === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => handleSelectStaff(st)}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-teal-600 bg-teal-50/80 text-teal-900 ring-1 ring-teal-500'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-slate-200 font-bold text-xs flex items-center justify-center shrink-0">
                      {st.full_name?.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{st.full_name}</div>
                      <div className="text-[10px] text-slate-400 capitalize">{st.role}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: PIN Input (Shown when staff selected) */}
          {selectedStaff && (
            <div className="pt-2 border-t border-slate-100 animate-in fade-in">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-bold text-slate-700">
                  2. ປ້ອນລະຫັດ PIN ຂອງ {selectedStaff.full_name}:
                </label>
                <span className="text-[10px] font-mono font-bold text-teal-600">
                  {pin.length} / 4 ຕົວເລກ
                </span>
              </div>

              {/* PIN Dots */}
              <div className="flex items-center justify-center gap-3 py-2 bg-slate-50 rounded-xl border border-slate-200 mb-3">
                {[0, 1, 2, 3].map((idx) => {
                  const isFilled = pin.length > idx;
                  return (
                    <div
                      key={idx}
                      className={`w-3.5 h-3.5 rounded-full transition-all ${
                        isFilled
                          ? 'bg-teal-600 scale-110 shadow-xs'
                          : 'bg-slate-200 border border-slate-300'
                      }`}
                    />
                  );
                })}
              </div>

              {errorMsg && (
                <div className="mb-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1.5">
                  <Warning size={14} weight="fill" className="shrink-0" />
                  <span className="truncate">{errorMsg}</span>
                </div>
              )}

              {/* Compact Numpad */}
              <div className="grid grid-cols-3 gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleDigit(String(num))}
                    disabled={isSubmitting}
                    className="h-10 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-teal-100 border border-slate-200/80 text-base font-bold font-mono text-slate-800 flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={isSubmitting || pin.length === 0}
                  className="h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-500 flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-30"
                >
                  C
                </button>
                <button
                  type="button"
                  onClick={() => handleDigit('0')}
                  disabled={isSubmitting}
                  className="h-10 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-teal-100 border border-slate-200/80 text-base font-bold font-mono text-slate-800 flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleBackspace}
                  disabled={isSubmitting || pin.length === 0}
                  className="h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-30"
                >
                  <Backspace size={16} weight="bold" />
                </button>
              </div>
            </div>
          )}

          {onOpenLogin && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-center">
              <button
                type="button"
                onClick={onOpenLogin}
                className="text-xs text-teal-700 hover:text-teal-800 font-bold hover:underline cursor-pointer py-1"
              >
                ເຂົ້າສູ່ລະບົບດ້ວຍ Email & ລະຫັດຜ່ານ (Đăng nhập Email)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Logout Confirmation Dialog */}
      <ConfirmDialogModal
        isOpen={isLogoutConfirmOpen}
        onClose={() => setIsLogoutConfirmOpen(false)}
        onConfirm={async () => {
          setIsLogoutConfirmOpen(false);
          onClose();
          await logout();
        }}
        type="danger"
        title="ອອກຈາກລະບົບ (Logout)"
        message="ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການອອກຈາກລະບົບ? ລະບົບຈະກັບຄືນສູ່ໜ້າຈໍ Login."
        confirmText="ອອກຈາກລະບົບ"
        cancelText="ຍົກເລີກ"
        isConfirm={true}
      />
    </div>
  );
}
