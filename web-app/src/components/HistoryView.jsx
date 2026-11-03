import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ClockCounterClockwise,
  Printer,
  Receipt,
  Invoice,
  Trash,
  PencilSimple,
  MagnifyingGlass,
  ArrowClockwise,
  CheckCircle,
  Prohibit,
  X,
  CalendarBlank,
  HandCoins,
  ArrowsClockwise,
  Money,
  QrCode,
  Warning,
  XCircle,
  Check,
  Barcode,
  User,
  Clock,
  ChartBar,
  ChartLineUp,
  CaretLeft,
  CaretRight,
  Bell,
  FileArrowDown,
  DotsThreeVertical,
  Tag
} from '@phosphor-icons/react';
import { exportTransactionsToExcel } from '../utils/excelExport';
import { formatKip, normalizeLao, getDueDateStatus, formatDateToDDMMYYYY, formatDateTime24h, formatTime24h } from '../utils/formatters';
import CustomerDebtPaymentModal from './inventory/CustomerDebtPaymentModal';
import InvoiceProfitDetailModal, { calculateTxProfitMetrics } from './InvoiceProfitDetailModal';
import BarcodeScannerModal from './BarcodeScannerModal';
import { useHardwareBarcodeScanner, sanitizeBarcode } from '../hooks/useHardwareBarcodeScanner';
import { playUnitChangeBeep, playActionClickBeep, playErrorBeep, playSuccessBeep } from '../utils/audioFeedback';
import { HistoryListSkeleton } from './common/SkeletonLoaders';
import { useAuthRole } from '../contexts/AuthContext';
import { fetchTransactionByIdFromSupabase, fetchArchivedTransactionFromSupabase } from '../services/supabase';
import { getOfflineQueue } from '../services/offlineSyncService';

export default function HistoryView({
  transactions = [],
  products = [],
  realtimeHighlights = {},
  unreadOrderIds = new Set(),
  updatedOrderIds = new Set(),
  onMarkOrderAsRead,
  onMarkAllOrdersAsRead,
  onOpenReceipt,
  onCancelTransaction,
  onDeleteTransaction,
  onUpdateTransaction,
  onRefreshTransactions,
  onEditOrderInPos,
  isLoading,
  onAlert,
}) {
  const { canDeleteOrders, canViewReports } = useAuthRole();
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef(null);

  // Barcode scanner states
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanToast, setScanToast] = useState(null);
  const [scannedHighlightId, setScannedHighlightId] = useState(null);

  // Keep track of user's active date filter tab prior to searching or barcode scanning
  const previousDateFilterRef = useRef('today');
  const isAutoSwitchedRef = useRef(false);

  // 3 Primary Tabs: 'cash' | 'transfer' | 'debt' + 'all' | 'cancelled'
  const [activeTab, setActiveTab] = useState('all');
  
  // Date range filters: 'today' | 'yesterday' | '7days' | 'all' | 'custom' (default 'today' on entry as requested)
  const [dateFilter, setDateFilter] = useState('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Configurable Pagination States (Default 50, with 20 | 50 | 100 | 200 | ALL options)
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [archivedSearchedTx, setArchivedSearchedTx] = useState(null);
  const [isSearchingArchive, setIsSearchingArchive] = useState(false);

  const handleClearSearch = () => {
    setSearchTerm('');
    setScannedHighlightId(null);
    setScanToast(null);
    setArchivedSearchedTx(null);
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
      try {
        searchInputRef.current.focus();
      } catch (_) {}
    }
    // Restore previous date filter if auto-switched by search
    if (isAutoSwitchedRef.current) {
      setDateFilter(previousDateFilterRef.current || 'today');
      isAutoSwitchedRef.current = false;
    }
    setCurrentPage(1);
  };

  // Default to 'today' whenever entering History
  useEffect(() => {
    setDateFilter('today');
    setActiveTab('all');
    previousDateFilterRef.current = 'today';
    isAutoSwitchedRef.current = false;
  }, []);

  const handleSelectDateFilter = (filterKey) => {
    playUnitChangeBeep('history');
    setDateFilter(filterKey);
    previousDateFilterRef.current = filterKey;
    isAutoSwitchedRef.current = false;
    setCurrentPage(1);
  };

  const handleDeleteTransaction = (tx) => {
    if (onDeleteTransaction) {
      onDeleteTransaction(tx);
      // If deleted while search-filtered, restore to previous date tab
      if (isAutoSwitchedRef.current) {
        setDateFilter(previousDateFilterRef.current || 'today');
        isAutoSwitchedRef.current = false;
        setSearchTerm('');
        if (searchInputRef.current) {
          searchInputRef.current.value = '';
        }
      }
    }
  };

  // Modals state
  const [editingTx, setEditingTx] = useState(null);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('cash');

  // Customer Debt Recovery Modal state
  const [debtModalTx, setDebtModalTx] = useState(null);

  // Profit & Cost Breakdown Detail Modal state
  const [selectedProfitTx, setSelectedProfitTx] = useState(null);

  // Fast Product lookup map for dynamic cost and profit computation
  const productsMap = useMemo(() => {
    const map = new Map();
    (products || []).forEach((p) => {
      if (p.id) map.set(p.id, p);
      if (p.barcode) map.set(p.barcode, p);
    });
    return map;
  }, [products]);

  // Row Action Menu State (for 3-dots action popover rendered via Portal to avoid overflow/z-index clipping)
  const [actionMenuState, setActionMenuState] = useState(null);

  const handleToggleActionMenu = (e, tx) => {
    e.stopPropagation();
    if (actionMenuState && actionMenuState.tx.id === tx.id) {
      setActionMenuState(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 165;
    const menuHeight = canDeleteOrders ? 124 : 82;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < 140 && rect.top > 140;

    let left = rect.right - menuWidth;
    if (left < 10) left = 10;
    if (left + menuWidth > window.innerWidth - 10) {
      left = window.innerWidth - menuWidth - 10;
    }

    const top = openUpward ? rect.top - menuHeight - 4 : rect.bottom + 4;

    setActionMenuState({
      tx,
      top,
      left,
      openUpward,
    });
  };

  // Close 3-dots action popover when clicking anywhere outside or scrolling
  useEffect(() => {
    if (!actionMenuState) return;
    const handleClose = () => setActionMenuState(null);
    window.addEventListener('click', handleClose);
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
    };
  }, [actionMenuState]);

  // Filter out all online orders: HistoryView is strictly for direct POS in-store sales (#INV-...)
  // Online orders (#ONL-...) are managed and viewed exclusively in OnlineOrdersView!
  const directTransactions = useMemo(() => {
    const list = (transactions || []).filter((tx) => {
      const isOnline =
        tx.order_source === 'online' ||
        tx.orderSource === 'online' ||
        String(tx.id || '').startsWith('onl_') ||
        String(tx.receiptNumber || tx.receipt_number || '').startsWith('ONL-') ||
        (tx.cashierName || tx.cashier_name) === 'Online Web';
      return !isOnline;
    });

    if (archivedSearchedTx && !list.some((t) => t.id === archivedSearchedTx.id)) {
      return [archivedSearchedTx, ...list];
    }
    return list;
  }, [transactions, archivedSearchedTx]);

  // 1. Transactions filtered strictly by the currently selected date range (today, yesterday, 7days, all, custom)
  const dateFilteredTransactions = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
    const endOfYesterday = new Date(startOfToday.getTime() - 1);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let list = directTransactions;
    if (dateFilter === 'today') {
      list = list.filter((tx) => new Date(tx.createdAt || tx.created_at) >= startOfToday);
    } else if (dateFilter === 'yesterday') {
      list = list.filter((tx) => {
        const d = new Date(tx.createdAt || tx.created_at);
        return d >= startOfYesterday && d <= endOfYesterday;
      });
    } else if (dateFilter === '7days') {
      list = list.filter((tx) => new Date(tx.createdAt || tx.created_at) >= sevenDaysAgo);
    } else if (dateFilter === 'custom') {
      if (startDate) {
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        list = list.filter((tx) => new Date(tx.createdAt || tx.created_at) >= s);
      }
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        list = list.filter((tx) => new Date(tx.createdAt || tx.created_at) <= e);
      }
    }
    return list;
  }, [directTransactions, dateFilter, startDate, endDate]);

  // 2. Tab count calculations (Badges on tabs: ທັງໝົດ, ເງິນສົດ, ເງິນໂອນ, ຕິດໜີ້, ຍົກເລີກແລ້ວ)
  // Strictly filtered by the currently selected date range (ມື້ນີ້, ທັງໝົດ, ມື້ວານ, 7 ມື້...)
  const counts = useMemo(() => {
    let cash = 0;
    let transfer = 0;
    let debt = 0;
    let cancelled = 0;
    let notices = 0;

    dateFilteredTransactions.forEach((tx) => {
      const isCancelled = tx.status === 'cancelled' || tx.isCancelled;
      if (isCancelled) {
        cancelled++;
      } else {
        const isOnlineOrder =
          tx.order_source === 'online' ||
          tx.orderSource === 'online' ||
          String(tx.id || '').startsWith('onl_') ||
          String(tx.receiptNumber || tx.receipt_number || '').startsWith('ONL-') ||
          (tx.cashierName || tx.cashier_name) === 'Online Web';
        const method = (tx.paymentMethod || '').toLowerCase();
        const status = (tx.paymentStatus || '').toUpperCase();
        const total = Number(tx.grandTotal || tx.finalTotalKip || 0);
        const paid = Number(tx.paidAmount ?? tx.amountTendered ?? 0);
        let remainingDebt = Number(tx.remainingDebt ?? tx.debtAmount ?? 0);
        const isDebtOrder =
          !isOnlineOrder &&
          (status === 'DEBT' ||
          status === 'PARTIAL' ||
          remainingDebt > 0 ||
          method === 'debt' ||
          Boolean(tx.debtDueDate || tx.debt_due_date));
        if (isDebtOrder && remainingDebt <= 0 && paid < total) {
          remainingDebt = Math.max(0, total - paid);
        }

        if (isDebtOrder) {
          debt++;
        } else if (
          method === 'transfer' ||
          method === 'qrtransfer' ||
          method === 'onepay' ||
          method === 'qr'
        ) {
          transfer++;
        } else {
          cash++;
        }
      }

      const hasNotice = Boolean(
        (unreadOrderIds && unreadOrderIds.has(tx.id)) ||
        (updatedOrderIds && updatedOrderIds.has(tx.id)) ||
        (realtimeHighlights && realtimeHighlights[tx.id])
      );
      if (hasNotice) notices++;
    });

    return { cash, transfer, debt, cancelled, notices, total: dateFilteredTransactions.length };
  }, [dateFilteredTransactions, unreadOrderIds, updatedOrderIds, realtimeHighlights]);

  // Counts of transactions for each date pill button
  const dateCounts = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
    const endOfYesterday = new Date(startOfToday.getTime() - 1);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let all = directTransactions.length;
    let today = 0;
    let yesterday = 0;
    let sevenDays = 0;

    directTransactions.forEach((tx) => {
      const createdAt = new Date(tx.createdAt || tx.created_at || Date.now());
      if (createdAt >= startOfToday) {
        today++;
      }
      if (createdAt >= startOfYesterday && createdAt <= endOfYesterday) {
        yesterday++;
      }
      if (createdAt >= sevenDaysAgo) {
        sevenDays++;
      }
    });

    return { all, today, yesterday, sevenDays };
  }, [directTransactions]);

  // Dynamic statistics calculated specifically for the CURRENTLY SELECTED timeframe
  const selectedPeriodStats = useMemo(() => {
    let totalBills = 0;
    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;

    dateFilteredTransactions.forEach((tx) => {
      totalBills++; // Count all transactions in this timeframe

      const isCancelled = tx.status === 'cancelled' || tx.isCancelled;
      if (isCancelled) return; // Cancelled bills do not contribute to revenue, cost, or profit

      const rev = Number(tx.finalTotalKip || tx.final_total_kip || tx.grandTotal || tx.grand_total || tx.totalKip || tx.total_kip || 0);
      const metrics = calculateTxProfitMetrics(tx, productsMap);
      const cost = Number(metrics?.totalCost || 0);

      totalRevenue += rev;
      totalCost += cost;
      totalProfit += (rev - cost);
    });

    const overallMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0';

    return {
      totalBills,
      totalRevenue,
      totalCost,
      totalProfit,
      overallMargin,
    };
  }, [dateFilteredTransactions, productsMap]);

  const selectedPeriodLabel = useMemo(() => {
    if (dateFilter === 'today') return 'ມື້ນີ້';
    if (dateFilter === 'yesterday') return 'ມື້ວານ';
    if (dateFilter === '7days') return '7 ມື້ຜ່ານມາ';
    if (dateFilter === 'custom') return 'ຊ່ວງວັນທີເລືອກ';
    return 'ທັງໝົດ';
  }, [dateFilter]);

  // Handler: When clicking Print, mark the order as read
  const handlePrintReceipt = (tx) => {
    playActionClickBeep('history');
    onMarkOrderAsRead?.(tx.id);
    onOpenReceipt?.(tx);
  };

  const unreadCount = unreadOrderIds ? unreadOrderIds.size : 0;

  // Filtering pipeline: Date Filter (dateFilteredTransactions) -> Tab Filter -> Search Filter
  const filteredTransactions = useMemo(() => {
    let list = dateFilteredTransactions;

    // 1. Primary Tab Filtering
    if (activeTab === 'cash') {
      list = list.filter((tx) => {
        const isCancelled = tx.status === 'cancelled' || tx.isCancelled;
        if (isCancelled) return false;
        const method = (tx.paymentMethod || '').toLowerCase();
        const status = (tx.paymentStatus || '').toUpperCase();
        const debt = Number(tx.remainingDebt ?? tx.debtAmount ?? 0);
        const isDebt = status === 'DEBT' || status === 'PARTIAL' || debt > 0 || method === 'debt';
        const isTransfer =
          method === 'transfer' ||
          method === 'qrtransfer' ||
          method === 'onepay' ||
          method === 'qr';
        return !isDebt && !isTransfer;
      });
    } else if (activeTab === 'transfer') {
      list = list.filter((tx) => {
        const isCancelled = tx.status === 'cancelled' || tx.isCancelled;
        if (isCancelled) return false;
        const method = (tx.paymentMethod || '').toLowerCase();
        const status = (tx.paymentStatus || '').toUpperCase();
        const debt = Number(tx.remainingDebt ?? tx.debtAmount ?? 0);
        const isDebt = status === 'DEBT' || status === 'PARTIAL' || debt > 0 || method === 'debt';
        return (
          !isDebt &&
          (method === 'transfer' ||
            method === 'qrtransfer' ||
            method === 'onepay' ||
            method === 'qr')
        );
      });
    } else if (activeTab === 'debt') {
      list = list.filter((tx) => {
        const isCancelled = tx.status === 'cancelled' || tx.isCancelled;
        if (isCancelled) return false;
        const isOnline =
          tx.order_source === 'online' ||
          tx.orderSource === 'online' ||
          String(tx.id || '').startsWith('onl_') ||
          String(tx.receiptNumber || tx.receipt_number || '').startsWith('ONL-') ||
          (tx.cashierName || tx.cashier_name) === 'Online Web';
        if (isOnline) return false;
        const method = (tx.paymentMethod || '').toLowerCase();
        const status = (tx.paymentStatus || '').toUpperCase();
        const debt = Number(tx.remainingDebt ?? tx.debtAmount ?? 0);
        const total = Number(tx.grandTotal || 0);
        const paid = Number(tx.paidAmount ?? tx.amountTendered ?? 0);
        return status === 'DEBT' || status === 'PARTIAL' || debt > 0 || method === 'debt' || (method === 'debt' && paid < total);
      });
    } else if (activeTab === 'cancelled') {
      list = list.filter((tx) => tx.status === 'cancelled' || tx.isCancelled);
    } else if (activeTab === 'notifications') {
      list = list.filter((tx) =>
        (unreadOrderIds && unreadOrderIds.has(tx.id)) ||
        (updatedOrderIds && updatedOrderIds.has(tx.id)) ||
        (realtimeHighlights && realtimeHighlights[tx.id])
      );
    }

    // 3. Search query filter: Mã bill, tên khách hàng, hình thức thanh toán VÀ tên sản phẩm / barcode / đơn vị trong bill
    const rawSearch = String(searchTerm || '').replace(/[\r\n\t]/g, '').trim();
    if (!rawSearch) return list;

    // Normalize slashes/underscores to hyphens and auto-repair scanner artifacts (e.g. INV-32586183 -> INV-586183)
    let normalizedSearch = rawSearch.replace(/[\/\\]/g, '-');
    if (/^inv[\/\\_\s-]*32(\d{6})$/i.test(normalizedSearch)) {
      normalizedSearch = normalizedSearch.replace(/^inv[\/\\_\s-]*32(\d{6})$/i, 'INV-$1');
    } else if (/^32(\d{6})$/.test(normalizedSearch)) {
      normalizedSearch = normalizedSearch.replace(/^32(\d{6})$/, 'INV-$1');
    } else if (/^inv[\/\\_\s-]*\d+/i.test(normalizedSearch)) {
      normalizedSearch = normalizedSearch.replace(/^inv[\/\\_\s-]*(\d+)/i, 'INV-$1');
    }
    const cleanQ = normalizeLao(normalizedSearch).replace(/^#/, '');
    const compactQ = cleanQ.replace(/[-_\s]/g, '');
    const stripped32Q = compactQ.startsWith('inv32') && compactQ.length === 11
      ? 'inv' + compactQ.slice(5)
      : (compactQ.startsWith('32') && compactQ.length === 8 ? compactQ.slice(2) : compactQ);
    if (!cleanQ) return list;

    // If searching by barcode / code and not found in date-filtered list, search across all transactions
    const searchPool = (dateFilter !== 'all' && rawSearch.length >= 3) ? directTransactions : list;

    return searchPool.filter((tx) => {
      // 3.1. Tìm theo thông tin chung của đơn hàng (receiptNumber, receipt_number, id, customerName, ...)
      const rawNum = tx.receiptNumber || tx.receipt_number || '';
      const txNum = normalizeLao(rawNum).replace(/^#/, '').replace(/[\/\\]/g, '-');
      const txCompact = txNum.replace(/[-_\s]/g, '');
      const txId = normalizeLao(tx.id || '').replace(/^#/, '');
      const txIdCompact = txId.replace(/[-_\s]/g, '');
      const matchBasic =
        (txNum && (txNum === cleanQ || txNum.includes(cleanQ) || cleanQ.includes(txNum))) ||
        (compactQ.length >= 4 && (txCompact === compactQ || txCompact.includes(compactQ) || compactQ.includes(txCompact))) ||
        (stripped32Q.length >= 4 && (txCompact === stripped32Q || txCompact.includes(stripped32Q) || stripped32Q.includes(txCompact))) ||
        (txId && (txId === cleanQ || txId.includes(cleanQ) || cleanQ.includes(txId))) ||
        (compactQ.length >= 4 && (txIdCompact === compactQ || txIdCompact.includes(compactQ) || compactQ.includes(txIdCompact))) ||
        (stripped32Q.length >= 4 && (txIdCompact === stripped32Q || txIdCompact.includes(stripped32Q) || stripped32Q.includes(txIdCompact))) ||
        (cleanQ.length >= 4 && txNum && txNum.endsWith(cleanQ)) ||
        (compactQ.length >= 4 && txCompact && txCompact.endsWith(compactQ)) ||
        (stripped32Q.length >= 4 && txCompact && txCompact.endsWith(stripped32Q)) ||
        normalizeLao(tx.customerName).includes(cleanQ) ||
        normalizeLao(tx.paymentMethod).includes(cleanQ) ||
        normalizeLao(tx.status).includes(cleanQ) ||
        normalizeLao(tx.debtNote).includes(cleanQ);

      if (matchBasic) return true;

      // 3.2. Tìm theo danh sách sản phẩm bên trong bill (items hoặc sale_transaction_items)
      const billItems = (tx.items && tx.items.length > 0)
        ? tx.items
        : (tx.sale_transaction_items || []);

      const matchItem = billItems.some((it) => {
        const prodName = normalizeLao(it.productName || it.product_name || it.product?.name || '');
        const barcode = normalizeLao(it.barcode || it.product?.barcode || '');
        const unitName = normalizeLao(it.unitName || it.unit_name || it.unit?.unitName || '');

        return (
          prodName.includes(cleanQ) ||
          (barcode && (barcode === cleanQ || barcode.includes(cleanQ) || cleanQ.includes(barcode))) ||
          unitName.includes(cleanQ)
        );
      });

      return matchItem;
    });
  }, [dateFilteredTransactions, activeTab, searchTerm, directTransactions, unreadOrderIds, updatedOrderIds, realtimeHighlights, dateFilter]);

  const tableTopRef = useRef(null);

  const scrollToTableTop = () => {
    tableTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handlePageChange = (newPage) => {
    if (newPage === currentPage || newPage < 1 || newPage > totalPages) return;
    playActionClickBeep('history');
    setCurrentPage(newPage);
    scrollToTableTop();
  };

  const handlePageSizeChange = (newSize) => {
    playActionClickBeep('history');
    setPageSize(newSize);
    setCurrentPage(1);
    scrollToTableTop();
  };

  const totalItemsCount = filteredTransactions.length;

  // Background targeted search for archived transactions (> 1000 items) if not found in memory
  useEffect(() => {
    const rawSearch = searchTerm.trim().replace(/^#/, '');
    if (!rawSearch || rawSearch.length < 3) {
      if (archivedSearchedTx) setArchivedSearchedTx(null);
      return;
    }
    // Check if matched in local in-memory transactions
    const foundInMem = directTransactions.some((tx) => {
      const rawNum = tx.receiptNumber || tx.receipt_number || '';
      return rawNum.toLowerCase().includes(rawSearch.toLowerCase()) || tx.id?.includes(rawSearch);
    });
    if (foundInMem) return;

    let isCurrent = true;
    const timer = setTimeout(async () => {
      setIsSearchingArchive(true);
      try {
        const archived = await fetchArchivedTransactionFromSupabase(rawSearch);
        if (isCurrent && archived) {
          setArchivedSearchedTx(archived);
        }
      } catch (_) {}
      if (isCurrent) setIsSearchingArchive(false);
    }, 450);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [searchTerm, directTransactions, archivedSearchedTx]);

  const totalPages = useMemo(() => {
    if (pageSize === 'ALL' || !pageSize) return 1;
    return Math.max(1, Math.ceil(totalItemsCount / pageSize));
  }, [totalItemsCount, pageSize]);

  // Protect currentPage within bounds when items count changes
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Export filtered transactions to Excel (.xlsx)
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const handleExportExcel = async () => {
    const listToExport = displayedTransactions.length > 0 ? displayedTransactions : filteredTransactions;
    if (!listToExport || listToExport.length === 0) return;
    try {
      setIsExportingExcel(true);
      playActionClickBeep('history');
      const tabNames = {
        all: 'ທັງໝົດ',
        cash: 'ເງິນສົດ',
        transfer: 'ໂອນເງິນ',
        debt: 'ຄ້າງຊຳລະ',
        cancelled: 'ຍົກເລີກແລ້ວ',
        notifications: 'ແຈ້ງເຕືອນໃໝ່',
      };
      const dateNames = {
        all: 'ທັງໝົດ',
        today: 'ມື້ນີ້',
        yesterday: 'ມື້ວານ',
        '7days': '7 ມື້ຜ່ານມາ',
        custom: `${startDate || '...'} ຫາ ${endDate || '...'}`,
      };

      await exportTransactionsToExcel(listToExport, {
        timeframeLabel: dateNames[dateFilter] || dateFilter,
        tabLabel: tabNames[activeTab] || activeTab,
        searchQuery: searchTerm,
      });
    } catch (err) {
      console.error('Export transactions error:', err);
      if (onAlert) {
        onAlert(`ດາວໂຫຼດ Excel ບໍ່ສຳເລັດ: ${err.message || 'ເກີດຂໍ້ຜິດພາດ'}`, 'ຜິດພາດ', 'error');
      }
    } finally {
      setIsExportingExcel(false);
    }
  };

  const paginatedTransactions = useMemo(() => {
    if (pageSize === 'ALL' || !pageSize) {
      return filteredTransactions;
    }
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  // Instant In-Memory Paginated transactions + any pending offline bills on page 1
  const displayedTransactions = useMemo(() => {
    if (currentPage === 1 && !searchTerm) {
      try {
        const pendingQueue = getOfflineQueue();
        const pendingDirect = (pendingQueue || [])
          .filter((item) => {
            const tx = item.receipt || item;
            const isOnline = tx.order_source === 'online' || tx.orderSource === 'online';
            return !isOnline;
          })
          .map((item) => ({ ...item.receipt, isOfflinePending: true }));

        if (pendingDirect.length > 0) {
          const ids = new Set(paginatedTransactions.map((t) => t.id));
          const freshPending = pendingDirect.filter((t) => !ids.has(t.id));
          return [...freshPending, ...paginatedTransactions];
        }
      } catch (_) {}
    }
    return paginatedTransactions;
  }, [paginatedTransactions, currentPage, searchTerm]);

  // Smart page numbers pagination algorithm
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = [];
    pages.push(1);
    if (currentPage > 3) {
      pages.push('...');
    }
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) {
      pages.push('...');
    }
    pages.push(totalPages);
    return pages;
  };

  // Handle Barcode Scan (Both Camera modal & Hardware USB/Bluetooth scanner)
  // Replaces the search term without requiring manual clear or backspace
  const handleScanBarcode = (barcode) => {
    if (!barcode) return;
    let cleanCode = sanitizeBarcode(barcode).trim();
    if (!cleanCode) return;

    // 0. Auto-fix common scanner artifacts (e.g. INV-32586183, INV32586183, INV-586183 -> INV-586183)
    if (/^inv[\/\\_\s-]*32(\d{6})$/i.test(cleanCode)) {
      cleanCode = cleanCode.replace(/^inv[\/\\_\s-]*32(\d{6})$/i, 'INV-$1');
    } else if (/^32(\d{6})$/.test(cleanCode)) {
      cleanCode = cleanCode.replace(/^32(\d{6})$/, 'INV-$1');
    } else if (/^inv[\/\\_\s-]*\d+/i.test(cleanCode)) {
      cleanCode = cleanCode.replace(/^inv[\/\\_\s-]*(\d+)/i, 'INV-$1');
    }
    if (/^onl[\/\\_\s-]*\d+/i.test(cleanCode)) {
      cleanCode = cleanCode.replace(/^onl[\/\\_\s-]*(\d{6})[\/\\_\s-]*(\d+)/i, 'ONL-$1-$2');
    }

    // If scanner only captured digits e.g. 2586183, resolve to INV-2586183
    if (/^\d{6,8}$/.test(cleanCode)) {
      const foundTx = directTransactions.find((t) => {
        const num = (t.receiptNumber || t.receipt_number || '').trim();
        return num === `INV-${cleanCode}` || num.endsWith(cleanCode);
      });
      if (foundTx) {
        cleanCode = foundTx.receiptNumber || foundTx.receipt_number || `INV-${cleanCode}`;
      } else {
        cleanCode = `INV-${cleanCode}`;
      }
    }

    // 1. Remember current active date filter & switch to 'all' so scanned bill is always found across all history
    if (!isAutoSwitchedRef.current) {
      previousDateFilterRef.current = dateFilter;
      isAutoSwitchedRef.current = true;
    }
    setDateFilter('all');
    setActiveTab('all');

    // 2. Immediately set search term in state
    setSearchTerm(cleanCode);

    // 3. Direct DOM sync to ensure input displays value without requiring focus or backspace
    const inputEl = searchInputRef.current || document.getElementById('history-search-input');
    if (inputEl) {
      const proto = window.HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
      if (descriptor && descriptor.set) {
        descriptor.set.call(inputEl, cleanCode);
      } else {
        inputEl.value = cleanCode;
      }
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
      try {
        inputEl.blur();
      } catch (_) {}
    }

    setScannerOpen(false);

    // 4. Look for matching transaction in full list
    const cleanRaw = cleanCode.replace(/^#/, '');
    const q = normalizeLao(cleanRaw);
    const compactQ = q.replace(/[-_\s]/g, '');
    const stripped32Q = compactQ.startsWith('inv32') && compactQ.length === 11
      ? 'inv' + compactQ.slice(5)
      : (compactQ.startsWith('32') && compactQ.length === 8 ? compactQ.slice(2) : compactQ);

    const matched = directTransactions.find((tx) => {
      const rawNum = tx.receiptNumber || tx.receipt_number || '';
      const txNum = normalizeLao(rawNum).replace(/^#/, '');
      const txCompact = txNum.replace(/[-_\s]/g, '');
      const txId = normalizeLao(tx.id || '').replace(/^#/, '');
      const txIdCompact = txId.replace(/[-_\s]/g, '');

      if ((txNum && (txNum === q || txNum.includes(q) || q.includes(txNum))) ||
          (compactQ.length >= 4 && (txCompact === compactQ || txCompact.includes(compactQ) || compactQ.includes(txCompact))) ||
          (stripped32Q.length >= 4 && (txCompact === stripped32Q || txCompact.includes(stripped32Q) || stripped32Q.includes(txCompact))) ||
          (txId && (txId === q || txId.includes(q) || q.includes(txId))) ||
          (compactQ.length >= 4 && (txIdCompact === compactQ || txIdCompact.includes(compactQ) || compactQ.includes(txIdCompact))) ||
          (stripped32Q.length >= 4 && (txIdCompact === stripped32Q || txIdCompact.includes(stripped32Q) || stripped32Q.includes(txIdCompact)))) {
        return true;
      }

      const billItems = tx.items?.length > 0 ? tx.items : (tx.sale_transaction_items || []);
      return billItems.some((it) => {
        const b = normalizeLao(it.barcode || it.product?.barcode || '');
        return b && (b === q || b.includes(q) || q.includes(b));
      });
    });

    const onMatchSuccess = (matchedItem) => {
      playSuccessBeep();
      setScannedHighlightId(matchedItem.id);
      setScanToast({
        type: 'success',
        message: `ພົບເຫັນບິນ #${matchedItem.receiptNumber || matchedItem.receipt_number || matchedItem.id} (${matchedItem.customerName || 'ລູກຄ້າທົ່ວໄປ'})`,
      });
      setTimeout(() => setScanToast(null), 3500);
      setTimeout(() => setScannedHighlightId(null), 7000);

      setTimeout(() => {
        const el = document.getElementById(`tx-card-${matchedItem.id}`) || document.getElementById(`tx-row-${matchedItem.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 200);
    };

    if (matched) {
      onMatchSuccess(matched);
    } else {
      // If not in current local cache, targetedly fetch archive from Supabase
      fetchArchivedTransactionFromSupabase(cleanCode).then((archivedTx) => {
        if (archivedTx) {
          setArchivedSearchedTx(archivedTx);
          onMatchSuccess(archivedTx);
        } else {
          playErrorBeep();
          setScanToast({
            type: 'error',
            message: `ບໍ່ພົບເຫັນບິນທີ່ມີລະຫັດບາໂຄດ: "${cleanCode}"`,
          });
          setTimeout(() => setScanToast(null), 3500);
        }
      });
    }
  };

  // Hardware Scanner Listener: Automatically captures barcode & fills/replaces search input without focus
  useHardwareBarcodeScanner({
    onScan: handleScanBarcode,
    enabled: true,
    maxInterval: 180,
    maxAvgInterval: 85,
    duplicateInterval: 250,
    minLength: 3,
    preventDefaultOnEnter: true,
    cleanActiveInput: true,
  });

  // Simple Customer Name / Method edit modal
  const handleOpenEdit = (tx) => {
    setEditingTx(tx);
    setEditCustomerName(tx.customerName || 'ລູກຄ້າທົ່ວໄປ');
    setEditPaymentMethod(tx.paymentMethod || 'cash');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingTx) return;
    if (onUpdateTransaction) {
      const ok = await onUpdateTransaction(editingTx.id, {
        customerName: editCustomerName.trim() || 'ລູກຄ້າທົ່ວໄປ',
        paymentMethod: editPaymentMethod,
      });
      if (ok) setEditingTx(null);
    }
  };

  return (
    <main
      className="flex-1 w-full max-w-full p-3 sm:p-5 md:p-6 overflow-y-auto overflow-x-hidden font-sans min-h-0 pb-4 sm:pb-6 touch-pan-y"
      style={{
        paddingRight: 'max(0.75rem, env(safe-area-inset-right, 0px))',
        overscrollBehaviorX: 'none',
      }}
    >
      {/* Top Header Bar (Standardized matching GRN & Products) */}
      <div className="bg-white border-b border-slate-200/80 px-3 sm:px-6 py-2.5 sm:py-3.5 -mx-3 sm:-mx-5 md:-mx-6 -mt-3 sm:-mt-5 md:-mt-6 mb-3 sm:mb-4 flex items-center justify-between gap-2.5 sm:gap-3 shrink-0 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700 shrink-0">
            <Receipt size={20} className="sm:w-5 sm:h-5" weight="duotone" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span className="truncate">
                <span className="sm:hidden">ປະຫວັດບິນຂາຍ</span>
                <span className="hidden sm:inline">ປະຫວັດບິນຂາຍ & ໜີ້ສິນ</span>
              </span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                {directTransactions.length} ບິນ
              </span>
            </h2>
            <p className="text-[11.5px] sm:text-xs text-slate-500 mt-0.5 hidden sm:block truncate">
              ລາຍການບິນຂາຍ • ແຍກໝວດຊຳລະ • ແກ້ໄຂບິນ POS • ຊຳລະໜີ້ລູກຄ້າ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Export to Excel (Export theo filter: ngày, tab thanh toán, tìm kiếm) */}
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExportingExcel || filteredTransactions.length === 0}
            className="px-2.5 sm:px-3.5 py-2 sm:py-2.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            title={`ດາວໂຫຼດ Excel (${filteredTransactions.length} ບິນ)`}
          >
            <FileArrowDown size={15} weight="bold" />
            <span className="hidden sm:inline">Export Excel</span>
            <span className="sm:hidden">Excel</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onRefreshTransactions?.();
            }}
            disabled={isLoading}
            className="p-2 sm:p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 border border-slate-200 shadow-2xs"
            title="ໂຫຼດຂໍ້ມູນຄືນຈາກ Supabase"
          >
            <ArrowClockwise size={15} className={isLoading ? 'animate-spin' : ''} weight="bold" />
            <span className="hidden sm:inline">ຣີເຟຣຊ</span>
          </button>
        </div>
      </div>

      {/* 1. DATE FILTER TOOLBAR (Top: ທັງໝົດ, ມື້ນີ້, ມື້ວານ, 7 ມື້ຜ່ານມາ, ເລືອກວັນທີ...) */}
      <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/90 shadow-2xs mb-3 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <CalendarBlank size={16} className="text-slate-400 shrink-0 ml-1 mr-0.5" />
          
          {/* ທັງໝົດ */}
          <button
            type="button"
            onClick={() => handleSelectDateFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border ${
              dateFilter === 'all'
                ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>ທັງໝົດ</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                dateFilter === 'all' ? 'bg-teal-700 text-teal-100' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {dateCounts.all}
            </span>
          </button>

          {/* ມື້ນີ້ (Today) */}
          <button
            type="button"
            onClick={() => handleSelectDateFilter('today')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border ${
              dateFilter === 'today'
                ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>ມື້ນີ້ (Today)</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                dateFilter === 'today' ? 'bg-teal-700 text-teal-100' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {dateCounts.today}
            </span>
          </button>

          {/* ມື້ວານ (Yesterday) */}
          <button
            type="button"
            onClick={() => handleSelectDateFilter('yesterday')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border ${
              dateFilter === 'yesterday'
                ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>ມື້ວານ (Yesterday)</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                dateFilter === 'yesterday' ? 'bg-teal-700 text-teal-100' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {dateCounts.yesterday}
            </span>
          </button>

          {/* 7 ມື້ຜ່ານມາ (7 Days) */}
          <button
            type="button"
            onClick={() => handleSelectDateFilter('7days')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border ${
              dateFilter === '7days'
                ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>7 ມື້ຜ່ານມາ (7 Days)</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                dateFilter === '7days' ? 'bg-teal-700 text-teal-100' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {dateCounts.sevenDays}
            </span>
          </button>

          {/* ເລືອກວັນທີ... */}
          <button
            type="button"
            onClick={() => handleSelectDateFilter('custom')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap border ${
              dateFilter === 'custom'
                ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            ເລືອກວັນທີ...
          </button>
        </div>

        {/* Custom Range Inputs (shown when dateFilter === 'custom') */}
        {dateFilter === 'custom' && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium">ແຕ່:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-teal-500"
            />
            <span className="text-slate-400 font-medium">ຫາ:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-teal-500"
            />
          </div>
        )}
      </div>

      {/* 2. STATS IN THE MIDDLE: Info-only compact cards (Box 1: Số bill, Box 2: Doanh thu, Box 3: Giá vốn, Box 4: Tiền lãi) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3.5 select-none pointer-events-none">
        {/* Card 1: ຍອດລວມບິນ (Box 1: Giữ nguyên như cũ) */}
        <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-black shrink-0">
            <Receipt size={20} weight="duotone" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider truncate">
              ທັງໝົດ ({selectedPeriodLabel})
            </div>
            <div className="text-lg font-black text-slate-900 font-mono leading-tight">
              {selectedPeriodStats.totalBills} <span className="text-xs font-normal text-slate-400">ບິນ</span>
            </div>
          </div>
        </div>

        {/* Card 2: ຍອດຂາຍລວມ (Box 2: Tổng tiền đã bán được) */}
        <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-black shrink-0">
            <Money size={20} weight="duotone" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-blue-600 font-bold uppercase tracking-wider truncate">
              ຍອດຂາຍ ({selectedPeriodLabel})
            </div>
            <div className="text-lg font-black text-blue-900 font-mono leading-tight truncate">
              {formatKip(selectedPeriodStats.totalRevenue)} <span className="text-xs font-normal text-blue-600/70"></span>
            </div>
          </div>
        </div>

        {/* Card 3: ຕົ້ນທຶນສິນຄ້າ (Box 3: Số tiền giá nhập đã được bán) */}
        <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-black shrink-0">
            <Tag size={20} weight="duotone" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-amber-600 font-bold uppercase tracking-wider truncate">
              ຕົ້ນທຶນສິນຄ້າ ({selectedPeriodLabel})
            </div>
            <div className="text-lg font-black text-amber-900 font-mono  truncate">
              {formatKip(selectedPeriodStats.totalCost)} <span className="text-xs font-normal text-amber-600/70"></span>
            </div>
          </div>
        </div>

        {/* Card 4: ກຳໄລລວມ (Box 4: Tiền lãi - đã trừ với tiền giá nhập) */}
        <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black shrink-0 ${
            selectedPeriodStats.totalProfit < 0
              ? 'bg-rose-50 text-rose-700'
              : 'bg-emerald-50 text-emerald-700'
          }`}>
            <ChartLineUp size={20} weight="duotone" />
          </div>
          <div className="min-w-0">
            <div className={`text-[11px] font-bold uppercase tracking-wider truncate ${
              selectedPeriodStats.totalProfit < 0 ? 'text-rose-600' : 'text-emerald-700'
            }`}>
              {selectedPeriodStats.totalProfit < 0 ? 'ຂາດທຶນ' : 'ກຳໄລ'} ({selectedPeriodStats.overallMargin}%)
            </div>
            <div className={`text-lg font-black font-mono leading-tight truncate ${
              selectedPeriodStats.totalProfit < 0 ? 'text-rose-600' : 'text-emerald-800'
            }`}>
              {selectedPeriodStats.totalProfit > 0 ? '+' : ''}{formatKip(selectedPeriodStats.totalProfit)} <span className="text-xs font-normal opacity-70"></span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. PAYMENT CATEGORY TABS & SEARCH BAR (Below Stats) */}
      <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/90 shadow-2xs mb-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Payment category tabs: All, Cash, Transfer, Debt, Cancelled */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {/* Tab 1: ທັງໝົດ */}
          <button
            type="button"
            onClick={() => {
              playUnitChangeBeep('history');
              setActiveTab('all');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Receipt size={15} weight="bold" />
            <span>ທັງໝົດ</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'all' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {counts.total}
            </span>
          </button>

          {/* Tab 2: ເງິນສົດ */}
          <button
            type="button"
            onClick={() => {
              playUnitChangeBeep('history');
              setActiveTab('cash');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border ${
              activeTab === 'cash'
                ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Money size={15} weight="bold" />
            <span>ເງິນສົດ</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'cash' ? 'bg-teal-700 text-teal-100' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {counts.cash}
            </span>
          </button>

          {/* Tab 3: ເງິນໂອນ */}
          <button
            type="button"
            onClick={() => {
              playUnitChangeBeep('history');
              setActiveTab('transfer');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border ${
              activeTab === 'transfer'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <QrCode size={15} weight="bold" />
            <span>ເງິນໂອນ</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'transfer' ? 'bg-blue-700 text-blue-100' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {counts.transfer}
            </span>
          </button>

          {/* Tab 4: ຕິດໜີ້ */}
          <button
            type="button"
            onClick={() => {
              playUnitChangeBeep('history');
              setActiveTab('debt');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border ${
              activeTab === 'debt'
                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100/70'
            }`}
          >
            <HandCoins size={15} weight="bold" />
            <span>ຄ້າງຊຳລະ</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                activeTab === 'debt' ? 'bg-amber-700 text-amber-100' : 'bg-amber-200 text-amber-900'
              }`}
            >
              {counts.debt}
            </span>
          </button>

          {/* Tab 5: ຍົກເລີກ */}
          <button
            type="button"
            onClick={() => {
              playUnitChangeBeep('history');
              setActiveTab('cancelled');
            }}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
              activeTab === 'cancelled'
                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
            }`}
          >
            <span>ຍົກເລີກ ({counts.cancelled})</span>
          </button>

          {/* Tab 6: ແຈ້ງເຕືອນ (Đơn mới / Sửa mới) */}
          <button
            type="button"
            onClick={() => {
              playUnitChangeBeep('history');
              setActiveTab('notifications');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 border ${
              activeTab === 'notifications'
                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                : counts.notices > 0
                ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100/70'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Bell size={15} weight="bold" />
            <span>ແຈ້ງເຕືອນ</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                activeTab === 'notifications' ? 'bg-amber-700 text-amber-100' : 'bg-amber-200 text-amber-900'
              }`}
            >
              {counts.notices}
            </span>
          </button>
        </div>

        {/* Search input & Barcode scanner */}
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-80">
            {isSearchingArchive ? (
              <ArrowClockwise
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-teal-600 animate-spin pointer-events-none"
              />
            ) : (
              <MagnifyingGlass
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            )}
            <input
              ref={searchInputRef}
              id="history-search-input"
              type="text"
              data-barcode-input="true"
              data-barcode-replace="true"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
              autoComplete="off"
              value={searchTerm}
              onChange={(e) => {
                let val = e.target.value;
                if (/^inv[\/\\_\s-]*32(\d{6})$/i.test(val)) {
                  val = val.replace(/^inv[\/\\_\s-]*32(\d{6})$/i, 'INV-$1');
                } else if (/^32(\d{6})$/.test(val)) {
                  val = val.replace(/^32(\d{6})$/, 'INV-$1');
                } else if (/^inv[\/\\_\s-]*\d+/i.test(val)) {
                  val = val.replace(/^inv[\/\\_\s-]*(\d+)/i, 'INV-$1');
                }
                if (/^onl[\/\\_\s-]*\d+/i.test(val)) {
                  val = val.replace(/^onl[\/\\_\s-]*(\d{6})[\/\\_\s-]*(\d+)/i, 'ONL-$1-$2');
                }

                if (val.trim()) {
                  // Auto-switch to 'all' to search across all history
                  if (!isAutoSwitchedRef.current) {
                    previousDateFilterRef.current = dateFilter;
                    isAutoSwitchedRef.current = true;
                  }
                  setDateFilter('all');
                  setActiveTab('all');
                } else {
                  // When filter input is cleared (deleted/empty), restore to previous date tab (e.g. today or yesterday)
                  if (isAutoSwitchedRef.current) {
                    setDateFilter(previousDateFilterRef.current || 'today');
                    isAutoSwitchedRef.current = false;
                  }
                }

                setSearchTerm(val);
              }}
              placeholder="ຄົ້ນຫາເລກບິນ, ລູກຄ້າ, ສິນຄ້າ..."
              className="w-full h-9 pl-8 pr-20 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-teal-600 font-medium"
            />

            {/* Action Buttons: Quick Clear 'X' and Camera Scan - Compact height with breathing room */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {searchTerm && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="w-6 h-6 sm:w-6.5 sm:h-6.5 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white rounded-md flex items-center justify-center shrink-0 cursor-pointer shadow-xs active:scale-95 transition-all"
                  title="ລຶບການຄົ້ນຫາ (Xóa tất cả)"
                >
                  <X size={13} weight="bold" />
                </button>
              )}

              {/* Barcode Camera Button inside Search Bar - Icon only */}
              <button
                type="button"
                onClick={() => {
                  playActionClickBeep();
                  setScannerOpen(true);
                }}
                className="w-6 h-6 sm:w-6.5 sm:h-6.5 rounded-md bg-teal-50 hover:bg-teal-600 hover:text-white text-teal-700 transition-all cursor-pointer border border-teal-200 shadow-2xs flex items-center justify-center relative active:scale-95"
                title="ເປີດກ້ອງສະແກນບາໂຄດບິນ (Camera Barcode Scanner) • ຮອງຮັບເຄື່ອງຍິງບາໂຄດ USB/Bluetooth ອັດຕະໂນມັດ"
              >
                <Barcode size={15} weight="bold" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse absolute top-0.5 right-0.5" title="Hardware Scanner Ready" />
              </button>
            </div>
          </div>
          

          {/* Mark All As Read Button: placed on the right side next to search bar */}
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => {
                playSuccessBeep('history');
                onMarkAllOrdersAsRead?.();
              }}
              className="py-1.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer whitespace-nowrap shrink-0"
              title="ໝາຍວ່າອ່ານທັງໝົດ (Mark all as read)"
            >
              <CheckCircle size={15} weight="bold" />
              <span className="hidden sm:inline">ໝາຍວ່າອ່ານທັງໝົດ</span>
              <span className="sm:hidden">ອ່ານໝົດ</span>
              <span className="px-1.5 py-0.5 rounded-full bg-teal-800/90 text-white text-[10px] font-sans font-black tabular-nums shadow-xs">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Skeleton Loading State */}
      {isLoading && (!displayedTransactions || displayedTransactions.length === 0) ? (
        <HistoryListSkeleton count={6} />
      ) : (
        <>
          {/* Scroll anchor for pagination scroll-to-top */}
          <div ref={tableTopRef} className="scroll-mt-3 sm:scroll-mt-4" />
          {/* 3. MOBILE VIEW (< 768px): Touch-Optimized Cards */}
          <div className="md:hidden flex flex-col gap-3 pb-6">
            {displayedTransactions.map((tx) => {
          const isCancelled = tx.status === 'cancelled' || tx.isCancelled;
          const total = Number(tx.grandTotal) || 0;
          const paid = Number(tx.paidAmount ?? tx.amountTendered ?? 0);
          const method = (tx.paymentMethod || '').toLowerCase();
          const status = (tx.paymentStatus || '').toUpperCase();
          const isOnlineOrder = tx.order_source === 'online' || tx.orderSource === 'online';
          const isOnlineCompleted = isOnlineOrder && ((tx.online_status || tx.onlineStatus || '').toUpperCase() === 'COMPLETED');
          const isDebtOrder =
            !isOnlineCompleted &&
            (method === 'debt' ||
            tx.isDebt ||
            status === 'DEBT' ||
            status === 'PARTIAL' ||
            Boolean(tx.debtDueDate || tx.debt_due_date));

          let remainingDebt = isOnlineCompleted
            ? 0
            : Number(tx.remainingDebt ?? tx.debtAmount ?? Math.max(0, total - paid));
          if (isDebtOrder && remainingDebt <= 0 && paid < total) {
            remainingDebt = Math.max(0, total - paid);
          }

          const isDebtItem =
            !isOnlineCompleted &&
            (status === 'DEBT' ||
            status === 'PARTIAL' ||
            remainingDebt > 0 ||
            isDebtOrder ||
            (tx.debtPayments && tx.debtPayments.length > 0));
          const hasDebt = !isOnlineCompleted && remainingDebt > 0;

          const highlightType = realtimeHighlights?.[tx.id];
          const isRealtimeNew = highlightType === 'new';
          const isRealtimeUpdated = highlightType === 'updated';

          // 1. Phân biệt đơn sửa (ưu tiên updatedOrderIds bền vững hoặc realtime highlight)
          const isOrderUpdated = (updatedOrderIds && updatedOrderIds.has(tx.id)) || isRealtimeUpdated;

          // 2. Phân biệt đơn mới (chỉ khi không phải đơn sửa và có unreadOrderIds hoặc realtime new)
          const isOrderNew = !isOrderUpdated && ((unreadOrderIds && unreadOrderIds.has(tx.id)) || isRealtimeNew);

          const profitMetrics = calculateTxProfitMetrics(tx, productsMap);

          return (
            <div
              key={tx.id}
              id={`tx-card-${tx.id}`}
              className={`p-3.5 bg-white rounded-2xl border transition-all duration-300 shadow-xs flex flex-col gap-3 ${
                isOrderUpdated
                  ? 'border-amber-300 bg-amber-50/40 shadow-xs'
                  : isOrderNew
                  ? 'border-slate-200 bg-emerald-50/40 shadow-xs'
                  : scannedHighlightId === tx.id
                  ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/20'
                  : isCancelled
                  ? 'border-rose-200 bg-rose-50/20'
                  : hasDebt
                  ? 'border-amber-300 bg-amber-50/15'
                  : 'border-slate-200'
              }`}
            >
              {/* Top Row: Receipt #, Status Chip & Date */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="w-6 h-6 rounded-md bg-blue-50 text-primary flex items-center justify-center shrink-0 border border-blue-100">
                    <Tag size={14} weight="duotone" />
                  </div>
                  <span
                    className={`font-black font-mono text-sm ${
                      isCancelled ? 'line-through text-slate-400' : 'text-slate-900'
                    }`}
                  >
                    #{tx.receiptNumber}
                  </span>
                  {(tx.order_source === 'online' || tx.orderSource === 'online') && (
                    <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-black bg-teal-50 text-teal-800 border border-teal-200 shadow-2xs inline-flex items-center gap-1">
                      <span>ອອນລາຍ</span>
                    </span>
                  )}
                  {Boolean(tx.isOfflinePending) && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-500 text-white shadow-xs inline-flex items-center gap-1" title="ບິນນີ້ຖືກບັນທຶກຕອນບໍ່ມີເນັດ, ລະບົບຈະຊິ້ງຂຶ້ນ Cloud ອັດຕະໂນມັດເມື່ອມີເນັດ">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      <span>ອອບລາຍ</span>
                    </span>
                  )}
                  {isOrderNew && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-600 text-white shadow-xs inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      <span>ບິນໃໝ່</span>
                    </span>
                  )}
                  {isOrderUpdated && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-600 text-white shadow-xs inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      <span>ແກ້ໄຂໃໝ່</span>
                    </span>
                  )}
                  {isCancelled && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-300">
                      ຍົກເລີກແລ້ວ
                    </span>
                  )}
                  {Boolean(tx.is_printed || tx.isPrinted) && !isCancelled && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300 inline-flex items-center gap-1 shadow-2xs">
                      <Check size={11} weight="bold" className="text-emerald-600" />
                      <span>ພິມແລ້ວ</span>
                    </span>
                  )}
                  {!isCancelled && hasDebt && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                      {remainingDebt >= total ? 'ຄ້າງຊຳລະ 100%' : 'ຄ້າງຊຳລະບາງສ່ວນ'}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-500 font-medium font-mono">
                    {formatDateTime24h(tx.createdAt || tx.created_at)}
                  </div>
                </div>
              </div>

              {/* Middle Row: Customer Name, Cashier, Method, Amounts */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-1">
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 block font-medium">ລູກຄ້າ:</span>
                    <span className="text-xs font-bold text-slate-900 truncate block">
                      {tx.customerName || 'ລູກຄ້າທົ່ວໄປ'}
                    </span>
                  </div>

                  <div className="text-center px-1 shrink-0">
                    <span className="text-[9.5px] text-slate-400 block font-medium">ຜູ້ຂາຍ:</span>
                    <span className="text-[10.5px] font-bold text-indigo-700 bg-indigo-50/90 px-1.5 py-0.5 rounded border border-indigo-200/80 inline-flex items-center gap-1">
                      <User size={10} weight="bold" />
                      <span className="truncate max-w-[70px]">{tx.cashierName || tx.cashier_name || 'Meii'}</span>
                    </span>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-400 block font-medium">ຮູບແບບ:</span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold inline-flex items-center gap-1 ${
                        tx.paymentMethod === 'cash' || tx.paymentMethod === 'ເງິນສົດ'
                          ? 'bg-teal-50 text-teal-800 border border-teal-200'
                          : isDebtItem
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-blue-50 text-blue-800 border border-blue-200'
                      }`}
                    >
                      {tx.paymentMethod === 'cash' || tx.paymentMethod === 'ເງິນສົດ' ? (
                        <>
                          <Money size={12} weight="bold" />
                          <span>ເງິນສົດ</span>
                        </>
                      ) : isDebtItem ? (
                        <>
                          <HandCoins size={12} weight="bold" />
                          <span>ຄ້າງຊຳລະ</span>
                        </>
                      ) : (
                        <>
                          <QrCode size={12} weight="bold" />
                          <span>ໂອນເງິນ</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Amounts Breakdown: Only show ຈ່າຍແລ້ວ & ໜີ້ຄ້າງ when activeTab === 'debt' */}
                {activeTab === 'debt' && isDebtItem ? (
                  <>
                    <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-slate-200/60 text-center">
                      <div>
                        <span className="text-[9.5px] text-slate-500 block uppercase">ຍອດລວມ</span>
                        <span className="text-xs font-mono font-black text-slate-900">
                          {formatKip(total)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9.5px] text-emerald-700 block uppercase">ຈ່າຍແລ້ວ</span>
                        <span className="text-xs font-mono font-bold text-emerald-700">
                          {formatKip(paid)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9.5px] text-rose-600 block uppercase">ໜີ້ຄ້າງ</span>
                        <span
                          className={`text-xs font-mono font-black ${
                            remainingDebt > 0 ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                        >
                          {remainingDebt > 0 ? formatKip(remainingDebt) : 'ຄົບແລ້ວ'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/40 text-xs">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">ກຳໄລ:</span>
                      <span className={`font-mono font-black ${profitMetrics.isLoss ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {profitMetrics.isProfit ? '+' : ''}{formatKip(profitMetrics.totalProfit)}
                        <span className="text-[9.5px] font-bold ml-1 opacity-80">
                          ({profitMetrics.isProfit ? '+' : ''}{profitMetrics.overallMargin}%)
                        </span>
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">ຍອດລວມ</span>
                      <span className="text-xs font-mono font-black text-slate-900">
                        {formatKip(total)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-bold uppercase block ${profitMetrics.isLoss ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {profitMetrics.isLoss ? ' ຂາດທຶນ' : 'ກຳໄລ'}
                      </span>
                      <span className={`text-xs font-mono font-black ${profitMetrics.isLoss ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {profitMetrics.isProfit ? '+' : ''}{formatKip(profitMetrics.totalProfit)}
                        <span className="text-[9.5px] font-bold ml-1 opacity-80">
                          ({profitMetrics.isProfit ? '+' : ''}{profitMetrics.overallMargin}%)
                        </span>
                      </span>
                    </div>
                  </div>
                )}

                {/* Mobile Debt Due Date Banner */}
                {activeTab === 'debt' && isDebtItem && (
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/60 text-xs">
                    <span className="text-[10.5px] text-slate-500 font-bold uppercase flex items-center gap-1">
                      <CalendarBlank size={12} weight="bold" className="text-rose-500" />
                      <span>ກຳນົດຊຳລະ:</span>
                    </span>
                    {(() => {
                      const rawDue = tx.debtDueDate || tx.debt_due_date;
                      const due = getDueDateStatus(rawDue);
                      if (!due) return <span className="text-[10.5px] text-slate-400 font-medium">ບໍ່ກຳນົດ</span>;
                      return (
                        <span className={`px-2 py-0.5 rounded-full text-[10.5px] ${due.badgeClass}`}>
                          {due.label}
                        </span>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Bottom Actions Row */}
              <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-100 flex-wrap">
                {/* View/Print Receipt */}
                <button
                  type="button"
                  onClick={() => handlePrintReceipt(tx)}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer ${
                    (tx.is_printed || tx.isPrinted)
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200'
                  }`}
                >
                  <Printer size={15} weight="bold" />
                  <span>{(tx.is_printed || tx.isPrinted) ? 'ພິມຄືນ' : 'ພິມບິນ'}</span>
                </button>

                {/* View Profit Breakdown Modal */}
                <button
                  type="button"
                  onClick={() => {
                    playActionClickBeep('history');
                    setSelectedProfitTx(tx);
                  }}
                  className="py-2 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
                  title="ເບິ່ງຕົ້ນທຶນ & ກຳໄລ"
                >
                  <ChartLineUp size={15} weight="bold" />
                  <span>ກຳໄລ</span>
                </button>

                {/* Edit Order via POS (Replace & Re-checkout) */}
                {!isCancelled && onEditOrderInPos && (
                  <button
                    type="button"
                    onClick={() => {
                      playActionClickBeep('history');
                      onEditOrderInPos(tx);
                    }}
                    className="py-2 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
                    title="ແກ້ໄຂບິນຜ່ານໜ້າ POS"
                  >
                    <PencilSimple size={15} weight="bold" />
                    <span>ແກ້ໄຂບິນ</span>
                  </button>
                )}

                {/* Debt Collection Button */}
                {!isCancelled && hasDebt && (
                  <button
                    type="button"
                    onClick={() => {
                      playActionClickBeep('history');
                      setDebtModalTx(tx);
                    }}
                    className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1 shadow-2xs active:scale-95 transition-all cursor-pointer"
                  >
                    <HandCoins size={15} weight="bold" />
                    <span>ຊຳລະໜີ້</span>
                  </button>
                )}

                {/* Void / Cancel Button */}
                {!isCancelled ? (
                  <button
                    type="button"
                    onClick={() => {
                      playErrorBeep('history');
                      onCancelTransaction && onCancelTransaction(tx);
                    }}
                    className="p-2 rounded-xl bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 border border-rose-200 text-xs font-bold inline-flex items-center gap-1 active:scale-95 transition-all cursor-pointer ml-auto"
                    title="ຍົກເລີກບິນ"
                  >
                    <Prohibit size={15} weight="bold" />
                  </button>
                ) : (
                  <span className="p-2 rounded-xl bg-rose-50 text-rose-400 text-xs inline-flex items-center gap-1 ml-auto">
                    <Prohibit size={15} weight="bold" />
                  </span>
                )}

                {canDeleteOrders && (
                  <button
                    type="button"
                    onClick={() => handleDeleteTransaction(tx)}
                    className="p-2 rounded-xl bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-600 cursor-pointer"
                    title="ລຶບ (Admin Only)"
                  >
                    <Trash size={15} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile-only pagination bar (< 768px) */}
      {totalItemsCount > 0 && (
        <div className="md:hidden bg-white rounded-2xl border border-slate-200 p-3 mb-3 flex flex-col items-center gap-3 shadow-2xs">
          {/* Top: Page Size Selector (20 | 50 | 100 | 200 | ALL) */}
          <div className="flex items-center gap-2 w-full justify-between">
            <span className="text-xs text-slate-500 font-medium">
              ຈຳນວນຕໍ່ໜ້າ:
            </span>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {[20, 50, 100, 200, 'ALL'].map((size) => {
                const isActive = pageSize === size;
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => handlePageSizeChange(size)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-teal-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                    }`}
                  >
                    {size === 'ALL' ? 'ທັງໝົດ' : size}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Middle: Summary Text (Compact for iPad & Mobile) */}
          <div className="text-xs text-slate-600 font-medium text-center whitespace-nowrap shrink-0 px-1">
            {pageSize === 'ALL' ? (
              <span>
                ທັງໝົດ <strong className="text-slate-900 font-bold font-mono">{totalItemsCount}</strong>
              </span>
            ) : (
              <span>
                <strong className="text-slate-900 font-bold font-mono">
                  {totalItemsCount > 0 ? (currentPage - 1) * pageSize + 1 : 0} - {Math.min(currentPage * pageSize, totalItemsCount)}
                </strong>{' '}
                ຈາກ{' '}
                <strong className="text-slate-900 font-bold font-mono">{totalItemsCount}</strong>
              </span>
            )}
          </div>

          {/* Bottom: Page Navigation (Only shown when not ALL) */}
          {pageSize !== 'ALL' && totalPages > 1 && (
            <div className="flex items-center gap-1 w-full justify-center">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
                className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1 ${
                  currentPage === 1
                    ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
                    : 'border-slate-200 text-slate-700 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300 cursor-pointer active:scale-95'
                }`}
              >
                <CaretLeft size={13} weight="bold" />
                <span>ກ່ອນໜ້າ</span>
              </button>

              <div className="flex items-center gap-1">
                {getPageNumbers().map((page, idx) => {
                  if (page === '...') {
                    return (
                      <span key={`dots-${idx}`} className="px-1 text-slate-400 font-bold text-xs">
                        ...
                      </span>
                    );
                  }
                  const isCurrent = currentPage === page;
                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() => handlePageChange(page)}
                      className={`min-w-[32px] h-8 px-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-teal-600 text-white shadow-2xs font-black'
                          : 'text-slate-700 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
                className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1 ${
                  currentPage === totalPages
                    ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
                    : 'border-slate-200 text-slate-700 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300 cursor-pointer active:scale-95'
                }`}
              >
                <span>ຕໍ່ໄປ</span>
                <CaretRight size={13} weight="bold" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* 4. TABLET & DESKTOP VIEW (>= 768px): Data Table */}
      <div className="hidden md:block w-full max-w-full bg-white rounded-2xl border border-slate-200 shadow-xs mb-3 overflow-hidden">
        <div className="w-full max-w-full overflow-x-auto overscroll-x-contain touch-pan-y">
          <table className={`w-full text-left text-xs border-separate border-spacing-0 ${activeTab === 'debt' ? 'min-w-[760px]' : 'min-w-[620px]'}`}>
          <thead>
            <tr className="sticky top-0 z-10 text-slate-700 font-extrabold [&_th]:border-b [&_th]:border-slate-200 [&_th]:bg-slate-50 select-none">
              <th className="py-3 px-2 sm:px-3 w-12 text-center text-slate-500 font-bold">ລ/ດ</th>
              <th className="py-3 px-3 sm:px-4">ເລກທີບິນ / ວັນທີ</th>
              <th className="py-3 px-3">ຜູ້ຂາຍ</th>
              <th className="py-3 px-3">ຊື່ລູກຄ້າ</th>
              {activeTab !== 'debt' && <th className="py-3 px-3">ຮູບແບບ / ສະຖານະ</th>}
              <th className="py-3 px-3 text-right whitespace-nowrap">ຍອດລວມ / ກຳໄລ</th>
              {activeTab === 'debt' && (
                <>
                  <th className="py-3 px-3 text-right">ຈ່າຍແລ້ວ</th>
                  <th className="py-3 px-3 text-right">ໜີ້ຄ້າງ</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap">ກຳນົດຊຳລະ</th>
                </>
              )}
              <th className="py-3 px-2 sm:px-3 text-center">ຈັດການ</th>
            </tr>
          </thead>
          <tbody className="[&_td]:border-b [&_td]:border-slate-100">
            {displayedTransactions.map((tx, idx) => {
              const itemIndex = (currentPage - 1) * pageSize + idx + 1;
              const isCancelled = tx.status === 'cancelled' || tx.isCancelled;
              const total = Number(tx.grandTotal) || 0;
              const paid = Number(tx.paidAmount ?? tx.amountTendered ?? 0);
              const method = (tx.paymentMethod || '').toLowerCase();
              const status = (tx.paymentStatus || '').toUpperCase();
              const isOnlineOrder =
                tx.order_source === 'online' ||
                tx.orderSource === 'online' ||
                String(tx.id || '').startsWith('onl_') ||
                String(tx.receiptNumber || tx.receipt_number || '').startsWith('ONL-') ||
                (tx.cashierName || tx.cashier_name) === 'Online Web';
              const isOnlineCompleted = isOnlineOrder && ((tx.online_status || tx.onlineStatus || '').toUpperCase() === 'COMPLETED');
              const isDebtOrder =
                !isOnlineOrder &&
                (method === 'debt' ||
                tx.isDebt ||
                status === 'DEBT' ||
                status === 'PARTIAL' ||
                Boolean(tx.debtDueDate || tx.debt_due_date));

              let remainingDebt = isOnlineOrder
                ? 0
                : Number(tx.remainingDebt ?? tx.debtAmount ?? Math.max(0, total - paid));
              if (isDebtOrder && remainingDebt <= 0 && paid < total) {
                remainingDebt = Math.max(0, total - paid);
              }

              const isDebtItem =
                !isOnlineOrder &&
                (status === 'DEBT' ||
                status === 'PARTIAL' ||
                remainingDebt > 0 ||
                isDebtOrder ||
                (tx.debtPayments && tx.debtPayments.length > 0));
              const hasDebt = !isOnlineOrder && remainingDebt > 0;

              const highlightType = realtimeHighlights?.[tx.id];
              const isRealtimeNew = highlightType === 'new';
              const isRealtimeUpdated = highlightType === 'updated';

              // 1. Phân biệt đơn sửa (ưu tiên updatedOrderIds bền vững hoặc realtime highlight)
              const isOrderUpdated = (updatedOrderIds && updatedOrderIds.has(tx.id)) || isRealtimeUpdated;

              // 2. Phân biệt đơn mới (chỉ khi không phải đơn sửa và có unreadOrderIds hoặc realtime new)
              const isOrderNew = !isOrderUpdated && ((unreadOrderIds && unreadOrderIds.has(tx.id)) || isRealtimeNew);

              const profitMetrics = calculateTxProfitMetrics(tx, productsMap);

              return (
                <tr
                  key={tx.id}
                  id={`tx-row-${tx.id}`}
                  onClick={() => handlePrintReceipt(tx)}
                  className={`transition-colors duration-150 cursor-pointer ${
                    isOrderUpdated
                      ? 'bg-amber-50/80 hover:bg-amber-100/90 active:bg-amber-100 text-slate-900 font-bold'
                      : isOrderNew
                      ? 'bg-emerald-50/80 hover:bg-emerald-100/90 active:bg-emerald-100 text-slate-900 font-bold'
                      : scannedHighlightId === tx.id
                      ? 'bg-emerald-50/40 text-slate-900 ring-2 ring-inset ring-emerald-500'
                      : isCancelled
                      ? 'bg-rose-50/30 hover:bg-rose-50/60 active:bg-rose-100/50 text-slate-500'
                      : hasDebt
                      ? 'bg-amber-50/20 hover:bg-amber-50/50 active:bg-amber-100/50 text-slate-900'
                      : 'hover:bg-blue-50/40 active:bg-blue-100/50 text-slate-900'
                  }`}
                >
                  {/* 0. STT (ລ/ດ - Số thứ tự) */}
                  <td className="py-3 px-2 sm:px-3 text-center font-bold text-slate-400 font-mono text-[11px]">
                    {itemIndex}
                  </td>

                  {/* 1. Mã đơn & Ngày giờ gộp chung (Receipt # & Date/Time combined) */}
                  <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 shadow-2xs">
                        <Tag size={16} weight="duotone" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5 flex-wrap">
                          <span
                            className={isCancelled ? 'line-through text-slate-400 font-mono' : 'text-slate-900 font-mono'}
                          >
                            #{tx.receiptNumber}
                          </span>
                          {(tx.order_source === 'online' || tx.orderSource === 'online') && (
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-teal-50 text-teal-800 border border-teal-200 inline-flex items-center gap-1">
                              <span>ອອນລາຍ</span>
                            </span>
                          )}
                          {isOrderNew && (
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-emerald-600 text-white shadow-xs inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-white" />
                              <span>ບິນໃໝ່</span>
                            </span>
                          )}
                          {Boolean(tx.isOfflinePending) && (
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-amber-500 text-white shadow-xs inline-flex items-center gap-1" title="ບິນນີ້ຖືກບັນທຶກຕອນບໍ່ມີເນັດ, ລະບົບຈະຊິ້ງຂຶ້ນ Cloud ອັດຕະໂນມັດເມື່ອມີເນັດ">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                              <span>ອອບລາຍ</span>
                            </span>
                          )}
                          {isOrderUpdated && (
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-amber-600 text-white shadow-xs inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-white" />
                              <span>ແກ້ໄຂໃໝ່</span>
                            </span>
                          )}
                          {isCancelled && (
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-rose-100 text-rose-700 border border-rose-300">
                              ຍົກເລີກແລ້ວ
                            </span>
                          )}
                          {Boolean(tx.is_printed || tx.isPrinted) && !isCancelled && (
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-slate-100 text-slate-700 border border-slate-300 inline-flex items-center gap-1 shadow-2xs">
                              <Check size={10} weight="bold" className="text-emerald-600" />
                              <span>ພິມແລ້ວ</span>
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 font-normal mt-0.5 flex items-center gap-1.5 font-mono">
                          <span>{formatDateToDDMMYYYY(tx.createdAt || tx.created_at)}</span>
                          <span>•</span>
                          <span>{formatTime24h(tx.createdAt || tx.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* 2. Cashier */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                      <User size={12} weight="bold" />
                      <span>{tx.cashierName || tx.cashier_name || 'Meii'}</span>
                    </span>
                  </td>

                  {/* 3. Customer Name */}
                  <td
                    className={`py-3 px-3 font-bold ${
                      isCancelled ? 'text-slate-500' : 'text-slate-800'
                    }`}
                  >
                    <div>{tx.customerName || 'ລູກຄ້າທົ່ວໄປ'}</div>
                  </td>

                  {/* 4. Payment Method / Status - Hidden in Debt Tab */}
                  {activeTab !== 'debt' && (
                    <td className="py-3 px-3 whitespace-nowrap">
                      {isCancelled ? (
                        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-black bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center gap-1">
                          <Prohibit size={12} weight="bold" />
                          <span>ຍົກເລີກບິນ</span>
                        </span>
                      ) : isDebtItem ? (
                        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-black bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1">
                          <HandCoins size={12} weight="bold" />
                          <span>
                            {remainingDebt >= total ? 'ຄ້າງຊຳລະ 100%' : remainingDebt > 0 ? 'ຄ້າງຊຳລະບາງສ່ວນ' : 'ຊຳລະຄົບແລ້ວ'}
                          </span>
                        </span>
                      ) : isOnlineOrder ? (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold inline-flex items-center gap-1 ${
                            tx.paymentMethod === 'transfer' || tx.payment_method === 'transfer'
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : 'bg-teal-50 text-teal-800 border border-teal-200'
                          }`}
                        >
                          {tx.paymentMethod === 'transfer' || tx.payment_method === 'transfer' ? (
                            <>
                              <QrCode size={12} weight="bold" />
                              <span>QR ໂອນ</span>
                            </>
                          ) : (
                            <>
                              <Money size={12} weight="bold" />
                              <span>ເງິນສົດ (COD)</span>
                            </>
                          )}
                        </span>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold inline-flex items-center gap-1 ${
                            tx.paymentMethod === 'cash' || tx.paymentMethod === 'ເງິນສົດ'
                              ? 'bg-teal-50 text-teal-800 border border-teal-200'
                              : 'bg-blue-50 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {tx.paymentMethod === 'cash' || tx.paymentMethod === 'ເງິນສົດ' ? (
                            <>
                              <Money size={12} weight="bold" />
                              <span>ເງິນສົດ</span>
                            </>
                          ) : (
                            <>
                              <QrCode size={12} weight="bold" />
                              <span>QR ໂອນ</span>
                            </>
                          )}
                        </span>
                      )}
                    </td>
                  )}

                  {/* 5. Gộp Doanh thu & Lợi nhuận (Grand Total & Profit Combined - text-right) */}
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    {/* Dòng trên: Doanh thu */}
                    <div className="font-bold text-slate-900 text-sm font-mono">
                      <span className={isCancelled ? 'line-through text-slate-400' : 'text-slate-900'}>
                        {formatKip(total)}
                      </span>
                    </div>

                    {/* Dòng dưới: Lợi nhuận */}
                    {isCancelled ? (
                      <div className="text-xs font-semibold text-slate-400 mt-0.5 font-mono line-through flex items-center justify-end gap-1">
                        <span>{formatKip(profitMetrics.totalProfit)}</span>
                      </div>
                    ) : (canViewReports ?? true) ? (
                      profitMetrics.isLoss ? (
                        <div className="text-xs font-semibold text-rose-600 mt-0.5 flex items-center justify-end gap-1 font-mono">
                          <span>{formatKip(profitMetrics.totalProfit)}</span>
                        </div>
                      ) : profitMetrics.isProfit ? (
                        <div className="text-xs font-semibold text-emerald-600 mt-0.5 flex items-center justify-end gap-1 font-mono">
                          <span>+{formatKip(profitMetrics.totalProfit)}</span>
                        </div>
                      ) : (
                        <div className="text-xs font-medium text-slate-400 mt-0.5 flex items-center justify-end font-mono">
                          <span>0 ₭</span>
                        </div>
                      )
                    ) : null}
                  </td>

                  {/* Paid Amount, Remaining Debt & Due Date - ONLY DISPLAYED WHEN activeTab === 'debt' */}
                  {activeTab === 'debt' && (
                    <>
                      {/* Paid Amount (ຈ່າຍແລ້ວ) */}
                      <td className="py-3 px-3 text-right font-mono">
                        {isDebtItem ? (
                          <span className="font-bold text-emerald-700">{formatKip(paid)}</span>
                        ) : (
                          <span className="text-slate-300 font-bold select-none">-</span>
                        )}
                      </td>

                      {/* Remaining Debt (ໜີ້ຄ້າງ) */}
                      <td className="py-3 px-3 text-right font-mono">
                        {isDebtItem ? (
                          remainingDebt > 0 ? (
                            <span className="font-black text-rose-600">{formatKip(remainingDebt)}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Check size={11} weight="bold" />
                              <span>ຄົບແລ້ວ</span>
                            </span>
                          )
                        ) : (
                          <span className="text-slate-300 font-bold select-none">-</span>
                        )}
                      </td>

                      {/* Due Date (ກຳນົດຊຳລະ) */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {(() => {
                          const rawDue = tx.debtDueDate || tx.debt_due_date;
                          const due = isDebtItem ? getDueDateStatus(rawDue) : null;
                          if (!due) return <span className="text-slate-300 font-bold select-none">-</span>;
                          return (
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] ${due.badgeClass}`}
                              title={due.formattedDate}
                            >
                              <CalendarBlank size={12} weight="bold" />
                              <span>{due.label}</span>
                            </span>
                          );
                        })()}
                      </td>
                    </>
                  )}

                  {/* 6. Actions Column: Touch-Friendly Square Icon Buttons (w-9 h-9) */}
                  <td className="py-2.5 px-2 sm:px-3 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1.5 flex-nowrap relative row-action-popover-container">
                      {activeTab === 'debt' ? (
                        <>
                          {/* Tab Khách nợ: Chỉ để lại nút ຊຳລະ và nút Sửa ở ngoài */}
                          {/* Nút Thu nợ (HandCoins Icon nếu có nợ) - Square Icon Button */}
                          {!isCancelled && hasDebt && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                playActionClickBeep('history');
                                setDebtModalTx(tx);
                              }}
                              className="w-9 h-9 flex items-center justify-center bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
                              title="ຊຳລະໜີ້"
                            >
                              <HandCoins size={16} weight="bold" />
                            </button>
                          )}

                          {/* Nút Sửa (Pencil Icon) - Square Icon Button */}
                          {!isCancelled && onEditOrderInPos && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                playActionClickBeep('history');
                                onEditOrderInPos(tx);
                              }}
                              className="w-9 h-9 flex items-center justify-center bg-slate-50 border border-slate-200 text-slate-500 hover:text-amber-600 hover:border-amber-300 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
                              title="ແກ້ໄຂ"
                            >
                              <PencilSimple size={16} weight="bold" />
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          {/* Các Tab Khác: Giữ nguyên các nút tiêu chuẩn */}
                          {/* Nút In (Printer Icon) - Square Icon Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrintReceipt(tx);
                            }}
                            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer ${
                              Boolean(tx.is_printed || tx.isPrinted)
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80'
                                : 'bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white'
                            }`}
                            title={Boolean(tx.is_printed || tx.isPrinted) ? 'ພິມຄືນໃໝ່' : 'ພິມບິນ'}
                          >
                            <Printer size={16} weight="bold" />
                          </button>

                          {/* Nút Lợi nhuận (Trending/Chart Icon) - Square Icon Button */}
                          {(canViewReports ?? true) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                playActionClickBeep('history');
                                setSelectedProfitTx(tx);
                              }}
                              className="w-9 h-9 flex items-center justify-center bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
                              title="ເບິ່ງກຳໄລ"
                            >
                              <ChartLineUp size={16} weight="bold" />
                            </button>
                          )}

                          {/* Nút Sửa (Pencil Icon) - Square Icon Button */}
                          {!isCancelled && onEditOrderInPos && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                playActionClickBeep('history');
                                onEditOrderInPos(tx);
                              }}
                              className="w-9 h-9 flex items-center justify-center bg-slate-50 border border-slate-200 text-slate-500 hover:text-amber-600 hover:border-amber-300 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
                              title="ແກ້ໄຂ"
                            >
                              <PencilSimple size={16} weight="bold" />
                            </button>
                          )}

                          {/* Nút Thu nợ (HandCoins Icon nếu có nợ) - Square Icon Button */}
                          {!isCancelled && hasDebt && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                playActionClickBeep('history');
                                setDebtModalTx(tx);
                              }}
                              className="w-9 h-9 flex items-center justify-center bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
                              title="ຊຳລະໜີ້"
                            >
                              <HandCoins size={16} weight="bold" />
                            </button>
                          )}
                        </>
                      )}

                      {/* Nút Menu 3 chấm (Chứa In, Xem lợi nhuận, Hủy đơn & Xóa) - Square Icon Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleActionMenu(e, tx);
                        }}
                        className={`w-9 h-9 rounded-xl border transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-sm active:scale-95 ${
                          actionMenuState?.tx.id === tx.id
                            ? 'bg-slate-200 border-slate-300 text-slate-900 shadow-2xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                        title="ຕົວເລືອກເພີ່ມເຕີມ"
                      >
                        <DotsThreeVertical size={16} weight="bold" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!isLoading && totalItemsCount === 0 && (
          <div className="py-20 text-center text-slate-400">
            <Receipt size={40} className="mx-auto mb-2 opacity-50" />
            <p className="text-xs font-bold">ບໍ່ພົບລາຍການບິນຕາມເງື່ອນໄຂທີ່ເລືອກ</p>
          </div>
        )}
        </div>

        {/* Attached Desktop Pagination Bar (Seamless with table, 0 gap) */}
        {totalItemsCount > 0 && (
          <div className="border-t border-slate-200 bg-slate-50/80 px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Left: Page Size Selector (20 | 50 | 100 | 200 | ALL) */}
            <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-start">
              <span className="text-xs text-slate-500 font-medium">
                ຈຳນວນຕໍ່ໜ້າ:
              </span>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {[20, 50, 100, 200, 'ALL'].map((size) => {
                  const isActive = pageSize === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => handlePageSizeChange(size)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-teal-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                      }`}
                    >
                      {size === 'ALL' ? 'ທັງໝົດ' : size}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Middle: Summary Text (Compact for iPad & Responsive) */}
            <div className="text-xs text-slate-600 font-medium text-center whitespace-nowrap shrink-0 px-2">
              {pageSize === 'ALL' ? (
                <span>
                  ທັງໝົດ <strong className="text-slate-900 font-bold font-mono">{totalItemsCount}</strong>
                </span>
              ) : (
                <span>
                  <strong className="text-slate-900 font-bold font-mono">
                    {totalItemsCount > 0 ? (currentPage - 1) * pageSize + 1 : 0} - {Math.min(currentPage * pageSize, totalItemsCount)}
                  </strong>{' '}
                  ຈາກ{' '}
                  <strong className="text-slate-900 font-bold font-mono">{totalItemsCount}</strong>
                </span>
              )}
            </div>

            {/* Right: Page Navigation (Only shown when not ALL) */}
            {pageSize !== 'ALL' && totalPages > 1 && (
              <div className="flex items-center gap-1 w-full md:w-auto justify-center md:justify-end">
                {/* Previous Page */}
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1 ${
                    currentPage === 1
                      ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
                      : 'border-slate-200 text-slate-700 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300 cursor-pointer active:scale-95'
                  }`}
                >
                  <CaretLeft size={13} weight="bold" />
                  <span className="hidden sm:inline">ກ່ອນໜ້າ</span>
                </button>

                {/* Number buttons with smart truncation */}
                <div className="flex items-center gap-1">
                  {getPageNumbers().map((page, idx) => {
                    if (page === '...') {
                      return (
                        <span key={`dots-${idx}`} className="px-1 text-slate-400 font-bold text-xs">
                          ...
                        </span>
                      );
                    }
                    const isCurrent = currentPage === page;
                    return (
                      <button
                        key={page}
                        type="button"
                        onClick={() => handlePageChange(page)}
                        className={`min-w-[32px] h-8 px-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-teal-600 text-white shadow-2xs font-black'
                            : 'text-slate-700 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>

                {/* Next Page */}
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1 ${
                    currentPage === totalPages
                      ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50'
                      : 'border-slate-200 text-slate-700 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300 cursor-pointer active:scale-95'
                  }`}
                >
                  <span className="hidden sm:inline">ຕໍ່ໄປ</span>
                  <CaretRight size={13} weight="bold" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Empty State */}
      {!isLoading && totalItemsCount === 0 && (
        <div className="md:hidden py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 mb-6">
          <Receipt size={36} className="mx-auto mb-2 opacity-50" />
          <p className="text-xs font-bold">ບໍ່ພົບລາຍການບິນຕາມເງື່ອນໄຂທີ່ເລືອກ</p>
        </div>
      )}
    </>
  )}

      {/* Customer Debt Payment Modal */}
      {debtModalTx && (
        <CustomerDebtPaymentModal
          isOpen={Boolean(debtModalTx)}
          onClose={() => setDebtModalTx(null)}
          transaction={debtModalTx}
          onSuccess={() => {
            onRefreshTransactions?.();
            setDebtModalTx(null);
          }}
          onAlert={onAlert}
        />
      )}

      {/* Quick Customer Name / Payment Method Edit Modal (Fallback) */}
      {editingTx && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <PencilSimple size={18} className="text-teal-600" weight="bold" />
                <span>ແກ້ໄຂຂໍ້ມູນບິນ: #{editingTx.receiptNumber}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingTx(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ຊື່ລູກຄ້າ (Customer Name):
                </label>
                <input
                  type="text"
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-teal-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ຮູບແບບຊຳລະ (Payment Method):
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditPaymentMethod('cash')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      editPaymentMethod === 'cash'
                        ? 'bg-teal-50 border-teal-500 text-teal-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <Money size={15} weight="bold" />
                    <span>ເງິນສົດ (Cash)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditPaymentMethod('onepay')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      editPaymentMethod !== 'cash'
                        ? 'bg-blue-50 border-blue-500 text-blue-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <QrCode size={15} weight="bold" />
                    <span>QR ໂອນ (OnePay)</span>
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex justify-between">
                <span>ຍອດຊຳລະທັງໝົດ:</span>
                <span className="font-black text-slate-900 font-mono">
                  {formatKip(editingTx.grandTotal)}
                </span>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  ຍົກເລີກ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckCircle size={15} weight="fill" />
                  <span>ບັນທຶກ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Barcode Camera Scanner Modal */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleScanBarcode}
        onScan={handleScanBarcode}
        title="ສະແກນບາໂຄດໃບບິນ (Scan Receipt Barcode)"
      />

      {/* 4.1. Invoice Profit & Cost Breakdown Detail Modal */}
      {selectedProfitTx && (
        <InvoiceProfitDetailModal
          isOpen={Boolean(selectedProfitTx)}
          onClose={() => setSelectedProfitTx(null)}
          transaction={selectedProfitTx}
          products={products}
          onPrintReceipt={handlePrintReceipt}
        />
      )}

      {/* 5. Toast Feedback for Barcode Scanning (Floating, safe below Dynamic Island) */}
      {scanToast && (
        <div
          className={`fixed top-[max(3.5rem,calc(env(safe-area-inset-top,0px)+0.75rem))] left-1/2 -translate-x-1/2 z-[130] px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-black animate-in fade-in slide-in-from-top-4 duration-200 border ${
            scanToast.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500'
              : 'bg-rose-600 text-white border-rose-500'
          }`}
        >
          {scanToast.type === 'success' ? (
            <CheckCircle size={18} weight="fill" />
          ) : (
            <Warning size={18} weight="fill" />
          )}
          <span>{scanToast.message}</span>
        </div>
      )}

      {/* 6. Action Menu Popover Portal (Renders into document.body with fixed position & z-[9999] to prevent table clipping & pagination overlap) */}
      {actionMenuState && typeof document !== 'undefined' && createPortal(
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setActionMenuState(null)}
          />
          <div
            className="fixed z-[9999] animate-in fade-in zoom-in-95 duration-100"
            style={{
              top: `${actionMenuState.top}px`,
              left: `${actionMenuState.left}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 py-1 min-w-[165px] text-left">
              {/* In hóa đơn (Print Receipt) - Đặc biệt tiện cho tab khách nợ khi nút in ngoài được ẩn */}
              <button
                type="button"
                onClick={() => {
                  const currentTx = actionMenuState.tx;
                  setActionMenuState(null);
                  handlePrintReceipt(currentTx);
                }}
                className="w-full px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 flex items-center gap-2 transition-colors cursor-pointer border-b border-slate-100"
              >
                <Printer size={15} weight="bold" className="text-blue-600" />
                <span>{Boolean(actionMenuState.tx.is_printed || actionMenuState.tx.isPrinted) ? 'ພິມຄືນໃໝ່' : 'ພິມບິນ'}</span>
              </button>

              {/* Xem vốn & lãi (Profit Breakdown) */}
              <button
                type="button"
                onClick={() => {
                  const currentTx = actionMenuState.tx;
                  setActionMenuState(null);
                  playActionClickBeep('history');
                  setSelectedProfitTx(currentTx);
                }}
                className="w-full px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 transition-colors cursor-pointer border-b border-slate-100"
              >
                <ChartLineUp size={15} weight="bold" className="text-emerald-600" />
                <span>ເບິ່ງຕົ້ນທຶນ & ກຳໄລ</span>
              </button>

              {/* Hủy đơn (Void / Cancel) */}
              {!actionMenuState.tx.isCancelled && actionMenuState.tx.status !== 'cancelled' ? (
                <button
                  type="button"
                  onClick={() => {
                    const currentTx = actionMenuState.tx;
                    setActionMenuState(null);
                    onCancelTransaction && onCancelTransaction(currentTx);
                  }}
                  className="w-full px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Prohibit size={15} weight="bold" className="text-rose-600" />
                  <span>ຍົກເລີກບິນ</span>
                </button>
              ) : (
                <div className="px-3 py-1.5 text-[11px] text-rose-400 font-bold italic flex items-center gap-1.5">
                  <Prohibit size={13} weight="bold" />
                  <span>ບິນນີ້ຍົກເລີກແລ້ວ</span>
                </div>
              )}

              {/* Xóa vĩnh viễn (Delete - Admin Only) */}
              {canDeleteOrders && (
                <button
                  type="button"
                  onClick={() => {
                    const currentTx = actionMenuState.tx;
                    setActionMenuState(null);
                    handleDeleteTransaction(currentTx);
                  }}
                  className="w-full px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors cursor-pointer border-t border-slate-100"
                >
                  <Trash size={15} className="text-red-600" />
                  <span>ລຶບຖາວອນ</span>
                </button>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </main>
  );
}
