import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  PencilSimple,
  Trash,
  ShieldCheck,
  User,
  Key,
  MagnifyingGlass,
  ArrowClockwise,
  ArrowCounterClockwise,
  CheckCircle,
  XCircle,
  Warning,
  Lock,
  Eye,
  EyeSlash,
  Check,
  X,
  Prohibit,
  ShieldWarning,
  SlidersHorizontal,
  Plus,
  Info,
} from '@phosphor-icons/react';
import {
  fetchStaffProfiles,
  adminCreateStaff,
  adminUpdateStaff,
  adminDeleteStaff,
  adminToggleStaffActive,
} from '../../services/staffService';
import { useAuth } from '../../contexts/AuthContext';
import { playActionClickBeep, playSuccessBeep, playErrorBeep } from '../../utils/audioFeedback';
import { NAVIGATION_SCHEMA, DEFAULT_ROLE_PERMISSIONS } from '../../config/navigationSchema';

export default function StaffManagementView() {
  const {
    refreshStaffList,
    rolesList,
    rolePermissions,
    updateRolePermissions,
    resetPermissions,
    createCustomRole,
    deleteCustomRole,
  } = useAuth();

  const [activeViewTab, setActiveViewTab] = useState('staff'); // 'staff' | 'permissions'
  const [selectedRoleConfig, setSelectedRoleConfig] = useState('admin'); // role ID (default to admin)
  const [tempPermissions, setTempPermissions] = useState(rolePermissions || DEFAULT_ROLE_PERMISSIONS);
  const [isSavingPerms, setIsSavingPerms] = useState(false);

  // New Role Creation Modal State
  const [isAddRoleModalOpen, setIsAddRoleModalOpen] = useState(false);
  const [newRoleId, setNewRoleId] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRolePerms, setNewRolePerms] = useState(['pos', 'products']);

  const [staffList, setStaffList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); // 'all' | role ID

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [deletingStaff, setDeletingStaff] = useState(null);

  // Form states for Add/Edit
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formPin, setFormPin] = useState('');
  const [formRole, setFormRole] = useState('cashier');
  const [formActive, setFormActive] = useState(true);

  // Notifications
  const [toast, setToast] = useState(null);
  const [revealedPins, setRevealedPins] = useState({});

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const loadStaff = async () => {
    setIsLoading(true);
    const { data, error } = await fetchStaffProfiles();
    if (error) {
      showToast('error', error);
    } else {
      setStaffList(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadStaff();
  }, []);

  useEffect(() => {
    if (rolePermissions) {
      setTempPermissions(rolePermissions);
    }
  }, [rolePermissions]);

  const handleTogglePermission = (routeId) => {
    playActionClickBeep();
    setTempPermissions((prev) => {
      const list = prev[selectedRoleConfig] || [];
      const exists = list.includes(routeId);
      let updated;
      if (exists) {
        if (selectedRoleConfig === 'admin' && (routeId === 'staff-management' || routeId === 'pos')) {
          showToast('error', 'ບໍ່ສາມາດປິດສິດ POS ຫຼື ຈັດການພະນັກງານຂອງ Admin ໄດ້ (ເພື່ອຄວາມປອດໄພ)');
          return prev;
        }
        updated = list.filter((id) => id !== routeId);
      } else {
        updated = [...list, routeId];
      }
      return {
        ...prev,
        [selectedRoleConfig]: updated,
      };
    });
  };

  const handleSavePermissions = async () => {
    setIsSavingPerms(true);
    const res = await updateRolePermissions(tempPermissions);
    setIsSavingPerms(false);
    if (res.success) {
      playSuccessBeep();
      showToast('success', 'ບັນທຶກສິດການເຂົ້າເຖິງສຳເລັດແລ້ວ! ແຖບເມນູ ແລະ ໜ້າລະບົບອັບເດດທັນທີ.');
    } else {
      playErrorBeep();
      showToast('error', res.error || 'ບໍ່ສາມາດບັນທຶກສິດໄດ້');
    }
  };

  // Sort roles so 'admin' is always first, then 'cashier', then custom roles
  const sortedRolesList = useMemo(() => {
    return [...rolesList].sort((a, b) => {
      if (a.id === 'admin') return -1;
      if (b.id === 'admin') return 1;
      if (a.id === 'cashier') return -1;
      if (b.id === 'cashier') return 1;
      return (a.name || a.id).localeCompare(b.name || b.id);
    });
  }, [rolesList]);

  // Original saved permissions for current role
  const originalRolePerms = useMemo(() => {
    return rolePermissions?.[selectedRoleConfig] || [];
  }, [rolePermissions, selectedRoleConfig]);

  // Current edited permissions for current role
  const currentRolePerms = useMemo(() => {
    return tempPermissions?.[selectedRoleConfig] || [];
  }, [tempPermissions, selectedRoleConfig]);

  // Dirty check for currently selected role
  const isCurrentRoleDirty = useMemo(() => {
    const orig = [...originalRolePerms].sort();
    const curr = [...currentRolePerms].sort();
    if (orig.length !== curr.length) return true;
    return orig.some((val, idx) => val !== curr[idx]);
  }, [originalRolePerms, currentRolePerms]);

  // Dirty check across all roles (so if any role was changed, save can be triggered)
  const isAnyRoleDirty = useMemo(() => {
    if (!rolePermissions || !tempPermissions) return false;
    const allRoleIds = Array.from(
      new Set([...Object.keys(rolePermissions), ...Object.keys(tempPermissions)])
    );
    return allRoleIds.some((rId) => {
      const orig = [...(rolePermissions[rId] || [])].sort();
      const curr = [...(tempPermissions[rId] || [])].sort();
      if (orig.length !== curr.length) return true;
      return orig.some((val, idx) => val !== curr[idx]);
    });
  }, [rolePermissions, tempPermissions]);

  // Handler to reset current role permissions back to saved state
  const handleResetToSaved = () => {
    playActionClickBeep();
    setTempPermissions((prev) => ({
      ...prev,
      [selectedRoleConfig]: [...originalRolePerms],
    }));
  };

  const handleEnableAllForRole = () => {
    playActionClickBeep();
    setTempPermissions((prev) => ({
      ...prev,
      [selectedRoleConfig]: NAVIGATION_SCHEMA.map((item) => item.id),
    }));
  };

  const handleOpenAddRole = () => {
    playActionClickBeep();
    setNewRoleId('');
    setNewRoleName('');
    setNewRoleDesc('');
    setNewRolePerms(['pos', 'products']);
    setIsAddRoleModalOpen(true);
  };

  const handleSaveAddRole = async (e) => {
    e.preventDefault();
    if (!newRoleId.trim() || !newRoleName.trim()) {
      showToast('error', 'ກະລຸນາປ້ອນລະຫັດບົດບາດ ແລະ ຊື່ບົດບາດ');
      return;
    }

    setIsLoading(true);
    const res = await createCustomRole({
      id: newRoleId,
      name: newRoleName,
      description: newRoleDesc,
      permissions: newRolePerms,
    });
    setIsLoading(false);

    if (res.success) {
      playSuccessBeep();
      showToast('success', `ສ້າງບົດບາດໃໝ່ "${newRoleName}" ສຳເລັດແລ້ວ!`);
      setIsAddRoleModalOpen(false);
      setSelectedRoleConfig(res.role.id);
    } else {
      playErrorBeep();
      showToast('error', res.error || 'ບໍ່ສາມາດສ້າງບົດບາດໃໝ່ໄດ້');
    }
  };

  const handleDeleteRole = async (roleId) => {
    if (!window.confirm(`ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລຶບບົດບາດ "${roleId}"?`)) return;

    setIsLoading(true);
    const res = await deleteCustomRole(roleId);
    setIsLoading(false);

    if (res.success) {
      playSuccessBeep();
      showToast('success', 'ລຶບບົດບາດສຳເລັດແລ້ວ!');
      setSelectedRoleConfig('admin');
    } else {
      playErrorBeep();
      showToast('error', res.error || 'ບໍ່ສາມາດລຶບບົດບາດໄດ້');
    }
  };

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter((st) => {
      const matchRole = roleFilter === 'all' || st.role === roleFilter;
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        st.full_name?.toLowerCase().includes(q) ||
        st.email?.toLowerCase().includes(q) ||
        st.role?.toLowerCase().includes(q);
      return matchRole && matchSearch;
    });
  }, [staffList, searchTerm, roleFilter]);

  // Stats count
  const stats = useMemo(() => {
    const total = staffList.length;
    const admins = staffList.filter((s) => s.role === 'admin').length;
    const cashiers = staffList.filter((s) => s.role === 'cashier' && s.is_active).length;
    const inactive = staffList.filter((s) => !s.is_active).length;
    return { total, admins, cashiers, inactive };
  }, [staffList]);

  // Open Add Modal
  const handleOpenAdd = () => {
    playActionClickBeep();
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormPin('1234');
    setFormRole('cashier');
    setFormActive(true);
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (st) => {
    playActionClickBeep();
    setEditingStaff(st);
    setFormName(st.full_name || '');
    setFormEmail(st.email || '');
    setFormRole(st.role || 'cashier');
    setFormPin(st.pin_code || '1234');
    setFormActive(st.is_active !== false);
  };

  // Submit Add Staff
  const handleSaveAdd = async (e) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim() || !formPassword.trim()) {
      showToast('error', 'ກະລຸນາປ້ອນຂໍ້ມູນໃຫ້ຄົບ (ຊື່, Email, ລະຫັດຜ່ານ)');
      return;
    }
    if (formPin.length < 4) {
      showToast('error', 'ລະຫັດ PIN ຕ້ອງມີ 4 ຕົວເລກຂຶ້ນໄປ');
      return;
    }

    setIsLoading(true);
    const res = await adminCreateStaff({
      fullName: formName,
      email: formEmail,
      password: formPassword,
      role: formRole,
      pinCode: formPin,
    });
    setIsLoading(false);

    if (res.success) {
      playSuccessBeep();
      showToast('success', `ສ້າງບັນຊີ ${formName} ສຳເລັດແລ້ວ!`);
      setIsAddModalOpen(false);
      await loadStaff();
      await refreshStaffList();
    } else {
      playErrorBeep();
      showToast('error', res.error || 'ບໍ່ສາມາດສ້າງບັນຊີໄດ້');
    }
  };

  // Submit Edit Staff
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingStaff) return;
    if (!formName.trim()) {
      showToast('error', 'ກະລຸນາປ້ອນຊື່ພະນັກງານ');
      return;
    }

    setIsLoading(true);
    const res = await adminUpdateStaff(editingStaff.id, {
      fullName: formName,
      email: formEmail,
      role: formRole,
      pinCode: formPin,
      isActive: formActive,
    });
    setIsLoading(false);

    if (res.success) {
      playSuccessBeep();
      showToast('success', `ອັບເດດຂໍ້ມູນ ${formName} ສຳເລັດແລ້ວ!`);
      setEditingStaff(null);
      await loadStaff();
      await refreshStaffList();
    } else {
      playErrorBeep();
      showToast('error', res.error || 'ບໍ່ສາມາດອັບເດດໄດ້');
    }
  };

  // Toggle staff active status (Tắt / Bật nhanh)
  const handleToggleActive = async (st, targetStatus) => {
    playActionClickBeep();
    if (!targetStatus && st.role === 'admin') {
      const activeAdmins = staffList.filter((s) => s.role === 'admin' && s.is_active !== false);
      if (activeAdmins.length <= 1) {
        showToast('error', 'ບໍ່ສາມາດປິດບັນຊີ Admin ຫຼັກດຽວຂອງລະບົບໄດ້');
        return;
      }
    }

    setIsLoading(true);
    const res = await adminToggleStaffActive(st.id, targetStatus);
    setIsLoading(false);

    if (res.success) {
      playSuccessBeep();
      showToast(
        'success',
        targetStatus
          ? `ເປີດການນຳໃຊ້ບັນຊີ ${st.full_name} ສຳເລັດແລ້ວ!`
          : `ປິດການນຳໃຊ້ບັນຊີ ${st.full_name} ສຳເລັດແລ້ວ!`
      );
      await loadStaff();
      await refreshStaffList();
    } else {
      playErrorBeep();
      showToast('error', res.error || 'ເກີດຂໍ້ຜິດພາດໃນການປ່ຽນສະຖານະ');
    }
  };

  // Open Delete Modal
  const handleOpenDelete = (st) => {
    playActionClickBeep();
    if (st.role === 'admin') {
      const adminCount = staffList.filter((s) => s.role === 'admin');
      if (adminCount.length <= 1) {
        showToast('error', 'ບໍ່ສາມາດລຶບບັນຊີ Admin ຫຼັກດຽວຂອງລະບົບໄດ້');
        return;
      }
    }
    setDeletingStaff(st);
  };

  // Confirm Permanent Delete staff
  const handleConfirmDelete = async () => {
    if (!deletingStaff) return;
    setIsLoading(true);
    const res = await adminDeleteStaff(deletingStaff.id);
    setIsLoading(false);

    if (res.success) {
      playSuccessBeep();
      showToast('success', `ລຶບບັນຊີ ${deletingStaff.full_name} ສຳເລັດແລ້ວ!`);
      setDeletingStaff(null);
      await loadStaff();
      await refreshStaffList();
    } else {
      playErrorBeep();
      showToast('error', res.error || 'ບໍ່ສາມາດລຶບບັນຊີໄດ້');
    }
  };

  const togglePinReveal = (id) => {
    setRevealedPins((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <main
      className="flex-1 w-full max-w-full p-3 sm:p-5 md:p-6 overflow-y-auto overflow-x-hidden font-sans min-h-0 pb-24 touch-pan-y"
      style={{
        paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))',
        paddingBottom: 'max(5.5rem, calc(4.5rem + env(safe-area-inset-bottom, 0px)))',
        overscrollBehaviorX: 'none',
      }}
    >
      {/* 1. Header Toolbar */}
      <div className="bg-white border-b border-slate-200/80 px-3 sm:px-6 py-2.5 sm:py-3.5 -mx-3 sm:-mx-5 md:-mx-6 -mt-3 sm:-mt-5 md:-mt-6 mb-4 flex items-center justify-between gap-2.5 sm:gap-3 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shrink-0">
            <Users size={20} weight="duotone" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>ຄຸ້ມຄອງບັນຊີພະນັກງານ & ບົດບາດ</span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {staffList.length} ບັນຊີ
              </span>
            </h2>
            <p className="text-[11.5px] text-slate-500 mt-0.5 hidden sm:block">
              ກຳນົດສິດ (Admin / Cashier) • ລະຫັດ PIN 4 ຕົວເລກປ່ຽນກະຂາຍ • ລະງັບບັນຊີ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadStaff}
            disabled={isLoading}
            className="p-2 sm:px-3 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 border border-slate-200 shadow-2xs"
            title="ຣີເຟຣຊ"
          >
            <ArrowClockwise size={15} className={isLoading ? 'animate-spin' : ''} weight="bold" />
            <span className="hidden sm:inline">ຣີເຟຣຊ</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-xl text-xs font-extrabold shadow-sm active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <UserPlus size={16} weight="bold" />
            <span>+ ເພີ່ມພະນັກງານ</span>
          </button>
        </div>
      </div>

      {/* Toast notification banner */}
      {toast && (
        <div
          className={`mb-4 p-3 rounded-xl border text-xs font-bold flex items-center gap-2 shadow-xs transition-all animate-in fade-in slide-in-from-top-1 ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle size={18} weight="fill" className="text-emerald-600 shrink-0" />
          ) : (
            <Warning size={18} weight="fill" className="text-rose-600 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* View Tabs: Staff List vs Role Permissions */}
      <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => {
            playActionClickBeep();
            setActiveViewTab('staff');
          }}
          className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeViewTab === 'staff'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <Users size={16} weight="bold" />
          <span>ລາຍຊື່ພະນັກງານ (ບັນຊີ)</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
            activeViewTab === 'staff' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
          }`}>
            {staffList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            playActionClickBeep();
            setActiveViewTab('permissions');
            setSelectedRoleConfig('admin');
          }}
          className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
            activeViewTab === 'permissions'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'bg-white hover:bg-teal-50 text-slate-600 border border-slate-200'
          }`}
        >
          <ShieldCheck size={16} weight="bold" />
          <span>ກຳນົດສິດ Role & Permissions</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
            activeViewTab === 'permissions' ? 'bg-teal-800 text-teal-100' : 'bg-teal-100 text-teal-800 font-bold'
          }`}>
            ປັບແຕ່ງສິດ
          </span>
        </button>
      </div>

      {/* 2. TAB A: STAFF LIST TABLE */}
      {activeViewTab === 'staff' && (
        <>
          {/* 2. Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-black">
            <Users size={20} weight="duotone" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">ທັງໝົດ</div>
            <div className="text-lg font-black text-slate-900 font-mono">{stats.total}</div>
          </div>
        </div>

        <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-black">
            <ShieldCheck size={20} weight="duotone" />
          </div>
          <div>
            <div className="text-[11px] text-amber-600 font-bold uppercase tracking-wider">ຜູ້ຈັດການ (Admin)</div>
            <div className="text-lg font-black text-amber-900 font-mono">{stats.admins}</div>
          </div>
        </div>

        <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-black">
            <User size={20} weight="duotone" />
          </div>
          <div>
            <div className="text-[11px] text-teal-600 font-bold uppercase tracking-wider">ພະນັກງານຂາຍ</div>
            <div className="text-lg font-black text-teal-900 font-mono">{stats.cashiers}</div>
          </div>
        </div>

        <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-black">
            <Prohibit size={20} weight="duotone" />
          </div>
          <div>
            <div className="text-[11px] text-rose-600 font-bold uppercase tracking-wider">ລະງັບບັນຊີ</div>
            <div className="text-lg font-black text-rose-900 font-mono">{stats.inactive}</div>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Role Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              roleFilter === 'all'
                ? 'bg-slate-900 text-white font-black shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            ທັງໝົດ ({stats.total})
          </button>
          {sortedRolesList.map((r) => {
            const count = staffList.filter((s) => s.role === r.id).length;
            const isSelected = roleFilter === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setRoleFilter(r.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? (r.id === 'admin' ? 'bg-amber-600 text-white font-black shadow-xs' : 'bg-teal-600 text-white font-black shadow-xs')
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {r.name.split(' ')[0]} ({count})
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <MagnifyingGlass
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ຄົ້ນຫາຊື່, ອີເມວ ຫຼື ບົດບາດ..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600 font-medium"
          />
        </div>
      </div>

      {/* 4. Staff Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden mb-6 w-full max-w-full">
        <div className="w-full max-w-full overflow-x-auto overscroll-x-contain touch-pan-y">
          <table className="w-full text-left text-xs border-collapse min-w-[760px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">ຊື່ ແລະ ນາມສະກຸນ</th>
                <th className="py-3 px-3">ອີເມວ (Email)</th>
                <th className="py-3 px-3">ບົດບາດ (Role)</th>
                <th className="py-3 px-3">ລະຫັດ PIN</th>
                <th className="py-3 px-3">ສະຖານະ (Status)</th>
                <th className="py-3 px-3">ວັນທີສ້າງ</th>
                <th className="py-3 px-4 text-center">ຈັດການ (Thao tác)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredStaff.length > 0 ? (
                filteredStaff.map((st, idx) => {
                  const isAdmin = st.role === 'admin';
                  const isRevealed = Boolean(revealedPins[st.id]);

                  return (
                    <tr
                      key={st.id || idx}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        !st.is_active ? 'bg-rose-50/20 text-slate-500' : 'text-slate-900'
                      }`}
                    >
                      {/* Name & Avatar */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-9 h-9 rounded-xl font-black text-sm flex items-center justify-center shrink-0 shadow-xs text-white ${
                              isAdmin
                                ? 'bg-gradient-to-tr from-amber-600 to-amber-500'
                                : 'bg-gradient-to-tr from-teal-600 to-emerald-500'
                            }`}
                          >
                            {st.full_name?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900">{st.full_name}</div>
                            
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3 px-3  text-slate-700">
                        {st.email || 'ບໍ່ມີອີເມວ'}
                      </td>

                      {/* Role Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-black uppercase font-mono ${
                            isAdmin
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-teal-100 text-teal-900 border border-teal-300'
                          }`}
                        >
                          {isAdmin ? (
                            <>
                              <ShieldCheck size={13} weight="bold" />
                              <span>Admin</span>
                            </>
                          ) : (
                            <>
                              <User size={13} weight="bold" />
                              <span>Cashier</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* PIN with Reveal */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 border border-slate-200/80 font-mono font-bold text-slate-800 text-xs">
                          <Key size={13} className="text-slate-400" weight="bold" />
                          <span>{isRevealed ? st.pin_code : '••••'}</span>
                          <button
                            type="button"
                            onClick={() => togglePinReveal(st.id)}
                            className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                            title={isRevealed ? 'ເຊື່ອງ PIN' : 'ເບິ່ງ PIN'}
                          >
                            {isRevealed ? <EyeSlash size={13} /> : <Eye size={13} />}
                          </button>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-black uppercase font-mono ${
                            st.is_active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              st.is_active ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          ></span>
                          <span>{st.is_active ? 'Active' : 'Disabled'}</span>
                        </span>
                      </td>

                      {/* Created At */}
                      <td className="py-3 px-3 text-slate-500 text-[11px] whitespace-nowrap font-mono">
                        {st.created_at ? new Date(st.created_at).toLocaleDateString('lo-LA') : '-'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* 1. ແກ້ໄຂ (Sửa) */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(st)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95 border border-slate-200 shadow-2xs"
                            title="ແກ້ໄຂຂໍ້ມູນ"
                          >
                            <PencilSimple size={13} weight="bold" />
                            <span>ແກ້ໄຂ</span>
                          </button>

                          {/* 2. ປິດ / ເປີດ (Tắt / Bật nhanh) */}
                          {st.is_active ? (
                            <button
                              type="button"
                              onClick={() => handleToggleActive(st, false)}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95 border border-amber-200"
                              title="ປິດການນຳໃຊ້ (Tắt tài khoản)"
                            >
                              <Prohibit size={13} weight="bold" />
                              <span>ປິດ</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleActive(st, true)}
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95 border border-emerald-200"
                              title="ເປີດການນຳໃຊ້ (Bật tài khoản)"
                            >
                              <CheckCircle size={13} weight="bold" />
                              <span>ເປີດ</span>
                            </button>
                          )}

                          {/* 3. ລຶບຖາວອນ (Xóa người dùng vĩnh viễn) */}
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(st)}
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95 border border-rose-200"
                            title="ລຶບບັນຊີຖາວອນ (Xóa tài khoản)"
                          >
                            <Trash size={13} weight="bold" />
                            <span>ລຶບ</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                        <Users size={24} weight="duotone" />
                      </div>
                      <div className="font-bold text-sm text-slate-600">ບໍ່ພົບລາຍຊື່ພະນັກງານ</div>
                      <div className="text-xs text-slate-400">
                        ກົດປຸ່ມ "+ ເພີ່ມພະນັກງານ" ເພື່ອສ້າງບັນຊີໃໝ່ ຫຼື ກົດ "ຣີເຟຣຊ" ເພື່ອໂຫຼດຂໍ້ມູນຄືນ
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenAdd}
                        className="mt-2 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer inline-flex items-center gap-1"
                      >
                        <UserPlus size={14} weight="bold" />
                        <span>+ ເພີ່ມພະນັກງານ</span>
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )}

  {/* 3. TAB B: ROLE PERMISSIONS CUSTOMIZATION MATRIX */}
  {activeViewTab === 'permissions' && (
    <div className="space-y-4 mb-6">
      {/* Role Selector Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={22} weight="duotone" className="text-teal-600" />
            <h3 className="text-sm sm:text-base font-black text-slate-900">
              ກຳນົດສິດການເຂົ້າເຖິງ & ເມນູແຖບຂ້າງ (Sidebar Permissions)
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            ເລືອກບົດບາດ (Role) ດ້ານລຸ່ມເພື່ອເປີດ/ປິດປຸ່ມເມນູ. ປຸ່ມທີ່ຖືກປິດຈະເຊື່ອງຈາກ Sidebar ແລະ ບລັອກການເຂົ້າເຖິງໜ້ານັ້ນທັນທີ.
          </p>
        </div>

        {/* Role Picker Pills */}
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl shrink-0 self-start md:self-auto flex-wrap">
          {sortedRolesList.map((r) => {
            const isSelected = selectedRoleConfig === r.id;
            const permsCount = (tempPermissions[r.id] || []).length;
            const isAdm = r.id === 'admin';

            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  playActionClickBeep();
                  setSelectedRoleConfig(r.id);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? (isAdm ? 'bg-amber-600 text-white shadow-xs' : 'bg-teal-600 text-white shadow-xs')
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isAdm ? <ShieldCheck size={14} weight="bold" /> : <User size={14} weight="bold" />}
                <span>{r.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? 'bg-black/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {permsCount}/8
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={handleOpenAddRole}
            className="px-3 py-1.5 rounded-lg text-xs font-black bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white transition-all flex items-center gap-1 cursor-pointer shadow-xs active:scale-95"
            title="ເພີ່ມບົດບາດໃໝ່ (Thêm Role mới)"
          >
            <Plus size={14} weight="bold" />
            <span>+ ບົດບາດໃໝ່</span>
          </button>
        </div>
      </div>

      {/* Unified Permissions Box */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
        {/* 1. Status & Presets Header Toolbar */}
        <div className="bg-white border-b border-slate-200 p-3 sm:px-4 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">
              ກຳລັງຕັ້ງຄ່າສຳລັບ: <strong className={selectedRoleConfig === 'admin' ? 'text-amber-700' : 'text-teal-700'}>
                {sortedRolesList.find((r) => r.id === selectedRoleConfig)?.name || selectedRoleConfig}
              </strong>
            </span>
            <span className="text-[11px] text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-mono">
              ເປີດໃຊ້ {(tempPermissions[selectedRoleConfig] || []).length} / 8 ເມນູ
            </span>
            {isCurrentRoleDirty && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-200">
                ມີການປ່ຽນແປງ
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {selectedRoleConfig !== 'admin' && selectedRoleConfig !== 'cashier' && (
              <button
                type="button"
                onClick={() => handleDeleteRole(selectedRoleConfig)}
                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                title="ລຶບບົດບາດນີ້ອອກຈາກລະບົບ"
              >
                <Trash size={14} weight="bold" />
                <span>ລຶບບົດບາດນີ້</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleEnableAllForRole}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95"
              title="ເປີດທຸກປຸ່ມ (8/8)"
            >
              <span>ເປີດທັງໝົດ (8/8)</span>
            </button>

            <button
              type="button"
              onClick={handleResetToSaved}
              disabled={!isCurrentRoleDirty}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                isCurrentRoleDirty
                  ? 'bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs active:scale-95 cursor-pointer ring-1 ring-amber-200/50'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-50'
              }`}
              title="ຣີເຊັດຄືນຄ່າເດີມກ່ອນການແກ້ໄຂ"
            >
              <ArrowCounterClockwise
                size={13}
                weight="bold"
                className={isCurrentRoleDirty ? 'text-amber-600' : 'text-slate-400'}
              />
              <span>ຣີເຊັດຄືນ ({originalRolePerms.length})</span>
            </button>
          </div>
        </div>

        {/* 2. Permission Matrix Cards Grid */}
        <div className="p-3.5 sm:p-4 bg-slate-100/90">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {NAVIGATION_SCHEMA.map((route) => {
              const Icon = route.icon;
              const currentList = tempPermissions[selectedRoleConfig] || [];
              const isEnabled = currentList.includes(route.id);
              const isProtected = selectedRoleConfig === 'admin' && (route.id === 'staff-management' || route.id === 'pos');

              return (
                <div
                  key={route.id}
                  onClick={() => {
                    if (!isProtected) handleTogglePermission(route.id);
                  }}
                  className={`p-3.5 rounded-2xl border transition-all select-none flex items-center justify-between gap-3 ${
                    isProtected
                      ? 'bg-slate-200/60 border-slate-300/80 opacity-90 cursor-not-allowed'
                      : isEnabled
                      ? 'bg-white border-teal-300 hover:border-teal-400 shadow-xs cursor-pointer'
                      : 'bg-white/70 border-slate-200 hover:border-slate-300 shadow-2xs cursor-pointer opacity-75'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs transition-colors ${
                        isEnabled
                          ? 'bg-teal-50 text-teal-700 border border-teal-200'
                          : 'bg-slate-100 text-slate-400 border border-slate-200'
                      }`}
                    >
                      <Icon size={20} weight={isEnabled ? 'bold' : 'regular'} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-black truncate ${isEnabled ? 'text-slate-900' : 'text-slate-500'}`}>
                          {route.label}
                        </span>
                        {route.isDefault && (
                          <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-teal-50 text-teal-700 border border-teal-200 font-bold">
                            ໜ້າຫຼັກ
                          </span>
                        )}
                        {isProtected && (
                          <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 font-bold">
                            ລັອກສະເພາະ Admin
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {route.sub}
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10.5px] font-extrabold font-mono uppercase ${
                        isEnabled ? 'text-teal-700' : 'text-slate-400'
                      }`}
                    >
                      {isEnabled ? 'ເປີດ' : 'ປິດ'}
                    </span>

                    {/* iOS-style toggle */}
                    <div
                      className={`w-11 h-6 flex items-center rounded-full p-1 duration-200 cursor-pointer ${
                        isEnabled ? 'bg-teal-600' : 'bg-slate-300'
                      } ${isProtected ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ease-in-out ${
                          isEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Bottom Save Reminder & Action Bar */}
        <div className="p-3.5 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-600 flex items-center gap-1.5">
            <Info size={16} weight="bold" className="text-teal-600 shrink-0" />
            <span>
              ຫຼັງຈາກປັບປ່ຽນປຸ່ມເປີດ/ປິດແລ້ວ, ກະລຸນາກົດປຸ່ມ <strong className="text-slate-900 font-black">"ບັນທຶກການຕັ້ງຄ່າສິດ"</strong> ເພື່ອໃຫ້ມີຜົນຕໍ່ Sidebar ແລະ ລະບົບ.
            </span>
          </div>
          <button
            type="button"
            onClick={handleSavePermissions}
            disabled={!isAnyRoleDirty || isSavingPerms}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
              isAnyRoleDirty && !isSavingPerms
                ? 'bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white shadow-md active:scale-95 cursor-pointer'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
            }`}
          >
            <Check size={16} weight="bold" />
            <span>{isSavingPerms ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກການຕັ້ງຄ່າສິດ'}</span>
          </button>
        </div>
      </div>
    </div>
  )}

  {/* 4. Modal: Add New Role */}
  {isAddRoleModalOpen && (
    <div className="fixed inset-0 z-[160] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col text-slate-900 animate-in zoom-in-95">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} weight="bold" className="text-teal-600" />
            <h3 className="text-sm font-black text-slate-900">ເພີ່ມບົດບາດໃໝ່ (Create New Role)</h3>
          </div>
          <button
            type="button"
            onClick={() => setIsAddRoleModalOpen(false)}
            className="w-7 h-7 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
          >
            <X size={15} weight="bold" />
          </button>
        </div>

        <form onSubmit={handleSaveAddRole} className="p-5 flex flex-col gap-3.5 max-h-[82vh] overflow-y-auto">
          <div>
            <label className="text-xs font-bold text-slate-700 mb-1 block">
              ລະຫັດບົດບາດ (Role ID) * <span className="text-[10.5px] text-slate-400 font-normal">(ຕົວອັກສອນພາສາອັງກິດເຊັ່ນ: warehouse, accountant)</span>
            </label>
            <input
              type="text"
              required
              value={newRoleId}
              onChange={(e) => setNewRoleId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="ຕົວຢ່າງ: warehouse"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-teal-600"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 mb-1 block">ຊື່ບົດບາດສະແດງ (Role Name) *</label>
            <input
              type="text"
              required
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="ຕົວຢ່າງ: ພະນັກງານສາງ (Warehouse)"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-teal-600"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 mb-1 block">ຄຳອະທິບາຍໜ້າທີ່ (Description)</label>
            <input
              type="text"
              value={newRoleDesc}
              onChange={(e) => setNewRoleDesc(e.target.value)}
              placeholder="ຕົວຢ່າງ: ຈັດການສາງ, ຮັບສິນຄ້າເຂົ້າ ແລະ ເບິ່ງສະຕັອກ"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600 font-medium"
            />
          </div>

          {/* Quick toggle permission switches for new role */}
          <div className="pt-2 border-t border-slate-100">
            <label className="text-xs font-black text-slate-800 mb-2 block">
              ເລືອກເມນູ ແລະ ໜ້າທີ່ອະນຸຍາດ:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {NAVIGATION_SCHEMA.map((nav) => {
                const isChecked = newRolePerms.includes(nav.id);
                return (
                  <label
                    key={nav.id}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-bold cursor-pointer transition-all select-none ${
                      isChecked
                        ? 'bg-teal-50/80 border-teal-300 text-teal-900'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewRolePerms((prev) => [...prev, nav.id]);
                        } else {
                          setNewRolePerms((prev) => prev.filter((id) => id !== nav.id));
                        }
                      }}
                      className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                    />
                    <span className="truncate">{nav.shortLabel || nav.label.split(' ')[0]}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="pt-3 flex items-center gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddRoleModalOpen(false)}
              className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            >
              ຍົກເລີກ
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Check size={16} weight="bold" />
              <span>ສ້າງບົດບາດໃໝ່</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )}

  {/* 5. Modal: Add New Staff */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[160] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col text-slate-900 animate-in zoom-in-95">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <UserPlus size={18} weight="bold" className="text-teal-600" />
                <h3 className="text-sm font-black text-slate-900">ເພີ່ມພະນັກງານໃໝ່</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                <X size={15} weight="bold" />
              </button>
            </div>

            <form onSubmit={handleSaveAdd} className="p-5 flex flex-col gap-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">ຊື່ ແລະ ນາມສະກຸນ *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="ຕົວຢ່າງ: ສົມສັກ ແກ້ວມະນີ"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600 font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">ອີເມວ (Email) *</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="somsak@meiishop.la"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600 font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">ລະຫັດຜ່ານເລີ່ມຕົ້ນ *</label>
                <input
                  type="password"
                  required
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="ຢ່າງໜ້ອຍ 6 ຕົວອັກສອນ"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">ລະຫັດ PIN 4 ຕົວເລກ *</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={formPin}
                    onChange={(e) => setFormPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="1234"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-teal-600 text-center tracking-widest"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">ບົດບາດ (Role) *</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-teal-600 cursor-pointer"
                  >
                    {sortedRolesList.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  ຍົກເລີກ
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle size={15} weight="fill" />
                  <span>ບັນທຶກ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal: Edit Staff */}
      {editingStaff && (
        <div className="fixed inset-0 z-[160] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col text-slate-900 animate-in zoom-in-95">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <PencilSimple size={18} weight="bold" className="text-teal-600" />
                <h3 className="text-sm font-black text-slate-900">ແກ້ໄຂຂໍ້ມູນພະນັກງານ</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="w-7 h-7 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                <X size={15} weight="bold" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 flex flex-col gap-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">ຊື່ ແລະ ນາມສະກຸນ *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600 font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">ອີເມວ (Email)</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="name@meiishop.la"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">ລະຫັດ PIN 4 ຕົວເລກ</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={formPin}
                    onChange={(e) => setFormPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-teal-600 text-center tracking-widest"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">ບົດບາດ (Role)</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-teal-600 cursor-pointer"
                  >
                    {sortedRolesList.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status active checkbox */}
              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer text-xs font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                />
                <span>ເປີດນຳໃຊ້ບັນຊີ (Active Status)</span>
              </label>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  ຍົກເລີກ
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle size={15} weight="fill" />
                  <span>ບັນທຶກ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Modal: Confirm Permanent Delete */}
      {deletingStaff && (
        <div className="fixed inset-0 z-[160] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-200 p-5 flex flex-col gap-3 text-slate-900 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
              <Trash size={26} weight="bold" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-black text-slate-900">ລຶບບັນຊີພະນັກງານຖາວອນ?</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການ "ລຶບ" ບັນຊີ{' '}
                <strong className="text-slate-800 font-bold">{deletingStaff.full_name}</strong>?
                <br />
                <span className="text-rose-600 text-[11px] font-bold block mt-1">
                  ຂໍ້ມູນພະນັກງານ ແລະ ລະຫັດ PIN ນີ້ຈະຖືກລຶບອອກຈາກລະບົບຢ່າງຖາວອນ.
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingStaff(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
              >
                ຍົກເລີກ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isLoading}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash size={15} weight="bold" />
                <span>ຢືນຢັນລຶບ</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
