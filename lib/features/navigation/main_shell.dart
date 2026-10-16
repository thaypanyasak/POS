import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/app_colors.dart';
import '../../core/localization/lo.dart';
import '../../views/inventory/purchase_list_screen.dart';
import '../backoffice/presentation/dashboard_screen.dart';
import '../backoffice/presentation/product_list_screen.dart';
import '../history/presentation/receipt_history_screen.dart';
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
                          icon: Icon(Icons.storefront_rounded),
                          activeIcon: Icon(Icons.storefront_rounded),
                          label: 'ຂາຍໜ້າຮ້ານ',
                        ),
                        BottomNavigationBarItem(
                          icon: Icon(Icons.bar_chart_rounded),
                          activeIcon: Icon(Icons.bar_chart_rounded),
                          label: 'ແຜງຄວບຄຸມ',
                        ),
                        BottomNavigationBarItem(
                          icon: Icon(Icons.warehouse_rounded),
                          activeIcon: Icon(Icons.warehouse_rounded),
                          label: 'ລາຍການສິນຄ້າ',
                        ),
                        BottomNavigationBarItem(
                          icon: Icon(Icons.history_rounded),
                          activeIcon: Icon(Icons.history_rounded),
                          label: 'ປະຫວັດບິນ',
                        ),
                        BottomNavigationBarItem(
                          icon: Icon(Icons.inventory_2_rounded),
                          activeIcon: Icon(Icons.inventory_2_rounded),
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
    final screenWidth = MediaQuery.of(context).size.width;
    final isMobileLandscape = screenWidth < 900;
    final collapsedWidth = isMobileLandscape ? 56.0 : 68.0;
    final expandedWidth = isMobileLandscape ? 190.0 : 230.0;
    final sidebarWidth = _isSidebarCollapsed ? collapsedWidth : expandedWidth;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeInOut,
      width: sidebarWidth,
      clipBehavior: Clip.hardEdge,
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(right: BorderSide(color: AppColors.border, width: 1.2)),
        boxShadow: [
          BoxShadow(
            color: AppColors.shadowSubtle,
            offset: Offset(2, 0),
            blurRadius: 4,
          ),
        ],
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final isCompact = constraints.maxWidth < 180;

          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Sidebar Header & Toggle
              Container(
                padding: EdgeInsets.symmetric(
                  horizontal: isCompact ? 4 : 16,
                  vertical: 14,
                ),
                child: isCompact
                    ? Center(
                        child: IconButton(
                          onPressed: () {
                            setState(() => _isSidebarCollapsed = !_isSidebarCollapsed);
                          },
                          style: IconButton.styleFrom(
                            backgroundColor: AppColors.surfaceSubtle,
                            padding: const EdgeInsets.all(6),
                            minimumSize: const Size(36, 36),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                          ),
                          icon: const Icon(
                            Icons.menu,
                            color: AppColors.textSecondary,
                            size: 18,
                          ),
                          tooltip: 'ຂະຫຍາຍເມນູ',
                        ),
                      )
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 34,
                                  height: 34,
                                  decoration: BoxDecoration(
                                    gradient: AppColors.primaryGradient,
                                    borderRadius: BorderRadius.circular(9),
                                    boxShadow: const [
                                      BoxShadow(
                                        color: Color(0x33059669),
                                        offset: Offset(0, 2),
                                        blurRadius: 6,
                                      ),
                                    ],
                                  ),
                                  child: const Center(
                                    child: Text(
                                      'M',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w900,
                                        fontSize: 18,
                                        letterSpacing: -0.5,
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                const Flexible(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        'MeiiShop',
                                        style: TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w800,
                                          color: AppColors.textPrimary,
                                          letterSpacing: -0.3,
                                        ),
                                        overflow: TextOverflow.fade,
                                        softWrap: false,
                                      ),
                                      Text(
                                        'POS Station',
                                        style: TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.w600,
                                          color: AppColors.textTertiary,
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            onPressed: () {
                              setState(() => _isSidebarCollapsed = !_isSidebarCollapsed);
                            },
                            style: IconButton.styleFrom(
                              backgroundColor: Colors.transparent,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8),
                              ),
                            ),
                            icon: const Icon(
                              Icons.menu_open,
                              color: AppColors.textSecondary,
                              size: 20,
                            ),
                            tooltip: 'ຫຍໍ້ເມນູ',
                          ),
                        ],
                      ),
              ),

              const Divider(height: 1, color: AppColors.border),
              const SizedBox(height: 10),

              // Scrollable Primary Navigation Items (Never overflows bottom)
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  children: [
                    _buildNavItem(
                      workflow: MainWorkflow.pos,
                      icon: Icons.storefront_rounded,
                      label: 'ຂາຍໜ້າຮ້ານ (POS)',
                      isCompact: isCompact,
                      currentWorkflow: currentWorkflow,
                    ),
                    _buildNavItem(
                      workflow: MainWorkflow.dashboard,
                      icon: Icons.bar_chart_rounded,
                      label: 'ແຜງຄວບຄຸມ',
                      isCompact: isCompact,
                      currentWorkflow: currentWorkflow,
                    ),
                    _buildNavItem(
                      workflow: MainWorkflow.catalog,
                      icon: Icons.warehouse_rounded,
                      label: 'ລາຍການສິນຄ້າ',
                      isCompact: isCompact,
                      currentWorkflow: currentWorkflow,
                    ),
                    _buildNavItem(
                      workflow: MainWorkflow.history,
                      icon: Icons.history_rounded,
                      label: 'ປະຫວັດບິນ',
                      isCompact: isCompact,
                      currentWorkflow: currentWorkflow,
                    ),
                    _buildNavItem(
                      workflow: MainWorkflow.inventory,
                      icon: Icons.inventory_2_rounded,
                      label: 'ຮັບສິນຄ້າເຂົ້າສາງ',
                      isCompact: isCompact,
                      currentWorkflow: currentWorkflow,
                    ),
                  ],
                ),
              ),

              // Bottom Utilities
              const Divider(height: 1, color: AppColors.border),
              // Quick Cash Drawer Open shortcut
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(8),
                    onTap: () {
                      ref.read(printerProvider.notifier).openCashDrawer();
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('ສົ່ງຄຳສັ່ງເປີດລິ້ນຊັກ (ESC p 0)'),
                          duration: Duration(seconds: 1),
                          backgroundColor: AppColors.primary,
                        ),
                      );
                    },
                    child: Padding(
                      padding: EdgeInsets.symmetric(horizontal: isCompact ? 8 : 12, vertical: 8),
                      child: Row(
                        mainAxisAlignment: isCompact
                            ? MainAxisAlignment.center
                            : MainAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(5),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceSubtle,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Icon(Icons.sensor_door_outlined, size: 16, color: AppColors.textSecondary),
                          ),
                          if (!isCompact) ...[
                            const SizedBox(width: 10),
                            const Expanded(
                              child: Text(
                                LaoStrings.openDrawer,
                                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
              ),

              // Cashier profile footer
              Container(
                margin: EdgeInsets.fromLTRB(isCompact ? 4 : 8, 0, isCompact ? 4 : 8, 8),
                padding: EdgeInsets.symmetric(horizontal: isCompact ? 2 : 10, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.surfaceSubtle,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.borderSubtle),
                ),
                child: Row(
                  mainAxisAlignment: isCompact
                      ? MainAxisAlignment.center
                      : MainAxisAlignment.start,
                  children: [
                    Stack(
                      clipBehavior: Clip.none,
                      children: [
                        const CircleAvatar(
                          radius: 13,
                          backgroundColor: AppColors.primaryLight,
                          child: Text(
                            'M',
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primaryDark),
                          ),
                        ),
                        Positioned(
                          right: 0,
                          bottom: 0,
                          child: Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: const Color(0xFF10B981),
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white, width: 1.5),
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (!isCompact) ...[
                      const SizedBox(width: 8),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'ໄມ້ຄຳ (Meii)',
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            Text(
                              'Online Sync',
                              style: TextStyle(fontSize: 10, color: AppColors.primary, fontWeight: FontWeight.bold),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildNavItem({
    required MainWorkflow workflow,
    required IconData icon,
    required String label,
    required bool isCompact,
    required MainWorkflow currentWorkflow,
  }) {
    final isSelected = currentWorkflow == workflow;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4.0, vertical: 3.0),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => ref.read(mainWorkflowProvider.notifier).state = workflow,
          borderRadius: BorderRadius.circular(12),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding: EdgeInsets.symmetric(
              horizontal: isCompact ? 8 : 12,
              vertical: 10,
            ),
            decoration: BoxDecoration(
              color: isSelected ? const Color(0xFF0F766E) : Colors.transparent,
              borderRadius: BorderRadius.circular(12),
              boxShadow: isSelected
                  ? const [
                      BoxShadow(
                        color: Color(0x330F766E),
                        offset: Offset(0, 2),
                        blurRadius: 4,
                      ),
                    ]
                  : null,
            ),
            child: Row(
              mainAxisAlignment: isCompact
                  ? MainAxisAlignment.center
                  : MainAxisAlignment.start,
              children: [
                Icon(
                  icon,
                  size: 20,
                  color: isSelected ? Colors.white : const Color(0xFF64748B),
                ),
                if (!isCompact) ...[
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      label,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                        color: isSelected ? Colors.white : const Color(0xFF334155),
                        letterSpacing: -0.2,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
