// ignore_for_file: avoid_print, depend_on_referenced_packages
import 'package:supabase/supabase.dart';

void main() async {
  const url = 'https://qanphpmphnipyuwcadwz.supabase.co';
  const key = 'sb_publishable_zQw2L3JfnT-5o_-tJgZaIA_WETQFTPq';

  print('🔍 ກຳລັງກວດສອບການເຊື່ອມຕໍ່ Supabase...');
  print('📍 URL: $url');
  print('🔑 Key: $key\n');

  final client = SupabaseClient(url, key);

  try {
    // 1. Check 'products' table
    final products = await client.from('products').select().limit(5);
    print('✅ [1/4] ຕາຕະລາງ "products": ເຊື່ອມຕໍ່ສຳເລັດ! (ພົບ ${products.length} ລາຍການ)');

    // 2. Check 'product_units' table
    final units = await client.from('product_units').select().limit(5);
    print('✅ [2/4] ຕາຕະລາງ "product_units": ເຊື່ອມຕໍ່ສຳເລັດ! (ພົບ ${units.length} ລາຍການ)');

    // 3. Check 'sale_transactions' table
    final txs = await client.from('sale_transactions').select().limit(5);
    print('✅ [3/4] ຕາຕະລາງ "sale_transactions": ເຊື່ອມຕໍ່ສຳເລັດ! (ພົບ ${txs.length} ລາຍການ)');

    // 4. Check 'sale_transaction_items' table
    final items = await client.from('sale_transaction_items').select().limit(5);
    print('✅ [4/4] ຕາຕະລາງ "sale_transaction_items": ເຊື່ອມຕໍ່ສຳເລັດ! (ພົບ ${items.length} ລາຍການ)');

    // 5. Test Write & Delete (RLS Policy check)
    const testId = 'test_ping_001';
    await client.from('products').upsert({
      'id': testId,
      'name': 'ທົດສອບການເຊື່ອມຕໍ່ (Ping Test)',
      'category': 'ທົດສອບ',
      'base_unit': 'ອັນ',
      'cost_per_base_unit': 1000,
      'current_stock_base_units': 10,
      'track_stock': false,
    });
    print('✅ [5/5] ທົດສອບການຂຽນຂໍ້ມູນ (Write/Insert): ສຳເລັດ 100%!');

    // Clean up
    await client.from('products').delete().eq('id', testId);
    print('🧹 ລຶບຂໍ້ມູນທົດສອບຮຽບຮ້ອຍ!');

    print('\n🎉 ສະຫຼຸບ: ການເຊື່ອມຕໍ່ Supabase Database ແມ່ນ **ຜ່ານ 100%**! ພ້ອມໃຊ້ງານ!');
  } catch (e) {
    print('❌ ເກີດຂໍ້ຜິດພາດ: $e');
  }
}
