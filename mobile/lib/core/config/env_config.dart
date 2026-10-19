enum AppEnvironment {
  development,
  staging,
  production,
}

class EnvConfig {
  final AppEnvironment environment;
  final String apiBaseUrl;
  final int connectTimeoutMs;
  final int receiveTimeoutMs;
  final bool enableVerboseLogging;

  const EnvConfig({
    required this.environment,
    required this.apiBaseUrl,
    this.connectTimeoutMs = 15000,
    this.receiveTimeoutMs = 15000,
    this.enableVerboseLogging = false,
  });

  static EnvConfig fromEnvironment() {
    const envString = String.fromEnvironment('ENV', defaultValue: 'development');
    switch (envString.toLowerCase()) {
      case 'production':
      case 'prod':
        return const EnvConfig(
          environment: AppEnvironment.production,
          apiBaseUrl: 'https://api.docunexa.com/api/v1',
          connectTimeoutMs: 10000,
          receiveTimeoutMs: 10000,
          enableVerboseLogging: false,
        );
      case 'staging':
        return const EnvConfig(
          environment: AppEnvironment.staging,
          apiBaseUrl: 'https://staging-api.docunexa.com/api/v1',
          connectTimeoutMs: 15000,
          receiveTimeoutMs: 15000,
          enableVerboseLogging: true,
        );
      case 'development':
      default:
        // Default to local development server on port 8080 (10.0.2.2 for Android emulator)
        const host = String.fromEnvironment('API_HOST', defaultValue: '10.0.2.2');
        const port = String.fromEnvironment('API_PORT', defaultValue: '8080');
        return EnvConfig(
          environment: AppEnvironment.development,
          apiBaseUrl: 'http://$host:$port/api/v1',
          connectTimeoutMs: 20000,
          receiveTimeoutMs: 20000,
          enableVerboseLogging: true,
        );
    }
  }
}
