import React from 'react';
import {
  WifiSlash,
  CloudSlash,
  CloudArrowUp,
  ArrowsClockwise,
  CheckCircle,
} from '@phosphor-icons/react';

export default function OfflineSyncBanner({
  isOnline = true,
  pendingCount = 0,
  isSyncing = false,
  onSyncNow,
}) {
  // If online and no pending offline items, don't show the banner
  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <div
      className={`w-full px-3 py-1.5 flex items-center justify-between gap-2 text-xs font-bold transition-all select-none border-b shadow-2xs z-30 animate-in fade-in slide-in-from-top-1 ${
        !isOnline
          ? 'bg-rose-50 text-rose-800 border-rose-200'
          : 'bg-amber-50 text-amber-900 border-amber-200'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {!isOnline ? (
          <div className="w-5 h-5 rounded-full bg-rose-200/80 flex items-center justify-center shrink-0 text-rose-700">
            <WifiSlash size={13} weight="bold" />
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full bg-amber-200/80 flex items-center justify-center shrink-0 text-amber-800">
            <CloudArrowUp size={13} weight="bold" />
          </div>
        )}

        <div className="truncate text-[11px] sm:text-xs">
          {!isOnline ? (
            <span>
              <span className="font-black text-rose-700">ໂໝດຂາຍອອບລາຍ (Offline): </span>
              <span>ບໍ່ມີສັນຍານເນັດ • ທ່ານຍັງສາມາດຂາຍເຄື່ອງ & ອອກບິນໄດ້ປົກກະຕິ!</span>
            </span>
          ) : (
            <span>
              <span>ກວດພົບອິນເຕີເນັດແລ້ວ! ມີ </span>
              <span className="font-black underline px-1">{pendingCount} ບິນ</span>
              <span>ຂາຍອອບລາຍລໍຖ້າຊິ້ງຂຶ້ນ Cloud</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {pendingCount > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-white/90 text-[10px] font-mono font-black border border-slate-200/80 tabular-nums shadow-2xs">
            {pendingCount} ບິນ
          </span>
        )}

        {isOnline && pendingCount > 0 && (
          <button
            type="button"
            disabled={isSyncing}
            onClick={onSyncNow}
            className={`h-6 px-2.5 rounded-lg text-[10.5px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-2xs ${
              isSyncing
                ? 'bg-amber-200 text-amber-800 cursor-wait'
                : 'bg-teal-600 hover:bg-teal-700 text-white'
            }`}
          >
            <ArrowsClockwise
              size={12}
              weight="bold"
              className={isSyncing ? 'animate-spin' : ''}
            />
            <span>{isSyncing ? 'ກຳລັງຊິ້ງ...' : 'ຊິ້ງດຽວນີ້'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
