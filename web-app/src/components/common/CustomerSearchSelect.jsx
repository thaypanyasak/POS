import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User, CaretDown, MagnifyingGlass, X, Check, Phone, WarningCircle, Plus } from '@phosphor-icons/react';
import { formatKip, normalizeLao } from '../../utils/formatters';
import { playActionClickBeep } from '../../utils/audioFeedback';

export default function CustomerSearchSelect({
  customerName = 'ລູກຄ້າທົ່ວໄປ',
  customerPhone = '',
  onChangeCustomer,
  customers = [],
  onOpenNewCustomerModal = null,
  onQuickCreateCustomer = null,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const inputSearchRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [isOpen]);

  // Focus search input when popover opens without triggering native window jump
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setTimeout(() => {
        if (inputSearchRef.current) {
          try {
            inputSearchRef.current.focus({ preventScroll: true });
          } catch (_) {
            inputSearchRef.current.focus();
          }
        }
      }, 50);
    }
  }, [isOpen]);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return customers.slice(0, 30);

    const normQ = normalizeLao(q);
    return customers
      .filter((c) => {
        const nameMatch = c.name?.toLowerCase().includes(q) || normalizeLao(c.name || '').includes(normQ);
        const phoneMatch = c.phone && c.phone.includes(q);
        return nameMatch || phoneMatch;
      })
      .slice(0, 30);
  }, [customers, searchTerm]);

  const handleSelect = (c) => {
    playActionClickBeep();
    if (onChangeCustomer) {
      onChangeCustomer({
        name: c.name,
        phone: c.phone || '',
        id: c.id === 'default' ? null : c.id,
      });
    }
    setIsOpen(false);
  };

  const handleUseCustomName = (customName) => {
    const cleanName = (customName || '').trim();
    if (!cleanName) return;
    playActionClickBeep();

    // 1. Áp dụng ngay tức thì vào giỏ hàng và đóng dropdown ngay lập tức (0ms latency, không chờ đợi)
    setIsOpen(false);
    if (onChangeCustomer) {
      onChangeCustomer({
        name: cleanName,
        phone: '',
        id: null,
      });
    }

    // 2. Tạo ngầm (background) vào database/Supabase, khi xong tự cập nhật lại ID
    if (onQuickCreateCustomer) {
      onQuickCreateCustomer(cleanName)
        .then((saved) => {
          if (saved?.id && onChangeCustomer) {
            onChangeCustomer({
              name: saved.name || cleanName,
              phone: saved.phone || '',
              id: saved.id,
            });
          }
        })
        .catch((err) => {
          console.debug('[CustomerSearchSelect] Background save customer error:', err);
        });
    }
  };

  const isDefault = !customerName || customerName === 'ລູກຄ້າທົ່ວໄປ';

  return (
    <div className={`relative w-full ${isOpen ? 'z-50' : ''}`} ref={containerRef}>
      {/* Trigger Button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-8 px-2.5 rounded-lg border flex items-center justify-between gap-1.5 cursor-pointer transition-all select-none shadow-2xs ${
          isDefault
            ? 'bg-slate-50 hover:bg-slate-100/80 border-slate-200 text-slate-700'
            : 'bg-teal-50/80 hover:bg-teal-100/80 border-teal-300 text-teal-900 font-bold'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <User size={13} weight="bold" className={isDefault ? 'text-slate-400' : 'text-teal-700'} />
          <span className="text-xs truncate font-medium">
            {customerName || 'ລູກຄ້າທົ່ວໄປ'}
          </span>
          {customerPhone && (
            <span className="text-[10px] font-mono font-bold text-teal-700/80 truncate">
              ({customerPhone})
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!isDefault && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelect({ name: 'ລູກຄ້າທົ່ວໄປ', phone: '' });
              }}
              className="w-4 h-4 rounded-full bg-slate-200/80 hover:bg-rose-500 hover:text-white text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              title="ຣີເຊັດເປັນລູກຄ້າທົ່ວໄປ"
            >
              <X size={10} weight="bold" />
            </button>
          )}
          <CaretDown size={12} weight="bold" className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Dropdown Menu Popover (Opens downwards below select) */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-full sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col animate-in fade-in-50 slide-in-from-top-2 duration-150">
          {/* Search Header */}
          <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-1.5">
            <div className="relative flex-1">
              <MagnifyingGlass size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputSearchRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchTerm.trim()) {
                    e.preventDefault();
                    handleUseCustomName(searchTerm);
                  }
                }}
                placeholder="ຄົ້ນຫາຊື່ ຫຼື ເບີໂທ..."
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="w-full h-7 pl-7 pr-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder:text-[11px] placeholder:text-slate-400 focus:outline-none focus:border-teal-600 shadow-2xs"
              />
            </div>

            {onOpenNewCustomerModal && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenNewCustomerModal();
                }}
                className="h-7 px-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 transition-all active:scale-95 shadow-2xs cursor-pointer"
                title="ເພີ່ມລູກຄ້າໃໝ່ "
              >
                <Plus size={12} weight="bold" />
                <span>+ ໃໝ່</span>
              </button>
            )}
          </div>

          {/* Quick Add New Customer Row */}
          {/* {onOpenNewCustomerModal && (
            <div className="p-1.5 bg-teal-50/40 border-b border-teal-100/80">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenNewCustomerModal();
                }}
                className="w-full py-1.5 px-2.5 rounded-xl border border-dashed border-teal-400 bg-white hover:bg-teal-50 text-teal-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-98"
              >
                <Plus size={14} weight="bold" className="text-teal-600" />
                <span>+ ເພີ່ມລູກຄ້າໃໝ່</span>
              </button>
            </div>
          )} */}

          {/* Quick Custom Name Option if user typed something not matching */}
          {searchTerm.trim() && (
            <div className="p-1.5 bg-teal-50/60 border-b border-teal-100">
              <button
                type="button"
                onClick={() => handleUseCustomName(searchTerm)}
                className="w-full px-2 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 active:scale-98 text-white text-xs font-bold flex items-center justify-between transition-all cursor-pointer text-left shadow-2xs"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Check size={12} weight="bold" className="shrink-0" />
                  <span className="truncate">ໃຊ້ຊື່: "{searchTerm.trim()}"</span>
                </div>
                <span className="text-[10px] text-teal-100 font-normal shrink-0">ບັນທຶກໃໝ່</span>
              </button>
            </div>
          )}

          {/* Customer List */}
          <div className="max-h-56 overflow-y-auto p-1 space-y-0.5">
            {/* Quick Option: ລູກຄ້າທົ່ວໄປ (Default) */}
            <button
              type="button"
              onClick={() => handleSelect({ name: 'ລູກຄ້າທົ່ວໄປ', phone: '' })}
              className={`w-full px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between text-left transition-colors cursor-pointer ${
                isDefault
                  ? 'bg-teal-50 text-teal-900 font-bold'
                  : 'hover:bg-slate-100 text-slate-700 font-medium'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                  ທ
                </div>
                <span>ລູກຄ້າທົ່ວໄປ</span>
              </div>
              {isDefault && <Check size={13} weight="bold" className="text-teal-700" />}
            </button>

            {/* Other Customers */}
            {filteredCustomers
              .filter((c) => !c.isDefault && c.name !== 'ລູກຄ້າທົ່ວໄປ')
              .map((c) => {
                const isSelected = customerName && c.name && customerName.toLowerCase() === c.name.toLowerCase();

                return (
                  <button
                    key={c.id || c.name}
                    type="button"
                    onClick={() => handleSelect(c)}
                    className={`w-full px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-teal-50 text-teal-900 font-bold'
                        : 'hover:bg-slate-100 text-slate-700 font-medium'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-800 truncate">
                        {c.name}
                      </div>
                      {c.phone && (
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                          <Phone size={10} />
                          <span>{c.phone}</span>
                        </div>
                      )}
                    </div>

                    {isSelected && <Check size={13} weight="bold" className="text-teal-700 shrink-0" />}
                  </button>
                );
              })}

            {filteredCustomers.length === 0 && !searchTerm.trim() && (
              <div className="p-4 text-center text-xs text-slate-400">
                ຍັງບໍ່ມີລາຍຊື່ລູກຄ້າ
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

