# Phase 6 Plan: Build & Release

<task type="auto">
  <name>Dependency Resolution</name>
  <files>mobile/pubspec.yaml</files>
  <action>
    - Navigate to `mobile` directory.
    - Run `flutter pub get` to ensure all dependencies are resolved and the environment is ready.
  </action>
  <verify>Check for 'Exit code: 0' and no dependency resolution errors.</verify>
  <done>Dependencies are fully resolved.</done>
</task>

<task type="auto">
  <name>Generate Release APK</name>
  <files>mobile/android/</files>
  <action>
    - Run `flutter build apk --release`.
    - This will generate the production-ready APK in `build/app/outputs/flutter-apk/app-release.apk`.
  </action>
  <verify>Check for 'Built build/app/outputs/flutter-apk/app-release.apk' in output.</verify>
  <done>APK is successfully generated.</done>
</task>

<task type="auto">
  <name>Git Persistence</name>
  <files>N/A</files>
  <action>
    - Add all changes: `git add .`
    - Commit the fix and build state: `git commit -m "feat: stabilize notification system and generate release APK"`
    - Push to remote: `git push origin main`
  </action>
  <verify>Run `git status` to ensure clean working directory.</verify>
  <done>Code is pushed and remote is up to date.</done>
</task>
