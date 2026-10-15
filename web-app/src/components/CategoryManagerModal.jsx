import React, { useState } from 'react';
import {
  X,
  Plus,
  PencilSimple,
  Trash,
  Check,
  WarningCircle,
  Tag,
  Folders,
  Info,
} from '@phosphor-icons/react';

export default function CategoryManagerModal({
  isOpen,
  onClose,
  categories = [],
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  products = [],
}) {
  const [newCatName, setNewCatName] = useState('');
  const [editingCatId, setEditingCatId] = useState(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message }
  const [categoryToDelete, setCategoryToDelete] = useState(null);

  if (!isOpen) return null;

  const showToast = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const clean = newCatName.trim();

    // Check duplicate locally
    if (categories.some((c) => (c.name || '').toLowerCase() === clean.toLowerCase())) {
      showToast('error', `ໝວດໝູ່ "${clean}" ມີໃນລະບົບແລ້ວ!`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onCreateCategory(clean);
      if (res) {
        setNewCatName('');
        showToast('success', `ເພີ່ມໝວດໝູ່ "${clean}" ສຳເລັດແລ້ວ!`);
      }
    } catch (err) {
      showToast('error', err.message || 'ເກີດຂໍ້ຜິດພາດ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (cat) => {
    setEditingCatId(cat.id);
    setEditingCatName(cat.name);
  };

  const handleCancelEdit = () => {
    setEditingCatId(null);
    setEditingCatName('');
  };

  const handleSaveEdit = async (cat) => {
    const clean = editingCatName.trim();
    if (!clean) return;
    if (clean === cat.name) {
      handleCancelEdit();
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onUpdateCategory(cat.id, clean, cat.name);
      if (res?.success !== false) {
        showToast('success', `ແກ້ໄຂໝວດໝູ່ເປັນ "${clean}" ສຳເລັດແລ້ວ!`);
        handleCancelEdit();
      } else {
        showToast('error', res?.error || 'ບໍ່ສາມາດແກ້ໄຂໝວດໝູ່ໄດ້');
      }
    } catch (err) {
      showToast('error', err.message || 'ເກີດຂໍ້ຜິດພາດ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestDelete = (cat) => {
    // Check product count for safety
    const count = products.filter(
      (p) => p.category === cat.name || p.categoryId === cat.id
    ).length;

    if (count > 0) {
      showToast('error', `⚠️ ໝວດໝູ່ນີ້ກຳລັງມີສິນຄ້າຢູ່ ${count} ລາຍການ, ບໍ່ສາມາດລຶບໄດ້! ກະລຸນາຍ້າຍສິນຄ້າໄປໝວດອື່ນກ່ອນ.`);
      return;
    }

    setCategoryToDelete(cat);
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    const cat = categoryToDelete;
    setIsSubmitting(true);
    try {
      const res = await onDeleteCategory(cat.id, cat.name);
      if (res?.success !== false) {
        showToast('success', `ລຶບໝວດໝູ່ "${cat.name}" ສຳເລັດແລ້ວ!`);
        setCategoryToDelete(null);
      } else {
        showToast('error', res?.error || 'ບໍ່ສາມາດລຶບໝວດໝູ່ໄດ້');
      }
    } catch (err) {
      showToast('error', err.message || 'ເກີດຂໍ້ຜິດພາດ');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="px-6 py-4 bg-gradient-to-r from-teal-700 to-emerald-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
              <Folders size={20} weight="fill" className="text-teal-200" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm sm:text-base leading-tight">
                ຈັດການໝວດໝູ່ສິນຄ້າ (Category Manager)
              </h2>
              <p className="text-[10.5px] text-teal-100/90 mt-0.5">
                ເພີ່ມ, ແກ້ໄຂຊື່ ແລະ ລຶບໝວດໝູ່ໃນລະບົບ Supabase
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X size={18} weight="bold" />
          </button>
        </header>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`px-6 py-2.5 text-xs font-bold flex items-center gap-2 shrink-0 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
                : 'bg-red-50 text-red-800 border-b border-red-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <Check size={16} weight="bold" className="text-emerald-600" />
            ) : (
              <WarningCircle size={16} weight="fill" className="text-red-600" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Create Input Bar */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200/80 shrink-0">
          <form onSubmit={handleCreate} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Tag
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                weight="bold"
              />
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="ປ້ອນຊື່ໝວດໝູ່ໃໝ່ (e.g. ເຄື່ອງໃຊ້ໄຟຟ້າ, ເຂົ້າສານ...)"
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-500 shadow-2xs"
                disabled={isSubmitting}
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !newCatName.trim()}
              className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all active:scale-95 shadow-2xs shrink-0 cursor-pointer"
            >
              <Plus size={14} weight="bold" />
              <span>ເພີ່ມ</span>
            </button>
          </form>
        </div>

        {/* Category List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between mb-1 px-1">
            <span className="text-xs font-extrabold text-slate-700">
              ລາຍການໝວດໝູ່ທັງໝົດ ({categories.length})
            </span>
            <span className="text-[10px] text-slate-400">
              * ແກ້ໄຂຊື່ແລ້ວສິນຄ້າທັງໝົດຈະອັບເດດຕາມອັດຕະໂນມັດ
            </span>
          </div>

          {categories.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Tag size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-500">ຍັງບໍ່ມີໝວດໝູ່ໃນລະບົບ</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                ປ້ອນຊື່ໝວດໝູ່ດ້ານເທິງເພື່ອເລີ່ມຕົ້ນສ້າງ
              </p>
            </div>
          ) : (
            categories.map((cat, idx) => {
              const isEditing = editingCatId === cat.id;
              const prodCount = products.filter(
                (p) => p.category === cat.name || p.categoryId === cat.id
              ).length;

              return (
                <div
                  key={cat.id || idx}
                  className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    isEditing
                      ? 'bg-teal-50/70 border-teal-300 ring-1 ring-teal-500/20'
                      : 'bg-white hover:bg-slate-50 border-slate-200 shadow-2xs'
                  }`}
                >
                  {isEditing ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={editingCatName}
                        onChange={(e) => setEditingCatName(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-white border border-teal-400 rounded-lg text-xs font-bold text-slate-900 focus:outline-none"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveEdit(cat);
                          } else if (e.key === 'Escape') {
                            handleCancelEdit();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(cat)}
                        disabled={isSubmitting || !editingCatName.trim()}
                        className="p-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-all cursor-pointer"
                        title="ບັນທຶກ"
                      >
                        <Check size={14} weight="bold" />
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="p-2 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 transition-all cursor-pointer"
                        title="ຍົກເລີກ"
                      >
                        <X size={14} weight="bold" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-black shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-900 block truncate">
                            {cat.name}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {prodCount > 0 ? `${prodCount} ສິນຄ້າ` : 'ຍັງບໍ່ມີສິນຄ້າ'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(cat)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50 transition-all cursor-pointer"
                          title="ແກ້ໄຂຊື່ໝວດໝູ່"
                        >
                          <PencilSimple size={15} weight="bold" />
                        </button>
                        <button
                          type="button"
                          onClick={() => requestDelete(cat)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                          title="ລຶບໝວດໝູ່"
                        >
                          <Trash size={15} weight="bold" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <footer className="p-4 bg-slate-100/80 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500">
            <Info size={14} className="text-teal-600 shrink-0" />
            <span>ບັນທຶກລົງຕາຕະລາງ `categories` ໃນ Supabase ໂດຍກົງ</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            ປິດໜ້າຕ່າງ
          </button>
        </footer>

        {/* In-Modal Confirmation Dialog */}
        {categoryToDelete && (
          <div className="absolute inset-0 z-20 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xl max-w-sm w-full text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
                <Trash size={24} weight="bold" />
              </div>
              <h3 className="font-extrabold text-sm text-slate-900 mb-1">
                ຢືນຢັນການລຶບໝວດໝູ່
              </h3>
              <p className="text-xs text-slate-600 mb-4">
                ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລຶບໝວດໝູ່ <span className="font-bold text-red-600">"{categoryToDelete.name}"</span>?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCategoryToDelete(null)}
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  ຍົກເລີກ
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteCategory}
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'ກຳລັງລຶບ...' : 'ຢືນຢັນລຶບ'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
