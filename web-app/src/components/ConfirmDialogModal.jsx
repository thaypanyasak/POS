import React from 'react';
import {
  CheckCircle,
  WarningCircle,
  Info,
  XCircle,
  Trash,
  ArrowCounterClockwise,
  X
} from '@phosphor-icons/react';

/**
 * Premium Dialog Modal replacing native browser alert() and confirm()
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - onConfirm?: () => void
 * - type: 'success' | 'warning' | 'error' | 'info' | 'danger'
 * - title: string
 * - message: string (supports multiline \n)
 * - confirmText?: string (e.g. "ຕົກລົງ", "ຢືນຢັນ", "ລຶບ")
 * - cancelText?: string (e.g. "ຍົກເລີກ")
 * - isConfirm?: boolean (if true, displays Cancel button alongside Confirm button)
 */
export default function ConfirmDialogModal({
  isOpen,
  onClose,
  onConfirm,
  type = 'info',
  title,
  message,
  confirmText = 'ຕົກລົງ',
  cancelText = 'ຍົກເລີກ',
  isConfirm = false,
}) {
  if (!isOpen) return null;

  const handleConfirmClick = () => {
    if (onConfirm) onConfirm();
    onClose();
  };

  const getTheme = () => {
    switch (type) {
      case 'success':
        return {
          icon: <CheckCircle size={32} weight="fill" className="text-emerald-500" />,
          headerBg: 'bg-emerald-50 text-emerald-950',
          badgeBg: 'bg-emerald-100 text-emerald-800',
          confirmBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20',
          border: 'border-emerald-200',
        };
      case 'danger':
      case 'error':
        return {
          icon: type === 'danger' ? <Trash size={32} weight="fill" className="text-red-500" /> : <XCircle size={32} weight="fill" className="text-red-500" />,
          headerBg: 'bg-red-50 text-red-950',
          badgeBg: 'bg-red-100 text-red-800',
          confirmBtn: 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20',
          border: 'border-red-200',
        };
      case 'warning':
        return {
          icon: <WarningCircle size={32} weight="fill" className="text-amber-500" />,
          headerBg: 'bg-amber-50 text-amber-950',
          badgeBg: 'bg-amber-100 text-amber-800',
          confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20',
          border: 'border-amber-200',
        };
      case 'info':
      default:
        return {
          icon: <Info size={32} weight="fill" className="text-teal-600" />,
          headerBg: 'bg-teal-50 text-teal-950',
          badgeBg: 'bg-teal-100 text-teal-800',
          confirmBtn: 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/20',
          border: 'border-teal-200',
        };
    }
  };

  const theme = getTheme();

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`p-6 flex flex-col items-center text-center relative ${theme.headerBg}`}>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-black/5 transition-all cursor-pointer"
          >
            <X size={18} weight="bold" />
          </button>

          <div className="w-14 h-14 rounded-2xl bg-white shadow-md flex items-center justify-center mb-3 border border-slate-100">
            {theme.icon}
          </div>

          <h3 className="font-extrabold text-base text-slate-900">
            {title || 'ແຈ້ງເຕືອນລະບົບ'}
          </h3>
        </div>

        <div className="p-6 pt-4">
          <div className="text-xs text-slate-600 font-medium whitespace-pre-line leading-relaxed text-center">
            {message}
          </div>

          <div className="flex items-center gap-3 mt-6">
            {isConfirm && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
              >
                {cancelText}
              </button>
            )}

            <button
              type="button"
              onClick={handleConfirmClick}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black shadow-md transition-all active:scale-95 cursor-pointer ${theme.confirmBtn}`}
              autoFocus
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
