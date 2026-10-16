import React, { useState } from 'react';
import {
  Gear,
  CurrencyCircleDollar,
  Receipt,
  CloudCheck,
  CloudSlash,
  Folders,
  UsersThree,
  Plus,
  ArrowClockwise,
  ShieldCheck,
  DeviceTablet,
  CheckCircle,
  Tag,
  ClockCounterClockwise
} from '@phosphor-icons/react';

export default function SettingsView({
  exchangeRate = 720,
  isCloudSynced = false,
  productsCount = 0,
  transactionsCount = 0,
  outOfStockCount = 0,
  debtCount = 0,
  receiptPaperWidth = 80,
  setReceiptPaperWidth,
  onOpenCategoryManager,
  onOpenSupplierManager,
  onAddNewProduct,
  onRefreshAll,
  isLoading = false,
}) {
  const [localPaperWidth, setLocalPaperWidth] = useState(receiptPaperWidth);
  const paperWidth = setReceiptPaperWidth ? receiptPaperWidth : localPaperWidth;
  const handlePaperWidthChange = (val) => {
    if (setReceiptPaperWidth) {
      setReceiptPaperWidth(val);
    } else {
      setLocalPaperWidth(val);
    }
  };

  return (
    <div className="flex-1 h-full min-h-0 overflow-y-auto bg-slate-100 p-4 md:p-6 lg:p-8 overscroll-contain">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-3 sm:pb-3.5 border-b border-slate-200/80 mb-3 sm:mb-4 gap-2.5 sm:gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700 shrink-0">
              <Gear size={20} className="sm:w-5 sm:h-5" weight="duotone" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span className="truncate">ຕັ້ງຄ່າລະບົບ (Settings)</span>
              </h1>
              <p className="text-[11.5px] sm:text-xs text-slate-500 mt-0.5 hidden sm:block truncate">
                ຈັດການຂໍ້ມູນຮ້ານຄ້າ, ອັດຕາແລກປ່ຽນ ແລະ ລະບົບພິມບິນ MeiiShop POS
              </p>
            </div>
          </div>

          {onRefreshAll && (
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={onRefreshAll}
                disabled={isLoading}
                className="p-2 sm:p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 border border-slate-200 shadow-2xs"
                title="ໂຫຼດຂໍ້ມູນຄືນ"
              >
                <ArrowClockwise size={15} weight="bold" className={isLoading ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">ຣີເຟຣຊຂໍ້ມູນ</span>
              </button>
            </div>
          )}
        </div>

        {/* 2x2 Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Currency & Exchange Rate */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <CurrencyCircleDollar size={22} weight="fill" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    ອັດຕາຕົ້ນທຶນເງິນບາດ (THB / LAK)
                  </h2>
                  <p className="text-xs text-slate-500">
                    ໃຊ້ສຳລັບແປງຕົ້ນທຶນສິນຄ້ານຳເຂົ້າຈາກໄທ ເປັນກີບລາວ
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 font-semibold block">
                    ອັດຕາແລກປ່ຽນປະຈຸບັນ
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                      1 ฿ = {exchangeRate} ₭
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200/80">
                  ອັດຕາຄົງທີ່ POS
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                ໝາຍເຫດ: ລາຄາຕົ້ນທຶນບາດຂອງສິນຄ້າຈະຖືກຄິດໄລ່ອັດຕະໂນມັດຕາມອັດຕານີ້ (1 ບາດ = {exchangeRate} ກີບ) ເພື່ອຮັບປະກັນກຳໄລຂັ້ນຕົ້ນທີ່ຖືກຕ້ອງ.
              </p>
            </div>
          </div>

          {/* Card 2: Receipt Printing Width */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                  <Receipt size={22} weight="bold" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    ຂະໜາດເຈ້ຍພິມບິນ (Thermal Receipt)
                  </h2>
                  <p className="text-xs text-slate-500">
                    ກຳນົດຂະໜາດເຈ້ຍສຳລັບເຄື່ອງພິມຄວາມຮ້ອນ POS
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => handlePaperWidthChange(80)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    paperWidth === 80
                      ? 'bg-teal-50 border-teal-500 text-teal-900 ring-2 ring-teal-500/20'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">80 mm (ມາດຕະຖານ)</span>
                    {paperWidth === 80 && (
                      <CheckCircle size={18} weight="fill" className="text-teal-600" />
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    ເໝາະສຳລັບເຄື່ອງພິມຕັ້ງໂຕະ ໜ້າກວ້າງ 3 ນິ້ວ
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePaperWidthChange(58)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    paperWidth === 58
                      ? 'bg-teal-50 border-teal-500 text-teal-900 ring-2 ring-teal-500/20'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">58 mm (ແບບພົກພາ)</span>
                    {paperWidth === 58 && (
                      <CheckCircle size={18} weight="fill" className="text-teal-600" />
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    ເໝາະສຳລັບເຄື່ອງພິມ Bluetooth ຂະໜາດນ້ອຍ 2 ນິ້ວ
                  </span>
                </button>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>ຮູບແບບຟອນໃບບິນ:</span>
              <span className="font-mono font-bold text-slate-700">Noto Sans Lao & Monospace</span>
            </div>
          </div>

          {/* Card 3: Quick Master Data Management */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <Folders size={22} weight="bold" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  ຈັດການຂໍ້ມູນຫຼັກ (Master Data)
                </h2>
                <p className="text-xs text-slate-500">
                  ໝວດໝູ່ສິນຄ້າ, ຜູ້ສະໜອງ ແລະ ການເພີ່ມສິນຄ້າໃໝ່
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              {onOpenCategoryManager && (
                <button
                  type="button"
                  onClick={onOpenCategoryManager}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-teal-50/50 hover:border-teal-300 transition-all text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                      <Tag size={18} weight="bold" />
                    </div>
                    <div>
                      <span className="text-xs md:text-sm font-bold text-slate-800 group-hover:text-teal-800">
                        ຈັດການໝວດໝູ່ສິນຄ້າ (Categories)
                      </span>
                      <p className="text-[11px] text-slate-500">
                        ເພີ່ມ, ແກ້ໄຂ ແລະ ຈັດລະບຽບກຸ່ມສິນຄ້າ
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-teal-700 group-hover:underline">
                    ເປີດ &rarr;
                  </span>
                </button>
              )}

              {onOpenSupplierManager && (
                <button
                  type="button"
                  onClick={onOpenSupplierManager}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-teal-50/50 hover:border-teal-300 transition-all text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                      <UsersThree size={18} weight="bold" />
                    </div>
                    <div>
                      <span className="text-xs md:text-sm font-bold text-slate-800 group-hover:text-teal-800">
                        ຈັດການຜູ້ສະໜອງ (Suppliers)
                      </span>
                      <p className="text-[11px] text-slate-500">
                        ລາຍຊື່ຜູ້ສະໜອງ, ເບີໂທ ແລະ ຍອດໜີ້ຄ້າງຈ່າຍ
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-teal-700 group-hover:underline">
                    ເປີດ &rarr;
                  </span>
                </button>
              )}

              {onAddNewProduct && (
                <button
                  type="button"
                  onClick={onAddNewProduct}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-teal-50/50 hover:border-teal-300 transition-all text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                      <Plus size={18} weight="bold" />
                    </div>
                    <div>
                      <span className="text-xs md:text-sm font-bold text-slate-800 group-hover:text-teal-800">
                        ເພີ່ມສິນຄ້າໃໝ່ (Add Product)
                      </span>
                      <p className="text-[11px] text-slate-500">
                        ລົງທະບຽນບາໂຄດ, ລາຄາ ແລະ 3 ລະດັບຫົວໜ່ວຍ
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-teal-700 group-hover:underline">
                    ເປີດ &rarr;
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Card 4: Cloud Database & System Health */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                <ShieldCheck size={22} weight="bold" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  ຖານຂໍ້ມູນ Supabase & ສະຖານະ
                </h2>
                <p className="text-xs text-slate-500">
                  ການຊິ້ງຄ໌ຂໍ້ມູນຄລາວ ແລະ ແຄຊໃນເຄື່ອງ
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-xs font-semibold text-slate-600">ສະຖານະຄລາວ</span>
                <div className="flex items-center gap-1.5">
                  {isCloudSynced ? (
                    <>
                      <CloudCheck size={16} className="text-teal-600" weight="fill" />
                      <span className="text-xs font-bold text-teal-700">Online (Synced)</span>
                    </>
                  ) : (
                    <>
                      <CloudSlash size={16} className="text-amber-600" weight="fill" />
                      <span className="text-xs font-bold text-amber-700">Offline / Local Cache</span>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-slate-500 block">ສິນຄ້າໃນລະບົບ</span>
                  <span className="font-mono text-base font-bold text-slate-800">
                    {productsCount} ລາຍການ
                  </span>
                  {outOfStockCount > 0 && (
                    <span className="text-[11px] font-mono text-rose-500 font-bold block mt-0.5">
                      (ໝົດສະຕັອກ: {outOfStockCount})
                    </span>
                  )}
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-slate-500 block">ບິນຂາຍທັງໝົດ</span>
                  <span className="font-mono text-base font-bold text-slate-800">
                    {transactionsCount} ບິນ
                  </span>
                  {debtCount > 0 && (
                    <span className="text-[11px] font-mono text-rose-500 font-bold block mt-0.5">
                      (ຕິດໜີ້: {debtCount})
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between">
                <span>MeiiShop POS • Vientiane Laos</span>
                <span className="font-mono font-medium">DESIGN.md Compliant</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
