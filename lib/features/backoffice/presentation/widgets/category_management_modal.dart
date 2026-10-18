import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../domain/models/category_model.dart';
import '../../../pos/presentation/controllers/catalog_controller.dart';

/// Modal for Comprehensive Category CRUD Management (ຈັດການໝວດໝູ່ສິນຄ້າ)
/// Spec reference: SPEC_CATEGORY_MANAGEMENT.md & CategoryManagerModal.jsx
class CategoryManagementModal extends ConsumerStatefulWidget {
  const CategoryManagementModal({super.key});

  @override
  ConsumerState<CategoryManagementModal> createState() => _CategoryManagementModalState();
}

class _CategoryManagementModalState extends ConsumerState<CategoryManagementModal> {
  final TextEditingController _newCatController = TextEditingController();
  final TextEditingController _editCatController = TextEditingController();

  String? _editingCatId;
  bool _isSubmitting = false;

  // Feedback toast banner: message and whether it's an error
  String? _feedbackMessage;
  bool _isFeedbackError = false;
  Timer? _feedbackTimer;

  @override
  void dispose() {
    _newCatController.dispose();
    _editCatController.dispose();
    _feedbackTimer?.cancel();
    super.dispose();
  }

  void _showFeedback(String message, {bool isError = false}) {
    _feedbackTimer?.cancel();
    setState(() {
      _feedbackMessage = message;
      _isFeedbackError = isError;
    });
    _feedbackTimer = Timer(const Duration(milliseconds: 3500), () {
      if (mounted) {
        setState(() {
          _feedbackMessage = null;
        });
      }
    });
  }

  Future<void> _handleCreate() async {
    final clean = _newCatController.text.trim();
    if (clean.isEmpty || _isSubmitting) return;

    final catalogState = ref.read(catalogProvider);
    final rawCats = catalogState.rawCategories;

    // Check duplicate locally
    if (rawCats.any((c) => c.name.trim().toLowerCase() == clean.toLowerCase())) {
      _showFeedback('ໝວດໝູ່ "$clean" ມີໃນລະບົບແລ້ວ!', isError: true);
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final res = await ref.read(catalogProvider.notifier).createCategory(clean);
      if (res != null) {
        _newCatController.clear();
        _showFeedback('ເພີ່ມໝວດໝູ່ "$clean" ສຳເລັດແລ້ວ!');
      } else {
        _showFeedback('ເກີດຂໍ້ຜິດພາດໃນການສ້າງໝວດໝູ່', isError: true);
      }
    } catch (e) {
      _showFeedback(e.toString(), isError: true);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  void _startEdit(CategoryModel cat) {
    setState(() {
      _editingCatId = cat.id;
      _editCatController.text = cat.name;
    });
  }

  void _cancelEdit() {
    setState(() {
      _editingCatId = null;
      _editCatController.clear();
    });
  }

  Future<void> _handleSaveEdit(CategoryModel cat) async {
    final clean = _editCatController.text.trim();
    if (clean.isEmpty) return;

    if (clean == cat.name) {
      _cancelEdit();
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final success = await ref.read(catalogProvider.notifier).updateCategory(cat.id, clean, cat.name);
      if (success) {
        _showFeedback('ແກ້ໄຂໝວດໝູ່ເປັນ "$clean" ສຳເລັດແລ້ວ!');
        _cancelEdit();
      } else {
        _showFeedback('ບໍ່ສາມາດແກ້ໄຂໝວດໝູ່ໄດ້', isError: true);
      }
    } catch (e) {
      _showFeedback(e.toString(), isError: true);
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  void _requestDelete(CategoryModel cat, int productCount) {
    if (productCount > 0) {
      _showFeedback(
        'ໝວດໝູ່ນີ້ກຳລັງມີສິນຄ້າຢູ່ $productCount ລາຍການ, ບໍ່ສາມາດລຶບໄດ້! ກະລຸນາຍ້າຍສິນຄ້າໄປໝວດອື່ນກ່ອນ.',
        isError: true,
      );
      return;
    }

    // Confirmation dialog for empty category
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: const [
            PhosphorIcon(PhosphorIconsBold.warningCircle, color: Color(0xFFDC2626), size: 24),
            SizedBox(width: 8),
            Text(
              'ຢືນຢັນການລຶບໝວດໝູ່',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
            ),
          ],
        ),
        content: Text(
          'ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລຶບໝວດໝູ່ "${cat.name}"? ຂໍ້ມູນຈະຖືກລຶບອອກຈາກຖານຂໍ້ມູນ Supabase ໂດຍກົງ.',
          style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
        ),
        actions: [
          AppButton(
            variant: AppButtonVariant.outline,
            size: AppButtonSize.sm,
            label: 'ຍົກເລີກ',
            onPressed: () => Navigator.of(ctx).pop(),
          ),
          const SizedBox(width: 8),
          AppButton(
            variant: AppButtonVariant.danger,
            size: AppButtonSize.sm,
            label: 'ລຶບໝວດໝູ່',
            icon: PhosphorIconsBold.trash,
            onPressed: () async {
              Navigator.of(ctx).pop();
              setState(() => _isSubmitting = true);
              try {
                final err = await ref.read(catalogProvider.notifier).deleteCategory(cat.id, cat.name);
                if (err == null) {
                  _showFeedback('ລຶບໝວດໝູ່ "${cat.name}" ສຳເລັດແລ້ວ!');
                } else {
                  _showFeedback(err, isError: true);
                }
              } catch (e) {
                _showFeedback(e.toString(), isError: true);
              } finally {
                if (mounted) setState(() => _isSubmitting = false);
              }
            },
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final catalogState = ref.watch(catalogProvider);
    final rawCats = catalogState.rawCategories;
    final allProducts = catalogState.allProducts;
    final screenSize = MediaQuery.of(context).size;
    final isCompactLandscape = screenSize.height < 500;
    final isMobileWidth = screenSize.width < 540;

    return Dialog(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(isMobileWidth ? 20 : 20),
        side: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      backgroundColor: Colors.white,
      clipBehavior: Clip.antiAlias,
      insetPadding: EdgeInsets.symmetric(
        horizontal: isMobileWidth ? 12 : 24,
        vertical: isCompactLandscape ? 8 : (isMobileWidth ? 16 : 24),
      ),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: isCompactLandscape ? 600 : 540,
          maxHeight: isCompactLandscape ? (screenSize.height - 16) : (screenSize.height * 0.90).clamp(480.0, 750.0),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 1. Header Toolbar (Modern Clean Slate-50 with Subtle 1px Border)
            Container(
              padding: EdgeInsets.symmetric(
                horizontal: isMobileWidth ? 14 : 20,
                vertical: isMobileWidth ? 12 : 16,
              ),
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
              ),
              child: Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: const Color(0xFFCCFBF1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const PhosphorIcon(PhosphorIconsBold.folder, color: Color(0xFF0D9488), size: 20),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Text(
                          'ຈັດການໝວດໝູ່ສິນຄ້າ (Category Manager)',
                          style: TextStyle(
                            color: Color(0xFF0F172A),
                            fontWeight: FontWeight.w900,
                            fontSize: 15,
                            letterSpacing: -0.2,
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'ເພີ່ມ, ແກ້ໄຂຊື່ ແລະ ລຶບໝວດໝູ່ໃນລະບົບ Supabase',
                          style: TextStyle(
                            color: Color(0xFF64748B),
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const PhosphorIcon(PhosphorIconsBold.x, color: Color(0xFF64748B), size: 18),
                    style: IconButton.styleFrom(
                      backgroundColor: const Color(0xFFF1F5F9),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    tooltip: 'ປິດໜ້າຕ່າງ',
                  ),
                ],
              ),
            ),

            // 2. Feedback Toast Banner
            if (_feedbackMessage != null)
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                color: _isFeedbackError ? const Color(0xFFFEF2F2) : const Color(0xFFECFDF5),
                child: Row(
                  children: [
                    PhosphorIcon(
                      _isFeedbackError ? PhosphorIconsBold.warningCircle : PhosphorIconsBold.checkCircle,
                      color: _isFeedbackError ? const Color(0xFFDC2626) : const Color(0xFF059669),
                      size: 18,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        _feedbackMessage!,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: _isFeedbackError ? const Color(0xFFB91C1C) : const Color(0xFF047857),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

            // 3. Create Bar Input Form
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: const BoxDecoration(
                color: Color(0xFFF8FAFC),
                border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Container(
                      height: 40,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFCBD5E1)),
                      ),
                      child: TextField(
                        controller: _newCatController,
                        enabled: !_isSubmitting,
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                        decoration: const InputDecoration(
                          hintText: 'ປ້ອນຊື່ໝວດໝູ່ໃໝ່ (e.g. ເຄື່ອງໃຊ້ໄຟຟ້າ, ເຂົ້າສານ...)',
                          hintStyle: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                          prefixIcon: Padding(
                            padding: EdgeInsets.symmetric(horizontal: 10),
                            child: PhosphorIcon(PhosphorIconsBold.tag, size: 18, color: Color(0xFF64748B)),
                          ),
                          prefixIconConstraints: BoxConstraints(minWidth: 36, minHeight: 36),
                          border: InputBorder.none,
                          contentPadding: EdgeInsets.symmetric(vertical: 10, horizontal: 8),
                          isDense: true,
                        ),
                        onSubmitted: (_) => _handleCreate(),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  AppButton(
                    onPressed: _isSubmitting ? null : _handleCreate,
                    variant: AppButtonVariant.primary,
                    size: AppButtonSize.md,
                    label: 'ເພີ່ມ',
                    icon: PhosphorIconsBold.plus,
                    isLoading: _isSubmitting,
                  ),
                ],
              ),
            ),

            // 4. List Count Header & Explanatory Subtitle
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 12, 18, 6),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'ລາຍການໝວດໝູ່ທັງໝົດ (${rawCats.length})',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF334155),
                    ),
                  ),
                  const Flexible(
                    child: Text(
                      '* ແກ້ໄຂຊື່ແລ້ວສິນຄ້າຈະອັບເດດຕາມ',
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w500,
                        color: Color(0xFF94A3B8),
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),

            // 5. Scrollable Category List
            Expanded(
              child: rawCats.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(32),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: const [
                            PhosphorIcon(PhosphorIconsBold.tag, size: 40, color: Color(0xFFCBD5E1)),
                            SizedBox(height: 10),
                            Text(
                              'ຍັງບໍ່ມີໝວດໝູ່ໃນລະບົບ',
                              style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
                            ),
                            SizedBox(height: 4),
                            Text(
                              'ປ້ອນຊື່ໝວດໝູ່ດ້ານເທິງເພື່ອເລີ່ມຕົ້ນສ້າງ',
                              style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                            ),
                          ],
                        ),
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      itemCount: rawCats.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 6),
                      itemBuilder: (context, index) {
                        final cat = rawCats[index];
                        final isEditing = _editingCatId == cat.id;

                        // Count connected products
                        final productCount = allProducts
                            .where((p) => p.categoryId == cat.id || p.category == cat.name)
                            .length;

                        return Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: isEditing ? const Color(0xFFF0FDFA) : const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: isEditing ? const Color(0xFF0D9488) : const Color(0xFFE2E8F0),
                              width: isEditing ? 1.4 : 1,
                            ),
                          ),
                          child: Row(
                            children: [
                              // Index Badge
                              Container(
                                width: 26,
                                height: 26,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFE2E8F0),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Center(
                                  child: Text(
                                    '${index + 1}',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w800,
                                      color: Color(0xFF475569),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),

                              // Name or Inline Edit Field
                              Expanded(
                                child: isEditing
                                    ? Container(
                                        height: 36,
                                        decoration: BoxDecoration(
                                          color: Colors.white,
                                          borderRadius: BorderRadius.circular(8),
                                          border: Border.all(color: const Color(0xFF0D9488)),
                                        ),
                                        child: TextField(
                                          controller: _editCatController,
                                          autofocus: true,
                                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                                          decoration: const InputDecoration(
                                            isDense: true,
                                            contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                                            border: InputBorder.none,
                                          ),
                                          onSubmitted: (_) => _handleSaveEdit(cat),
                                        ),
                                      )
                                    : Row(
                                        children: [
                                          Expanded(
                                            child: Text(
                                              cat.name,
                                              style: const TextStyle(
                                                fontSize: 13,
                                                fontWeight: FontWeight.w800,
                                                color: Color(0xFF0F172A),
                                              ),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                                            decoration: BoxDecoration(
                                              color: productCount > 0
                                                  ? const Color(0xFFE0F2FE)
                                                  : const Color(0xFFF1F5F9),
                                              borderRadius: BorderRadius.circular(6),
                                              border: Border.all(
                                                color: productCount > 0
                                                    ? const Color(0xFFBAE6FD)
                                                    : const Color(0xFFE2E8F0),
                                              ),
                                            ),
                                            child: Text(
                                              productCount > 0 ? '$productCount ສິນຄ້າ' : 'ຍັງບໍ່ມີສິນຄ້າ',
                                              style: TextStyle(
                                                fontSize: 10,
                                                fontWeight: FontWeight.w700,
                                                color: productCount > 0
                                                    ? const Color(0xFF0369A1)
                                                    : const Color(0xFF94A3B8),
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                              ),

                              const SizedBox(width: 8),

                              // Actions
                              if (isEditing) ...[
                                IconButton(
                                  icon: const PhosphorIcon(PhosphorIconsBold.check, color: Color(0xFF0D9488), size: 18),
                                  onPressed: () => _handleSaveEdit(cat),
                                  style: IconButton.styleFrom(
                                    backgroundColor: const Color(0xFFCCFBF1),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                    minimumSize: const Size(32, 32),
                                    padding: EdgeInsets.zero,
                                  ),
                                  tooltip: 'ບັນທຶກ',
                                ),
                                const SizedBox(width: 4),
                                IconButton(
                                  icon: const PhosphorIcon(PhosphorIconsBold.x, color: Color(0xFF64748B), size: 18),
                                  onPressed: _cancelEdit,
                                  style: IconButton.styleFrom(
                                    backgroundColor: const Color(0xFFF1F5F9),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                    minimumSize: const Size(32, 32),
                                    padding: EdgeInsets.zero,
                                  ),
                                  tooltip: 'ຍົກເລີກ',
                                ),
                              ] else ...[
                                IconButton(
                                  icon: const PhosphorIcon(PhosphorIconsBold.pencilSimple, color: Color(0xFF475569), size: 16),
                                  onPressed: () => _startEdit(cat),
                                  style: IconButton.styleFrom(
                                    backgroundColor: Colors.white,
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(8),
                                      side: const BorderSide(color: Color(0xFFE2E8F0)),
                                    ),
                                    minimumSize: const Size(32, 32),
                                    padding: EdgeInsets.zero,
                                  ),
                                  tooltip: 'ແກ້ໄຂຊື່',
                                ),
                                const SizedBox(width: 4),
                                IconButton(
                                  icon: const PhosphorIcon(PhosphorIconsBold.trash, color: Color(0xFFDC2626), size: 16),
                                  onPressed: () => _requestDelete(cat, productCount),
                                  style: IconButton.styleFrom(
                                    backgroundColor: const Color(0xFFFEF2F2),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(8),
                                      side: const BorderSide(color: Color(0xFFFECDD3)),
                                    ),
                                    minimumSize: const Size(32, 32),
                                    padding: EdgeInsets.zero,
                                  ),
                                  tooltip: 'ລຶບໝວດໝູ່',
                                ),
                              ],
                            ],
                          ),
                        );
                      },
                    ),
            ),

            // 6. Modal Footer
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
              decoration: const BoxDecoration(
                color: Color(0xFFF8FAFC),
                border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
              ),
              child: Row(
                children: [
                  const PhosphorIcon(PhosphorIconsBold.info, size: 15, color: Color(0xFF64748B)),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'ບັນທຶກລົງຕາຕະລາງ categories ໃນ Supabase ໂດຍກົງ',
                      style: TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                    ),
                  ),
                  AppButton(
                    variant: AppButtonVariant.outline,
                    size: AppButtonSize.sm,
                    label: 'ປິດໜ້າຕ່າງ',
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
