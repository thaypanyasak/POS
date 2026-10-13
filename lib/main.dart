import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/config/supabase_config.dart';
import 'core/localization/lo.dart';
import 'core/theme/app_theme.dart';
import 'data/local/pos_database.dart';
import 'data/remote/supabase_sync_service.dart';
import 'features/navigation/main_shell.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 1. Strictly lock orientation to Landscape for iPad / Tablet POS Workstation
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);

  // 2. Initialize local offline storage
  await PosDatabase.instance.init();

  // 3. Initialize Supabase cloud sync if configured
  if (SupabaseConfig.isConfigured) {
    await SupabaseSyncService.initialize(
      supabaseUrl: SupabaseConfig.supabaseUrl,
      supabaseAnonKey: SupabaseConfig.supabaseAnonKey,
    );
  }

  // 4. Set immersive system UI overlays for tablet POS
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      systemNavigationBarColor: Colors.white,
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
  );

  runApp(
    const ProviderScope(
      child: MeiiShopApp(),
    ),
  );
}

class MeiiShopApp extends StatelessWidget {
  const MeiiShopApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: LaoStrings.appTitle,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: const MainShell(),
    );
  }
}
