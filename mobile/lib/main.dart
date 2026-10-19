import 'package:flutter/material.dart';
import 'app.dart';
import 'core/config/env_config.dart';
import 'core/di/injection_container.dart';
import 'core/logging/app_logger.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Environment and Dependency Injection
  final envConfig = EnvConfig.fromEnvironment();
  await initDependencyInjection(config: envConfig);

  final logger = sl<AppLogger>();
  logger.info('DocuNexa Mobile initialized in ${envConfig.environment.name} mode');

  runApp(const DocuNexaApp());
}
