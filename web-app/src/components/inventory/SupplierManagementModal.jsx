import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash,
  PencilSimple,
  Truck,
  WarningCircle,
  CheckCircle,
  MapPin,
} from '@phosphor-icons/react';
import {
  createSupplierInSupabase,
  updateSupplierInSupabase,
  deleteSupplierSafelyInSupabase,
} from '../../services/supabase';

export default function SupplierManagementModal({
  isOpen,
  onClose,
  suppliers = [],
  onRefreshSuppliers,
  onAlert,
}) {
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const resetForm = () => {
    setEditingSupplier(null);
    setName('');
    setPhone('');
    setAddress('');
    setContactPerson('');
    setNote('');
  };

  const startEdit = (s) => {
    setEditingSupplier(s);
    setName(s.name || '');
    setPhone(s.phone || '');
    setAddress(s.address || '');
    setContactPerson(s.contact_person || '');
    setNote(s.note || '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      onAlert?.('ກະລຸນາປ້ອນຊື່ແຫຼ່ງສິນຄ້າ / ຜູ້ສະໜອງ', 'ແຈ້ງເຕືອນ', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name,
        phone,
        address,
        contactPerson,
        note,
      };

      if (editingSupplier) {
        const res = await updateSupplierInSupabase(editingSupplier.id, payload);
        if (res.success) {
          onAlert?.('ອັບເດດຂໍ້ມູນຜູ້ສະໜອງສຳເລັດແລ້ວ!', 'ສຳເລັດ', 'success');
          resetForm();
          onRefreshSuppliers?.();
        } else {
          onAlert?.(res.error || 'ເກີດຂໍ້ຜິດພາດ', 'ຂໍ້ຜິດພາດ', 'error');
        }
      } else {
        const res = await createSupplierInSupabase(payload);
        if (res.success) {
          onAlert?.('ເພີ່ມຜູ້ສະໜອງໃໝ່ສຳເລັດແລ້ວ!', 'ສຳເລັດ', 'success');
          resetForm();
          onRefreshSuppliers?.();
        } else {
          onAlert?.(res.error || 'ເກີດຂໍ້ຜິດພາດ', 'ຂໍ້ຜິດພາດ', 'error');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (s) => {
    if (!window.confirm(`ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລຶບຜູ້ສະໜອງ "${s.name}"?`)) return;

    const res = await deleteSupplierSafelyInSupabase(s.id);
    if (!res.success) {
      onAlert?.(res.error, 'ແຈ້ງເຕືອນຄວາມປອດໄພ', 'warning');
    } else {
      onAlert?.(`ລຶບຜູ້ສະໜອງ "${s.name}" ສຳເລັດແລ້ວ!`, 'ສຳເລັດ', 'success');
      onRefreshSuppliers?.();
      if (editingSupplier?.id === s.id) resetForm();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col gap-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700">
              <Truck size={22} weight="duotone" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                ຈັດການແຫຼ່ງສະໜອງສິນຄ້າ (Suppliers Management)
              </h3>
              <p className="text-xs text-slate-500">
                ເພີ່ມ, ແກ້ໄຂ ແລະ ຕິດຕາມແຫຼ່ງນຳເຂົ້າສິນຄ້າ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 flex-1 min-h-0 overflow-y-auto">
          {/* Left: Supplier List (6 cols) */}
          <div className="md:col-span-7 flex flex-col gap-2.5 overflow-y-auto pr-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">
                ລາຍຊື່ຜູ້ສະໜອງທັງໝົດ ({suppliers.length})
              </span>
              <button
                type="button"
                onClick={resetForm}
                className="text-[11px] font-bold text-teal-700 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} /> ເພີ່ມຜູ້ສະໜອງໃໝ່
              </button>
            </div>

            {suppliers.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                ຍັງບໍ່ມີຂໍ້ມູນຜູ້ສະໜອງສິນຄ້າ
              </div>
            ) : (
              suppliers.map((s) => {
                const isSelected = editingSupplier?.id === s.id;
                return (
                  <div
                    key={s.id}
                    className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-teal-50/50 border-teal-500 ring-1 ring-teal-500'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {s.name}
                        </span>
                        {s.phone && (
                          <span className="text-[10px] text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded font-mono font-medium">
                            {s.phone}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-1">
                        {s.address ? (
                          <>
                            <MapPin size={12} weight="fill" className="text-slate-400 shrink-0" />
                            <span className="truncate">{s.address}</span>
                          </>
                        ) : (
                          'ບໍ່ມີທີ່ຢູ່'
                        )}
                      </div>
                      {s.note && (
                        <div className="text-[10px] text-slate-400 italic mt-0.5 truncate">
                          * {s.note}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(s)}
                        className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded-lg cursor-pointer transition-colors"
                        title="ແກ້ໄຂ"
                      >
                        <PencilSimple size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(s)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                        title="ລຶບ"
                      >
                        <Trash size={15} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right: Form Editor (5 cols) */}
          <div className="md:col-span-5 bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col gap-3">
            <span className="text-xs font-bold text-slate-800">
              {editingSupplier ? `ແກ້ໄຂ: ${editingSupplier.name}` : 'ເພີ່ມແຫຼ່ງສະໜອງໃໝ່'}
            </span>

            <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  ຊື່ຜູ້ສະໜອງ / ຮ້ານສົ່ງ *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ເຊັ່ນ: Friendship, ບໍລິສັດ ເບຍລາວ..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  ເບີໂທລະສັບ
                </label>
                <input
                  type="text"
                  placeholder="020 5555 1234"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500 shadow-2xs font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  ທີ່ຢູ່ / ສາງສິນຄ້າ
                </label>
                <input
                  type="text"
                  placeholder="ບ້ານ ໂພນຕ້ອງ, ນະຄອນຫຼວງວຽງຈັນ..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  ໝາຍເຫດ
                </label>
                <textarea
                  rows={2}
                  placeholder="ເຊັ່ນ: ໃຫ້ເຄຣດິດ 30 ວັນ, ສົ່ງຟຣີຮອດຮ້ານ..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500 shadow-2xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 mt-1">
                {editingSupplier && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200 cursor-pointer"
                  >
                    ຍົກເລີກ
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer active:scale-95 transition-all"
                >
                  {isSubmitting
                    ? 'ກຳລັງບັນທຶກ...'
                    : editingSupplier
                    ? 'ອັບເດດ'
                    : 'ບັນທຶກຜູ້ສະໜອງ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
