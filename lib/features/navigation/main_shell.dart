import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/app_colors.dart';
import '../../providers/exchange_rate_provider.dart';
import '../../views/inventory/purchase_list_screen.dart';
import '../backoffice/presentation/dashboard_screen.dart';
import '../backoffice/presentation/product_list_screen.dart';
import '../history/presentation/receipt_history_screen.dart';
import '../pos/presentation/controllers/cart_controller.dart';
import '../pos/presentation/controllers/printer_controller.dart';
import '../pos/presentation/pos_screen.dart';

enum MainWorkflow {
  pos,
  dashboard,
  catalog,
  history,
  inventory,
}

/// Global workflow state provider to enable screen transitions from any screen (e.g. edit order in POS)
final mainWorkflowProvider = StateProvider<MainWorkflow>((ref) => MainWorkflow.pos);

/// Master Shell with Collapsible Sidebar Navigation for iPad/Tablet Landscape
class MainShell extends ConsumerStatefulWidget {
  const MainShell({super.key});

  @override
  ConsumerState<MainShell> createState() => _MainShellState();
}

class _MainShellState extends ConsumerState<MainShell> {
  bool _isSidebarCollapsed = true; // Collapsed by default for maximum POS real estate
  bool _isFullScreen = false;

  void _toggleFullScreen() {
    setState(() {
      _isFullScreen = !_isFullScreen;
    });
    if (_isFullScreen) {
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    } else {
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    }
  }

  void _showSettingsDialog() {
    final printerState = ref.read(printerProvider);
    final ipController = TextEditingController(text: printerState.config.ipAddress);
    bool isSim = printerState.config.isSimulationMode;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) {
          return Dialog(
            backgroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
              side: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
            insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Padding(
                padding: const EdgeInsets.all(22),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: const Color(0xFFF0FDFA),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFFCCFBF1)),
                          ),
                          child: const Center(
                            child: PhosphorIcon(
                              PhosphorIconsRegular.gearSix,
                              color: Color(0xFF0D9488),
                              size: 22,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'ຕັ້ງຄ່າລະບົບ (System Settings)',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF0F172A),
                                ),
                              ),
                              SizedBox(height: 2),
                              Text(
                                'ອັດຕາແລກປ່ຽນ, ເຄື່ອງພິມ & ອຸປະກອນ',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Color(0xFF64748B),
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          onPressed: () => Navigator.of(ctx).pop(),
                          icon: const PhosphorIcon(
                            PhosphorIconsRegular.x,
                            size: 18,
                            color: Color(0xFF94A3B8),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 18),
                    const Divider(height: 1, color: Color(0xFFF1F5F9)),
                    const SizedBox(height: 16),
                    TextField(
                      controller: ipController,
                      decoration: InputDecoration(
                        labelText: 'Printer IP Address (Port 9100)',
                        hintText: '192.168.1.200',
                        prefixIcon: const PhosphorIcon(
                          PhosphorIconsRegular.printer,
                          size: 18,
                          color: Color(0xFF0D9488),
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: Color(0xFF0D9488), width: 1.5),
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      ),
                    ),
                    const SizedBox(height: 12),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text(
                        'Simulation Mode (ທົດສອບໂດຍບໍ່ມີເຄື່ອງ)',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                      subtitle: const Text(
                        'ຈຳລອງການພິມບິນລົງ Console ໂດຍບໍ່ສົ່ງຂໍ້ມູນຜ່ານ LAN',
                        style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                      ),
                      value: isSim,
                      activeColor: const Color(0xFF0D9488),
                      onChanged: (val) {
                        setModalState(() => isSim = val);
                      },
                    ),
                    const SizedBox(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        TextButton(
                          onPressed: () => Navigator.of(ctx).pop(),
                          style: TextButton.styleFrom(
                            foregroundColor: const Color(0xFF64748B),
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                          ),
                          child: const Text('ຍົກເລີກ'),
                        ),
                        const SizedBox(width: 8),
                        ElevatedButton.icon(
                          onPressed: () {
                            ref
                                .read(printerProvider.notifier)
                                .updatePrinterIp(ipController.text);
                            ref
                                .read(printerProvider.notifier)
                                .toggleSimulation(isSim);
                            Navigator.of(ctx).pop();
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('ບັນທຶກການຕັ້ງຄ່າສຳເລັດ!'),
                                backgroundColor: Color(0xFF0D9488),
                                duration: Duration(seconds: 2),
                              ),
                            );
                          },
                          icon: const PhosphorIcon(
                            PhosphorIconsBold.check,
                            size: 16,
                            color: Colors.white,
                          ),
                          label: const Text(
                            'ບັນທຶກ',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF0D9488),
                            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                            elevation: 0,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  void _showEditRateDialog(BuildContext context, double currentRate) {
    final controller = TextEditingController(text: currentRate.round().toString());
    bool isSaving = false;

    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            String? errorMsg;

            Future<void> handleSave() async {
              final clean = controller.text.replaceAll(',', '').trim();
              final val = double.tryParse(clean);
              if (val == null || val <= 0) {
                setDialogState(() {
                  errorMsg = 'ກະລຸນາປ້ອນອັດຕາແລກປ່ຽນທີ່ຖືກຕ້ອງ (> 0)';
                });
                return;
              }

              setDialogState(() {
                isSaving = true;
                errorMsg = null;
              });

              final success = await ref
                  .read(exchangeRateProvider.notifier)
                  .updateExchangeRate(val);

              if (context.mounted) {
                Navigator.of(ctx).pop();
                if (success) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        'ອັບເດດອັດຕາແລກປ່ຽນເປັນ 1 ฿ = ${val.round()} ₭ ສຳເລັດ!',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      backgroundColor: const Color(0xFF0D9488),
                      duration: const Duration(seconds: 2),
                    ),
                  );
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('ເກີດຂໍ້ຜິດພາດໃນການອັບເດດອັດຕາແລກປ່ຽນ'),
                      backgroundColor: AppColors.error,
                    ),
                  );
                }
              }
            }

            return Dialog(
              backgroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
                side: const BorderSide(color: Color(0xFFF1F5F9)),
              ),
              clipBehavior: Clip.antiAlias,
              insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 380),
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              color: const Color(0xFFF0FDFA),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: const Color(0xFFCCFBF1)),
                            ),
                            child: const Center(
                              child: PhosphorIcon(
                                PhosphorIconsBold.currencyCircleDollar,
                                color: Color(0xFF0D9488),
                                size: 20,
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'ປັບອັດຕາແລກປ່ຽນ (THB / LAK)',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF0F172A),
                                  ),
                                ),
                                SizedBox(height: 2),
                                Text(
                                  'Store Settings • Realtime Supabase',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w500,
                                    color: Color(0xFF64748B),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            onPressed: () => Navigator.of(ctx).pop(),
                            icon: const PhosphorIcon(PhosphorIconsBold.x, size: 18, color: Color(0xFF94A3B8)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: controller,
                        keyboardType: TextInputType.number,
                        autofocus: true,
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF0F172A),
                        ),
                        decoration: InputDecoration(
                          labelText: '1 ฿ ເທົ່າກັບ (ກີບ)',
                          suffixText: '₭',
                          suffixStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          errorText: errorMsg,
                        ),
                        onSubmitted: (_) => handleSave(),
                      ),
                      const SizedBox(height: 18),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          TextButton(
                            onPressed: () => Navigator.of(ctx).pop(),
                            child: const Text('ຍົກເລີກ', style: TextStyle(color: Color(0xFF64748B))),
                          ),
                          const SizedBox(width: 8),
                          ElevatedButton(
                            onPressed: isSaving ? null : handleSave,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF0D9488),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              elevation: 0,
                            ),
                            child: isSaving
                                ? const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                  )
                                : const Text(
                                    'ບັນທຶກ',
                                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                                  ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final currentWorkflow = ref.watch(mainWorkflowProvider);

    return LayoutBuilder(
      builder: (context, constraints) {
        final isMobile = constraints.maxWidth < 640;

        return Scaffold(
          backgroundColor: AppColors.background,
          body: Row(
            children: [
              // Collapsible Left Navigation Rail (Only for tablets & desktop >= 640px)
              if (!isMobile) _buildSidebar(context, currentWorkflow),

              // Main Workflow Content (IndexedStack keeps POS state alive)
              Expanded(
                child: IndexedStack(
                  index: currentWorkflow.index,
                  children: const [
                    PosScreen(),
                    DashboardScreen(),
                    ProductListScreen(),
                    ReceiptHistoryScreen(),
                    PurchaseListScreen(),
                  ],
                ),
              ),
            ],
          ),
          bottomNavigationBar: isMobile
              ? Container(
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    border: Border(
                      top: BorderSide(color: Color(0xFFE2E8F0), width: 1.0),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Color(0x0F000000),
                        offset: Offset(0, -2),
                        blurRadius: 6,
                      ),
                    ],
                  ),
                  child: SafeArea(
                    top: false,
                    child: BottomNavigationBar(
                      currentIndex: currentWorkflow.index,
                      onTap: (index) {
                        ref.read(mainWorkflowProvider.notifier).state =
                            MainWorkflow.values[index];
                      },
                      type: BottomNavigationBarType.fixed,
                      backgroundColor: Colors.white,
                      selectedItemColor: const Color(0xFF0F766E),
                      unselectedItemColor: const Color(0xFF64748B),
                      selectedFontSize: 11,
                      unselectedFontSize: 10,
                      selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w800),
                      unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600),
                      elevation: 0,
                      items: const [
                        BottomNavigationBarItem(
                          icon: PhosphorIcon(PhosphorIconsBold.storefront),
                          activeIcon: PhosphorIcon(PhosphorIconsBold.storefront),
                          label: 'ຂາຍໜ້າຮ້ານ',
                        ),
                        BottomNavigationBarItem(
                          icon: PhosphorIcon(PhosphorIconsBold.chartBar),
                          activeIcon: PhosphorIcon(PhosphorIconsBold.chartBar),
                          label: 'ແຜງຄວບຄຸມ',
                        ),
                        BottomNavigationBarItem(
                          icon: PhosphorIcon(PhosphorIconsBold.warehouse),
                          activeIcon: PhosphorIcon(PhosphorIconsBold.warehouse),
                          label: 'ລາຍການສິນຄ້າ',
                        ),
                        BottomNavigationBarItem(
                          icon: PhosphorIcon(PhosphorIconsBold.clockCounterClockwise),
                          activeIcon: PhosphorIcon(PhosphorIconsBold.clockCounterClockwise),
                          label: 'ປະຫວັດບິນ',
                        ),
                        BottomNavigationBarItem(
                          icon: PhosphorIcon(PhosphorIconsBold.truck),
                          activeIcon: PhosphorIcon(PhosphorIconsBold.truck),
                          label: 'ຮັບເຂົ້າສາງ',
                        ),
                      ],
                    ),
                  ),
                )
              : null,
        );
      },
    );
  }

  Widget _buildSidebar(BuildContext context, MainWorkflow currentWorkflow) {
    // 1. KÍCH THƯỚC & CHUYỂN ĐỘNG (COLLAPSIBLE SPECS):
    // - AnimatedContainer: duration: Duration(milliseconds: 250), curve: Curves.easeInOut
    // - Collapsed: width: 72px
    // - Expanded: width: 250px
    // - Border right: BorderSide(color: Color(0xFFE2E8F0), width: 1), Background: Colors.white
    final sidebarWidth = _isSidebarCollapsed ? 72.0 : 250.0;
    final isCollapsed = _isSidebarCollapsed;

    // Cart badge count
    final cartItems = ref.watch(cartProvider).items;
    final cartCount = cartItems.fold<int>(0, (sum, i) => sum + i.quantity);

    // Live Exchange Rate
    final rateState = ref.watch(exchangeRateProvider);
    final rateDisplay = rateState.rate.round().toString();

    return AnimatedContainer(
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeInOut,
      width: sidebarWidth,
      clipBehavior: Clip.hardEdge,
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(right: BorderSide(color: Color(0xFFE2E8F0), width: 1.0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 2. PHẦN ĐỈNH (HEADER):
          // - Logo tròn chữ "M": Container tròn 44x44px, nền xanh Teal đậm Color(0xFF009688), chữ M trắng bold 20px
          // - Khi Mở rộng: MeiiShop (16px, FontWeight.w700), Badge POS (bg-teal-50 text-teal-700), ລະບົບຂາຍໜ້າຮ້ານ (12px Slate-500)
          // - Divider: Color(0xFFF1F5F9), height: 1
          InkWell(
            onTap: () => ref.read(mainWorkflowProvider.notifier).state = MainWorkflow.pos,
            child: Container(
              height: 68,
              padding: EdgeInsets.symmetric(
                horizontal: isCollapsed ? 8 : 16,
              ),
              child: Row(
                mainAxisAlignment: isCollapsed
                    ? MainAxisAlignment.center
                    : MainAxisAlignment.start,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Logo Circle 44x44
                  Container(
                    width: 44,
                    height: 44,
                    decoration: const BoxDecoration(
                      color: Color(0xFF009688),
                      shape: BoxShape.circle,
                    ),
                    child: const Center(
                      child: Text(
                        'M',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          height: 1.0,
                        ),
                      ),
                    ),
                  ),

                  // Header title when Expanded
                  if (!isCollapsed) ...[
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Text(
                                'MeiiShop',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF0F172A),
                                  letterSpacing: -0.3,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF0FDFA), // teal-50
                                  border: Border.all(color: const Color(0xFFCCFBF1)), // teal-100
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: const Text(
                                  'POS',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF0F766E), // teal-700
                                    height: 1.0,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 2),
                          const Text(
                            'ລະບົບຂາຍໜ້າຮ້ານ',
                            style: TextStyle(
                              fontSize: 12,
                              color: Color(0xFF64748B), // Slate-500
                              fontWeight: FontWeight.w500,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),

          const Divider(height: 1, thickness: 1, color: Color(0xFFF1F5F9)),
          const SizedBox(height: 6),

          // 3 & 4. DANH SÁCH MENU (6 ITEMS)
          // 1. Bán hàng (POS)
          // 2. Nhập kho (GRN)
          // 3. Danh sách sản phẩm (Catalog)
          // 4. Lịch sử đơn bán (History)
          // 5. Báo cáo (Dashboard)
          // 6. Cài đặt hệ thống (Settings)
          Expanded(
            child: ListView(
              padding: EdgeInsets.zero,
              children: [
                _buildMenuItem(
                  workflow: MainWorkflow.pos,
                  regularIcon: PhosphorIconsRegular.storefront,
                  boldIcon: PhosphorIconsBold.storefront,
                  title: 'ຂາຍໜ້າຮ້ານ (POS)',
                  subtitle: 'Terminal ຂາຍເຄື່ອງ',
                  isCollapsed: isCollapsed,
                  currentWorkflow: currentWorkflow,
                  badgeCount: cartCount,
                ),
                _buildMenuItem(
                  workflow: MainWorkflow.inventory,
                  regularIcon: PhosphorIconsRegular.warehouse,
                  boldIcon: PhosphorIconsBold.warehouse,
                  title: 'ຮັບສິນຄ້າເຂົ້າ (GRN)',
                  subtitle: 'ສາງ & ຜູ້ສະໜອງ',
                  isCollapsed: isCollapsed,
                  currentWorkflow: currentWorkflow,
                ),
                _buildMenuItem(
                  workflow: MainWorkflow.catalog,
                  regularIcon: PhosphorIconsRegular.package,
                  boldIcon: PhosphorIconsBold.package,
                  title: 'ລາຍການສິນຄ້າ',
                  subtitle: 'ຕົ້ນທຶນບາດ & ສະຕັອກ',
                  isCollapsed: isCollapsed,
                  currentWorkflow: currentWorkflow,
                ),
                _buildMenuItem(
                  workflow: MainWorkflow.history,
                  regularIcon: PhosphorIconsRegular.clockCounterClockwise,
                  boldIcon: PhosphorIconsBold.clockCounterClockwise,
                  title: 'ປະຫວັດບິນ',
                  subtitle: 'ລາຍການຂາຍສຳເລັດ',
                  isCollapsed: isCollapsed,
                  currentWorkflow: currentWorkflow,
                ),
                _buildMenuItem(
                  workflow: MainWorkflow.dashboard,
                  regularIcon: PhosphorIconsRegular.chartLine,
                  boldIcon: PhosphorIconsBold.chartLine,
                  title: 'ແຜງຄວບຄຸມ (Dashboard)',
                  subtitle: 'ລາຍຮັບ & ກຳໄລ',
                  isCollapsed: isCollapsed,
                  currentWorkflow: currentWorkflow,
                ),
                _buildCustomMenuItem(
                  regularIcon: PhosphorIconsRegular.gearSix,
                  boldIcon: PhosphorIconsBold.gearSix,
                  title: 'ຕັ້ງຄ່າລະບົບ',
                  subtitle: 'ອັດຕາແລກປ່ຽນ & ຮ້ານ',
                  isCollapsed: isCollapsed,
                  isSelected: false,
                  onTap: _showSettingsDialog,
                ),
              ],
            ),
          ),

          // 5. KHU VỰC TIỆN ÍCH DƯỚI ĐÁY (BOTTOM CONTROLS):
          const Divider(height: 1, thickness: 1, color: Color(0xFFF1F5F9)),

          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            color: const Color(0xFFF8FAFC).withValues(alpha: 0.5),
            child: isCollapsed
                ? Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // 1. Tỷ giá vốn (Collapsed)
                      Tooltip(
                        message: 'ອັດຕາຕົ້ນທຶນ: 1 ฿ = $rateDisplay ₭',
                        child: InkWell(
                          onTap: () => _showEditRateDialog(context, rateState.rate),
                          borderRadius: BorderRadius.circular(10),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const PhosphorIcon(
                                  PhosphorIconsFill.currencyCircleDollar,
                                  color: Color(0xFFF59E0B),
                                  size: 20,
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '$rateDisplay₭',
                                  style: const TextStyle(
                                    fontSize: 10,
                                    fontFamily: 'monospace',
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF475569),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),

                      // 2. Supabase Sync Dot (Collapsed)
                      Tooltip(
                        message: 'Supabase Sync: Realtime Connected',
                        child: Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: Color(0xFF10B981),
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),

                      // 3. Nút Toàn màn hình (Collapsed)
                      IconButton(
                        onPressed: _toggleFullScreen,
                        tooltip: 'ເຕັມຈໍ (Full Screen)',
                        style: IconButton.styleFrom(
                          backgroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                            side: const BorderSide(color: Color(0xFFE2E8F0)),
                          ),
                          minimumSize: const Size(40, 40),
                          padding: EdgeInsets.zero,
                        ),
                        icon: const PhosphorIcon(
                          PhosphorIconsRegular.cornersOut,
                          size: 18,
                          color: Color(0xFF475569),
                        ),
                      ),
                      const SizedBox(height: 8),

                      // 4. Nút Thu gọn / Mở rộng (Collapsed)
                      IconButton(
                        onPressed: () {
                          setState(() => _isSidebarCollapsed = !_isSidebarCollapsed);
                        },
                        tooltip: 'ຂະຫຍາຍແຖບເມນູ (Expand)',
                        style: IconButton.styleFrom(
                          backgroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                            side: const BorderSide(color: Color(0xFFE2E8F0)),
                          ),
                          minimumSize: const Size(40, 40),
                          padding: EdgeInsets.zero,
                        ),
                        icon: const PhosphorIcon(
                          PhosphorIconsRegular.sidebar,
                          size: 18,
                          color: Color(0xFF475569),
                        ),
                      ),
                    ],
                  )
                : Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // 1. Khối Tỷ giá vốn (Expanded)
                      InkWell(
                        onTap: () => _showEditRateDialog(context, rateState.rate),
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: Row(
                            children: [
                              const PhosphorIcon(
                                PhosphorIconsFill.currencyCircleDollar,
                                color: Color(0xFFF59E0B),
                                size: 18,
                              ),
                              const SizedBox(width: 6),
                              const Text(
                                'ອັດຕາຕົ້ນທຶນ:',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF475569),
                                ),
                              ),
                              const Spacer(),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF1F5F9),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  '1 ฿ = $rateDisplay ₭',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontFamily: 'monospace',
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF0F172A),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),

                      // 2. Khối Supabase Sync / Realtime Status (Expanded)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Row(
                          children: [
                            const PhosphorIcon(
                              PhosphorIconsRegular.cloudCheck,
                              size: 18,
                              color: Color(0xFF0D9488),
                            ),
                            const SizedBox(width: 8),
                            const Text(
                              'Supabase Sync',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF475569),
                              ),
                            ),
                            const Spacer(),
                            Container(
                              width: 8,
                              height: 8,
                              decoration: const BoxDecoration(
                                color: Color(0xFF10B981),
                                shape: BoxShape.circle,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),

                      // 3. Nút Toàn màn hình (Expanded)
                      InkWell(
                        onTap: _toggleFullScreen,
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: const Row(
                            children: [
                              PhosphorIcon(
                                PhosphorIconsRegular.cornersOut,
                                size: 18,
                                color: Color(0xFF475569),
                              ),
                              SizedBox(width: 8),
                              Text(
                                'ເຕັມຈໍ (Full Screen)',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF475569),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),

                      // 4. Nút Thu gọn / Mở rộng (Expanded)
                      InkWell(
                        onTap: () {
                          setState(() => _isSidebarCollapsed = !_isSidebarCollapsed);
                        },
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: const Row(
                            children: [
                              PhosphorIcon(
                                PhosphorIconsRegular.sidebar,
                                size: 18,
                                color: Color(0xFF475569),
                              ),
                              SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'ຫຍໍ້ແຖບເມນູ',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF475569),
                                  ),
                                ),
                              ),
                              PhosphorIcon(
                                PhosphorIconsRegular.caretLeft,
                                size: 16,
                                color: Color(0xFF94A3B8),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildMenuItem({
    required MainWorkflow workflow,
    required PhosphorIconData regularIcon,
    required PhosphorIconData boldIcon,
    required String title,
    required String subtitle,
    required bool isCollapsed,
    required MainWorkflow currentWorkflow,
    int badgeCount = 0,
  }) {
    final isSelected = currentWorkflow == workflow;
    return _buildCustomMenuItem(
      regularIcon: regularIcon,
      boldIcon: boldIcon,
      title: title,
      subtitle: subtitle,
      isCollapsed: isCollapsed,
      isSelected: isSelected,
      badgeCount: badgeCount,
      onTap: () => ref.read(mainWorkflowProvider.notifier).state = workflow,
    );
  }

  Widget _buildCustomMenuItem({
    required PhosphorIconData regularIcon,
    required PhosphorIconData boldIcon,
    required String title,
    required String subtitle,
    required bool isCollapsed,
    required bool isSelected,
    required VoidCallback onTap,
    int badgeCount = 0,
  }) {
    // 3. STYLE MENU ITEM & HIỆU ỨNG ACTIVE (CRITICAL UI):
    // - Chiều cao ~ 48px - 52px, bo góc 14px, căn lề horizontal: 10px, vertical: 4px
    // - Active:
    //   * Nền: Color(0xFFF0FDFA) (Teal-50)
    //   * Vạch chỉ thị mép trái (Indicator Pillar): width: 4px, height: 26px, Color(0xFF0D9488) bo tròn
    //   * Icon & Tiêu đề: Color(0xFF0D9488)
    //   * Tiêu đề: FontWeight.w600, 14px
    //   * Subtitle: Color(0xFF14B8A6), 11px
    // - Inactive:
    //   * Nền: Trong suốt (hover Color(0xFFF8FAFC))
    //   * Icon & Tiêu đề: Color(0xFF475569) (Slate-600)
    //   * Subtitle: Color(0xFF94A3B8) (Slate-400), 11px
    // - Badge thông báo (Đỏ hồng nổi bật):
    //   * Color(0xFFF43F5E) (Rose-500), rounded-full, chữ trắng bold 11px
    //   * Collapsed: Positioned(top: -4, right: -6)
    //   * Expanded: Align right edge
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      height: 50,
      child: Material(
        color: isSelected ? const Color(0xFFF0FDFA) : Colors.transparent,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          hoverColor: const Color(0xFFF8FAFC),
          child: Stack(
            alignment: Alignment.centerLeft,
            children: [
              // Indicator Pillar (Active only)
              if (isSelected)
                Positioned(
                  left: 0,
                  child: Container(
                    width: 4,
                    height: 26,
                    decoration: const BoxDecoration(
                      color: Color(0xFF0D9488),
                      borderRadius: BorderRadius.only(
                        topRight: Radius.circular(4),
                        bottomRight: Radius.circular(4),
                      ),
                    ),
                  ),
                ),

              // Item content
              Padding(
                padding: EdgeInsets.symmetric(
                  horizontal: isCollapsed ? 0 : 14,
                ),
                child: isCollapsed
                    ? Center(
                        child: Stack(
                          clipBehavior: Clip.none,
                          children: [
                            PhosphorIcon(
                              isSelected ? boldIcon : regularIcon,
                              size: 22,
                              color: isSelected
                                  ? const Color(0xFF0D9488)
                                  : const Color(0xFF475569),
                            ),
                            if (badgeCount > 0)
                              Positioned(
                                top: -4,
                                right: -6,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF43F5E), // Rose-500
                                    borderRadius: BorderRadius.circular(999),
                                    border: Border.all(color: Colors.white, width: 1.5),
                                  ),
                                  constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                                  child: Text(
                                    badgeCount > 99 ? '99+' : '$badgeCount',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                      height: 1.0,
                                    ),
                                    textAlign: TextAlign.center,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      )
                    : Row(
                        children: [
                          PhosphorIcon(
                            isSelected ? boldIcon : regularIcon,
                            size: 22,
                            color: isSelected
                                ? const Color(0xFF0D9488)
                                : const Color(0xFF475569),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  title,
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                                    color: isSelected
                                        ? const Color(0xFF0D9488)
                                        : const Color(0xFF475569),
                                    letterSpacing: -0.2,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 1),
                                Text(
                                  subtitle,
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: isSelected
                                        ? const Color(0xFF14B8A6)
                                        : const Color(0xFF94A3B8),
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                          if (badgeCount > 0)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF43F5E), // Rose-500
                                borderRadius: BorderRadius.circular(999),
                              ),
                              constraints: const BoxConstraints(minWidth: 20, minHeight: 20),
                              child: Text(
                                badgeCount > 99 ? '99+' : '$badgeCount',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  height: 1.0,
                                ),
                                textAlign: TextAlign.center,
                              ),
                            ),
                        ],
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

