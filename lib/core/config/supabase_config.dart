/// Supabase Configuration for MeiiShop
///
/// ວິທີເອົາຂໍ້ມູນຈາກ Supabase Dashboard:
/// 1. ເຂົ້າໄປທີ່ https://supabase.com/dashboard -> ເລືອກ Project ຂອງທ່ານ
/// 2. ໄປທີ່ Project Settings -> API
/// 3. ກັອບປີ້ "Project URL" ມາໃສ່ທີ່ [supabaseUrl]
/// 4. ກັອບປີ້ "Project API Keys" (anon public) ມາໃສ່ທີ່ [supabaseAnonKey]
class SupabaseConfig {
  SupabaseConfig._();

  /// ຕົວຢ່າງ: 'https://xyzcompany.supabase.co'
  static const String supabaseUrl = 'https://qanphpmphnipyuwcadwz.supabase.co';

  /// ຕົວຢ່າງ: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  static const String supabaseAnonKey =
      'sb_publishable_zQw2L3JfnT-5o_-tJgZaIA_WETQFTPq';

  /// ກວດສອບວ່າມີການໃສ່ຄ່າ URL ແລະ Key ແລ້ວຫຼືບໍ່
  static bool get isConfigured =>
      supabaseUrl.isNotEmpty &&
      !supabaseUrl.contains('YOUR_SUPABASE_URL') &&
      supabaseAnonKey.isNotEmpty &&
      !supabaseAnonKey.contains('YOUR_SUPABASE_ANON_KEY');
}
