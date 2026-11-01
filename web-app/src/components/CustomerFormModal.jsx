import React, { useState, useEffect } from 'react';
import { X, User, Phone, MapPin, Note, Check, Trash } from '@phosphor-icons/react';
import { playActionClickBeep, playSuccessBeep } from '../utils/audioFeedback';

export default function CustomerFormModal({
  isOpen,
  onClose,
  customer = null,
  onSave,
  onDelete = null,
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (customer) {
      setName(customer.name || '');
      setPhone(customer.phone || '');
      setAddress(customer.address || '');
      setNote(customer.note || '');
    } else {
      setName('');
      setPhone('');
      setAddress('');
      setNote('');
    }
    setErrorMsg('');
    setIsSaving(false);
  }, [isOpen, customer]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('ກະລຸນາປ້ອນຊື່ລູກຄ້າ (Vui lòng nhập tên khách hàng)');
      return;
    }

    try {
      setIsSaving(true);
      playSuccessBeep();
      await onSave({
        id: customer?.id,
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        note: note.trim(),
      });
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກ');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <User size={20} weight="bold" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base text-slate-800">
                {customer?.id ? 'ແກ້ໄຂຂໍ້ມູນລູກຄ້າ' : 'ເພີ່ມລູກຄ້າໃໝ່'}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {customer?.id ? 'ແກ້ໄຂຊື່, ເບີໂທ ແລະ ທີ່ຢູ່' : 'ບັນທຶກຂໍ້ມູນລູກຄ້າ ແລະ ເບີໂທລະສັບ'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
              {errorMsg}
            </div>
          )}

          {/* Customer Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ຊື່ລູກຄ້າ (Customer Name) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ຕົວຢ່າງ: ຮ້ານ 88, ອ້າຍສົມສັກ..."
                className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-200 transition-all"
              />
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ເບີໂທລະສັບ (Phone Number)
            </label>
            <div className="relative">
              <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="020 xxxx xxxx"
                className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-200 transition-all"
              />
            </div>
          </div>

          {/* Address / Location */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ທີ່ຢູ່ / ບ້ານ / ຮ້ານ (Address)
            </label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="ບ້ານ ໂພນສະຫວັນ, ນະຄອນປາກເຊ..."
                className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-200 transition-all"
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ໝາຍເຫດ (Note)
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ໝາຍເຫດເພີ່ມເຕີມ..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-200 transition-all resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
            {customer?.id && !customer?.isDefault && onDelete && (
              <button
                type="button"
                onClick={() => {
                  playActionClickBeep();
                  if (confirm(`ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລຶບລູກຄ້າ "${customer.name}"?`)) {
                    onDelete(customer.id);
                    onClose();
                  }
                }}
                className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Trash size={14} />
                <span>ລຶບ</span>
              </button>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                ຍົກເລີກ
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Check size={15} weight="bold" />
                <span>{isSaving ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກ'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

