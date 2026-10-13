/// Complete Lao Language Dictionary for MeiiShop POS
/// Target Locale: lo_LA (ພາສາລາວ)
class LaoStrings {
  LaoStrings._();

  // App & Header
  static const String appTitle = 'MeiiShop POS';
  static const String posStation = 'ຈຸດຂາຍ';
  static const String storeName = 'ຮ້ານຄ້າ mei ຊຸບເປີມາເກັດ';
  static const String storeSubtitle = 'ຂາຍຍົກ - ຂາຍຍ່ອຍ ສິນຄ້າອຸປະໂພກ ບໍລິໂພກ';
  static const String storeAddress =
      'ຖະໜົນ ໄກສອນ ພົມວິຫານ, ບ້ານ ໂພນສະຫວ່າງ, ນະຄອນຫຼວງວຽງຈັນ';
  static const String storeTel = 'ໂທ: 020 5555 9999 / 021 214 555';
  static const String cashier = 'ພະນັກງານຂາຍ';
  static const String terminal = 'ເຄື່ອງຂາຍ';
  static const String onlineStatus = 'ອອນລາຍ (Sync ແລ້ວ)';
  static const String offlineStatus = 'ອອຟລາຍ (ບັນທຶກໄວ້ໃນເຄື່ອງ)';

  // Navigation & Tabs
  static const String products = 'ລາຍການສິນຄ້າ';
  static const String cart = 'ກະຕ່າສິນຄ້າ';
  static const String transactions = 'ປະຫວັດການຂາຍ';
  static const String profitReport = 'ລາຍງານກຳໄລ';
  static const String settings = 'ຕັ້ງຄ່າ';

  // Sale Modes
  static const String retail = 'ຂາຍຍ່ອຍ';
  static const String wholesale = 'ຂາຍສົ່ງ';
  static const String retailModeDesc = 'ລາຄາຂາຍຍ່ອຍມາດຕະຖານ';
  static const String wholesaleModeDesc = 'ລາຄາຂາຍສົ່ງຍົກແກັດ / ຍົກແພັກ';

  // Categories
  static const String catAll = 'ທັງໝົດ';
  static const String catBeverages = 'ເຄື່ອງດື່ມ';
  static const String catSnacks = 'ເຂົ້າໜົມ/ອາຫານຫວ່າງ';
  static const String catDryGoods = 'ເຄື່ອງປຸງ/ອາຫານແຫ້ງ';
  static const String catBeerAlcohol = 'ເບຍ/ເຄື່ອງດື່ມມີທາດເຫຼົ້າ';
  static const String catHousehold = 'ເຄື່ອງໃຊ້ທົ່ວໄປ';
  static const String catRiceGrains = 'ເຂົ້າສານ/ອາຫານຫຼັກ';
  static const String catDairyChilled = 'ນົມ/ເຄື່ອງເຢັນ';

  // Units
  static const String unitCarton = 'ແກັດ';
  static const String unitPack = 'ແພັກ';
  static const String unitPiece = 'ອັນ';
  static const String unitCan = 'ກະປ໋ອງ';
  static const String unitBottle = 'ແກ້ວ';
  static const String unitBag = 'ຖົງ';
  static const String unitBox = 'ກ່ອງ';

  // Inventory & Stock
  static const String inStock = 'ສາງ';
  static const String outOfStock = 'ສິນຄ້າໝົດ';
  static const String untrackedStock = 'ບໍ່ນັບສາງ';
  static const String baseUnit = 'ຫົວໜ່ວຍຫຼັກ';
  static const String conversionRate = 'ອັດຕາຄູນ';
  static const String costPerBaseUnit = 'ຕົ້ນທຶນ/ຫົວໜ່ວຍ';

  // Search & Barcode
  static const String searchHint = 'ຄົ້ນຫາຊື່ສິນຄ້າ ຫຼື ຍິງບາໂຄດ...';
  static const String scanBarcode = 'ຍິງບາໂຄດ';
  static const String productNotFound = 'ບໍ່ພົບລາຍການສິນຄ້າ';

  // Customer Management
  static const String customer = 'ລູກຄ້າ';
  static const String generalCustomer = 'ລູກຄ້າທົ່ວໄປ';
  static const String regularCustomer = 'ລູກຄ້າປະຈຳ';
  static const String selectCustomer = 'ເລືອກລູກຄ້າ';

  // Cart & Line Items
  static const String emptyCart = 'ບໍ່ມີສິນຄ້າໃນກະຕ່າ';
  static const String emptyCartHint =
      'ກະລຸນາເລືອກສິນຄ້າຈາກເມນູດ້ານຊ້າຍ ຫຼື ຍິງບາໂຄດ';
  static const String clearCart = 'ລ້າງກະຕ່າ';
  static const String confirmClearCart = 'ທ່ານຕ້ອງການລ້າງກະຕ່າທັງໝົດແທ້ບໍ່?';
  static const String holdOrder = 'ພັກບິນ';
  static const String recallOrder = 'ເອີ້ນບິນຄືນ';
  static const String quantity = 'ຈຳນວນ';
  static const String unitPrice = 'ລາຄາ/ໜ່ວຍ';
  static const String lineTotal = 'ລວມ';

  // Price Override
  static const String overridePrice = 'ປັບລາຄາພິເສດ';
  static const String originalPrice = 'ລາຄາເດີມ';
  static const String customPrice = 'ລາຄາໃໝ່';
  static const String discountAmount = 'ສ່ວນຫຼຸດ';
  static const String overrideReason = 'ເຫດຜົນ (ລູກຄ້າປະຈຳ)';
  static const String applyPrice = 'ນຳໃຊ້ລາຄາ';
  static const String resetPrice = 'ລາຄາເດີມ';

  // Financial & Order Summary
  static const String subtotal = 'ລວມຍ່ອຍ';
  static const String discount = 'ສ່ວນຫຼຸດລວມ';
  static const String total = 'ລວມທັງໝົດ';
  static const String netTotal = 'ຍອດຊຳລະສຸດທິ';
  static const String totalItems = 'ຈຳນວນລາຍການ';
  static const String totalQuantity = 'ຈຳນວນຊິ້ນລວມ';

  // Payment & Tender
  static const String pay = 'ຊຳລະເງິນ';
  static const String payAmount = 'ຍອດຊຳລະ';
  static const String cash = 'ເງິນສົດ';
  static const String transfer = 'ເງິນໂອນ (QR)';
  static const String bcelOne = 'BCEL One / Lao QR';
  static const String receivedAmount = 'ເງິນທີ່ໄດ້ຮັບ';
  static const String change = 'ເງິນທອນ';
  static const String exactCash = 'ພໍດີ';
  static const String insufficientPayment = 'ຍັງຂາດເງິນອີກ';
  static const String confirmPayment = 'ຢືນຢັນການຊຳລະເງິນ';
  static const String paymentSuccess = 'ການຂາຍສຳເລັດແລ້ວ';

  // Receipt & Printing
  static const String receipt = 'ໃບບິນ';
  static const String receiptNo = 'ເລກບິນ';
  static const String date = 'ວັນທີ';
  static const String time = 'ເວລາ';
  static const String printReceipt = 'ພິມໃບບິນ';
  static const String reprinting = 'ພິມໃບບິນຄືນ';
  static const String openDrawer = 'ເປີດລິ້ນຊັກເງິນ';
  static const String printerConnected = 'ເຊື່ອມຕໍ່ເຄື່ອງພິມແລ້ວ';
  static const String printerDisconnected = 'ບໍ່ສາມາດເຊື່ອມຕໍ່ເຄື່ອງພິມ';
  static const String printingInProgress = 'ກຳລັງພິມໃບບິນ...';
  static const String thankYouMsg = 'ຂອບໃຈທີ່ອຸດໜູນ';
  static const String welcomeBackMsg = 'ໂອກາດໜ້າເຊີນໃໝ່ເດີ';

  // Profit & Analytics
  static const String dailyProfit = 'ກຳໄລ ປະຈຳວັນ';
  static const String weeklyProfit = 'ກຳໄລ ປະຈຳອາທິດ';
  static const String monthlyProfit = 'ກຳໄລ ປະຈຳເດືອນ';
  static const String totalRevenue = 'ຍອດຂາຍລວມ';
  static const String totalCost = 'ຕົ້ນທຶນລວມ';
  static const String grossProfit = 'ກຳໄລຂັ້ນຕົ້ນ';
  static const String profitMargin = 'ອັດຕາກຳໄລ (%)';
  static const String totalOrders = 'ຈຳນວນບິນຂາຍ';

  // Common UI Actions
  static const String cancel = 'ຍົກເລີກ';
  static const String confirm = 'ຕົກລົງ';
  static const String close = 'ປິດ';
  static const String save = 'ບັນທຶກ';
  static const String delete = 'ລຶບ';
  static const String select = 'ເລືອກ';
  static const String edit = 'ແກ້ໄຂ';
}
