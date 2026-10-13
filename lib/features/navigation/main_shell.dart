import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/app_colors.dart';
import '../../core/localization/lo.dart';
import '../backoffice/presentation/dashboard_screen.dart';
import '../backoffice/presentation/product_form_screen.dart';
import '../backoffice/presentation/product_list_screen.dart';
import '../history/presentation/receipt_history_screen.dart';
import '../pos/presentation/controllers/printer_controller.dart';
import '../pos/presentation/pos_screen.dart';

enum MainWorkflow {
  pos,
  catalog,
  addProduct,
  history,
  dashboard,
}

/// Master Shell with Collapsible Sidebar Navigation for iPad/Tablet Landscape
class MainShell extends ConsumerStatefulWidget {
  const MainShell({super.key});

  @override
  ConsumerState<MainShell> createState() => _MainShellState();
}

class _MainShellState extends ConsumerState<MainShell> {
  MainWorkflow _currentWorkflow = MainWorkflow.pos;
  bool _isSidebarCollapsed = true; // Collapsed by default for maximum POS real estate

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Row(
        children: [
          // Collapsible Left Navigation Rail
          _buildSidebar(context),

          // Main Workflow Content (IndexedStack keeps POS state alive)
          Expanded(
            child: IndexedStack(
              index: _currentWorkflow.index,
              children: [
                const PosScreen(),
                ProductListScreen(
                  onOpenAddProduct: () {
                    setState(() => _currentWorkflow = MainWorkflow.addProduct);
                  },
                ),
                ProductFormScreen(
                  onSaved: () {
                    setState(() => _currentWorkflow = MainWorkflow.catalog);
                  },
                ),
                const ReceiptHistoryScreen(),
                const DashboardScreen(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSidebar(BuildContext context) {
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
                  horizontal: isCompact ? 10 : 16,
                  vertical: 14,
                ),
                child: Row(
                  mainAxisAlignment: isCompact
                      ? MainAxisAlignment.center
                      : MainAxisAlignment.spaceBetween,
                  children: [
                    if (!isCompact)
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
                        backgroundColor: isCompact
                            ? AppColors.surfaceSubtle
                            : Colors.transparent,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      icon: Icon(
                        _isSidebarCollapsed ? Icons.menu_open : Icons.menu,
                        color: AppColors.textSecondary,
                        size: 20,
                      ),
                      tooltip: _isSidebarCollapsed ? 'ຂະຫຍາຍເມນູ' : 'ຫຍໍ້ເມນູ',
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
                      icon: Icons.point_of_sale_rounded,
                      label: 'ຈຸດຂາຍ (POS)',
                      badgeText: 'ໜ້າຮ້ານ',
                      isCompact: isCompact,
                    ),
                    _buildNavItem(
                      workflow: MainWorkflow.catalog,
                      icon: Icons.inventory_2_outlined,
                      label: 'ສາງ & ສິນຄ້າ',
                      badgeText: 'ຫຼັງຮ້ານ',
                      isCompact: isCompact,
                    ),
                    _buildNavItem(
                      workflow: MainWorkflow.addProduct,
                      icon: Icons.add_circle_outline_rounded,
                      label: 'ເພີ່ມສິນຄ້າໃໝ່',
                      isCompact: isCompact,
                    ),
                    _buildNavItem(
                      workflow: MainWorkflow.history,
                      icon: Icons.receipt_long_rounded,
                      label: 'ປະຫວັດໃບບິນ',
                      badgeText: 'ບິນຂາຍ',
                      isCompact: isCompact,
                    ),
                    _buildNavItem(
                      workflow: MainWorkflow.dashboard,
                      icon: Icons.insights_rounded,
                      label: 'ແຜງຄວບຄຸມ',
                      badgeText: 'ກຳໄລ',
                      isCompact: isCompact,
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
                margin: const EdgeInsets.fromLTRB(8, 0, 8, 8),
                padding: EdgeInsets.symmetric(horizontal: isCompact ? 6 : 10, vertical: 8),
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
                      children: [
                        const CircleAvatar(
                          radius: 14,
                          backgroundColor: AppColors.primaryLight,
                          child: Text(
                            'M',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.primaryDark),
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
    String? badgeText,
  }) {
    final isSelected = _currentWorkflow == workflow;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4.0, vertical: 2.5),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => setState(() => _currentWorkflow = workflow),
          borderRadius: BorderRadius.circular(9),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding: EdgeInsets.symmetric(
              horizontal: isCompact ? 8 : 10,
              vertical: 9,
            ),
            decoration: BoxDecoration(
              color: isSelected ? AppColors.primaryLight : Colors.transparent,
              borderRadius: BorderRadius.circular(9),
              border: Border.all(
                color: isSelected ? AppColors.primaryBorder : Colors.transparent,
                width: 0.9,
              ),
            ),
            child: Row(
              mainAxisAlignment: isCompact
                  ? MainAxisAlignment.center
                  : MainAxisAlignment.start,
              children: [
                Icon(
                  icon,
                  size: 20,
                  color: isSelected ? AppColors.primaryDark : AppColors.textSecondary,
                ),
                if (!isCompact) ...[
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      label,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                        color: isSelected ? AppColors.primaryDark : AppColors.textPrimary,
                        letterSpacing: -0.2,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (badgeText != null)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: isSelected ? AppColors.primary : AppColors.surfaceSubtle,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        badgeText,
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          color: isSelected ? Colors.white : AppColors.textTertiary,
                        ),
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
