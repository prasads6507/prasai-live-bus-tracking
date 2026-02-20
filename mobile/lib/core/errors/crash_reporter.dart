class CrashReporter {
  static void logError(dynamic exception, StackTrace? stack) {
    // TODO: Integrate Crashlytics or other service
    print('Error: $exception');
    if (stack != null) {
      print('Stack: $stack');
    }
  }
}
