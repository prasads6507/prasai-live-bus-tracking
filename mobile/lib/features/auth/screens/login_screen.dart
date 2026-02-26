import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/colors.dart';
import '../../../core/theme/typography.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/widgets/pulsing_dot.dart';
import '../controllers/auth_controller.dart';

class LoginScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic> college;
  const LoginScreen({super.key, required this.college});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _emailFocus = FocusNode();
  final _passwordFocus = FocusNode();
  bool _isPasswordVisible = false;
  bool _emailFocused = false;
  bool _passwordFocused = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _emailFocus.addListener(() => setState(() => _emailFocused = _emailFocus.hasFocus));
    _passwordFocus.addListener(() => setState(() => _passwordFocused = _passwordFocus.hasFocus));
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _emailFocus.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _errorMessage = null);
    if (_formKey.currentState!.validate()) {
      final email = _emailController.text.trim();
      final password = _passwordController.text.trim();

      await ref.read(authControllerProvider.notifier).signIn(
            email: email,
            password: password,
            college: widget.college,
          );
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AsyncValue<void>>(
      authControllerProvider,
      (_, state) {
        if (state.hasError) {
          setState(() => _errorMessage = state.error.toString());
        }
      },
    );

    final state = ref.watch(authControllerProvider);

    return AppScaffold(
      body: Stack(
        children: [
          // Gradient background
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [AppColors.bgBase, AppColors.bgDeep],
                  stops: const [0.0, 0.4],
                ),
              ),
            ),
          ),
          // Radial glow
          Positioned(
            top: -60,
            right: -60,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppColors.primary.withOpacity(0.1),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),

          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 12),
                  // Back Button
                  GestureDetector(
                    onTap: () => context.go('/college-selection'),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.arrow_back_rounded, color: AppColors.textSecondary, size: 18),
                        const SizedBox(width: 8),
                        Text(
                          'Change Organization',
                          style: AppTypography.bodyMd.copyWith(color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 40),

                  // Hero Identity Zone
                  Center(
                    child: Column(
                      children: [
                        // Glowing icon container
                        Container(
                          width: 72,
                          height: 72,
                          decoration: BoxDecoration(
                            color: AppColors.primarySoft,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: AppColors.primary.withOpacity(0.3)),
                            boxShadow: [AppShadows.primaryGlow],
                          ),
                          child: const Icon(Icons.school_rounded, color: AppColors.primary, size: 36),
                        ),
                        const SizedBox(height: 20),
                        Text(
                          widget.college['collegeName'] ?? 'Welcome',
                          style: AppTypography.h1,
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 14),
                        // Secure Badge
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                          decoration: BoxDecoration(
                            color: AppColors.live.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(100),
                            border: Border.all(color: AppColors.live.withOpacity(0.3)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const PulsingDot(color: AppColors.live, size: 6),
                              const SizedBox(width: 8),
                              Text(
                                'Secure Portal Active',
                                style: AppTypography.label.copyWith(color: AppColors.live),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 48),

                  // Section header
                  Text(
                    'SIGN IN',
                    style: AppTypography.caption.copyWith(
                      color: AppColors.textTertiary,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Error Banner
                  if (_errorMessage != null)
                    _ErrorBanner(
                      message: _errorMessage!,
                      onDismiss: () => setState(() => _errorMessage = null),
                    ),

                  // Form Card
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: AppColors.borderSubtle),
                      boxShadow: [AppShadows.cardShadow],
                    ),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Email field
                          Text('Email', style: AppTypography.label.copyWith(color: AppColors.textSecondary)),
                          const SizedBox(height: 8),
                          _GlowField(
                            isFocused: _emailFocused,
                            child: TextFormField(
                              controller: _emailController,
                              focusNode: _emailFocus,
                              keyboardType: TextInputType.emailAddress,
                              style: AppTypography.bodyLg.copyWith(color: AppColors.textPrimary),
                              decoration: InputDecoration(
                                prefixIcon: const Padding(
                                  padding: EdgeInsets.fromLTRB(16, 0, 12, 0),
                                  child: Icon(Icons.mail_outline_rounded, color: AppColors.textSecondary, size: 20),
                                ),
                                prefixIconConstraints: const BoxConstraints(minWidth: 48, minHeight: 20),
                                hintText: 'Enter your email',
                                contentPadding: const EdgeInsets.symmetric(vertical: 16),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(16),
                                  borderSide: const BorderSide(color: AppColors.borderSubtle, width: 1),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(16),
                                  borderSide: const BorderSide(color: AppColors.borderSubtle, width: 1),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(16),
                                  borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                                ),
                              ),
                              validator: (value) =>
                                  (value == null || value.isEmpty) ? 'Please enter your email' : null,
                            ),
                          ),

                          const SizedBox(height: 20),

                          // Password field
                          Text('Password', style: AppTypography.label.copyWith(color: AppColors.textSecondary)),
                          const SizedBox(height: 8),
                          _GlowField(
                            isFocused: _passwordFocused,
                            child: TextFormField(
                              controller: _passwordController,
                              focusNode: _passwordFocus,
                              obscureText: !_isPasswordVisible,
                              style: AppTypography.bodyLg.copyWith(color: AppColors.textPrimary),
                              decoration: InputDecoration(
                                prefixIcon: const Padding(
                                  padding: EdgeInsets.fromLTRB(16, 0, 12, 0),
                                  child: Icon(Icons.lock_outline_rounded, color: AppColors.textSecondary, size: 20),
                                ),
                                prefixIconConstraints: const BoxConstraints(minWidth: 48, minHeight: 20),
                                suffixIcon: IconButton(
                                  icon: Icon(
                                    _isPasswordVisible ? Icons.visibility_rounded : Icons.visibility_off_rounded,
                                    color: AppColors.textTertiary,
                                    size: 20,
                                  ),
                                  onPressed: () => setState(() => _isPasswordVisible = !_isPasswordVisible),
                                ),
                                hintText: 'Enter your password',
                                contentPadding: const EdgeInsets.symmetric(vertical: 16),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(16),
                                  borderSide: const BorderSide(color: AppColors.borderSubtle, width: 1),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(16),
                                  borderSide: const BorderSide(color: AppColors.borderSubtle, width: 1),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(16),
                                  borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                                ),
                              ),
                              validator: (value) =>
                                  (value == null || value.isEmpty) ? 'Please enter your password' : null,
                            ),
                          ),

                          const SizedBox(height: 36),

                          // Sign In Button
                          PrimaryButton(
                            text: 'Sign In',
                            trailingIcon: Icons.arrow_forward_rounded,
                            onPressed: _submit,
                            isLoading: state.isLoading,
                          ),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 40),
                  Center(
                    child: Text(
                      'Live Tracking Platform v1.0',
                      style: AppTypography.caption.copyWith(color: AppColors.textTertiary),
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Focus-activated glow container for form fields
class _GlowField extends StatelessWidget {
  final bool isFocused;
  final Widget child;

  const _GlowField({required this.isFocused, required this.child});

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(16),
        boxShadow: isFocused
            ? [BoxShadow(color: AppColors.primary.withOpacity(0.15), blurRadius: 12)]
            : [],
      ),
      child: child,
    );
  }
}

/// Animated error banner that appears above the form
class _ErrorBanner extends StatelessWidget {
  final String message;
  final VoidCallback onDismiss;

  const _ErrorBanner({required this.message, required this.onDismiss});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.error.withOpacity(0.1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.error.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.warning_amber_rounded, color: AppColors.error, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              message,
              style: AppTypography.bodyMd.copyWith(color: AppColors.error),
            ),
          ),
          GestureDetector(
            onTap: onDismiss,
            child: const Icon(Icons.close_rounded, color: AppColors.error, size: 18),
          ),
        ],
      ),
    );
  }
}
