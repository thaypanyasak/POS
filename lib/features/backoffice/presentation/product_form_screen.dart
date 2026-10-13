import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:uuid/uuid.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/localization/lao_currency_formatter.dart';
import '../../../core/utils/image_compress_service.dart';
import '../../../data/remote/supabase_sync_service.dart';
import '../../../domain/models/product.dart';
import '../../../domain/models/product_unit.dart';
import '../../pos/presentation/controllers/catalog_controller.dart';

enum ProductTypeMode {
  grocery, // ສິນຄ້າທົ່ວໄປ (ເຂົ້າໜົມ, ຢາສູບ, ນ້ຳຫວານ): ຊື້ເປັນແກັດ (ມີ X ແພັກ), ຂາຍເປັນແພັກ & ແກັດ (ລາຄາດຽວຕໍ່ໜ່ວຍ)
  beer,    // ເບຍໂດຍສະເພາະ: ຊື້ເປັນລັງ (24 ແກ້ວ), ຂາຍຍົກລັງຢ່າງດຽວ (ລາຄາດຽວຕໍ່ລັງ)
}

/// Module A: Lao Grocery Product Entry & Management (ເພີ່ມ ແລະ ແກ້ໄຂສິນຄ້າ)
///
/// Business Rules:
/// 1. General Grocery Mode (ເຂົ້າໜົມ, ຢາສູບ, ນ້ຳຫວານ...):
///    - Purchase cost per carton (ແກັດ), e.g. 500.000 ₭.
///    - Number of packs inside, e.g. 8 ແພັກ.
///    - Selling price for 1 Carton (ແກັດ/ກ່ອງ), e.g. 500.000 ₭.
///    - Selling price for 1 Pack (ແພັກ), e.g. 70.000 ₭.
///    - No wholesale/retail split (single selling price per unit).
/// 2. Beer Mode (ເບຍໂດຍສະເພາະ):
///    - Purchased by Crate (ລັງ) with 24 bottles/cans inside.
///    - Sold by Crate ONLY (ຂາຍຍົກລັງຢ່າງດຽວ, ບໍ່ມີຂາຍເປັນແພັກ).
///    - Enter only: Purchase Price per Crate (ລາຄາຊື້/ລັງ) and Selling Price per Crate (ລາຄາຂາຍ/ລັງ).
/// 3. Dot thousand separator (`.`) and strict 3-state profit calculation.
/// 4. Ultra-compressed image upload (< 40 KB).
class ProductFormScreen extends ConsumerStatefulWidget {
  final Product? productToEdit;
  final VoidCallback? onSaved;

  const ProductFormScreen({
    super.key,
    this.productToEdit,
    this.onSaved,
  });

  @override
  ConsumerState<ProductFormScreen> createState() => _ProductFormScreenState();
}

class _ProductFormScreenState extends ConsumerState<ProductFormScreen> {
  final _formKey = GlobalKey<FormState>();

  late ProductTypeMode _currentMode;

  late TextEditingController _nameController;
  late TextEditingController _barcodeController;
  late TextEditingController _categoryController;

  // Grocery Mode Controllers (ແກັດ & ແພັກ)
  late TextEditingController _groceryCartonCostController; // ຕົ້ນທຶນຊື້ຕໍ່ແກັດ
  late TextEditingController _groceryPacksPerCartonController; // ຈຳນວນແພັກໃນແກັດ (e.g. 8)
  late TextEditingController _groceryPackSellingPriceController; // ລາຄາຂາຍຕໍ່ແພັກ (e.g. 70.000)
  late TextEditingController _groceryCartonSellingPriceController; // ລາຄາຂາຍຕໍ່ແກັດ (e.g. 500.000)
  late TextEditingController _groceryStockCartonsController; // ຈຳນວນແກັດໃນສາງ
  late TextEditingController _groceryStockLoosePacksController; // ຈຳນວນແພັກເສດ

  // Beer Mode Controllers (ຂາຍຍົກລັງຢ່າງດຽວ)
  late TextEditingController _beerCrateCostController; // ຕົ້ນທຶນຊື້ຕໍ່ລັງ
  late TextEditingController _beerCrateSellingPriceController; // ລາຄາຂາຍຕໍ່ລັງ
  late TextEditingController _beerStockCratesController; // ຈຳນວນລັງໃນສາງ

  late bool _trackStock;
  int _groceryCalculatedCostPerPack = 0;

  // Image upload state
  Uint8List? _compressedImageBytes;
  int? _originalImageSizeBytes;
  String? _existingImageUrl;
  bool _isUploadingImage = false;

  final List<String> _suggestedCategories = [
    'ເຄື່ອງດື່ມ',
    'ເບຍ/ເຄື່ອງດື່ມມີທາດເຫຼົ້າ',
    'ເຂົ້າໜົມ/ອາຫານຫວ່າງ',
    'ເຄື່ອງປຸງ/ອາຫານແຫ້ງ',
    'ເຂົ້າສານ/ອາຫານຫຼັກ',
    'ເຄື່ອງໃຊ້ທົ່ວໄປ',
    'ນົມ/ເຄື່ອງເຢັນ',
    'ຢາສູບ',
  ];

  @override
  void initState() {
    super.initState();
    final p = widget.productToEdit;

    // Detect if editing Beer or Grocery
    final isBeer = p != null &&
        (p.baseUnit == 'ລັງ' ||
            p.category.contains('ເບຍ') ||
            (p.units.length == 1 && p.units.first.unitName == 'ລັງ'));

    _currentMode = isBeer ? ProductTypeMode.beer : ProductTypeMode.grocery;

    _nameController = TextEditingController(text: p?.name ?? '');
    _barcodeController = TextEditingController(text: p?.barcode ?? '');
    _categoryController = TextEditingController(
      text: p?.category ?? (isBeer ? 'ເບຍ/ເຄື່ອງດື່ມມີທາດເຫຼົ້າ' : 'ເຂົ້າໜົມ/ອາຫານຫວ່າງ'),
    );
    _trackStock = p?.trackStock ?? true;
    _existingImageUrl = p?.imageUrl;

    if (p != null && isBeer) {
      // Init Beer fields
      final crateCost = p.costPerBaseUnit;
      final cratePrice = p.units.isNotEmpty ? p.units.first.retailPrice : 0;
      _beerCrateCostController = TextEditingController(
        text: LaoCurrencyFormatter.format(crateCost, includeSymbol: false),
      );
      _beerCrateSellingPriceController = TextEditingController(
        text: LaoCurrencyFormatter.format(cratePrice, includeSymbol: false),
      );
      _beerStockCratesController = TextEditingController(
        text: p.currentStockBaseUnits.toString(),
      );

      // Default grocery controllers
      _groceryCartonCostController = TextEditingController(text: '500.000');
      _groceryPacksPerCartonController = TextEditingController(text: '8');
      _groceryPackSellingPriceController = TextEditingController(text: '70.000');
      _groceryCartonSellingPriceController = TextEditingController(text: '500.000');
      _groceryStockCartonsController = TextEditingController(text: '10');
      _groceryStockLoosePacksController = TextEditingController(text: '0');
    } else if (p != null && p.units.isNotEmpty) {
      // Init Grocery fields from existing product
      final packUnit = p.subTierUnit;
      final cartonUnit = p.cartonTierUnit;
      final multiplier = cartonUnit.multiplier > 1 ? cartonUnit.multiplier : 8;

      _groceryCartonCostController = TextEditingController(
        text: LaoCurrencyFormatter.format(multiplier * p.costPerBaseUnit, includeSymbol: false),
      );
      _groceryPacksPerCartonController = TextEditingController(text: multiplier.toString());
      _groceryPackSellingPriceController = TextEditingController(
        text: LaoCurrencyFormatter.format(packUnit.retailPrice, includeSymbol: false),
      );
      _groceryCartonSellingPriceController = TextEditingController(
        text: LaoCurrencyFormatter.format(cartonUnit.retailPrice, includeSymbol: false),
      );

      final cartons = p.currentStockBaseUnits ~/ multiplier;
      final loose = p.currentStockBaseUnits % multiplier;
      _groceryStockCartonsController = TextEditingController(text: cartons.toString());
      _groceryStockLoosePacksController = TextEditingController(text: loose.toString());
      _groceryCalculatedCostPerPack = p.costPerBaseUnit;

      // Default beer controllers
      _beerCrateCostController = TextEditingController(text: '240.000');
      _beerCrateSellingPriceController = TextEditingController(text: '265.000');
      _beerStockCratesController = TextEditingController(text: '20');
    } else {
      // Defaults for brand new product
      _groceryCartonCostController = TextEditingController(text: '500.000');
      _groceryPacksPerCartonController = TextEditingController(text: '8');
      _groceryPackSellingPriceController = TextEditingController(text: '70.000');
      _groceryCartonSellingPriceController = TextEditingController(text: '500.000');
      _groceryStockCartonsController = TextEditingController(text: '10');
      _groceryStockLoosePacksController = TextEditingController(text: '0');

      _beerCrateCostController = TextEditingController(text: '240.000');
      _beerCrateSellingPriceController = TextEditingController(text: '265.000');
      _beerStockCratesController = TextEditingController(text: '20');

      _recalculateGroceryCostPerPack();
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _barcodeController.dispose();
    _categoryController.dispose();

    _groceryCartonCostController.dispose();
    _groceryPacksPerCartonController.dispose();
    _groceryPackSellingPriceController.dispose();
    _groceryCartonSellingPriceController.dispose();
    _groceryStockCartonsController.dispose();
    _groceryStockLoosePacksController.dispose();

    _beerCrateCostController.dispose();
    _beerCrateSellingPriceController.dispose();
    _beerStockCratesController.dispose();
    super.dispose();
  }

  void _recalculateGroceryCostPerPack() {
    final cartonCost = LaoCurrencyFormatter.parse(_groceryCartonCostController.text);
    final multiplier = int.tryParse(_groceryPacksPerCartonController.text) ?? 1;
    final divisor = multiplier > 0 ? multiplier : 1;

    setState(() {
      _groceryCalculatedCostPerPack = (cartonCost / divisor).round();
    });
  }

  int get _totalGroceryStockInPacks {
    final cartons = int.tryParse(_groceryStockCartonsController.text) ?? 0;
    final loose = int.tryParse(_groceryStockLoosePacksController.text) ?? 0;
    final multiplier = int.tryParse(_groceryPacksPerCartonController.text) ?? 8;
    return (cartons * multiplier) + loose;
  }

  Future<void> _pickAndCompressImage(ImageSource source) async {
    try {
      final picker = ImagePicker();
      final pickedFile = await picker.pickImage(
        source: source,
        maxWidth: 800,
        maxHeight: 800,
        imageQuality: 80,
      );

      if (pickedFile == null) return;

      final rawBytes = await pickedFile.readAsBytes();
      final originalSize = rawBytes.length;

      // Aggressive multi-pass compression (< 40 KB)
      final compressed = ImageCompressService.compressImage(
        rawBytes,
        maxDimension: 400,
        initialQuality: 75,
      );

      setState(() {
        _compressedImageBytes = compressed;
        _originalImageSizeBytes = originalSize;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'ບີບອັດຮູບສຳເລັດ: ${ImageCompressService.formatByteSize(compressed.length)} (ຫຼຸດຈາກ ${ImageCompressService.formatByteSize(originalSize)})',
            ),
            backgroundColor: AppColors.primary,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('ເກີດຂໍ້ຜິດພາດໃນການເລືອກຮູບ: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  Future<void> _saveProduct() async {
    if (!_formKey.currentState!.validate()) return;

    final productId = widget.productToEdit?.id ?? 'p_${const Uuid().v4().substring(0, 8)}';
    final name = _nameController.text.trim();
    final category = _categoryController.text.trim();
    final barcode = _barcodeController.text.trim().isEmpty ? null : _barcodeController.text.trim();

    setState(() => _isUploadingImage = true);

    String? finalImageUrl = _existingImageUrl;

    // Upload compressed image if a new image was chosen
    if (_compressedImageBytes != null) {
      final uploadUrl = await SupabaseSyncService.uploadProductImage(
        productId: productId,
        imageBytes: _compressedImageBytes!,
      );

      if (uploadUrl != null && uploadUrl.isNotEmpty) {
        finalImageUrl = uploadUrl;
      } else {
        finalImageUrl = ImageCompressService.toDataUri(_compressedImageBytes!);
      }
    }

    Product product;

    if (_currentMode == ProductTypeMode.beer) {
      // 1. BEER MODE: Single unit "ລັງ" (Crate), sold by crate ONLY
      final crateCost = LaoCurrencyFormatter.parse(_beerCrateCostController.text);
      final crateSellingPrice = LaoCurrencyFormatter.parse(_beerCrateSellingPriceController.text);
      final cratesStock = int.tryParse(_beerStockCratesController.text) ?? 0;

      final units = [
        ProductUnit(
          id: '${productId}_crate',
          productId: productId,
          unitName: 'ລັງ',
          multiplier: 1,
          retailPrice: crateSellingPrice,
          wholesalePrice: crateSellingPrice,
          isBaseUnit: true,
        ),
      ];

      product = Product(
        id: productId,
        name: name,
        category: category.isNotEmpty ? category : 'ເບຍ/ເຄື່ອງດື່ມມີທາດເຫຼົ້າ',
        barcode: barcode,
        imageUrl: finalImageUrl,
        baseUnit: 'ລັງ',
        costPerBaseUnit: crateCost,
        currentStockBaseUnits: cratesStock,
        trackStock: _trackStock,
        units: units,
      );
    } else {
      // 2. GROCERY MODE: Carton (ແກັດ) and Pack (ແພັກ)
      final packsPerCarton = int.tryParse(_groceryPacksPerCartonController.text) ?? 8;
      final packSellingPrice = LaoCurrencyFormatter.parse(_groceryPackSellingPriceController.text);
      final cartonSellingPrice = LaoCurrencyFormatter.parse(_groceryCartonSellingPriceController.text);

      final units = [
        ProductUnit(
          id: '${productId}_pack',
          productId: productId,
          unitName: 'ແພັກ',
          multiplier: 1,
          retailPrice: packSellingPrice,
          wholesalePrice: packSellingPrice,
          isBaseUnit: true,
        ),
        ProductUnit(
          id: '${productId}_carton',
          productId: productId,
          unitName: 'ແກັດ',
          multiplier: packsPerCarton,
          retailPrice: cartonSellingPrice,
          wholesalePrice: cartonSellingPrice,
          isBaseUnit: false,
        ),
      ];

      product = Product(
        id: productId,
        name: name,
        category: category,
        barcode: barcode,
        imageUrl: finalImageUrl,
        baseUnit: 'ແພັກ',
        costPerBaseUnit: _groceryCalculatedCostPerPack,
        currentStockBaseUnits: _totalGroceryStockInPacks,
        trackStock: _trackStock,
        units: units,
      );
    }

    // Update local state and sync to Supabase
    ref.read(catalogProvider.notifier).upsertProduct(product);
    SupabaseSyncService.syncProduct(product);

    setState(() => _isUploadingImage = false);

    if (mounted) {
      final unitLabel = _currentMode == ProductTypeMode.beer ? 'ລັງ' : 'ແພັກ & ແກັດ';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('ບັນທຶກສິນຄ້າ "$name" ($unitLabel) ສຳເລັດແລ້ວ!'),
          backgroundColor: AppColors.primary,
        ),
      );

      if (widget.onSaved != null) {
        widget.onSaved!();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isEditing = widget.productToEdit != null;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(
          isEditing ? 'ແກ້ໄຂສິນຄ້າ: ${widget.productToEdit!.name}' : 'ເພີ່ມສິນຄ້າໃໝ່ (Product Entry)',
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16.0),
            child: ElevatedButton.icon(
              onPressed: _isUploadingImage ? null : _saveProduct,
              icon: _isUploadingImage
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                    )
                  : const Icon(Icons.check, size: 20),
              label: Text(_isUploadingImage ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກສິນຄ້າ'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              ),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Top Segmented Mode Selector: Grocery vs Beer
              _buildModeSwitcher(),

              const SizedBox(height: 20),

              LayoutBuilder(
                builder: (context, constraints) {
                  final isCompact = constraints.maxWidth < 760;

                  final leftColumn = Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Section 1: Basic Info & Image
                      _buildSectionCard(
                        title: '1. ຂໍ້ມູນສິນຄ້າ & ຮູບພາບ (Basic Info & Image)',
                        icon: Icons.inventory_2_outlined,
                        children: [
                          _buildImagePickerBox(),

                          const SizedBox(height: 16),

                          TextFormField(
                            controller: _nameController,
                            decoration: InputDecoration(
                              labelText: 'ຊື່ສິນຄ້າ (Product Name) *',
                              hintText: _currentMode == ProductTypeMode.beer
                                  ? 'e.g. ເບຍລາວ ຂວດໃຫຍ່ 640ml (ລັງ 24 ແກ້ວ)'
                                  : 'e.g. ເຂົ້າໜົມຊັອກໂກແລັດ, ຢາສູບ, ນ້ຳຫວານ...',
                            ),
                            validator: (val) => val == null || val.trim().isEmpty ? 'ກະລຸນາປ້ອນຊື່ສິນຄ້າ' : null,
                          ),
                          const SizedBox(height: 14),

                          TextFormField(
                            controller: _barcodeController,
                            decoration: InputDecoration(
                              labelText: 'ບາໂຄດ (Barcode)',
                              hintText: '8850029010012',
                              suffixIcon: IconButton(
                                icon: const Icon(Icons.qr_code_scanner),
                                onPressed: () {
                                  _barcodeController.text = '885${DateTime.now().millisecondsSinceEpoch.toString().substring(3, 13)}';
                                },
                                tooltip: 'ຈຳລອງການຍິງບາໂຄດ',
                              ),
                            ),
                          ),
                          const SizedBox(height: 14),

                          Text(
                            'ໝວດໝູ່ສິນຄ້າ:',
                            style: theme.textTheme.labelMedium?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 6),
                          _buildCategorySelector(),
                        ],
                      ),

                      const SizedBox(height: 20),

                      // Section 2: Stock Inventory
                      _buildStockInventoryCard(),
                    ],
                  );

                  final rightColumn = _currentMode == ProductTypeMode.beer
                      ? _buildBeerPricingCard()
                      : _buildGroceryPricingCard();

                  if (isCompact) {
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        leftColumn,
                        const SizedBox(height: 20),
                        rightColumn,
                      ],
                    );
                  }

                  return Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        flex: 55,
                        child: leftColumn,
                      ),
                      const SizedBox(width: 20),
                      Expanded(
                        flex: 45,
                        child: rightColumn,
                      ),
                    ],
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Top Mode Switcher Bar (Grocery vs Beer)
  Widget _buildModeSwitcher() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.backgroundAlt,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.borderSubtle, width: 0.9),
      ),
      child: Row(
        children: [
          Expanded(
            child: InkWell(
              onTap: () {
                setState(() {
                  _currentMode = ProductTypeMode.grocery;
                  if (_categoryController.text.contains('ເບຍ')) {
                    _categoryController.text = 'ເຂົ້າໜົມ/ອາຫານຫວ່າງ';
                  }
                });
              },
              borderRadius: BorderRadius.circular(9),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: _currentMode == ProductTypeMode.grocery
                      ? AppColors.surfaceDark
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(9),
                  boxShadow: _currentMode == ProductTypeMode.grocery
                      ? AppColors.cardShadow
                      : null,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.shopping_bag_rounded,
                      size: 19,
                      color: _currentMode == ProductTypeMode.grocery
                          ? Colors.white
                          : AppColors.textSecondary,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'ສິນຄ້າທົ່ວໄປ (ເຂົ້າໜົມ, ຢາສູບ, ນ້ຳຫວານ...) • ແກັດ & ແພັກ',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 13.5,
                        color: _currentMode == ProductTypeMode.grocery
                          ? Colors.white
                          : AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: InkWell(
              onTap: () {
                setState(() {
                  _currentMode = ProductTypeMode.beer;
                  _categoryController.text = 'ເບຍ/ເຄື່ອງດື່ມມີທາດເຫຼົ້າ';
                });
              },
              borderRadius: BorderRadius.circular(9),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: _currentMode == ProductTypeMode.beer
                      ? const Color(0xFFB45309) // Sleek Golden Amber
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(9),
                  boxShadow: _currentMode == ProductTypeMode.beer
                      ? AppColors.cardShadow
                      : null,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.sports_bar_rounded,
                      size: 19,
                      color: _currentMode == ProductTypeMode.beer
                          ? Colors.white
                          : AppColors.textSecondary,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'ເບຍໂດຍສະເພາະ (1 ລັງ = 24 ແກ້ວ) • ຂາຍຍົກລັງຢ່າງດຽວ',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 13.5,
                        color: _currentMode == ProductTypeMode.beer
                          ? Colors.white
                          : AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Right Card for BEER MODE (Purchase per crate, Selling price per crate, NO pack prices)
  Widget _buildBeerPricingCard() {
    final crateCost = LaoCurrencyFormatter.parse(_beerCrateCostController.text);
    final crateSelling = LaoCurrencyFormatter.parse(_beerCrateSellingPriceController.text);
    final crateProfit = crateSelling - crateCost;

    return _buildSectionCard(
      title: '2. ຕົ້ນທຶນ & ລາຄາຂາຍເບຍ (Crate Pricing)',
      icon: Icons.sports_bar_outlined,
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.wholesaleLight.withValues(alpha: 0.35),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: AppColors.wholesale.withValues(alpha: 0.4)),
          ),
          child: const Row(
            children: [
              Icon(Icons.info_outline, size: 18, color: AppColors.wholesaleDark),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'ເບຍຂາຍຍົກລັງຢ່າງດຽວ (1 ລັງ = 24 ແກ້ວ) • ບໍ່ມີຂາຍເປັນແພັກ • ຕື່ມສະເພາະລາຄາຊື້ ແລະ ລາຄາຂາຍຕໍ່ລັງ',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.wholesaleDark),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Purchase Cost per Crate
        TextFormField(
          controller: _beerCrateCostController,
          keyboardType: TextInputType.number,
          inputFormatters: [LaoCurrencyInputFormatter()],
          decoration: const InputDecoration(
            labelText: 'ຕົ້ນທຶນຊື້ເຂົ້າຕໍ່ລັງ (Purchase Cost / Crate) ₭',
            hintText: 'e.g. 240.000',
            prefixIcon: Icon(Icons.shopping_cart_outlined),
          ),
          onChanged: (_) => setState(() {}),
        ),

        const SizedBox(height: 16),

        // Selling Price per Crate
        TextFormField(
          controller: _beerCrateSellingPriceController,
          keyboardType: TextInputType.number,
          inputFormatters: [LaoCurrencyInputFormatter()],
          decoration: const InputDecoration(
            labelText: 'ລາຄາຂາຍຕໍ່ລັງ (Selling Price / Crate) ₭',
            hintText: 'e.g. 265.000',
            prefixIcon: Icon(Icons.sell_outlined),
          ),
          onChanged: (_) => setState(() {}),
        ),

        const SizedBox(height: 16),

        // Live Profit Indicator per Crate
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surfaceSubtle,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'ກຳໄລສຸດທິຕໍ່ລັງ (Profit / Crate):',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
              ),
              _buildProfitBadge(crateProfit, fontSize: 16),
            ],
          ),
        ),
      ],
    );
  }

  /// Right Card for GENERAL GROCERY MODE (500.000 carton cost, 8 packs inside, pack selling price, carton selling price)
  Widget _buildGroceryPricingCard() {
    final multiplier = int.tryParse(_groceryPacksPerCartonController.text) ?? 8;
    final packCost = _groceryCalculatedCostPerPack;
    final packSelling = LaoCurrencyFormatter.parse(_groceryPackSellingPriceController.text);
    final packProfit = packSelling - packCost;

    final cartonCost = LaoCurrencyFormatter.parse(_groceryCartonCostController.text);
    final cartonSelling = LaoCurrencyFormatter.parse(_groceryCartonSellingPriceController.text);
    final cartonProfit = cartonSelling - cartonCost;

    return _buildSectionCard(
      title: '2. ຕົ້ນທຶນ & ລາຄາຂາຍ (Carton & Pack Pricing)',
      icon: Icons.calculate_outlined,
      children: [
        // 1. Purchase cost & packs per carton
        Row(
          children: [
            Expanded(
              flex: 3,
              child: TextFormField(
                controller: _groceryCartonCostController,
                keyboardType: TextInputType.number,
                inputFormatters: [LaoCurrencyInputFormatter()],
                decoration: const InputDecoration(
                  labelText: 'ລາຄາຊື້ຕໍ່ແກັດ (₭)',
                  hintText: 'e.g. 500.000',
                ),
                onChanged: (_) => _recalculateGroceryCostPerPack(),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 2,
              child: TextFormField(
                controller: _groceryPacksPerCartonController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'ຈຳນວນແພັກໃນແກັດ',
                  hintText: 'e.g. 8',
                  suffixText: 'ແພັກ',
                ),
                onChanged: (_) => _recalculateGroceryCostPerPack(),
              ),
            ),
          ],
        ),

        const SizedBox(height: 10),

        // Auto-calculated cost per pack
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: AppColors.primaryLight.withValues(alpha: 0.3),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: AppColors.primary.withValues(alpha: 0.4)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'ຕົ້ນທຶນຕໍ່ແພັກ (Cost / Pack):',
                style: TextStyle(fontSize: 12, color: AppColors.primaryDark, fontWeight: FontWeight.w600),
              ),
              Text(
                '${LaoCurrencyFormatter.format(_groceryCalculatedCostPerPack)} / ແພັກ',
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.primaryDark),
              ),
            ],
          ),
        ),

        const SizedBox(height: 16),
        const Divider(height: 1),
        const SizedBox(height: 16),

        // 2. Selling Price for Pack
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'ລາຄາຂາຍ: ຕໍ່ແພັກ (Pack Selling Price)',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _groceryPackSellingPriceController,
                keyboardType: TextInputType.number,
                inputFormatters: [LaoCurrencyInputFormatter()],
                decoration: const InputDecoration(
                  labelText: 'ລາຄາຂາຍຕໍ່ 1 ແພັກ (₭)',
                  hintText: 'e.g. 70.000',
                  prefixIcon: Icon(Icons.sell_outlined),
                ),
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('ກຳໄລຕໍ່ແພັກ:', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  _buildProfitBadge(packProfit),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: 14),

        // 3. Selling Price for Carton (ແກັດ / ກ່ອງ)
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'ລາຄາຂາຍ: ຍົກແກັດ/ກ່ອງ ($multiplier ແພັກ)',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _groceryCartonSellingPriceController,
                keyboardType: TextInputType.number,
                inputFormatters: [LaoCurrencyInputFormatter()],
                decoration: const InputDecoration(
                  labelText: 'ລາຄາຂາຍຍົກ 1 ແກັດ/ກ່ອງ (₭)',
                  hintText: 'e.g. 500.000 ຫຼື 550.000',
                  prefixIcon: Icon(Icons.inventory_2_outlined),
                ),
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 6),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('ກຳໄລຍົກແກັດ:', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  _buildProfitBadge(cartonProfit),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// Stock Inventory Card (Adapts to Beer vs Grocery)
  Widget _buildStockInventoryCard() {
    return _buildSectionCard(
      title: '3. ຈັດການສາງສິນຄ້າ (Stock Inventory)',
      icon: Icons.warehouse_outlined,
      children: [
        SwitchListTile(
          title: const Text('ຕິດຕາມສະຕັອກສິນຄ້າ (Track Physical Stock)'),
          subtitle: Text(
            _trackStock
                ? 'ຕັດສາງອັດຕະໂນມັດເມື່ອມີການຂາຍ'
                : 'ບໍ່ຕິດຕາມສະຕັອກ (ອະນຸຍາດໃຫ້ຂາຍຕິດລົບໄດ້)',
          ),
          value: _trackStock,
          activeColor: AppColors.primary,
          onChanged: (val) => setState(() => _trackStock = val),
        ),
        if (_trackStock) ...[
          const SizedBox(height: 12),
          if (_currentMode == ProductTypeMode.beer) ...[
            // Beer stock: only crates
            TextFormField(
              controller: _beerStockCratesController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'ຈຳນວນລັງໃນສາງ (Crates in Stock)',
                hintText: 'e.g. 20',
                suffixText: 'ລັງ',
              ),
              onChanged: (_) => setState(() {}),
            ),
          ] else ...[
            // Grocery stock: Cartons and loose packs
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _groceryStockCartonsController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'ຈຳນວນແກັດໃນສາງ (Cartons)',
                      hintText: 'e.g. 10',
                      suffixText: 'ແກັດ',
                    ),
                    onChanged: (_) => setState(() {}),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _groceryStockLoosePacksController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'ຈຳນວນແພັກເສດ (Loose Packs)',
                      hintText: 'e.g. 4',
                      suffixText: 'ແພັກ',
                    ),
                    onChanged: (_) => setState(() {}),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.surfaceSubtle,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('ສະຕັອກລວມໃນລະບົບ:', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                  Text(
                    '${_groceryStockCartonsController.text.trim().isEmpty ? '0' : _groceryStockCartonsController.text} ແກັດ ${_groceryStockLoosePacksController.text.trim().isEmpty ? '0' : _groceryStockLoosePacksController.text} ແພັກ  (ລວມ $_totalGroceryStockInPacks ແພັກ)',
                    style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primaryDark, fontSize: 14),
                  ),
                ],
              ),
            ),
          ],
        ],
      ],
    );
  }

  Widget _buildCategorySelector() {
    final allCats = {
      ..._suggestedCategories,
      ...ref.watch(catalogProvider).categories.where((c) => c != 'ທັງໝົດ'),
    }.toList();

    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        ...allCats.map((cat) {
          final isSel = _categoryController.text == cat;
          return ChoiceChip(
            label: Text(cat),
            selected: isSel,
            selectedColor: AppColors.primaryLight,
            labelStyle: TextStyle(
              fontSize: 12,
              color: isSel ? AppColors.primaryDark : AppColors.textPrimary,
              fontWeight: isSel ? FontWeight.w700 : FontWeight.normal,
            ),
            onSelected: (_) => setState(() => _categoryController.text = cat),
          );
        }),
        ActionChip(
          avatar: const Icon(Icons.add, size: 14, color: AppColors.primary),
          label: const Text('+ ເພີ່ມໝວດໝູ່', style: TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.bold)),
          backgroundColor: AppColors.primaryLight.withValues(alpha: 0.35),
          onPressed: () {
            final textController = TextEditingController();
            showDialog(
              context: context,
              builder: (ctx) => AlertDialog(
                title: const Row(
                  children: [
                    Icon(Icons.category_outlined, color: AppColors.primary),
                    SizedBox(width: 8),
                    Text('ເພີ່ມໝວດໝູ່ສິນຄ້າໃໝ່'),
                  ],
                ),
                content: TextField(
                  controller: textController,
                  autofocus: true,
                  decoration: const InputDecoration(
                    labelText: 'ຊື່ໝວດໝູ່ (Category Name)',
                    hintText: 'e.g. ຢາສູບ, ໝາກໄມ້, ອາຫານແຊ່ແຂງ...',
                  ),
                  onSubmitted: (val) {
                    final cat = val.trim();
                    if (cat.isNotEmpty) {
                      ref.read(catalogProvider.notifier).addCategory(cat);
                      setState(() => _categoryController.text = cat);
                      Navigator.of(ctx).pop();
                    }
                  },
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.of(ctx).pop(),
                    child: const Text('ຍົກເລີກ'),
                  ),
                  ElevatedButton(
                    onPressed: () {
                      final cat = textController.text.trim();
                      if (cat.isNotEmpty) {
                        ref.read(catalogProvider.notifier).addCategory(cat);
                        setState(() => _categoryController.text = cat);
                        Navigator.of(ctx).pop();
                      }
                    },
                    child: const Text('ເພີ່ມໝວດໝູ່'),
                  ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _buildImagePickerBox() {
    final hasLocalImage = _compressedImageBytes != null;
    final hasExistingUrl = _existingImageUrl != null && _existingImageUrl!.isNotEmpty;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceSubtle,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 76,
            height: 76,
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.border),
            ),
            clipBehavior: Clip.antiAlias,
            child: hasLocalImage
                ? Image.memory(_compressedImageBytes!, fit: BoxFit.cover)
                : hasExistingUrl
                    ? (ImageCompressService.isDataUri(_existingImageUrl)
                        ? Image.memory(
                            ImageCompressService.bytesFromDataUri(_existingImageUrl!) ?? Uint8List(0),
                            fit: BoxFit.cover,
                          )
                        : Image.network(
                            _existingImageUrl!,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => const Icon(Icons.broken_image, color: AppColors.textMuted),
                          ))
                    : const Icon(Icons.image_outlined, size: 32, color: AppColors.textMuted),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    OutlinedButton.icon(
                      onPressed: () => _pickAndCompressImage(ImageSource.camera),
                      icon: const Icon(Icons.camera_alt, size: 16),
                      label: const Text('ຖ່າຍຮູບ'),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                    OutlinedButton.icon(
                      onPressed: () => _pickAndCompressImage(ImageSource.gallery),
                      icon: const Icon(Icons.photo_library, size: 16),
                      label: const Text('ເລືອກຈາກເຄື່ອງ'),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                    OutlinedButton.icon(
                      onPressed: _showImageUrlDialog,
                      icon: const Icon(Icons.link_rounded, size: 16),
                      label: const Text('ໃສ່ລິ້ງ URL'),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                    if (hasLocalImage || hasExistingUrl) ...[
                      IconButton(
                        icon: const Icon(Icons.delete_outline, size: 20, color: AppColors.error),
                        tooltip: 'ລຶບຮູບ',
                        onPressed: () {
                          setState(() {
                            _compressedImageBytes = null;
                            _existingImageUrl = null;
                            _originalImageSizeBytes = null;
                          });
                        },
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 6),
                if (hasLocalImage) ...[
                  Text(
                    'ຂະໜາດຫຼັງບີບອັດ: ${ImageCompressService.formatByteSize(_compressedImageBytes!.length)} (ຫຼຸດຈາກ ${ImageCompressService.formatByteSize(_originalImageSizeBytes ?? 0)})',
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primaryDark),
                  ),
                  const Text('⚡ ບີບອັດລະດັບສູງສຸດ (<40 KB) ເພື່ອປະຢັດ Quota Supabase Storage', style: TextStyle(fontSize: 10, color: AppColors.textMuted)),
                ] else if (hasExistingUrl) ...[
                  Text(
                    ImageCompressService.isDataUri(_existingImageUrl)
                        ? 'ຮູບພາບຖືກບັນທຶກແລ້ວ (Base64 Embedded)'
                        : 'ລິ້ງຮູບ: ${_existingImageUrl!.length > 40 ? '${_existingImageUrl!.substring(0, 37)}...' : _existingImageUrl!}',
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primaryDark),
                  ),
                  const Text('ກົດປຸ່ມຖັງຂີ້ເຫຍື້ອສີແດງຖ້າຕ້ອງການປ່ຽນ ຫຼື ລຶບຮູບ', style: TextStyle(fontSize: 10, color: AppColors.textMuted)),
                ] else ...[
                  const Text('ຮອງຮັບການບີບອັດອັດຕະໂນມັດ 400x400 JPEG ບໍ່ເກີນ 40 KB ຫຼື ໃສ່ລິ້ງ', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showImageUrlDialog() {
    final urlController = TextEditingController(
      text: _existingImageUrl != null && !ImageCompressService.isDataUri(_existingImageUrl)
          ? _existingImageUrl
          : '',
    );

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.link_rounded, color: AppColors.primary),
            SizedBox(width: 8),
            Text('ໃສ່ລິ້ງຮູບພາບ (Image URL)'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'ປ້ອນ URL ຮູບພາບຈາກອິນເຕີເນັດ (e.g. https://...):',
              style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: urlController,
              decoration: InputDecoration(
                hintText: 'https://example.com/product.jpg',
                prefixIcon: const Icon(Icons.image_outlined, size: 20),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              ),
              autofocus: true,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('ຍົກເລີກ'),
          ),
          ElevatedButton(
            onPressed: () {
              final url = urlController.text.trim();
              if (url.isNotEmpty) {
                setState(() {
                  _existingImageUrl = url;
                  _compressedImageBytes = null;
                  _originalImageSizeBytes = null;
                });
              }
              Navigator.pop(ctx);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('ຕົກລົງ'),
          ),
        ],
      ),
    );
  }


  Widget _buildProfitBadge(int profit, {double fontSize = 12}) {
    Color textColor;
    String labelText;

    if (profit > 0) {
      textColor = AppColors.primaryDark;
      labelText = 'ກຳໄລ: ${LaoCurrencyFormatter.formatProfit(profit)}';
    } else if (profit < 0) {
      textColor = AppColors.error;
      labelText = 'ຂາດທຶນ: ${LaoCurrencyFormatter.formatProfit(profit)}';
    } else {
      textColor = AppColors.textMuted;
      labelText = 'ເທົ່າທຶນ: 0 ₭';
    }

    return Text(
      labelText,
      style: TextStyle(
        fontSize: fontSize,
        fontWeight: FontWeight.w700,
        color: textColor,
      ),
    );
  }

  Widget _buildSectionCard({
    required String title,
    required IconData icon,
    required List<Widget> children,
  }) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.borderSubtle, width: 0.9),
        boxShadow: AppColors.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: AppColors.primaryLight,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.primaryBorder, width: 0.8),
                ),
                child: Icon(icon, size: 17, color: AppColors.primary),
              ),
              const SizedBox(width: 10),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ...children,
        ],
      ),
    );
  }
}
