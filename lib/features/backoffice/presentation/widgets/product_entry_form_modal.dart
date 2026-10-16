import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:uuid/uuid.dart';
import '../../../../core/localization/lao_currency_formatter.dart';
import '../../../../core/utils/image_compress_service.dart';
import '../../../../data/remote/supabase_sync_service.dart';
import '../../../../domain/models/category_model.dart';
import '../../../../domain/models/product.dart';
import '../../../../domain/models/product_unit.dart';
import '../../../pos/presentation/controllers/catalog_controller.dart';
import '../../../pos/presentation/widgets/barcode_scanner_modal.dart';
import 'category_management_modal.dart';

/// Modal for Product Entry & Edit Form (Modal Thêm & Sửa sản phẩm đa cấp)
/// Spec reference: SPEC_PRODUCT_FORM_MODAL.md & ProductFormModal.jsx
class ProductEntryFormModal extends ConsumerStatefulWidget {
  final Product? productToEdit;
  final VoidCallback? onSaved;
  final VoidCallback? onClose;

  const ProductEntryFormModal({
    super.key,
    this.productToEdit,
    this.onSaved,
    this.onClose,
  });

  @override
  ConsumerState<ProductEntryFormModal> createState() => _ProductEntryFormModalState();
}

class _ProductEntryFormModalState extends ConsumerState<ProductEntryFormModal> {
  final _formKey = GlobalKey<FormState>();

  // Basic Info Controllers
  late TextEditingController _nameController;
  late TextEditingController _barcodeController;
  late TextEditingController _categoryCustomController;
  String? _selectedCategoryId;
  String _selectedCategoryName = '';
  bool _isAddingCustomCategory = false;

  // Image upload
  String _imageUrl = '';
  Uint8List? _compressedImageBytes;
  int? _originalSizeBytes;
  int? _compressedSizeBytes;
  bool _isCompressing = false;
  bool _showUrlInput = false;
  late TextEditingController _urlInputController;

  // Dual Currency Cost Controllers & FocusNodes
  late TextEditingController _costBahtController;
  late TextEditingController _costKipController;
  final FocusNode _costBahtFocusNode = FocusNode();
  final FocusNode _costKipFocusNode = FocusNode();

  // Track Stock
  bool _trackStock = true;
  late TextEditingController _stockCartonController;
  late TextEditingController _stockPackController;
  late TextEditingController _stockPieceController;

  // 3-Tier Packaging Switches
  bool _enableCarton = true;
  bool _enablePack = true;
  bool _enablePiece = true;

  // Tier 1 (Carton / Box / Sack)
  late TextEditingController _cartonUnitNameController;
  late TextEditingController _cartonBarcodeController;
  late TextEditingController _cartonMultiplierController; // packs per carton
  late TextEditingController _cartonPriceController;
  bool _hasCrateDeposit = false;
  late TextEditingController _crateDepositFeeController;

  // Tier 2 (Pack / Bundle)
  late TextEditingController _packUnitNameController;
  late TextEditingController _packBarcodeController;
  late TextEditingController _packMultiplierController; // pieces per pack
  late TextEditingController _packPriceController;

  // Tier 3 (Piece / Retail)
  late TextEditingController _pieceUnitNameController;
  late TextEditingController _pieceBarcodeController;
  late TextEditingController _piecePriceController;

  bool _isSaving = false;

  final List<String> _commonCartonUnits = ['ແກັດ', 'ລັງ', 'ເປົາ', 'ກະສອບ', 'ກ່ອງໃຫຍ່', 'ຖັງ'];
  final List<String> _commonPackUnits = ['ແພັກ', 'ມັດ', 'ແຕະ', 'ໂຫຼ', 'ຖົງກາງ'];
  final List<String> _commonPieceUnits = ['ອັນ', 'ແກ້ວ', 'ຖົງ', 'ກະປ໋ອງ', 'ຕຸກ', 'ຊອງ', 'ກ່ອງນ້ອຍ'];

  @override
  void initState() {
    super.initState();
    _initControllers();
    _hydrateState();
  }

  void _initControllers() {
    _nameController = TextEditingController();
    _barcodeController = TextEditingController();
    _categoryCustomController = TextEditingController();
    _urlInputController = TextEditingController();

    _costBahtController = TextEditingController();
    _costKipController = TextEditingController();

    _stockCartonController = TextEditingController(text: '0');
    _stockPackController = TextEditingController(text: '0');
    _stockPieceController = TextEditingController(text: '0');

    _cartonUnitNameController = TextEditingController(text: 'ແກັດ');
    _cartonBarcodeController = TextEditingController();
    _cartonMultiplierController = TextEditingController(text: '8');
    _cartonPriceController = TextEditingController();
    _crateDepositFeeController = TextEditingController(text: '30.000');

    _packUnitNameController = TextEditingController(text: 'ແພັກ');
    _packBarcodeController = TextEditingController();
    _packMultiplierController = TextEditingController(text: '6');
    _packPriceController = TextEditingController();

    _pieceUnitNameController = TextEditingController(text: 'ອັນ');
    _pieceBarcodeController = TextEditingController();
    _piecePriceController = TextEditingController();
  }

  /// Clean slate reset and hydration strictly adhering to Anti-State Leak Architecture
  void _hydrateState() {
    final p = widget.productToEdit;
    final catalogState = ref.read(catalogProvider);
    final rawCats = catalogState.rawCategories;

    if (p == null) {
      // 1. CREATE MODE: Clean State
      _nameController.clear();
      _barcodeController.clear();
      _imageUrl = '';
      _compressedImageBytes = null;
      _originalSizeBytes = null;
      _compressedSizeBytes = null;
      _costBahtController.clear();
      _costKipController.clear();

      if (rawCats.isNotEmpty) {
        _selectedCategoryId = rawCats.first.id;
        _selectedCategoryName = rawCats.first.name;
      } else if (catalogState.categories.length > 1) {
        _selectedCategoryName = catalogState.categories[1];
      } else {
        _selectedCategoryName = 'ເຄື່ອງດື່ມ';
      }

      _trackStock = true;
      _stockCartonController.text = '0';
      _stockPackController.text = '0';
      _stockPieceController.text = '0';

      // Default: 3-tier setup
      _enableCarton = true;
      _cartonUnitNameController.text = 'ແກັດ';
      _cartonMultiplierController.text = '8';
      _cartonPriceController.text = '210.000';
      _cartonBarcodeController.clear();
      _hasCrateDeposit = false;
      _crateDepositFeeController.text = '30.000';

      _enablePack = true;
      _packUnitNameController.text = 'ແພັກ';
      _packMultiplierController.text = '6';
      _packPriceController.text = '55.000';
      _packBarcodeController.clear();

      _enablePiece = true;
      _pieceUnitNameController.text = 'ອັນ';
      _piecePriceController.text = '10.000';
      _pieceBarcodeController.clear();
    } else {
      // 2. EDIT MODE: Clean Slate Reset First
      _nameController.text = p.name;
      _barcodeController.text = p.barcode ?? '';
      _imageUrl = p.imageUrl ?? '';
      _urlInputController.text = p.imageUrl ?? '';

      // Hydrate carton purchase cost (Tier 1 / ຍົກລັງ purchase cost):
      // 1. If p.costKip > 0, use p.costKip directly (already resolved to carton cost)
      // 2. Otherwise if p.costPerBaseUnit > 0, compute costPerBaseUnit * cartonMultiplier
      int initialCartonCost = p.costKip;
      if (initialCartonCost == 0 && p.costPerBaseUnit > 0) {
        ProductUnit? cU;
        for (final u in p.units) {
          if (u.tier == 3 || _commonCartonUnits.contains(u.unitName) || u.id.endsWith('_carton')) {
            cU = u;
            break;
          }
        }
        final cMul = cU?.multiplier ?? (p.tier1Active ? p.packsPerCarton : 1);
        initialCartonCost = p.costPerBaseUnit * (cMul > 0 ? cMul : 1);
      }
      _costKipController.text = initialCartonCost > 0
          ? LaoCurrencyFormatter.formatNumber(initialCartonCost)
          : '';

      final int resolvedInitialBaht = p.costBaht > 0
          ? p.costBaht
          : (initialCartonCost > 0 ? (initialCartonCost / 720).round() : 0);
      _costBahtController.text =
          resolvedInitialBaht > 0 ? LaoCurrencyFormatter.formatNumber(resolvedInitialBaht) : '';

      _trackStock = p.trackStock;

      // Category resolution
      _selectedCategoryId = p.categoryId;
      _selectedCategoryName = p.category;
      if (_selectedCategoryId == null && rawCats.isNotEmpty) {
        final match = rawCats.where((c) => c.name == p.category).toList();
        if (match.isNotEmpty) _selectedCategoryId = match.first.id;
      }

      // Crate deposit
      _hasCrateDeposit = p.hasCrateDeposit;
      _crateDepositFeeController.text = LaoCurrencyFormatter.formatNumber(p.crateDepositFee);

      // Hydrate Units strictly from p.units
      final units = p.units;
      ProductUnit? cartonU;
      ProductUnit? packU;
      ProductUnit? pieceU;

      for (final u in units) {
        if (u.tier == 3 || _commonCartonUnits.contains(u.unitName) || u.id.endsWith('_carton')) {
          cartonU = u;
        } else if (u.tier == 2 || _commonPackUnits.contains(u.unitName) || u.id.endsWith('_pack')) {
          packU = u;
        } else {
          pieceU = u;
        }
      }

      // Active switch mapping: strictly by existence
      if (units.isNotEmpty) {
        _enableCarton = cartonU != null;
        _enablePack = packU != null;
        _enablePiece = pieceU != null;
        if (!_enableCarton && !_enablePack && !_enablePiece) {
          _enablePiece = true;
        }
      } else {
        _enableCarton = p.tier1Active;
        _enablePack = p.tier2Active;
        _enablePiece = p.tier3Active;
      }

      // Names and Prices
      if (cartonU != null) {
        _cartonUnitNameController.text = cartonU.unitName;
        _cartonPriceController.text = LaoCurrencyFormatter.formatNumber(cartonU.retailPrice);
        _cartonBarcodeController.text = cartonU.barcode ?? '';
      } else {
        _cartonUnitNameController.text = p.cName;
      }

      if (packU != null) {
        _packUnitNameController.text = packU.unitName;
        _packPriceController.text = LaoCurrencyFormatter.formatNumber(packU.retailPrice);
        _packBarcodeController.text = packU.barcode ?? '';
      } else {
        _packUnitNameController.text = p.pName;
      }

      if (pieceU != null) {
        _pieceUnitNameController.text = pieceU.unitName;
        _piecePriceController.text = LaoCurrencyFormatter.formatNumber(pieceU.retailPrice);
        _pieceBarcodeController.text = pieceU.barcode ?? '';
      } else {
        _pieceUnitNameController.text = p.pcName;
      }

      // Multipliers
      if (_enableCarton && _enablePack && cartonU != null && packU != null && cartonU.multiplier > packU.multiplier) {
        _cartonMultiplierController.text = (cartonU.multiplier ~/ packU.multiplier).toString();
      } else if (cartonU != null && cartonU.multiplier > 1) {
        _cartonMultiplierController.text = cartonU.multiplier.toString();
      } else {
        _cartonMultiplierController.text = p.packsPerCarton.toString();
      }

      if (_enablePack && _enablePiece && packU != null && pieceU != null && packU.multiplier > pieceU.multiplier) {
        _packMultiplierController.text = (packU.multiplier ~/ pieceU.multiplier).toString();
      } else if (packU != null && packU.multiplier > 1) {
        _packMultiplierController.text = packU.multiplier.toString();
      } else {
        _packMultiplierController.text = p.piecesPerPack.toString();
      }

      // Stock Deconstruction
      if (!p.trackStock) {
        _stockCartonController.text = '0';
        _stockPackController.text = '0';
        _stockPieceController.text = '0';
      } else {
        final totalBase = p.currentStockBaseUnits;
        final cMult = int.tryParse(_cartonMultiplierController.text) ?? 8;
        final pMult = int.tryParse(_packMultiplierController.text) ?? 6;

        if (_enableCarton && _enablePack && _enablePiece) {
          final piecesPerCarton = cMult * pMult;
          _stockCartonController.text = (totalBase ~/ piecesPerCarton).toString();
          final rem = totalBase % piecesPerCarton;
          _stockPackController.text = (rem ~/ pMult).toString();
          _stockPieceController.text = (rem % pMult).toString();
        } else if (_enableCarton && _enablePack && !_enablePiece) {
          _stockCartonController.text = (totalBase ~/ cMult).toString();
          _stockPackController.text = (totalBase % cMult).toString();
          _stockPieceController.text = '0';
        } else if (_enableCarton && !_enablePack && _enablePiece) {
          _stockCartonController.text = (totalBase ~/ cMult).toString();
          _stockPackController.text = '0';
          _stockPieceController.text = (totalBase % cMult).toString();
        } else if (!_enableCarton && _enablePack && _enablePiece) {
          _stockCartonController.text = '0';
          _stockPackController.text = (totalBase ~/ pMult).toString();
          _stockPieceController.text = (totalBase % pMult).toString();
        } else if (_enableCarton) {
          _stockCartonController.text = totalBase.toString();
          _stockPackController.text = '0';
          _stockPieceController.text = '0';
        } else if (_enablePack) {
          _stockCartonController.text = '0';
          _stockPackController.text = totalBase.toString();
          _stockPieceController.text = '0';
        } else {
          _stockCartonController.text = '0';
          _stockPackController.text = '0';
          _stockPieceController.text = totalBase.toString();
        }
      }
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _barcodeController.dispose();
    _categoryCustomController.dispose();
    _urlInputController.dispose();
    _costBahtController.dispose();
    _costKipController.dispose();
    _costBahtFocusNode.dispose();
    _costKipFocusNode.dispose();
    _stockCartonController.dispose();
    _stockPackController.dispose();
    _stockPieceController.dispose();
    _cartonUnitNameController.dispose();
    _cartonBarcodeController.dispose();
    _cartonMultiplierController.dispose();
    _cartonPriceController.dispose();
    _crateDepositFeeController.dispose();
    _packUnitNameController.dispose();
    _packBarcodeController.dispose();
    _packMultiplierController.dispose();
    _packPriceController.dispose();
    _pieceUnitNameController.dispose();
    _pieceBarcodeController.dispose();
    _piecePriceController.dispose();
    super.dispose();
  }

  // --- PRESETS ---
  void _applyPresetBeer() {
    setState(() {
      _enablePiece = false;
      _enablePack = false;
      _enableCarton = true;
      _cartonUnitNameController.text = 'ລັງ';
      _cartonMultiplierController.text = '1';
      _cartonPriceController.text = '265.000';
      _costBahtController.text = '250';
      _costKipController.text = '180.000';
      _hasCrateDeposit = true;
      _crateDepositFeeController.text = '30.000';
      _trackStock = true;
      _stockCartonController.text = '10';
      _stockPackController.text = '0';
      _stockPieceController.text = '0';
    });
  }

  void _applyPresetDrink3Tiers() {
    setState(() {
      _enablePiece = true;
      _pieceUnitNameController.text = 'ກະປ໋ອງ';
      _piecePriceController.text = '10.000';
      _enablePack = true;
      _packUnitNameController.text = 'ແພັກ';
      _packMultiplierController.text = '6';
      _packPriceController.text = '55.000';
      _enableCarton = true;
      _cartonUnitNameController.text = 'ແກັດ';
      _cartonMultiplierController.text = '4';
      _cartonPriceController.text = '210.000';
      _costBahtController.text = '250';
      _costKipController.text = '180.000';
      _hasCrateDeposit = false;
      _trackStock = true;
      _stockCartonController.text = '10';
      _stockPackController.text = '2';
      _stockPieceController.text = '0';
    });
  }

  void _applyPresetSnack3Tiers() {
    setState(() {
      _enablePiece = false;
      _enablePack = true;
      _packUnitNameController.text = 'ແພັກ';
      _packMultiplierController.text = '1';
      _packPriceController.text = '35.000';
      _enableCarton = true;
      _cartonUnitNameController.text = 'ແກັດ';
      _cartonMultiplierController.text = '6';
      _cartonPriceController.text = '200.000';
      _costBahtController.text = '250';
      _costKipController.text = '180.000';
      _hasCrateDeposit = false;
      _trackStock = true;
      _stockCartonController.text = '10';
      _stockPackController.text = '0';
      _stockPieceController.text = '0';
    });
  }

  void _applyPresetSugarSack() {
    setState(() {
      _enablePiece = true;
      _pieceUnitNameController.text = 'ຖົງ';
      _piecePriceController.text = '15.000';
      _enablePack = false;
      _enableCarton = true;
      _cartonUnitNameController.text = 'ເປົາ';
      _cartonMultiplierController.text = '25';
      _cartonPriceController.text = '350.000';
      _costBahtController.text = '87';
      _costKipController.text = '62.640';
      _hasCrateDeposit = false;
      _trackStock = true;
      _stockCartonController.text = '5';
      _stockPackController.text = '0';
      _stockPieceController.text = '10';
    });
  }

  void _applyPresetPieceOnly() {
    setState(() {
      _enablePiece = true;
      _pieceUnitNameController.text = 'ອັນ';
      _piecePriceController.text = '25.000';
      _enablePack = false;
      _enableCarton = false;
      _costBahtController.text = '25';
      _costKipController.text = '18.000';
      _hasCrateDeposit = false;
      _trackStock = true;
      _stockCartonController.text = '0';
      _stockPackController.text = '0';
      _stockPieceController.text = '20';
    });
  }

  // --- IMAGE SELECTION & COMPRESSION ---
  Future<void> _pickImage(ImageSource source) async {
    final picker = ImagePicker();
    final file = await picker.pickImage(source: source);
    if (file == null) return;

    setState(() => _isCompressing = true);
    try {
      final originalBytes = await file.readAsBytes();
      _originalSizeBytes = originalBytes.lengthInBytes;

      final compressed = await ImageCompressService.compressProductImage(originalBytes);
      _compressedImageBytes = compressed;
      _compressedSizeBytes = compressed.lengthInBytes;
      _imageUrl = '';
    } catch (_) {
    } finally {
      if (mounted) setState(() => _isCompressing = false);
    }
  }

  void _openBarcodeScanner(ValueChanged<String> onScan) {
    showDialog(
      context: context,
      builder: (_) => BarcodeScannerModal(onScan: onScan),
    );
  }

  // --- DYNAMIC MULTIPLIER & STOCK ALGORITHM ---
  int _calculateTotalBaseUnits() {
    if (!_trackStock) return 0;

    final cStock = int.tryParse(_stockCartonController.text.replaceAll('.', '').trim()) ?? 0;
    final pStock = int.tryParse(_stockPackController.text.replaceAll('.', '').trim()) ?? 0;
    final pcStock = int.tryParse(_stockPieceController.text.replaceAll('.', '').trim()) ?? 0;

    final packsPerCarton = int.tryParse(_cartonMultiplierController.text.trim()) ?? 8;
    final piecesPerPack = int.tryParse(_packMultiplierController.text.trim()) ?? 6;

    if (_enablePiece) {
      // Case A: Piece is Base Unit
      final pMult = _enablePack ? (piecesPerPack > 0 ? piecesPerPack : 1) : 1;
      final cMult = _enableCarton ? (_enablePack ? packsPerCarton * pMult : packsPerCarton) : 1;
      return (_enableCarton ? cStock * cMult : 0) + (_enablePack ? pStock * pMult : 0) + pcStock;
    } else if (_enablePack) {
      // Case B: Pack is Base Unit
      final cMult = _enableCarton ? (packsPerCarton > 0 ? packsPerCarton : 1) : 1;
      return (_enableCarton ? cStock * cMult : 0) + pStock;
    } else if (_enableCarton) {
      // Case C: Carton is Base Unit
      return cStock;
    }
    return 0;
  }

  String _getBaseUnitName() {
    if (_enablePiece) return _pieceUnitNameController.text.trim().isNotEmpty ? _pieceUnitNameController.text.trim() : 'ອັນ';
    if (_enablePack) return _packUnitNameController.text.trim().isNotEmpty ? _packUnitNameController.text.trim() : 'ແພັກ';
    if (_enableCarton) return _cartonUnitNameController.text.trim().isNotEmpty ? _cartonUnitNameController.text.trim() : 'ແກັດ';
    return 'ອັນ';
  }

  // --- SAVE PRODUCT ---
  Future<void> _handleSave() async {
    if (!_formKey.currentState!.validate()) return;

    if (!_enableCarton && !_enablePack && !_enablePiece) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('ກະລຸນາເປີດຢ່າງໜ້ອຍ 1 ລະດັບຫົວໜ່ວຍການຂາຍ (ອັນ, ແພັກ ຫຼື ແກັດ)'),
          backgroundColor: Color(0xFFDC2626),
        ),
      );
      return;
    }

    setState(() => _isSaving = true);
    try {
      final prodId = widget.productToEdit?.id ?? const Uuid().v4();
      final costKip = LaoCurrencyFormatter.parseClean(_costKipController.text);
      final enteredBaht = LaoCurrencyFormatter.parseClean(_costBahtController.text);
      final costBaht = enteredBaht > 0 ? enteredBaht : (costKip > 0 ? (costKip / 720).round() : 0);
      final crateDepositFee = LaoCurrencyFormatter.parseClean(_crateDepositFeeController.text);

      // 1. Upload compressed image if selected
      String finalImageUrl = _imageUrl;
      if (_compressedImageBytes != null) {
        final uploaded = await SupabaseSyncService.uploadProductImage(
          productId: prodId,
          imageBytes: _compressedImageBytes!,
        );
        if (uploaded != null) {
          finalImageUrl = uploaded;
        }
      }

      // 2. Resolve Multipliers & Units according to dynamic architecture
      final packsPerCarton = int.tryParse(_cartonMultiplierController.text.trim()) ?? 8;
      final piecesPerPack = int.tryParse(_packMultiplierController.text.trim()) ?? 6;
      final cartonPrice = LaoCurrencyFormatter.parseClean(_cartonPriceController.text);
      final packPrice = LaoCurrencyFormatter.parseClean(_packPriceController.text);
      final piecePrice = LaoCurrencyFormatter.parseClean(_piecePriceController.text);

      final List<ProductUnit> units = [];
      String actualBaseUnit = 'ອັນ';

      if (_enablePiece) {
        // CASE A: Piece is Base Unit
        actualBaseUnit = _pieceUnitNameController.text.trim().isNotEmpty ? _pieceUnitNameController.text.trim() : 'ອັນ';
        final tier2Mult = _enablePack ? (piecesPerPack > 0 ? piecesPerPack : 1) : 1;
        final tier1Mult = _enableCarton ? (_enablePack ? packsPerCarton * tier2Mult : packsPerCarton) : 1;

        if (_enableCarton) {
          units.add(ProductUnit(
            id: '${prodId}_carton',
            productId: prodId,
            tier: 3,
            unitName: _cartonUnitNameController.text.trim().isNotEmpty ? _cartonUnitNameController.text.trim() : 'ແກັດ',
            multiplier: tier1Mult,
            retailPrice: cartonPrice,
            wholesalePrice: (cartonPrice * 0.95).round(),
            barcode: _cartonBarcodeController.text.trim().isNotEmpty ? _cartonBarcodeController.text.trim() : null,
            isBaseUnit: false,
            isActive: true,
          ));
        }

        if (_enablePack) {
          units.add(ProductUnit(
            id: '${prodId}_pack',
            productId: prodId,
            tier: 2,
            unitName: _packUnitNameController.text.trim().isNotEmpty ? _packUnitNameController.text.trim() : 'ແພັກ',
            multiplier: tier2Mult,
            retailPrice: packPrice,
            wholesalePrice: (packPrice * 0.95).round(),
            barcode: _packBarcodeController.text.trim().isNotEmpty ? _packBarcodeController.text.trim() : null,
            isBaseUnit: false,
            isActive: true,
          ));
        }

        units.add(ProductUnit(
          id: '${prodId}_piece',
          productId: prodId,
          tier: 1,
          unitName: actualBaseUnit,
          multiplier: 1,
          retailPrice: piecePrice,
          wholesalePrice: (piecePrice * 0.95).round(),
          barcode: _pieceBarcodeController.text.trim().isNotEmpty ? _pieceBarcodeController.text.trim() : null,
          isBaseUnit: true,
          isActive: true,
        ));
      } else if (_enablePack) {
        // CASE B: Pack is Base Unit (Piece OFF)
        actualBaseUnit = _packUnitNameController.text.trim().isNotEmpty ? _packUnitNameController.text.trim() : 'ແພັກ';
        final tier1Mult = _enableCarton ? (packsPerCarton > 0 ? packsPerCarton : 1) : 1;

        if (_enableCarton) {
          units.add(ProductUnit(
            id: '${prodId}_carton',
            productId: prodId,
            tier: 3,
            unitName: _cartonUnitNameController.text.trim().isNotEmpty ? _cartonUnitNameController.text.trim() : 'ແກັດ',
            multiplier: tier1Mult,
            retailPrice: cartonPrice,
            wholesalePrice: (cartonPrice * 0.95).round(),
            barcode: _cartonBarcodeController.text.trim().isNotEmpty ? _cartonBarcodeController.text.trim() : null,
            isBaseUnit: false,
            isActive: true,
          ));
        }

        units.add(ProductUnit(
          id: '${prodId}_pack',
          productId: prodId,
          tier: 2,
          unitName: actualBaseUnit,
          multiplier: 1,
          retailPrice: packPrice,
          wholesalePrice: (packPrice * 0.95).round(),
          barcode: _packBarcodeController.text.trim().isNotEmpty ? _packBarcodeController.text.trim() : null,
          isBaseUnit: true,
          isActive: true,
        ));
      } else if (_enableCarton) {
        // CASE C: Carton is Base Unit
        actualBaseUnit = _cartonUnitNameController.text.trim().isNotEmpty ? _cartonUnitNameController.text.trim() : 'ລັງ';

        units.add(ProductUnit(
          id: '${prodId}_carton',
          productId: prodId,
          tier: 3,
          unitName: actualBaseUnit,
          multiplier: 1,
          retailPrice: cartonPrice,
          wholesalePrice: (cartonPrice * 0.95).round(),
          barcode: _cartonBarcodeController.text.trim().isNotEmpty ? _cartonBarcodeController.text.trim() : null,
          isBaseUnit: true,
          isActive: true,
        ));
      }

      final totalBaseUnits = _calculateTotalBaseUnits();

      // Multiplier ratio of carton relative to base unit:
      int cartonMultiplierRatio = 1;
      if (_enablePiece) {
        final tier2Mult = _enablePack ? (piecesPerPack > 0 ? piecesPerPack : 1) : 1;
        cartonMultiplierRatio = _enableCarton ? (_enablePack ? packsPerCarton * tier2Mult : packsPerCarton) : 1;
      } else if (_enablePack) {
        cartonMultiplierRatio = _enableCarton ? (packsPerCarton > 0 ? packsPerCarton : 1) : 1;
      } else if (_enableCarton) {
        cartonMultiplierRatio = 1;
      }
      if (cartonMultiplierRatio <= 0) cartonMultiplierRatio = 1;

      // True cost per base unit formula (matching Web App 100%):
      // cost_per_base_unit = costKip / cartonMultiplierRatio
      // e.g. 280,000 / 8 = 35,000 ₭
      final int costPerBaseUnit = cartonMultiplierRatio > 0
          ? (costKip / cartonMultiplierRatio).round()
          : costKip;

      // General barcode fallback
      String? mainBarcode = _barcodeController.text.trim().isNotEmpty ? _barcodeController.text.trim() : null;
      if (mainBarcode == null) {
        if (_enableCarton && _cartonBarcodeController.text.trim().isNotEmpty) {
          mainBarcode = _cartonBarcodeController.text.trim();
        } else if (_enablePack && _packBarcodeController.text.trim().isNotEmpty) {
          mainBarcode = _packBarcodeController.text.trim();
        } else if (_enablePiece && _pieceBarcodeController.text.trim().isNotEmpty) {
          mainBarcode = _pieceBarcodeController.text.trim();
        }
      }

      final product = Product(
        id: prodId,
        name: _nameController.text.trim(),
        category: _selectedCategoryName,
        categoryId: _selectedCategoryId,
        imageUrl: finalImageUrl.isNotEmpty ? finalImageUrl : 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80',
        baseUnit: actualBaseUnit,
        barcode: mainBarcode,
        trackStock: _trackStock,
        currentStockBaseUnits: _trackStock ? totalBaseUnits : 0, // Critical NOT-NULL rule: send 0 if untracked
        costPerBaseUnit: costPerBaseUnit, // 35.000 ₭ per base unit
        costBaht: costBaht,               // 250 ฿
        costKip: costKip,                 // 280.000 ₭ per carton
        hasCrateDeposit: _hasCrateDeposit,
        crateDepositFee: crateDepositFee,
        tier1Active: _enableCarton,
        tier2Active: _enablePack,
        tier3Active: _enablePiece,
        packsPerCarton: packsPerCarton,
        piecesPerPack: piecesPerPack,
        units: units,
      );

      // Save to Supabase and State
      final success = await ref.read(catalogProvider.notifier).syncProduct(product);

      if (mounted) {
        if (success) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('ບັນທຶກສິນຄ້າ "${product.name}" ສຳເລັດແລ້ວ! (Sync Supabase OK)'),
              backgroundColor: const Color(0xFF0F766E),
            ),
          );
          widget.onSaved?.call();
          if (widget.onClose != null) {
            widget.onClose!();
          } else {
            Navigator.of(context).maybePop();
          }
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກລົງ Supabase Cloud!'),
              backgroundColor: Color(0xFFDC2626),
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('ເກີດຂໍ້ຜິດພາດ: $e'),
            backgroundColor: const Color(0xFFDC2626),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final catalogState = ref.watch(catalogProvider);
    final rawCats = catalogState.rawCategories;

    final isEditMode = widget.productToEdit != null;
    final totalBaseUnits = _calculateTotalBaseUnits();
    final baseUnitName = _getBaseUnitName();

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(64),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
          ),
          child: SafeArea(
            child: Row(
              children: [
                IconButton(
                  onPressed: () {
                    if (widget.onClose != null) {
                      widget.onClose!();
                    } else {
                      Navigator.of(context).maybePop();
                    }
                  },
                  icon: const Icon(Icons.arrow_back_rounded, color: Color(0xFF334155), size: 20),
                  style: IconButton.styleFrom(
                    backgroundColor: const Color(0xFFF1F5F9),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  tooltip: 'ກັບຄືນ',
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            isEditMode ? Icons.edit_note_rounded : Icons.add_circle_rounded,
                            color: const Color(0xFF0D9488),
                            size: 20,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            isEditMode ? 'ແກ້ໄຂສິນຄ້າ (Edit Product)' : 'ເພີ່ມສິນຄ້າໃໝ່ (Product Entry Form)',
                            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15, color: Color(0xFF0F172A)),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFFCCFBF1),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: const Color(0xFF99F6E4)),
                            ),
                            child: const Text(
                              'Full Screen Mode',
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF0F766E)),
                            ),
                          ),
                        ],
                      ),
                      const Text(
                        'ຕົ້ນທຶນບາດ/ກີບ, ສະຕັອກສິນຄ້າ ແລະ Switch ເປີດ/ປິດ 3 ລະດັບຫົວໜ່ວຍ',
                        style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ),

                // Presets (visible on large screen)
                if (MediaQuery.of(context).size.width >= 900) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text(
                          'ແມ່ແບບ: ',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF94A3B8)),
                        ),
                        _buildPresetChip('🍺 ເບຍ', _applyPresetBeer),
                        _buildPresetChip('🥫 ເຄື່ອງດື່ມ', _applyPresetDrink3Tiers),
                        _buildPresetChip('🍬 ເຂົ້າໜົມ', _applyPresetSnack3Tiers),
                        _buildPresetChip('🧂 ນ້ຳຕານ', _applyPresetSugarSack),
                        _buildPresetChip('🏷️ ຂາຍຍ່ອຍ', _applyPresetPieceOnly),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                ],

                // Action Buttons
                TextButton(
                  onPressed: () {
                    if (widget.onClose != null) {
                      widget.onClose!();
                    } else {
                      Navigator.of(context).maybePop();
                    }
                  },
                  child: const Text('ຍົກເລີກ', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: _isSaving ? null : _handleSave,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0D9488),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  ),
                  child: _isSaving
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : Row(
                          mainAxisSize: MainAxisSize.min,
                          children: const [
                            Icon(Icons.check_circle_outline_rounded, size: 16),
                            SizedBox(width: 6),
                            Text('ບັນທຶກສິນຄ້າ', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                          ],
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          children: [
            // Responsive Card Layout
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 1000),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // SECTION 1: Product Profile & Category
                    _buildSectionCard(
                      title: '1. ຂໍ້ມູນສິນຄ້າ & ຮູບພາບ (Basic Profile & Image)',
                      icon: Icons.inventory_2_outlined,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Image Box
                              _buildImageModule(),
                              const SizedBox(width: 16),
                              // Name & Category & Barcode
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    // Name input
                                    const Text('ຊື່ສິນຄ້າ (Product Name) *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                                    const SizedBox(height: 6),
                                    TextFormField(
                                      controller: _nameController,
                                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                                      decoration: InputDecoration(
                                        hintText: 'ປ້ອນຊື່ສິນຄ້າ (e.g. ເບຍລາວ 330ml, ນ້ຳອັດລົມ Pep-si...)',
                                        isDense: true,
                                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                                      ),
                                      validator: (val) => val == null || val.trim().isEmpty ? 'ກະລຸນາປ້ອນຊື່ສິນຄ້າ' : null,
                                    ),
                                    const SizedBox(height: 12),

                                    // Category selector + inline create + Category Management button
                                    const Text('ໝວດໝູ່ສິນຄ້າ (Category)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                                    const SizedBox(height: 6),
                                    _buildCategorySelector(rawCats),
                                    const SizedBox(height: 12),

                                    // Main Barcode
                                    const Text('ບາໂຄດຫຼັກ (Main Barcode - ຖ້າມີ)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                                    const SizedBox(height: 6),
                                    Row(
                                      children: [
                                        Expanded(
                                          child: TextFormField(
                                            controller: _barcodeController,
                                            style: const TextStyle(fontSize: 13, fontFamily: 'monospace', fontWeight: FontWeight.bold),
                                            decoration: InputDecoration(
                                              hintText: 'ສະແກນ ຫຼື ປ້ອນລະຫັດບາໂຄດ...',
                                              isDense: true,
                                              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        IconButton(
                                          onPressed: () => _openBarcodeScanner((code) {
                                            setState(() => _barcodeController.text = code);
                                          }),
                                          icon: const Icon(Icons.barcode_reader, color: Color(0xFF0D9488)),
                                          style: IconButton.styleFrom(
                                            backgroundColor: const Color(0xFFCCFBF1),
                                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                            padding: const EdgeInsets.all(12),
                                          ),
                                          tooltip: 'ສະແກນບາໂຄດດ້ວຍກ້ອງ',
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // SECTION 2: Cost Breakdown (THB & LAK)
                    _buildSectionCard(
                      title: '2. ຕົ້ນທຶນຊື້ເຂົ້າ (Purchase Cost)',
                      icon: Icons.payments_outlined,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('ຕົ້ນທຶນ ฿ (THB) / ຍົກລັງ',
                                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                                    const SizedBox(height: 2),
                                    const Text('ສຳລັບບັນທຶກອ້າງອີງສ່ວນຕົວ',
                                        style: TextStyle(fontSize: 10, color: Color(0xFF64748B))),
                                    const SizedBox(height: 6),
                                    TextFormField(
                                      controller: _costBahtController,
                                      focusNode: _costBahtFocusNode,
                                      keyboardType: TextInputType.number,
                                      inputFormatters: [LaoCurrencyInputFormatter()],
                                      style: const TextStyle(
                                          fontSize: 13, fontFamily: 'monospace', fontWeight: FontWeight.bold),
                                      decoration: InputDecoration(
                                        hintText: '250',
                                        prefixText: '฿ ',
                                        isDense: true,
                                        contentPadding:
                                            const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                                      ),
                                      onChanged: (_) => setState(() {}),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        const Text('ຕົ້ນທຶນ ₭ (LAK) / ຍົກລັງ',
                                            style: TextStyle(
                                                fontSize: 12,
                                                fontWeight: FontWeight.w800,
                                                color: Color(0xFF0F766E))),
                                        InkWell(
                                          onTap: () {
                                            final bVal = LaoCurrencyFormatter.parseClean(_costBahtController.text);
                                            if (bVal > 0) {
                                              final kVal = bVal * 720;
                                              _costKipController.text = LaoCurrencyFormatter.formatNumber(kVal);
                                              setState(() {});
                                            }
                                          },
                                          borderRadius: BorderRadius.circular(6),
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFFF0FDFA),
                                              borderRadius: BorderRadius.circular(6),
                                              border: Border.all(color: const Color(0xFF99F6E4)),
                                            ),
                                            child: const Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                Icon(Icons.bolt_rounded, size: 12, color: Color(0xFF0D9488)),
                                                SizedBox(width: 2),
                                                Text('ແປງ 1฿=720₭',
                                                    style: TextStyle(
                                                        fontSize: 9.5,
                                                        fontWeight: FontWeight.bold,
                                                        color: Color(0xFF0F766E))),
                                              ],
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 2),
                                    const Text('ຕົ້ນທຶນຫຼັກບັນຊີຮ້ານ & ກຳໄລ',
                                        style: TextStyle(fontSize: 10, color: Color(0xFF0D9488))),
                                    const SizedBox(height: 6),
                                    TextFormField(
                                      controller: _costKipController,
                                      focusNode: _costKipFocusNode,
                                      keyboardType: TextInputType.number,
                                      inputFormatters: [LaoCurrencyInputFormatter()],
                                      style: const TextStyle(
                                          fontSize: 13,
                                          fontFamily: 'monospace',
                                          fontWeight: FontWeight.bold,
                                          color: Color(0xFF0F766E)),
                                      decoration: InputDecoration(
                                        hintText: '180.000',
                                        suffixText: '₭',
                                        isDense: true,
                                        contentPadding:
                                            const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                                        focusedBorder: OutlineInputBorder(
                                          borderRadius: BorderRadius.circular(10),
                                          borderSide: const BorderSide(color: Color(0xFF0D9488), width: 1.8),
                                        ),
                                      ),
                                      onChanged: (_) => setState(() {}),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          // Live Calculation Preview Banner
                          Builder(
                            builder: (context) {
                              final kipEntered = LaoCurrencyFormatter.parseClean(_costKipController.text);
                              if (kipEntered <= 0) return const SizedBox.shrink();

                              final pPerC = int.tryParse(_cartonMultiplierController.text.trim()) ?? 8;
                              final pcPerP = int.tryParse(_packMultiplierController.text.trim()) ?? 6;

                              int ratio = 1;
                              if (_enablePiece) {
                                final t2 = _enablePack ? (pcPerP > 0 ? pcPerP : 1) : 1;
                                ratio = _enableCarton ? (_enablePack ? pPerC * t2 : pPerC) : 1;
                              } else if (_enablePack) {
                                ratio = _enableCarton ? (pPerC > 0 ? pPerC : 1) : 1;
                              } else if (_enableCarton) {
                                ratio = 1;
                              }
                              if (ratio <= 0) ratio = 1;

                              final baseCost = (kipEntered / ratio).round();
                              final bName = _getBaseUnitName();

                              return Container(
                                margin: const EdgeInsets.only(top: 10),
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF0FDFA),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: const Color(0xFFCCFBF1)),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(Icons.info_outline_rounded, size: 15, color: Color(0xFF0D9488)),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        'ຕົ້ນທຶນຍົກລັງ: ${LaoCurrencyFormatter.formatNumber(kipEntered)} ₭  ➜  ຕົ້ນທຶນຕໍ່ຫົວໜ່ວຍຫຼັກ ($bName, x$ratio): ${LaoCurrencyFormatter.formatNumber(baseCost)} ₭',
                                        style: const TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                          color: Color(0xFF0F766E),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // SECTION 3: Stock Inventory Tracking
                    _buildSectionCard(
                      title: '3. ຕິດຕາມສະຕັອກສິນຄ້າ (Inventory & Stock Tracking)',
                      icon: Icons.warehouse_outlined,
                      headerTrailing: Switch(
                        value: _trackStock,
                        activeColor: const Color(0xFF0D9488),
                        onChanged: (val) => setState(() => _trackStock = val),
                      ),
                      child: _trackStock
                          ? Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    if (_enableCarton)
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              'ຈຳນວນ${_cartonUnitNameController.text.trim().isNotEmpty ? _cartonUnitNameController.text : "ແກັດ"}',
                                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
                                            ),
                                            const SizedBox(height: 6),
                                            TextFormField(
                                              controller: _stockCartonController,
                                              keyboardType: TextInputType.number,
                                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                                              decoration: InputDecoration(
                                                isDense: true,
                                                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                                              ),
                                              onChanged: (_) => setState(() {}),
                                            ),
                                          ],
                                        ),
                                      ),
                                    if (_enableCarton && _enablePack) const SizedBox(width: 12),
                                    if (_enablePack)
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              'ຈຳນວນ${_packUnitNameController.text.trim().isNotEmpty ? _packUnitNameController.text : "ແພັກ"}',
                                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
                                            ),
                                            const SizedBox(height: 6),
                                            TextFormField(
                                              controller: _stockPackController,
                                              keyboardType: TextInputType.number,
                                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                                              decoration: InputDecoration(
                                                isDense: true,
                                                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                                              ),
                                              onChanged: (_) => setState(() {}),
                                            ),
                                          ],
                                        ),
                                      ),
                                    if ((_enableCarton || _enablePack) && _enablePiece) const SizedBox(width: 12),
                                    if (_enablePiece)
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              'ຈຳນວນ${_pieceUnitNameController.text.trim().isNotEmpty ? _pieceUnitNameController.text : "ອັນ"}',
                                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
                                            ),
                                            const SizedBox(height: 6),
                                            TextFormField(
                                              controller: _stockPieceController,
                                              keyboardType: TextInputType.number,
                                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                                              decoration: InputDecoration(
                                                isDense: true,
                                                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                                              ),
                                              onChanged: (_) => setState(() {}),
                                            ),
                                          ],
                                        ),
                                      ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF0FDFA),
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: const Color(0xFFCCFBF1)),
                                  ),
                                  child: Row(
                                    children: [
                                      const Icon(Icons.info_outline_rounded, size: 16, color: Color(0xFF0F766E)),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          'ສະຕັອກເລີ່ມຕົ້ນ: ${_enableCarton ? "${_stockCartonController.text} ${_cartonUnitNameController.text} " : ""}${_enablePack ? "${_stockPackController.text} ${_packUnitNameController.text} " : ""}${_enablePiece ? "${_stockPieceController.text} ${_pieceUnitNameController.text}" : ""} (ລວມທັງໝົດ: $totalBaseUnits $baseUnitName)',
                                          style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: Color(0xFF0F766E)),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            )
                          : Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8FAFC),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: const Color(0xFFE2E8F0)),
                              ),
                              child: Row(
                                children: const [
                                  Icon(Icons.lightbulb_outline_rounded, color: Color(0xFF0284C7), size: 18),
                                  SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      '💡 ໂໝດບໍ່ນັບສະຕັອກ: ລະບົບຈະບໍ່ຕັດສະຕັອກ ແລະ ສາມາດຂາຍໄດ້ຕະຫຼອດ (ບໍ່ມີສິນຄ້າໝົດສາງ). ຖານຂໍ້ມູນຈະບັນທຶກ 0 base units.',
                                      style: TextStyle(fontSize: 11.5, color: Color(0xFF0369A1), fontWeight: FontWeight.w600),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                    ),
                    const SizedBox(height: 16),

                    // SECTION 4: 3-Tier Packaging Configuration
                    _buildSectionCard(
                      title: '4. ລະດັບຫົວໜ່ວຍການຂາຍ (3 Packaging Tiers)',
                      icon: Icons.layers_outlined,
                      child: Column(
                        children: [
                          // Tier 1: Carton
                          _buildTierContainer(
                            tierNumber: '1',
                            tierTitle: 'ຂາຍຍົກລັງ / ແກັດ (Carton / Box / Sack)',
                            isActive: _enableCarton,
                            onToggle: (val) => setState(() => _enableCarton = val),
                            unitController: _cartonUnitNameController,
                            barcodeController: _cartonBarcodeController,
                            priceController: _cartonPriceController,
                            multiplierController: _cartonMultiplierController,
                            multiplierLabel: '1 ${_cartonUnitNameController.text} = N ${_enablePack ? _packUnitNameController.text : (_enablePiece ? _pieceUnitNameController.text : "ໜ່ວຍ")}',
                            commonUnits: _commonCartonUnits,
                            extraWidgets: [
                              const Divider(height: 20, color: Color(0xFFE2E8F0)),
                              Row(
                                children: [
                                  Switch(
                                    value: _hasCrateDeposit,
                                    activeColor: const Color(0xFF0D9488),
                                    onChanged: (val) => setState(() => _hasCrateDeposit = val),
                                  ),
                                  const SizedBox(width: 8),
                                  const Text('ຄ່າຄ້ຳປະກັນແກັດ/ຂວດ (Crate Deposit)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                  if (_hasCrateDeposit) ...[
                                    const Spacer(),
                                    SizedBox(
                                      width: 140,
                                      child: TextFormField(
                                        controller: _crateDepositFeeController,
                                        keyboardType: TextInputType.number,
                                        inputFormatters: [LaoCurrencyInputFormatter()],
                                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                                        decoration: InputDecoration(
                                          suffixText: '₭',
                                          isDense: true,
                                          contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                        ),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),

                          // Tier 2: Pack
                          _buildTierContainer(
                            tierNumber: '2',
                            tierTitle: 'ຂາຍເປັນແພັກ / ມັດ (Pack / Bundle)',
                            isActive: _enablePack,
                            onToggle: (val) => setState(() => _enablePack = val),
                            unitController: _packUnitNameController,
                            barcodeController: _packBarcodeController,
                            priceController: _packPriceController,
                            multiplierController: _enablePiece ? _packMultiplierController : null,
                            multiplierLabel: _enablePiece ? '1 ${_packUnitNameController.text} = N ${_pieceUnitNameController.text}' : null,
                            commonUnits: _commonPackUnits,
                          ),
                          const SizedBox(height: 12),

                          // Tier 3: Piece
                          _buildTierContainer(
                            tierNumber: '3',
                            tierTitle: 'ຂາຍຍ່ອຍ / ອັນ / ກະປ໋ອງ (Piece / Single Retail)',
                            isActive: _enablePiece,
                            onToggle: (val) => setState(() => _enablePiece = val),
                            unitController: _pieceUnitNameController,
                            barcodeController: _pieceBarcodeController,
                            priceController: _piecePriceController,
                            commonUnits: _commonPieceUnits,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 40),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPresetChip(String label, VoidCallback onTap) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 3),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(6),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: const Color(0xFFCBD5E1)),
          ),
          child: Text(
            label,
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF334155)),
          ),
        ),
      ),
    );
  }

  Widget _buildSectionCard({
    required String title,
    required IconData icon,
    required Widget child,
    Widget? headerTrailing,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x08000000),
            offset: Offset(0, 1),
            blurRadius: 3,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: const BoxDecoration(
              color: Color(0xFFF8FAFC),
              borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
              border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
            ),
            child: Row(
              children: [
                Icon(icon, size: 18, color: const Color(0xFF0D9488)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF1E293B)),
                  ),
                ),
                if (headerTrailing != null) headerTrailing,
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: child,
          ),
        ],
      ),
    );
  }

  Widget _buildImageModule() {
    final hasImage = _compressedImageBytes != null || (_imageUrl.isNotEmpty && _imageUrl.startsWith('http'));

    return Column(
      children: [
        Container(
          width: 140,
          height: 140,
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFCBD5E1)),
          ),
          clipBehavior: Clip.antiAlias,
          child: _isCompressing
              ? const Center(child: CircularProgressIndicator(color: Color(0xFF0D9488)))
              : hasImage
                  ? Stack(
                      fit: StackFit.expand,
                      children: [
                        if (_compressedImageBytes != null)
                          Image.memory(_compressedImageBytes!, fit: BoxFit.cover)
                        else
                          Image.network(_imageUrl, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const Icon(Icons.image_not_supported)),
                        Positioned(
                          top: 4,
                          right: 4,
                          child: InkWell(
                            onTap: () {
                              setState(() {
                                _compressedImageBytes = null;
                                _imageUrl = '';
                                _urlInputController.clear();
                              });
                            },
                            child: Container(
                              padding: const EdgeInsets.all(4),
                              decoration: const BoxDecoration(
                                color: Colors.black54,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.close_rounded, size: 14, color: Colors.white),
                            ),
                          ),
                        ),
                      ],
                    )
                  : Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: const [
                        Icon(Icons.add_a_photo_outlined, size: 32, color: Color(0xFF94A3B8)),
                        SizedBox(height: 6),
                        Text('ຮູບສິນຄ້າ', style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold)),
                      ],
                    ),
        ),
        const SizedBox(height: 8),

        // Photo Action Buttons
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              icon: const Icon(Icons.camera_alt_outlined, size: 18),
              onPressed: () => _pickImage(ImageSource.camera),
              style: IconButton.styleFrom(
                backgroundColor: const Color(0xFFF1F5F9),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              tooltip: 'ຖ່າຍຮູບ',
            ),
            const SizedBox(width: 6),
            IconButton(
              icon: const Icon(Icons.photo_library_outlined, size: 18),
              onPressed: () => _pickImage(ImageSource.gallery),
              style: IconButton.styleFrom(
                backgroundColor: const Color(0xFFF1F5F9),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              tooltip: 'ເລືອກຈາກຄັງ',
            ),
            const SizedBox(width: 6),
            IconButton(
              icon: const Icon(Icons.link_rounded, size: 18),
              onPressed: () => setState(() => _showUrlInput = !_showUrlInput),
              style: IconButton.styleFrom(
                backgroundColor: _showUrlInput ? const Color(0xFFCCFBF1) : const Color(0xFFF1F5F9),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              tooltip: 'ລິ້ງ URL',
            ),
          ],
        ),

        if (_compressedSizeBytes != null && _originalSizeBytes != null) ...[
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: const Color(0xFFECFDF5),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: const Color(0xFFA7F3D0)),
            ),
            child: Text(
              '${(_originalSizeBytes! / 1024).toStringAsFixed(0)}KB → ${(_compressedSizeBytes! / 1024).toStringAsFixed(0)}KB',
              style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Color(0xFF047857)),
            ),
          ),
        ],

        if (_showUrlInput) ...[
          const SizedBox(height: 6),
          SizedBox(
            width: 140,
            child: TextField(
              controller: _urlInputController,
              style: const TextStyle(fontSize: 10),
              decoration: InputDecoration(
                hintText: 'https://...',
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(6)),
              ),
              onSubmitted: (url) {
                if (url.trim().isNotEmpty) {
                  setState(() {
                    _imageUrl = url.trim();
                    _compressedImageBytes = null;
                  });
                }
              },
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildCategorySelector(List<CategoryModel> rawCats) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            // Dropdown
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFCBD5E1)),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _selectedCategoryId ?? (rawCats.isNotEmpty ? rawCats.first.id : null),
                    isExpanded: true,
                    icon: const Icon(Icons.arrow_drop_down_rounded),
                    items: rawCats.map((cat) {
                      return DropdownMenuItem<String>(
                        value: cat.id,
                        child: Text(
                          cat.name,
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                        ),
                      );
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) {
                        final cat = rawCats.firstWhere((c) => c.id == val);
                        setState(() {
                          _selectedCategoryId = cat.id;
                          _selectedCategoryName = cat.name;
                        });
                      }
                    },
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),

            // Quick add category inline
            OutlinedButton.icon(
              onPressed: () => setState(() => _isAddingCustomCategory = !_isAddingCustomCategory),
              icon: Icon(_isAddingCustomCategory ? Icons.close_rounded : Icons.add_rounded, size: 14),
              label: Text(_isAddingCustomCategory ? 'ຍົກເລີກ' : 'ໝວດໃໝ່', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF0F766E),
                side: const BorderSide(color: Color(0xFF99F6E4)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
              ),
            ),
            const SizedBox(width: 6),

            // Manage categories button
            IconButton(
              onPressed: () {
                showDialog(
                  context: context,
                  builder: (_) => const CategoryManagementModal(),
                );
              },
              icon: const Icon(Icons.settings_outlined, color: Color(0xFF475569), size: 18),
              style: IconButton.styleFrom(
                backgroundColor: const Color(0xFFF1F5F9),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                padding: const EdgeInsets.all(10),
              ),
              tooltip: 'ຈັດການໝວດໝູ່ (Category Manager)',
            ),
          ],
        ),

        // Inline Category Creation field
        if (_isAddingCustomCategory) ...[
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _categoryCustomController,
                  autofocus: true,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                  decoration: InputDecoration(
                    hintText: 'ປ້ອນຊື່ໝວດໝູ່ໃໝ່ແລ້ວກົດບັນທຶກ...',
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                onPressed: () async {
                  final clean = _categoryCustomController.text.trim();
                  if (clean.isNotEmpty) {
                    final created = await ref.read(catalogProvider.notifier).createCategory(clean);
                    if (created != null) {
                      setState(() {
                        _selectedCategoryId = created.id;
                        _selectedCategoryName = created.name;
                        _categoryCustomController.clear();
                        _isAddingCustomCategory = false;
                      });
                    }
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0D9488),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
                child: const Text('ບັນທຶກ', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _buildTierContainer({
    required String tierNumber,
    required String tierTitle,
    required bool isActive,
    required ValueChanged<bool> onToggle,
    required TextEditingController unitController,
    required TextEditingController barcodeController,
    required TextEditingController priceController,
    TextEditingController? multiplierController,
    String? multiplierLabel,
    required List<String> commonUnits,
    List<Widget>? extraWidgets,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: isActive ? Colors.white : const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isActive ? const Color(0xFF0D9488).withValues(alpha: 0.4) : const Color(0xFFE2E8F0),
          width: isActive ? 1.2 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header with switch
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: isActive ? const Color(0xFFF0FDFA) : const Color(0xFFF1F5F9),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(13)),
            ),
            child: Row(
              children: [
                Container(
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    color: isActive ? const Color(0xFF0D9488) : const Color(0xFF94A3B8),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Center(
                    child: Text(
                      tierNumber,
                      style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w900),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    tierTitle,
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w800,
                      color: isActive ? const Color(0xFF0F172A) : const Color(0xFF64748B),
                    ),
                  ),
                ),
                Switch(
                  value: isActive,
                  activeColor: const Color(0xFF0D9488),
                  onChanged: onToggle,
                ),
              ],
            ),
          ),

          if (isActive)
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // 1. Unit Name
                      Expanded(
                        flex: 3,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('ຊື່ຫົວໜ່ວຍ', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 4),
                            TextFormField(
                              controller: unitController,
                              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold),
                              decoration: InputDecoration(
                                isDense: true,
                                contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                              ),
                              onChanged: (_) => setState(() {}),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 10),

                      // 2. Selling Price (Auto Formatted with Dots)
                      Expanded(
                        flex: 4,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('ລາຄາຂາຍ (₭)', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 4),
                            TextFormField(
                              controller: priceController,
                              keyboardType: TextInputType.number,
                              inputFormatters: [LaoCurrencyInputFormatter()],
                              style: const TextStyle(fontSize: 12.5, fontFamily: 'monospace', fontWeight: FontWeight.bold),
                              decoration: InputDecoration(
                                hintText: '10.000',
                                suffixText: '₭',
                                isDense: true,
                                contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                              ),
                            ),
                          ],
                        ),
                      ),

                      // 3. Multiplier (if applicable)
                      if (multiplierController != null) ...[
                        const SizedBox(width: 10),
                        Expanded(
                          flex: 3,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(multiplierLabel ?? 'ອັດຕາສ່ວນ', style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold)),
                              const SizedBox(height: 4),
                              TextFormField(
                                controller: multiplierController,
                                keyboardType: TextInputType.number,
                                style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold),
                                decoration: InputDecoration(
                                  isDense: true,
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                                onChanged: (_) => setState(() {}),
                              ),
                            ],
                          ),
                        ),
                      ],

                      const SizedBox(width: 10),

                      // 4. Barcode at the END of the row
                      Expanded(
                        flex: 4,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('ບາໂຄດສະເພາະຂັ້ນນີ້', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                Expanded(
                                  child: TextFormField(
                                    controller: barcodeController,
                                    style: const TextStyle(fontSize: 12, fontFamily: 'monospace', fontWeight: FontWeight.bold),
                                    decoration: InputDecoration(
                                      hintText: 'ບາໂຄດ...',
                                      isDense: true,
                                      contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 4),
                                IconButton(
                                  icon: const Icon(Icons.barcode_reader, size: 16, color: Color(0xFF0D9488)),
                                  onPressed: () => _openBarcodeScanner((code) {
                                    setState(() => barcodeController.text = code);
                                  }),
                                  style: IconButton.styleFrom(
                                    backgroundColor: const Color(0xFFCCFBF1),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                    minimumSize: const Size(36, 36),
                                    padding: EdgeInsets.zero,
                                  ),
                                  tooltip: 'ສະແກນ',
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),

                  // Common unit suggestions
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 4,
                    children: commonUnits.map((u) {
                      return InkWell(
                        onTap: () => setState(() => unitController.text = u),
                        borderRadius: BorderRadius.circular(6),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: const Color(0xFFCBD5E1)),
                          ),
                          child: Text(u, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF475569))),
                        ),
                      );
                    }).toList(),
                  ),

                  if (extraWidgets != null) ...extraWidgets,
                ],
              ),
            ),
        ],
      ),
    );
  }
}
