import 'product_unit.dart';
import '../../core/utils/stock_format_helper.dart';
import '../../data/local/product_local_meta_service.dart';

/// Product domain entity for Lao Grocery POS & Backoffice
/// Encapsulates multi-tier units, cost, untracked/negative stock rules,
/// barcode, relational category, and compound stock display logic.
class Product {
  final String id;
  final String name; // Lao product name (e.g. ເບຍລາວ ຂວດໃຫຍ່ 640ml)
  final String
  category; // Category name (e.g. ເຄື່ອງດື່ມ, ເບຍ/ເຫຼົ້າ, ເຂົ້າໜົມ)
  final String? categoryId; // Relational UUID linking to categories.id
  final String? barcode;
  final String? imageUrl;
  final String
  baseUnit; // Smallest stock keeping unit (e.g. "ແກ້ວ", "ກະປ໋ອງ", "ແພັກ", "ອັນ")
  final int costPerBaseUnit; // Wholesale cost per base unit in Lao Kip (₭)
  final int costBaht; // Purchase cost in THB (฿)
  final int costKip; // Purchase cost in LAK (₭)
  final int currentStockBaseUnits; // Inventory count in base unit
  final bool trackStock; // If false, displays "ບໍ່ນັບສາງ"
  final bool
  hasCrateDeposit; // Specialized crate deposit for beer crates/bottles
  final int crateDepositFee; // Fee per crate (default 30.000 Kip)
  final bool tier1Active; // Carton/Box tier switch
  final bool tier2Active; // Pack/Bundle tier switch
  final bool tier3Active; // Piece/Retail tier switch
  final int packsPerCarton; // Multiplier between Carton and Pack (default 8)
  final int piecesPerPack; // Multiplier between Pack and Piece (default 6)
  final bool
  allowNegativeStock; // If true, cashier can sell even when stock <= 0
  final List<ProductUnit> units; // Multi-tier unit packaging options

  const Product({
    required this.id,
    required this.name,
    required this.category,
    this.categoryId,
    this.barcode,
    this.imageUrl,
    required this.baseUnit,
    required this.costPerBaseUnit,
    this.costBaht = 0,
    this.costKip = 0,
    required this.currentStockBaseUnits,
    this.trackStock = true,
    this.allowNegativeStock = true,
    this.hasCrateDeposit = false,
    this.crateDepositFee = 30000,
    this.tier1Active = true,
    this.tier2Active = true,
    this.tier3Active = false,
    this.packsPerCarton = 8,
    this.piecesPerPack = 6,
    required this.units,
  });

  /// Alias for stock quantity in base units
  int get stockQuantity => currentStockBaseUnits;

  /// Active units only
  List<ProductUnit> get activeUnits => units.where((u) => u.isActive).toList();

  /// Resolve Carton unit (Tier 3 or Carton naming)
  ProductUnit? get cartonUnit {
    if (!tier1Active) return null;
    return units.cast<ProductUnit?>().firstWhere(
      (u) =>
          u != null &&
          (u.tier == 3 ||
              u.id.endsWith('_carton') ||
              [
                'ແກັດ',
                'ລັງ',
                'ເປົາ',
                'ກະສອບ',
                'ກ່ອງໃຫຍ່',
                'ຖັງ',
              ].contains(u.unitName)),
      orElse: () => units.isNotEmpty && units.length > 2 ? units.last : null,
    );
  }

  /// Resolve Pack unit (Tier 2 or Pack naming)
  ProductUnit? get packUnit {
    if (!tier2Active) return null;
    final cUnit = cartonUnit;
    return units.cast<ProductUnit?>().firstWhere(
      (u) =>
          u != null &&
          u.id != cUnit?.id &&
          (u.tier == 2 ||
              u.id.endsWith('_pack') ||
              ['ແພັກ', 'ມັດ', 'ແຕະ', 'ໂຫຼ', 'ຖົງກາງ'].contains(u.unitName)),
      orElse: () => units.length >= 2 ? units[units.length - 2] : null,
    );
  }

  /// Resolve Piece unit (Tier 1 or Piece naming)
  ProductUnit? get pieceUnit {
    if (!tier3Active) return null;
    final cUnit = cartonUnit;
    final pUnit = packUnit;
    return units.cast<ProductUnit?>().firstWhere(
      (u) =>
          u != null &&
          u.id != cUnit?.id &&
          u.id != pUnit?.id &&
          (u.tier == 1 ||
              u.id.endsWith('_piece') ||
              [
                'ອັນ',
                'ແກ້ວ',
                'ຖົງ',
                'ກະປ໋ອງ',
                'ຕຸກ',
                'ຊອງ',
                'ກ່ອງນ້ອຍ',
              ].contains(u.unitName)),
      orElse: () => units.isNotEmpty ? units.first : null,
    );
  }

  /// Unit name display getters
  String get cName => cartonUnit?.unitName ?? 'ແກັດ';
  String get pName => packUnit?.unitName ?? 'ແພັກ';
  String get pcName =>
      pieceUnit?.unitName ??
      (baseUnit != pName && baseUnit != cName ? baseUnit : 'ອັນ');

  /// Base unit representation
  ProductUnit get defaultBaseUnit {
    return units.firstWhere(
      (u) => u.multiplier == 1 || u.isBaseUnit,
      orElse:
          () =>
              units.isNotEmpty
                  ? units.reduce((a, b) => a.multiplier < b.multiplier ? a : b)
                  : ProductUnit(
                    id: '${id}_base',
                    productId: id,
                    unitName: baseUnit,
                    multiplier: 1,
                    retailPrice: 0,
                    wholesalePrice: 0,
                    isBaseUnit: true,
                  ),
    );
  }

  /// Highest multiplier unit (e.g., ແກັດ / Carton)
  ProductUnit get highestTierUnit {
    if (units.isEmpty) return defaultBaseUnit;
    return units.reduce((a, b) => a.multiplier > b.multiplier ? a : b);
  }

  /// Sub-tier (smallest unit sold individually, e.g. "ແກ້ວ", "ແພັກ", "ກະປ໋ອງ")
  ProductUnit get subTierUnit {
    return units.firstWhere(
      (u) => u.multiplier == 1 || u.isBaseUnit,
      orElse: () => defaultBaseUnit,
    );
  }

  /// Large tier (Carton / Box / "ແກັດ")
  ProductUnit get cartonTierUnit {
    return units.firstWhere(
      (u) => u.multiplier > 1 || u.unitName.contains('ແກັດ'),
      orElse: () => highestTierUnit,
    );
  }

  /// Compound Stock breakdown getters
  int get cartonCount {
    if (!trackStock || !tier1Active) return 0;
    final absBase = currentStockBaseUnits.abs();
    final cUnit = cartonUnit;
    final pUnit = packUnit;
    final pcUnit = pieceUnit;

    if (cUnit != null && pUnit != null && pcUnit != null) {
      final piecesPerCarton = packsPerCarton * piecesPerPack;
      return absBase ~/ (piecesPerCarton > 0 ? piecesPerCarton : 1);
    } else if (cUnit != null && pUnit != null) {
      return absBase ~/ (packsPerCarton > 0 ? packsPerCarton : 1);
    } else if (cUnit != null) {
      final mul = cUnit.multiplier > 0 ? cUnit.multiplier : 1;
      return absBase ~/ mul;
    }
    return 0;
  }

  int get packCount {
    if (!trackStock || !tier2Active) return 0;
    final absBase = currentStockBaseUnits.abs();
    final cUnit = cartonUnit;
    final pUnit = packUnit;
    final pcUnit = pieceUnit;

    if (cUnit != null && pUnit != null && pcUnit != null) {
      final piecesPerCarton = packsPerCarton * piecesPerPack;
      final rem = absBase % (piecesPerCarton > 0 ? piecesPerCarton : 1);
      return rem ~/ (piecesPerPack > 0 ? piecesPerPack : 1);
    } else if (cUnit != null && pUnit != null) {
      return absBase % (packsPerCarton > 0 ? packsPerCarton : 1);
    } else if (pUnit != null) {
      return absBase;
    }
    return 0;
  }

  int get pieceCount {
    if (!trackStock || !tier3Active) return 0;
    final absBase = currentStockBaseUnits.abs();
    final cUnit = cartonUnit;
    final pUnit = packUnit;
    final pcUnit = pieceUnit;

    if (cUnit != null && pUnit != null && pcUnit != null) {
      return absBase % (piecesPerPack > 0 ? piecesPerPack : 1);
    } else if (cUnit != null && pcUnit != null) {
      final mul =
          packsPerCarton > 0
              ? packsPerCarton
              : (cUnit.multiplier > 0 ? cUnit.multiplier : 1);
      return absBase % mul;
    } else if (pUnit != null && pcUnit != null) {
      return absBase % (piecesPerPack > 0 ? piecesPerPack : 1);
    } else if (pcUnit != null) {
      return absBase;
    }
    return 0;
  }

  String get totalPacksCount {
    if (!trackStock || !tier2Active) return '0';
    if (tier3Active && piecesPerPack > 0) {
      final val = currentStockBaseUnits.abs() / piecesPerPack;
      return val.toStringAsFixed(1).replaceAll('.0', '');
    }
    return currentStockBaseUnits.abs().toString();
  }

  /// Formatted compound negative stock (e.g. "-2 ແກັດ", "-2 ແກັດ 1 ອັນ", "-6 ອັນ")
  String get negativeStockCompound => StockFormatHelper.formatNegativeCompound(
    currentStockBaseUnits,
    units,
    baseUnitName: baseUnit,
  );

  /// Active units sorted from highest tier (largest multiplier) to lowest
  List<ProductUnit> get unitsHighestToLowest {
    final list = units.where((u) => u.isActive).toList();
    list.sort((a, b) => b.multiplier.compareTo(a.multiplier));
    return list;
  }

  /// Clean negative stock display formatted to highest unit: "ຕິດລົບ -{số} {đơn_vị_cao_nhất}"
  String get negativeHighestUnitStockText {
    if (currentStockBaseUnits >= 0) return '';
    final sorted = unitsHighestToLowest;
    final topUnit = sorted.isNotEmpty ? sorted.first : null;
    final topUnitName = topUnit?.unitName ?? cName;
    final topMult = topUnit != null && topUnit.multiplier > 1 ? topUnit.multiplier : 1;
    final absBase = currentStockBaseUnits.abs();

    if (topMult > 1 && absBase >= topMult) {
      if (absBase % topMult == 0) {
        final qty = absBase ~/ topMult;
        return 'ຕິດລົບ -$qty $topUnitName';
      } else {
        final qtyStr = (absBase / topMult).toStringAsFixed(1).replaceAll('.0', '');
        return 'ຕິດລົບ -$qtyStr $topUnitName';
      }
    }
    return 'ຕິດລົບ -$absBase $topUnitName';
  }

  /// Full ERP stock display string
  String get stockDisplayText => StockFormatHelper.formatStockDisplay(
    currentStockBaseUnits,
    units,
    baseUnitName: baseUnit,
    trackStock: trackStock,
  );

  /// Compound Stock Display Formatter
  ///
  /// Exactly implements SPEC_PRODUCT_LIST.md & SPEC_PRODUCT_FORM_MODAL.md:
  /// - When trackStock == false: returns 'ບໍ່ນັບສາງ'
  /// - When totalBaseUnits == 0: returns 'ໝົດສະຕັອກ (0)'
  /// - When totalBaseUnits < 0: returns 'ໝົດສະຕັອກ ($negativeStockCompound)'
  /// - Unpacks dynamically: `X ແກັດ Y ແພັກ Z ອັນ` + `(ລວມທັງໝົດ: N [baseUnit])`
  String get compoundStockFormatted {
    if (!trackStock) {
      return 'ບໍ່ນັບສາງ';
    }

    if (currentStockBaseUnits == 0) {
      return 'ໝົດສະຕັອກ (0)';
    }

    if (currentStockBaseUnits < 0) {
      return 'ໝົດສະຕັອກ ($negativeStockCompound)';
    }

    final List<String> parts = [];
    final cC = cartonCount;
    final pC = packCount;
    final pcC = pieceCount;

    if (tier1Active && cC > 0) parts.add('$cC $cName');
    if (tier2Active && pC > 0) parts.add('$pC $pName');
    if (tier3Active && pcC > 0) parts.add('$pcC $pcName');

    if (parts.isEmpty) {
      return '0 $baseUnit';
    }

    final summary = parts.join(' ');
    if (tier1Active && (tier2Active || tier3Active)) {
      return '$summary (ລວມທັງໝົດ: $currentStockBaseUnits $baseUnit)';
    }
    return summary;
  }

  /// Short summary for compact cards (e.g. `12 ແກັດ 4 ແພັກ`, `ຕິດລົບ (-2 ແກັດ)`)
  String get stockBadgeText {
    if (!trackStock) return 'ບໍ່ນັບສາງ';
    if (currentStockBaseUnits == 0) return 'ໝົດສະຕັອກ (0)';
    if (currentStockBaseUnits < 0) return 'ຕິດລົບ ($negativeStockCompound)';
    return compoundStockFormatted;
  }

  /// Check if a specific unit quantity can be fulfilled
  bool canFulfill(ProductUnit unit, int quantity) {
    if (!trackStock || allowNegativeStock) return true;
    final requiredBase = unit.multiplier * quantity;
    return currentStockBaseUnits >= requiredBase;
  }

  Product copyWith({
    String? id,
    String? name,
    String? category,
    String? categoryId,
    String? barcode,
    String? imageUrl,
    String? baseUnit,
    int? costPerBaseUnit,
    int? costBaht,
    int? costKip,
    int? currentStockBaseUnits,
    bool? trackStock,
    bool? allowNegativeStock,
    bool? hasCrateDeposit,
    int? crateDepositFee,
    bool? tier1Active,
    bool? tier2Active,
    bool? tier3Active,
    int? packsPerCarton,
    int? piecesPerPack,
    List<ProductUnit>? units,
  }) {
    return Product(
      id: id ?? this.id,
      name: name ?? this.name,
      category: category ?? this.category,
      categoryId: categoryId ?? this.categoryId,
      barcode: barcode ?? this.barcode,
      imageUrl: imageUrl ?? this.imageUrl,
      baseUnit: baseUnit ?? this.baseUnit,
      costPerBaseUnit: costPerBaseUnit ?? this.costPerBaseUnit,
      costBaht: costBaht ?? this.costBaht,
      costKip: costKip ?? this.costKip,
      currentStockBaseUnits:
          currentStockBaseUnits ?? this.currentStockBaseUnits,
      trackStock: trackStock ?? this.trackStock,
      allowNegativeStock: allowNegativeStock ?? this.allowNegativeStock,
      hasCrateDeposit: hasCrateDeposit ?? this.hasCrateDeposit,
      crateDepositFee: crateDepositFee ?? this.crateDepositFee,
      tier1Active: tier1Active ?? this.tier1Active,
      tier2Active: tier2Active ?? this.tier2Active,
      tier3Active: tier3Active ?? this.tier3Active,
      packsPerCarton: packsPerCarton ?? this.packsPerCarton,
      piecesPerPack: piecesPerPack ?? this.piecesPerPack,
      units: units ?? this.units,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'category': category,
      'category_id': categoryId,
      'barcode': barcode,
      'image_url': imageUrl,
      'base_unit': baseUnit,
      'cost_per_base_unit': costPerBaseUnit,
      'cost_thb': costBaht,
      'cost_baht': costBaht,
      'cost_lak': costKip,
      'current_stock_base_units': currentStockBaseUnits,
      'track_stock': trackStock,
      'allow_negative_stock': allowNegativeStock,
      'has_crate_deposit': hasCrateDeposit,
      'crate_deposit_fee': crateDepositFee,
      'tier1_active': tier1Active,
      'tier2_active': tier2Active,
      'tier3_active': tier3Active,
      'packs_per_carton': packsPerCarton,
      'pieces_per_pack': piecesPerPack,
      'units': units.map((u) => u.toJson()).toList(),
    };
  }

  factory Product.fromJson(Map<String, dynamic> json) {
    final rawUnits = json['units'] ?? json['product_units'];
    final unitsList =
        (rawUnits as List<dynamic>?)
            ?.map((u) => ProductUnit.fromJson(u as Map<String, dynamic>))
            .toList() ??
        [];

    final String resolvedCategory =
        json['categories']?['name']?.toString() ??
        json['category']?.toString() ??
        'ເຄື່ອງດື່ມ';

    final String? resolvedCategoryId =
        json['category_id']?.toString() ??
        json['categories']?['id']?.toString();

    // Check tier active flags directly or infer from units
    final bool hasCarton =
        json['tier1_active'] != null
            ? json['tier1_active'] as bool
            : unitsList.any(
              (u) =>
                  u.tier == 3 ||
                  u.id.endsWith('_carton') ||
                  [
                    'ແກັດ',
                    'ລັງ',
                    'ເປົາ',
                    'ກະສອບ',
                    'ກ່ອງໃຫຍ່',
                    'ຖັງ',
                  ].contains(u.unitName),
            );

    final bool hasPack =
        json['tier2_active'] != null
            ? json['tier2_active'] as bool
            : unitsList.any(
              (u) =>
                  u.tier == 2 ||
                  u.id.endsWith('_pack') ||
                  ['ແພັກ', 'ມັດ', 'ແຕະ', 'ໂຫຼ', 'ຖົງກາງ'].contains(u.unitName),
            );

    final bool hasPiece =
        json['tier3_active'] != null
            ? json['tier3_active'] as bool
            : unitsList.any(
              (u) =>
                  u.tier == 1 ||
                  u.id.endsWith('_piece') ||
                  [
                    'ອັນ',
                    'ແກ້ວ',
                    'ຖົງ',
                    'ກະປ໋ອງ',
                    'ຕຸກ',
                    'ຊອງ',
                    'ກ່ອງນ້ອຍ',
                  ].contains(u.unitName),
            );

    int packsPerC = (json['packs_per_carton'] as num?)?.toInt() ?? 8;
    int piecesPerP = (json['pieces_per_pack'] as num?)?.toInt() ?? 6;

    // Resolve multipliers from units if available
    ProductUnit? cU;
    ProductUnit? pU;
    ProductUnit? pcU;
    for (final u in unitsList) {
      if (u.tier == 3 || ['ແກັດ', 'ລັງ', 'ເປົາ', 'ກະສອບ'].contains(u.unitName)) {
        cU = u;
      }
      if (u.tier == 2 || ['ແພັກ', 'ມັດ', 'ແຕະ', 'ໂຫຼ'].contains(u.unitName)) {
        pU = u;
      }
      if (u.tier == 1 || ['ອັນ', 'ແກ້ວ', 'ຖົງ', 'ກະປ໋ອງ'].contains(u.unitName)) {
        pcU = u;
      }
    }

    if (cU != null && pU != null && cU.multiplier > pU.multiplier) {
      packsPerC = cU.multiplier ~/ pU.multiplier;
    } else if (cU != null && cU.multiplier > 1) {
      packsPerC = cU.multiplier;
    }

    if (pU != null && pcU != null && pU.multiplier > pcU.multiplier) {
      piecesPerP = pU.multiplier ~/ pcU.multiplier;
    } else if (pU != null && pU.multiplier > 1) {
      piecesPerP = pU.multiplier;
    }

    final int rawCostBase = (json['cost_per_base_unit'] as num?)?.toInt() ?? 0;
    final int cartonMul = cU?.multiplier ?? (hasCarton ? packsPerC : 1);
    final int effCartonMul = cartonMul > 0 ? cartonMul : 1;

    final String pId = json['id']?.toString() ?? '';
    final localMeta = ProductLocalMetaService.getMeta(pId);

    // Check if cost_lak or costKip was explicitly provided
    final int? explicitCostLak =
        (json['cost_lak'] as num?)?.toInt() ??
        (json['costLak'] as num?)?.toInt() ??
        (json['cost_kip'] as num?)?.toInt() ??
        (json['costKip'] as num?)?.toInt() ??
        localMeta?['costKip'];

    int costBase = rawCostBase;
    int cKip = 0;

    if (explicitCostLak != null && explicitCostLak > 0) {
      cKip = explicitCostLak;
      costBase = effCartonMul > 0 ? (cKip / effCartonMul).round() : cKip;
    } else if (rawCostBase > 0) {
      // Self-healing check for legacy products saved with old bug:
      // If rawCostBase in DB was mistakenly saved as carton cost (e.g. 280,000)
      // for a multi-tier product whose carton multiplier > 1 (e.g. 8):
      final int cartonRetail = cU?.retailPrice ?? 0;
      if (effCartonMul > 1 &&
          (cartonRetail > 0
              ? rawCostBase > (cartonRetail * 0.4)
              : rawCostBase > 50000)) {
        // rawCostBase in DB is already the carton cost (280,000)!
        cKip = rawCostBase;
        costBase = (rawCostBase / effCartonMul).round(); // 35,000
      } else {
        // Normal case: rawCostBase is true base unit cost (35,000)
        costBase = rawCostBase;
        cKip = rawCostBase * effCartonMul; // 35,000 * 8 = 280,000
      }
    }
    if (cKip == 0 && costBase > 0) cKip = costBase;

    // Baht cost: priority cost_thb -> cost_baht -> localMeta -> strictly 0 if domestic
    int cBaht =
        (json['cost_thb'] as num?)?.toInt() ??
        (json['cost_baht'] as num?)?.toInt() ??
        (json['costBaht'] as num?)?.toInt() ??
        (json['costThb'] as num?)?.toInt() ??
        localMeta?['costBaht'] ??
        0;

    return Product(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      category: resolvedCategory,
      categoryId: resolvedCategoryId,
      barcode: json['barcode']?.toString(),
      imageUrl: json['image_url']?.toString(),
      baseUnit: json['base_unit']?.toString() ?? 'ແພັກ',
      costPerBaseUnit: costBase,
      costBaht: cBaht,
      costKip: cKip,
      currentStockBaseUnits:
          (json['current_stock_base_units'] as num?)?.toInt() ?? 0,
      trackStock: json['track_stock'] as bool? ?? true,
      allowNegativeStock:
          json['allow_negative_stock'] as bool? ??
          json['allowNegativeStock'] as bool? ??
          true,
      hasCrateDeposit:
          json['has_crate_deposit'] as bool? ??
          json['hasCrateDeposit'] as bool? ??
          false,
      crateDepositFee:
          (json['crate_deposit_fee'] as num?)?.toInt() ??
          (json['crateDepositFee'] as num?)?.toInt() ??
          30000,
      tier1Active: hasCarton,
      tier2Active: hasPack,
      tier3Active: hasPiece,
      packsPerCarton: packsPerC > 0 ? packsPerC : 8,
      piecesPerPack: piecesPerP > 0 ? piecesPerP : 6,
      units: unitsList,
    );
  }
}
