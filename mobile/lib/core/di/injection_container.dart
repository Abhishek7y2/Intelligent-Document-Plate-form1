import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:get_it/get_it.dart';

import '../../features/auth/data/datasources/auth_remote_data_source.dart';
import '../../features/auth/data/repositories/auth_repository_impl.dart';
import '../../features/auth/domain/repositories/auth_repository.dart';
import '../../features/auth/presentation/bloc/auth_bloc.dart';
import '../../features/auth/presentation/bloc/auth_event.dart';
import '../../features/dashboard/data/datasources/dashboard_remote_data_source.dart';
import '../../features/dashboard/data/repositories/dashboard_repository_impl.dart';
import '../../features/dashboard/domain/repositories/dashboard_repository.dart';
import '../../features/dashboard/presentation/bloc/dashboard_bloc.dart';
import '../../features/documents/data/datasources/document_remote_data_source.dart';
import '../../features/documents/data/repositories/document_repository_impl.dart';
import '../../features/documents/domain/repositories/document_repository.dart';
import '../../features/documents/presentation/bloc/document_catalog_bloc.dart';
import '../../features/documents/presentation/bloc/document_detail_bloc.dart';
import '../../features/intake/data/datasources/intake_remote_data_source.dart';
import '../../features/intake/data/repositories/intake_repository_impl.dart';
import '../../features/intake/data/services/document_scanner_service.dart';
import '../../features/intake/data/services/file_picker_service.dart';
import '../../features/intake/domain/repositories/intake_repository.dart';
import '../../features/intake/presentation/bloc/intake_bloc.dart';
import '../../features/approvals/data/datasources/approval_remote_data_source.dart';
import '../../features/approvals/data/repositories/approval_repository_impl.dart';
import '../../features/approvals/domain/repositories/approval_repository.dart';
import '../../features/approvals/presentation/bloc/approval_detail/approval_detail_bloc.dart';
import '../../features/approvals/presentation/bloc/approval_queue/approval_queue_bloc.dart';
import '../../features/profile/data/datasources/profile_remote_data_source.dart';
import '../../features/profile/data/repositories/profile_repository_impl.dart';
import '../../features/profile/domain/repositories/profile_repository.dart';
import '../../features/profile/presentation/bloc/profile_bloc.dart';
import '../../features/profile/presentation/bloc/session_bloc.dart';
import '../../features/review/data/datasources/review_remote_data_source.dart';
import '../../features/review/data/repositories/review_repository_impl.dart';
import '../../features/review/domain/repositories/review_repository.dart';
import '../../features/review/presentation/bloc/review_queue/review_queue_bloc.dart';
import '../../features/review/presentation/bloc/review_workbench/review_workbench_bloc.dart';
import '../../features/version_compare/data/datasources/version_compare_remote_data_source.dart';
import '../../features/version_compare/data/repositories/version_compare_repository_impl.dart';
import '../../features/version_compare/domain/repositories/version_compare_repository.dart';
import '../../features/version_compare/presentation/bloc/version_compare_bloc.dart';
import '../../features/qa/data/datasources/qa_remote_data_source.dart';
import '../../features/qa/data/repositories/qa_repository_impl.dart';
import '../../features/qa/domain/repositories/qa_repository.dart';
import '../../features/qa/presentation/bloc/qa_bloc.dart';
import '../../features/notifications/data/datasources/notification_remote_data_source.dart';
import '../../features/notifications/data/repositories/notification_repository_impl.dart';
import '../../features/notifications/domain/repositories/notification_repository.dart';
import '../../features/notifications/presentation/bloc/notification_bloc.dart';
import '../../features/tasks/data/datasources/task_remote_data_source.dart';
import '../../features/tasks/data/repositories/task_repository_impl.dart';
import '../../features/tasks/domain/repositories/task_repository.dart';
import '../../features/tasks/presentation/bloc/task_bloc.dart';
import '../../features/admin/data/datasources/admin_remote_data_source.dart';
import '../../features/admin/data/repositories/admin_repository_impl.dart';
import '../../features/admin/domain/repositories/admin_repository.dart';
import '../../features/admin/presentation/bloc/admin_bloc.dart';
import '../../features/legal_hold/data/datasources/legal_hold_remote_data_source.dart';
import '../../features/legal_hold/data/repositories/legal_hold_repository_impl.dart';
import '../../features/legal_hold/domain/repositories/legal_hold_repository.dart';
import '../../features/legal_hold/presentation/bloc/legal_hold_bloc.dart';
import '../biometrics/biometric_service.dart';
import '../config/env_config.dart';
import '../logging/app_logger.dart';
import '../network/api_client.dart';
import '../network/auth_interceptor.dart';
import '../network/correlation_interceptor.dart';
import '../storage/secure_storage_service.dart';

final sl = GetIt.instance;

Future<void> initDependencyInjection({EnvConfig? config}) async {
  // 1. Environment & Configuration
  final envConfig = config ?? EnvConfig.fromEnvironment();
  if (!sl.isRegistered<EnvConfig>()) {
    sl.registerLazySingleton<EnvConfig>(() => envConfig);
  }

  // 2. Logging
  if (!sl.isRegistered<AppLogger>()) {
    sl.registerLazySingleton<AppLogger>(() => AppLogger(
          enableDebugLogging: envConfig.enableVerboseLogging,
        ));
  }

  // 3. Secure Storage
  if (!sl.isRegistered<FlutterSecureStorage>()) {
    sl.registerLazySingleton<FlutterSecureStorage>(() => const FlutterSecureStorage(
          aOptions: AndroidOptions(encryptedSharedPreferences: true),
          iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock_this_device),
        ));
  }

  if (!sl.isRegistered<SecureStorageService>()) {
    sl.registerLazySingleton<SecureStorageService>(
      () => SecureStorageServiceImpl(sl()),
    );
  }

  // 4. Biometrics Service
  if (!sl.isRegistered<BiometricService>()) {
    sl.registerLazySingleton<BiometricService>(() => BiometricServiceImpl());
  }

  // 5. Dedicated Refresh HTTP Client (No auth interceptor attached to prevent loops)
  final refreshDio = Dio(BaseOptions(
    baseUrl: envConfig.apiBaseUrl,
    connectTimeout: Duration(milliseconds: envConfig.connectTimeoutMs),
    receiveTimeout: Duration(milliseconds: envConfig.receiveTimeoutMs),
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  ));
  refreshDio.interceptors.add(CorrelationInterceptor());

  // 6. Main HTTP Client (Dio) with Queued Token Refresh & Correlation
  if (!sl.isRegistered<Dio>()) {
    sl.registerLazySingleton<Dio>(() {
      final dio = Dio(BaseOptions(
        baseUrl: envConfig.apiBaseUrl,
        connectTimeout: Duration(milliseconds: envConfig.connectTimeoutMs),
        receiveTimeout: Duration(milliseconds: envConfig.receiveTimeoutMs),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ));

      dio.interceptors.add(CorrelationInterceptor());
      dio.interceptors.add(
        AuthInterceptor(
          storage: sl(),
          refreshDio: refreshDio,
          onSessionExpired: () {
            if (sl.isRegistered<AuthBloc>()) {
              sl<AuthBloc>().add(const SessionExpired());
            }
          },
        ),
      );

      return dio;
    });
  }

  // 7. ApiClient
  if (!sl.isRegistered<ApiClient>()) {
    sl.registerLazySingleton<ApiClient>(() => ApiClientImpl(sl()));
  }

  // 8. Remote Data Sources & Repositories
  if (!sl.isRegistered<AuthRemoteDataSource>()) {
    sl.registerLazySingleton<AuthRemoteDataSource>(
      () => AuthRemoteDataSourceImpl(sl()),
    );
  }

  if (!sl.isRegistered<AuthRepository>()) {
    sl.registerLazySingleton<AuthRepository>(
      () => AuthRepositoryImpl(
        remoteDataSource: sl(),
        secureStorage: sl(),
        biometricService: sl(),
      ),
    );
  }

  if (!sl.isRegistered<DashboardRemoteDataSource>()) {
    sl.registerLazySingleton<DashboardRemoteDataSource>(
      () => DashboardRemoteDataSourceImpl(sl()),
    );
  }

  if (!sl.isRegistered<DashboardRepository>()) {
    sl.registerLazySingleton<DashboardRepository>(
      () => DashboardRepositoryImpl(sl()),
    );
  }

  if (!sl.isRegistered<DocumentRemoteDataSource>()) {
    sl.registerLazySingleton<DocumentRemoteDataSource>(
      () => DocumentRemoteDataSourceImpl(sl()),
    );
  }

  if (!sl.isRegistered<DocumentRepository>()) {
    sl.registerLazySingleton<DocumentRepository>(
      () => DocumentRepositoryImpl(sl()),
    );
  }

  if (!sl.isRegistered<ProfileRemoteDataSource>()) {
    sl.registerLazySingleton<ProfileRemoteDataSource>(
      () => ProfileRemoteDataSourceImpl(sl()),
    );
  }

  if (!sl.isRegistered<ProfileRepository>()) {
    sl.registerLazySingleton<ProfileRepository>(
      () => ProfileRepositoryImpl(sl()),
    );
  }

  if (!sl.isRegistered<FilePickerService>()) {
    sl.registerLazySingleton<FilePickerService>(
      () => FilePickerServiceImpl(logger: sl()),
    );
  }

  if (!sl.isRegistered<DocumentScannerService>()) {
    sl.registerLazySingleton<DocumentScannerService>(
      () => DocumentScannerServiceImpl(logger: sl()),
    );
  }

  if (!sl.isRegistered<IntakeRemoteDataSource>()) {
    sl.registerLazySingleton<IntakeRemoteDataSource>(
      () => IntakeRemoteDataSourceImpl(apiClient: sl(), logger: sl()),
    );
  }

  if (!sl.isRegistered<IntakeRepository>()) {
    sl.registerLazySingleton<IntakeRepository>(
      () => IntakeRepositoryImpl(
        remoteDataSource: sl(),
        filePickerService: sl(),
        scannerService: sl(),
        logger: sl(),
      ),
    );
  }

  if (!sl.isRegistered<ReviewRemoteDataSource>()) {
    sl.registerLazySingleton<ReviewRemoteDataSource>(
      () => ReviewRemoteDataSourceImpl(sl()),
    );
  }

  if (!sl.isRegistered<ReviewRepository>()) {
    sl.registerLazySingleton<ReviewRepository>(
      () => ReviewRepositoryImpl(remoteDataSource: sl()),
    );
  }

  if (!sl.isRegistered<ApprovalRemoteDataSource>()) {
    sl.registerLazySingleton<ApprovalRemoteDataSource>(
      () => ApprovalRemoteDataSourceImpl(sl()),
    );
  }

  if (!sl.isRegistered<ApprovalRepository>()) {
    sl.registerLazySingleton<ApprovalRepository>(
      () => ApprovalRepositoryImpl(remoteDataSource: sl()),
    );
  }

  if (!sl.isRegistered<VersionCompareRemoteDataSource>()) {
    sl.registerLazySingleton<VersionCompareRemoteDataSource>(
      () => VersionCompareRemoteDataSourceImpl(sl()),
    );
  }

  if (!sl.isRegistered<VersionCompareRepository>()) {
    sl.registerLazySingleton<VersionCompareRepository>(
      () => VersionCompareRepositoryImpl(remoteDataSource: sl()),
    );
  }

  // Sprint 7: QA, Notifications & Tasks Registrations
  if (!sl.isRegistered<QaRemoteDataSource>()) {
    sl.registerLazySingleton<QaRemoteDataSource>(
      () => QaRemoteDataSourceImpl(sl()),
    );
  }

  if (!sl.isRegistered<QaRepository>()) {
    sl.registerLazySingleton<QaRepository>(
      () => QaRepositoryImpl(remoteDataSource: sl()),
    );
  }

  if (!sl.isRegistered<NotificationRemoteDataSource>()) {
    sl.registerLazySingleton<NotificationRemoteDataSource>(
      () => NotificationRemoteDataSourceImpl(sl()),
    );
  }

  if (!sl.isRegistered<NotificationRepository>()) {
    sl.registerLazySingleton<NotificationRepository>(
      () => NotificationRepositoryImpl(remoteDataSource: sl()),
    );
  }

  if (!sl.isRegistered<TaskRemoteDataSource>()) {
    sl.registerLazySingleton<TaskRemoteDataSource>(
      () => TaskRemoteDataSourceImpl(sl()),
    );
  }

  if (!sl.isRegistered<TaskRepository>()) {
    sl.registerLazySingleton<TaskRepository>(
      () => TaskRepositoryImpl(remoteDataSource: sl()),
    );
  }

  // Sprint 8: Restricted Admin & Emergency Legal Hold Registrations
  if (!sl.isRegistered<AdminRemoteDataSource>()) {
    sl.registerLazySingleton<AdminRemoteDataSource>(
      () => AdminRemoteDataSourceImpl(sl()),
    );
  }

  if (!sl.isRegistered<AdminRepository>()) {
    sl.registerLazySingleton<AdminRepository>(
      () => AdminRepositoryImpl(remoteDataSource: sl()),
    );
  }

  if (!sl.isRegistered<LegalHoldRemoteDataSource>()) {
    sl.registerLazySingleton<LegalHoldRemoteDataSource>(
      () => LegalHoldRemoteDataSourceImpl(sl()),
    );
  }

  if (!sl.isRegistered<LegalHoldRepository>()) {
    sl.registerLazySingleton<LegalHoldRepository>(
      () => LegalHoldRepositoryImpl(remoteDataSource: sl()),
    );
  }

  // 9. BLoCs
  if (!sl.isRegistered<AuthBloc>()) {
    sl.registerLazySingleton<AuthBloc>(
      () => AuthBloc(authRepository: sl()),
    );
  }

  if (!sl.isRegistered<DashboardBloc>()) {
    sl.registerFactory<DashboardBloc>(
      () => DashboardBloc(dashboardRepository: sl()),
    );
  }

  if (!sl.isRegistered<DocumentCatalogBloc>()) {
    sl.registerFactory<DocumentCatalogBloc>(
      () => DocumentCatalogBloc(documentRepository: sl()),
    );
  }

  if (!sl.isRegistered<DocumentDetailBloc>()) {
    sl.registerFactory<DocumentDetailBloc>(
      () => DocumentDetailBloc(documentRepository: sl()),
    );
  }

  if (!sl.isRegistered<IntakeBloc>()) {
    sl.registerFactory<IntakeBloc>(
      () => IntakeBloc(intakeRepository: sl()),
    );
  }

  if (!sl.isRegistered<ProfileBloc>()) {
    sl.registerFactory<ProfileBloc>(
      () => ProfileBloc(profileRepository: sl()),
    );
  }

  if (!sl.isRegistered<SessionBloc>()) {
    sl.registerFactory<SessionBloc>(
      () => SessionBloc(profileRepository: sl()),
    );
  }

  if (!sl.isRegistered<ReviewQueueBloc>()) {
    sl.registerFactory<ReviewQueueBloc>(
      () => ReviewQueueBloc(repository: sl()),
    );
  }

  if (!sl.isRegistered<ReviewWorkbenchBloc>()) {
    sl.registerFactory<ReviewWorkbenchBloc>(
      () => ReviewWorkbenchBloc(repository: sl()),
    );
  }

  if (!sl.isRegistered<ApprovalQueueBloc>()) {
    sl.registerFactory<ApprovalQueueBloc>(
      () => ApprovalQueueBloc(repository: sl()),
    );
  }

  if (!sl.isRegistered<ApprovalDetailBloc>()) {
    sl.registerFactory<ApprovalDetailBloc>(
      () => ApprovalDetailBloc(repository: sl()),
    );
  }

  if (!sl.isRegistered<VersionCompareBloc>()) {
    sl.registerFactory<VersionCompareBloc>(
      () => VersionCompareBloc(repository: sl()),
    );
  }

  if (!sl.isRegistered<QaBloc>()) {
    sl.registerFactory<QaBloc>(
      () => QaBloc(repository: sl()),
    );
  }

  if (!sl.isRegistered<NotificationBloc>()) {
    sl.registerFactory<NotificationBloc>(
      () => NotificationBloc(repository: sl()),
    );
  }

  if (!sl.isRegistered<TaskBloc>()) {
    sl.registerFactory<TaskBloc>(
      () => TaskBloc(repository: sl()),
    );
  }

  if (!sl.isRegistered<AdminBloc>()) {
    sl.registerFactory<AdminBloc>(
      () => AdminBloc(repository: sl()),
    );
  }

  if (!sl.isRegistered<LegalHoldBloc>()) {
    sl.registerFactory<LegalHoldBloc>(
      () => LegalHoldBloc(repository: sl()),
    );
  }
}

