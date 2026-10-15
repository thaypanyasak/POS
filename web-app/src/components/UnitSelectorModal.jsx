import React from 'react';
import {
  X,
  Check,
  CheckCircle,
  Plus,
  Minus
} from '@phosphor-icons/react';
import { formatKip } from '../utils/formatters';

export default function UnitSelectorModal({
  product,
  onClose,
  selectedUnit,
  setSelectedUnit,
  modalQuantity,
  setModalQuantity,
  onAddToCart,
}) {
  if (!product) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans select-none">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col gap-4 border border-slate-200">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900">{product.name}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              ສາງຄົງເຫຼືອ:{' '}
              {product.trackStock === false ? (
                <span className="font-bold text-slate-600">ບໍ່ນັບສາງ</span>
              ) : (
                <span className="font-bold text-slate-800">
                  {product.currentStockBaseUnits ?? 0} {product.baseUnit}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1"
          >
            <X size={20} />
          </button>
        </div>

        {/* Unit Selection Options */}
        <div>
          <span className="text-xs font-bold text-slate-700 mb-2 block">
            ເລືອກຫົວໜ່ວຍບັນຈຸ (Packaging Units):
          </span>
          <div className="flex flex-col gap-2">
            {product.units.map((unit) => {
              const isSelected = selectedUnit?.id === unit.id;
              const price = unit.retailPrice;

              return (
                <div
                  key={unit.id}
                  onClick={() => setSelectedUnit(unit)}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-teal-50/80 border-teal-600 ring-1 ring-teal-600'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        isSelected
                          ? 'border-teal-600 bg-teal-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check size={12} weight="bold" />}
                    </div>
                    <div>
                      <span className="text-xs font-extrabold text-slate-900 block">
                        {unit.unitName}
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        {unit.multiplier > 1
                          ? `1 ${unit.unitName} = ${unit.multiplier} ${product.baseUnit}`
                          : 'ຫົວໜ່ວຍຍ່ອຍຫຼັກ'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-black text-teal-800 block font-mono">
                      {formatKip(price)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quantity Stepper */}
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
          <span className="text-xs font-bold text-slate-700">ຈຳນວນທີ່ຕ້ອງການຂາຍ:</span>
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1">
            <button
              onClick={() => setModalQuantity(Math.max(1, modalQuantity - 1))}
              className="w-7 h-7 rounded flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
            >
              <Minus size={14} weight="bold" />
            </button>
            <span className="w-8 text-center font-black text-sm text-slate-900 font-mono">
              {modalQuantity}
            </span>
            <button
              onClick={() => setModalQuantity(modalQuantity + 1)}
              className="w-7 h-7 rounded flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
            >
              <Plus size={14} weight="bold" />
            </button>
          </div>
        </div>

        {/* Total & Submit */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div>
            <span className="text-xs text-slate-500 block">ລວມເປັນເງິນ:</span>
            <span className="text-lg font-black text-teal-700 block font-mono">
              {formatKip((selectedUnit?.retailPrice || 0) * modalQuantity)}
            </span>
          </div>
          <button
            onClick={() => {
              if (selectedUnit) {
                onAddToCart(product, selectedUnit, modalQuantity);
                onClose();
              }
            }}
            className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-teal-600/20 active:scale-95 transition-all flex items-center gap-1.5"
          >
            <CheckCircle size={16} weight="fill" />
            <span>ເພີ່ມລົງກະຕ່າ</span>
          </button>
        </div>
      </div>
    </div>
  );
}
