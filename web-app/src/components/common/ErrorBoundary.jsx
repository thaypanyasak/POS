import React from 'react';
import { WarningCircle, ArrowClockwise, Trash } from '@phosphor-icons/react';
import { cleanupLegacyStorage } from '../../utils/safeStorage';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught runtime error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClearCacheAndReload = () => {
    try {
      cleanupLegacyStorage();
      localStorage.removeItem('meiishop_transactions_v7');
      localStorage.removeItem('meiishop_pos_active_orders_v1');
    } catch (_) {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const errMessage = this.state.error?.message || 'Unknown runtime error';

      return (
        <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 select-none font-sans">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl border border-slate-200 p-6 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4 shadow-xs">
              <WarningCircle size={32} weight="duotone" />
            </div>

            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight mb-1">
              ເກີດຂໍ້ຜິດພາດໃນລະບົບ (System Error)
            </h2>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              ລະບົບພົບຂໍ້ຜິດພາດຊົ່ວຄາວ. ທ່ານສາມາດໂຫຼດໜ້າຄືນໃໝ່ ຫຼື ລ້າງແຄຊເພື່ອສືບຕໍ່ຂາຍເຄື່ອງ.
            </p>

            <div className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 mb-5 text-left overflow-hidden">
              <p className="text-[11px] font-mono text-slate-700 break-words leading-tight line-clamp-3">
                {errMessage}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 w-full">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 h-10 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all"
              >
                <ArrowClockwise size={16} weight="bold" />
                <span>ໂຫຼດຄືນໃໝ່ (Tải lại)</span>
              </button>

              <button
                type="button"
                onClick={this.handleClearCacheAndReload}
                className="h-10 px-3.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-slate-200 active:scale-98 text-slate-600 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                title="ລ້າງແຄຊທີ່ບັນທຶກຊົ່ວຄາວ ແລະ ໂຫຼດໃໝ່"
              >
                <Trash size={15} weight="bold" />
                <span>ລ້າງແຄຊ</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
