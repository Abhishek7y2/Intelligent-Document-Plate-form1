import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'core/di/injection_container.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/presentation/bloc/auth_bloc.dart';
import 'features/auth/presentation/bloc/auth_event.dart';

class DocuNexaApp extends StatelessWidget {
  const DocuNexaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<AuthBloc>.value(
      value: sl<AuthBloc>()..add(const AuthCheckRequested()),
      child: MaterialApp.router(
        title: 'DocuNexa Mobile',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        darkTheme: AppTheme.darkTheme,
        themeMode: ThemeMode.dark, // Default to Dark Slate enterprise theme
        routerConfig: AppRouter.router,
      ),
    );
  }
}
