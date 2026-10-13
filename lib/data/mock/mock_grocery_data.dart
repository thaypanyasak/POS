import '../../domain/models/product.dart';
import '../../domain/models/sale_transaction.dart';

/// Clean Customer and Initial Catalog
class MockGroceryData {
  MockGroceryData._();

  static List<PosCustomer> get initialCustomers => const [
    PosCustomer.walkIn,
    PosCustomer(
      id: 'cust_01',
      name: 'ລູກຄ້າປະຈຳ (ຂາຍສົ່ງ)',
      phone: '020 5511 2233',
      type: CustomerType.regular,
      note: 'ລາຄາພິເສດຍົກແກັດ / ຍົກແພັກ',
    ),
  ];

  /// Empty initial list so user only sees real products added/synced
  static List<Product> get initialProducts => [];
}
