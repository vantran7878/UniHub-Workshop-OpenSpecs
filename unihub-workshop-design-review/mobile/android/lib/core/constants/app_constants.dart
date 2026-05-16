class AppConstants {
  // Supabase Configuration
  static const String supabaseUrl = 'https://ogltevujqghnlgepbpgd.supabase.co';
  static const String supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nbHRldnVqcWdobmxnZXBicGdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NzcwOTQsImV4cCI6MjA5NDI1MzA5NH0.j57N29nAJShmUM9o6EKranFWmtd5BLXIocNhNGBrOc8';
  static const String supabaseProjectId = 'ogltevujqghnlgepbpgd';

  // App Information
  static const String appName = 'UniHub Workshop';
  static const String appVersion = '1.0.0';

  // API Endpoints
  static const String baseUrl = 'https://ogltevujqghnlgepbpgd.supabase.co/rest/v1';

  // Timeouts
  static const Duration apiTimeout = Duration(seconds: 30);
  static const Duration connectionTimeout = Duration(seconds: 15);

  // Pagination
  static const int pageSize = 20;

  // Cache Duration
  static const Duration cacheDuration = Duration(hours: 1);
  static const Duration userCacheDuration = Duration(minutes: 30);

  // URLs
  static const String websiteUrl = 'https://unihub.edu.vn';
  static const String privacyPolicyUrl = '$websiteUrl/privacy';
  static const String termsOfServiceUrl = '$websiteUrl/terms';
}
