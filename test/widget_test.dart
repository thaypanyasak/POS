import 'package:flutter_test/flutter_test.dart';
import 'package:meiishop/core/localization/lao_currency_formatter.dart';
import 'package:meiishop/domain/models/cart_item.dart';
import 'package:meiishop/domain/models/product.dart';
import 'package:meiishop/domain/models/product_unit.dart';
import 'package:meiishop/domain/models/sale_transaction.dart';

void main() {
  group('LaoCurrencyFormatter Tests (Dot Separator & Strict Profit States)', () {
    test('Formats integer Kip with dot separators and NO decimals', () {
      expect(LaoCurrencyFormatter.format(545000), '545.000 ₭');
      expect(LaoCurrencyFormatter.format(15000), '15.000 ₭');
      expect(LaoCurrencyFormatter.format(0), '0 ₭');
      expect(LaoCurrencyFormatter.format(1250000), '1.250.000 ₭');
    });

    test('Parses Lao currency string with dots cleanly', () {
      expect(LaoCurrencyFormatter.parse('545.000 ₭'), 545000);
      expect(LaoCurrencyFormatter.parse('15.000 ກີບ'), 15000);
      expect(LaoCurrencyFormatter.parse('100.000'), 100000);
      expect(LaoCurrencyFormatter.parse('100000'), 100000);
    });

    test('Strict 3-State Profit Formatting (Gain, Loss, Break-even)', () {
      // Gain (> 0): +20.000 ₭
      expect(LaoCurrencyFormatter.formatProfit(20000), '+20.000 ₭');
      // Loss (< 0): -15.000 ₭ (never +-)
      expect(LaoCurrencyFormatter.formatProfit(-15000), '-15.000 ₭');
      // Break-even (== 0): 0 ₭
      expect(LaoCurrencyFormatter.formatProfit(0), '0 ₭');
    });

    test('Calculates change correctly in Lao Kip', () {
      expect(LaoCurrencyFormatter.calculateChange(600000, 545000), 55000);
      expect(LaoCurrencyFormatter.calculateChange(500000, 545000), 0);
    });

    test('Breaks down change into optimal Lao banknotes', () {
      // 55,000 ₭ change = 1 x 50,000 + 1 x 5,000
      final breakdown = LaoCurrencyFormatter.breakdownChange(55000);
      expect(breakdown[50000], 1);
      expect(breakdown[5000], 1);
    });
  });

  group('Dynamic 2-Tier Unit & Compound Stock Formatter Tests (Beer vs Snacks)', () {
    // Example A: Beer (1 ແກັດ = 24 ແກ້ວ, 30 bottles in stock)
    final beerProduct = Product(
      id: 'p_beer',
      name: 'Beerlao Bottle 640ml',
      category: 'Beer',
      baseUnit: 'ແກ້ວ',
      costPerBaseUnit: 10000,
      currentStockBaseUnits: 30, // 30 ~/ 24 = 1 box, 30 % 24 = 6 bottles
      trackStock: true,
      units: const [
        ProductUnit(
          id: 'u_beer_sub',
          productId: 'p_beer',
          unitName: 'ແກ້ວ',
          multiplier: 1,
          retailPrice: 15000,
          wholesalePrice: 13500,
          isBaseUnit: true,
        ),
        ProductUnit(
          id: 'u_beer_carton',
          productId: 'p_beer',
          unitName: 'ແກັດ',
          multiplier: 24,
          retailPrice: 300000,
          wholesalePrice: 280000,
        ),
      ],
    );

    // Example B: Snacks (1 ແກັດ = 7 ແພັກ, 23 packs in stock)
    final snackProduct = Product(
      id: 'p_snack',
      name: 'Choco Snack',
      category: 'Snack',
      baseUnit: 'ແພັກ',
      costPerBaseUnit: 10000,
      currentStockBaseUnits: 23, // 23 ~/ 7 = 3 boxes, 23 % 7 = 2 packs
      trackStock: true,
      units: const [
        ProductUnit(
          id: 'u_snack_sub',
          productId: 'p_snack',
          unitName: 'ແພັກ',
          multiplier: 1,
          retailPrice: 13000,
          wholesalePrice: 12000,
          isBaseUnit: true,
        ),
        ProductUnit(
          id: 'u_snack_carton',
          productId: 'p_snack',
          unitName: 'ແກັດ',
          multiplier: 7,
          retailPrice: 85000,
          wholesalePrice: 80000,
        ),
      ],
    );

    test('Beer Formats compound stock dynamically (1 ແກັດ 6 ແກ້ວ)', () {
      expect(beerProduct.compoundStockFormatted, '1 ແກັດ 6 ແກ້ວ');
    });

    test('Snacks Formats compound stock dynamically (3 ແກັດ 2 ແພັກ)', () {
      expect(snackProduct.compoundStockFormatted, '3 ແກັດ 2 ແພັກ');
    });

    test('Exact cartons with zero loose units displays carton only', () {
      final exactBeer = beerProduct.copyWith(currentStockBaseUnits: 48); // 48 ~/ 24 = 2, 0 loose
      expect(exactBeer.compoundStockFormatted, '2 ແກັດ');
    });

    test('Loose units less than one carton displays loose units only', () {
      final looseBeer = beerProduct.copyWith(currentStockBaseUnits: 15);
      expect(looseBeer.compoundStockFormatted, '15 ແກ້ວ');
    });

    test('Handles untracked stock gracefully', () {
      final untracked = beerProduct.copyWith(trackStock: false);
      expect(untracked.compoundStockFormatted, 'ບໍ່ນັບສາງ');
    });

    test('Handles out of stock with dynamic baseUnit name', () {
      final outOfStockBeer = beerProduct.copyWith(currentStockBaseUnits: 0);
      expect(outOfStockBeer.compoundStockFormatted, 'ໝົດສາງ (0 ແກ້ວ)');

      final outOfStockSnack = snackProduct.copyWith(currentStockBaseUnits: 0);
      expect(outOfStockSnack.compoundStockFormatted, 'ໝົດສາງ (0 ແພັກ)');
    });
  });

  group('Cost Splitting & Profit Formulas', () {
    test('Calculates carton purchase cost splitting into base unit cost', () {
      // Beer: Carton cost 240,000 / 24 = 10,000 per bottle
      const int beerCartonCost = 240000;
      const int beerMultiplier = 24;
      final int beerBaseCost = (beerCartonCost / beerMultiplier).round();
      expect(beerBaseCost, 10000);

      // Snack: Carton cost 70,000 / 7 = 10,000 per pack
      const int snackCartonCost = 70000;
      const int snackMultiplier = 7;
      final int snackBaseCost = (snackCartonCost / snackMultiplier).round();
      expect(snackBaseCost, 10000);
    });

    test('Calculates retail profit correctly', () {
      final product = Product(
        id: 'p_beer',
        name: 'Beerlao Bottle 640ml',
        category: 'Beer',
        baseUnit: 'ແກ້ວ',
        costPerBaseUnit: 10000,
        currentStockBaseUnits: 100,
        units: const [
          ProductUnit(
            id: 'u_sub',
            productId: 'p_beer',
            unitName: 'ແກ້ວ',
            multiplier: 1,
            retailPrice: 15000,
            wholesalePrice: 13500,
            isBaseUnit: true,
          ),
          ProductUnit(
            id: 'u_carton',
            productId: 'p_beer',
            unitName: 'ແກັດ',
            multiplier: 24,
            retailPrice: 300000,
            wholesalePrice: 280000,
          ),
        ],
      );

      final item = CartItem(
        id: 'c1',
        product: product,
        selectedUnit: product.subTierUnit,
        quantity: 2,
        isWholesaleMode: false,
      );

      // Unit cost = 10,000 * 1 = 10,000
      // Unit retail price = 15,000
      // Line profit = (15,000 - 10,000) * 2 = 10,000
      expect(item.unitCost, 10000);
      expect(item.lineTotal, 30000);
      expect(item.lineProfit, 10000);
      expect(item.totalBaseUnitsDeducted, 2);
    });
  });

  group('User Specification Workflows (Single Price Grocery & Beer Crate)', () {
    test('Grocery Mode: 500.000 carton cost, 8 packs, pack price 70.000, carton price 500.000', () {
      const int cartonCost = 500000;
      const int packsPerCarton = 8;
      final int packCost = (cartonCost / packsPerCarton).round(); // 62.500

      expect(packCost, 62500);

      final groceryProduct = Product(
        id: 'p_snack_user',
        name: 'ເຂົ້າໜົມທົ່ວໄປ',
        category: 'ເຂົ້າໜົມ/ອາຫານຫວ່າງ',
        baseUnit: 'ແພັກ',
        costPerBaseUnit: packCost,
        currentStockBaseUnits: 20, // 2 cartons + 4 packs
        trackStock: true,
        units: const [
          ProductUnit(
            id: 'u_pack',
            productId: 'p_snack_user',
            unitName: 'ແພັກ',
            multiplier: 1,
            retailPrice: 70000,
            wholesalePrice: 70000,
            isBaseUnit: true,
          ),
          ProductUnit(
            id: 'u_carton',
            productId: 'p_snack_user',
            unitName: 'ແກັດ',
            multiplier: 8,
            retailPrice: 500000,
            wholesalePrice: 500000,
          ),
        ],
      );

      // Verify stock formatting
      expect(groceryProduct.compoundStockFormatted, '2 ແກັດ 4 ແພັກ');

      // Verify pack profit (+7.500 ₭)
      final packProfit = groceryProduct.subTierUnit.retailPrice - groceryProduct.costPerBaseUnit;
      expect(packProfit, 7500);
      expect(LaoCurrencyFormatter.formatProfit(packProfit), '+7.500 ₭');

      // Verify carton profit (500.000 - 500.000 = 0 ₭ break-even)
      final cartonProfit = groceryProduct.cartonTierUnit.retailPrice - cartonCost;
      expect(cartonProfit, 0);
      expect(LaoCurrencyFormatter.formatProfit(cartonProfit), '0 ₭');
    });

    test('Beer Mode: Sold strictly by Crate (ລັງ), single price, 24 bottles capacity', () {
      const int crateCost = 240000;
      const int crateSellingPrice = 265000;
      const int crateStock = 50;

      final beerProduct = Product(
        id: 'p_beer_user',
        name: 'ເບຍລາວ ຂວດໃຫຍ່',
        category: 'ເບຍ/ເຄື່ອງດື່ມມີທາດເຫຼົ້າ',
        baseUnit: 'ລັງ',
        costPerBaseUnit: crateCost,
        currentStockBaseUnits: crateStock,
        trackStock: true,
        units: const [
          ProductUnit(
            id: 'u_beer_crate',
            productId: 'p_beer_user',
            unitName: 'ລັງ',
            multiplier: 1,
            retailPrice: crateSellingPrice,
            wholesalePrice: crateSellingPrice,
            isBaseUnit: true,
          ),
        ],
      );

      // Verify compound stock formatting displays crates directly
      expect(beerProduct.compoundStockFormatted, '50 ລັງ');

      // Verify profit per crate (+25.000 ₭)
      final crateProfit = crateSellingPrice - crateCost;
      expect(crateProfit, 25000);
      expect(LaoCurrencyFormatter.formatProfit(crateProfit), '+25.000 ₭');

      // Verify single unit behavior
      expect(beerProduct.units.length, 1);
      expect(beerProduct.subTierUnit.unitName, 'ລັງ');
      expect(beerProduct.cartonTierUnit.unitName, 'ລັງ');
    });
  });

  group('SaleTransaction Persistence & Serialization Tests', () {
    test('Serializes and deserializes SaleTransaction cleanly with Customer Name', () {
      final product = Product(
        id: 'p_test',
        name: 'ເຂົ້າໜົມ Layz',
        category: 'Snack',
        baseUnit: 'ແພັກ',
        costPerBaseUnit: 50000,
        currentStockBaseUnits: 10,
        units: const [
          ProductUnit(
            id: 'u_1',
            productId: 'p_test',
            unitName: 'ແພັກ',
            multiplier: 1,
            retailPrice: 70000,
            wholesalePrice: 65000,
            isBaseUnit: true,
          ),
        ],
      );

      final item = CartItem(
        id: 'ci_1',
        product: product,
        selectedUnit: product.defaultBaseUnit,
        quantity: 2,
      );

      final tx = SaleTransaction(
        id: 'tx_001',
        receiptNumber: 'RC-20261014-0001',
        createdAt: DateTime(2026, 10, 14, 1, 30),
        items: [item],
        isWholesale: false,
        customer: const PosCustomer(id: 'c_1', name: 'ແມ່ຄ້າ ວຽງທອງ'),
        paymentMethod: PaymentMethod.qrTransfer,
        subtotal: 140000,
        discountTotal: 0,
        grandTotal: 140000,
        amountTendered: 140000,
        changeAmount: 0,
        totalCostOfGoods: 100000,
        grossProfit: 40000,
      );

      final json = tx.toJson();
      final restored = SaleTransaction.fromJson(json);

      expect(restored.id, 'tx_001');
      expect(restored.receiptNumber, 'RC-20261014-0001');
      expect(restored.customer.name, 'ແມ່ຄ້າ ວຽງທອງ');
      expect(restored.paymentMethod, PaymentMethod.qrTransfer);
      expect(restored.grandTotal, 140000);
      expect(restored.grossProfit, 40000);
      expect(restored.items.length, 1);
      expect(restored.items.first.product.name, 'ເຂົ້າໜົມ Layz');
    });
  });
}

