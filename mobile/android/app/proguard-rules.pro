# Flutter Wrapper
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.**  { *; }
-keep class io.flutter.util.**  { *; }
-keep class io.flutter.view.**  { *; }
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.**  { *; }

# Flutter Secure Storage & Crypto
-keep class androidx.security.crypto.** { *; }
-keep class com.it_nomads.fluttersecurestorage.** { *; }

# Local Auth & Biometrics
-keep class io.flutter.plugins.localauth.** { *; }
-keep class androidx.biometric.** { *; }

# Google Fonts & Assets
-dontwarn com.google.common.**
-dontwarn com.google.android.gms.**

# Proguard optimization
-dontobfuscate
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
