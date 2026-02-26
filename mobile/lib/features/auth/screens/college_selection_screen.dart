import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/colors.dart';
import '../../../core/theme/typography.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../data/providers.dart';

class CollegeSelectionScreen extends ConsumerStatefulWidget {
  const CollegeSelectionScreen({super.key});

  @override
  ConsumerState<CollegeSelectionScreen> createState() => _CollegeSelectionScreenState();
}

class _CollegeSelectionScreenState extends ConsumerState<CollegeSelectionScreen> {
  final _searchController = TextEditingController();
  final _focusNode = FocusNode();
  List<Map<String, dynamic>> _searchResults = [];
  Map<String, dynamic>? _selectedCollege;
  bool _isLoading = false;
  bool _isFocused = false;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(() {
      setState(() => _isFocused = _focusNode.hasFocus);
    });
  }

  void _onSearchChanged(String query) {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      _search(query);
    });
  }

  Future<void> _search(String query) async {
    if (query.trim().isEmpty) {
      setState(() {
        _searchResults = [];
        _selectedCollege = null;
      });
      return;
    }

    setState(() => _isLoading = true);
    try {
      final results = await ref.read(apiDataSourceProvider).searchColleges(query);
      setState(() => _searchResults = results);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error searching: $e'), backgroundColor: AppColors.error),
        );
      }
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      body: SafeArea(
        child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 60),

                  // Title
                  Center(
                    child: Text(
                      'Find Your Institution',
                      style: AppTypography.h1,
                      textAlign: TextAlign.center,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Center(
                    child: Text(
                      'Search to get started',
                      style: AppTypography.bodyMd,
                      textAlign: TextAlign.center,
                    ),
                  ),
                  const SizedBox(height: 32),

                  // Glowing Search Bar
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    decoration: BoxDecoration(
                      color: AppColors.bgCard,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: _isFocused ? AppColors.primary : AppColors.borderSubtle,
                        width: _isFocused ? 1.5 : 1,
                      ),
                      boxShadow: _isFocused
                          ? [BoxShadow(color: AppColors.primary.withOpacity(0.15), blurRadius: 16)]
                          : [],
                    ),
                    child: TextField(
                      controller: _searchController,
                      focusNode: _focusNode,
                      onChanged: _onSearchChanged,
                      style: AppTypography.bodyLg.copyWith(color: AppColors.textPrimary),
                      decoration: InputDecoration(
                        prefixIcon: const Padding(
                          padding: EdgeInsets.fromLTRB(16, 0, 12, 0),
                          child: Icon(Icons.search_rounded, color: AppColors.primary, size: 22),
                        ),
                        prefixIconConstraints: const BoxConstraints(minWidth: 50, minHeight: 22),
                        suffixIcon: _isLoading
                            ? const Padding(
                                padding: EdgeInsets.all(14.0),
                                child: SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: AppColors.primary,
                                  ),
                                ),
                              )
                            : null,
                        hintText: 'Type your college name...',
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Results header
                  if (_searchResults.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(
                        'RESULTS',
                        style: AppTypography.caption.copyWith(
                          color: AppColors.textTertiary,
                          letterSpacing: 1.2,
                        ),
                      ),
                    ),

                  // Results List
                  Expanded(
                    child: _searchResults.isEmpty && _searchController.text.isNotEmpty && !_isLoading
                        ? Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.search_off_rounded, size: 48, color: AppColors.textTertiary),
                                const SizedBox(height: 12),
                                Text('No institutions found', style: AppTypography.bodyMd),
                              ],
                            ),
                          )
                        : ListView.builder(
                            padding: EdgeInsets.zero,
                            itemCount: _searchResults.length,
                            itemBuilder: (context, index) {
                              final college = _searchResults[index];
                              final isSelected = _selectedCollege?['collegeId'] == college['collegeId'];

                              return TweenAnimationBuilder<double>(
                                tween: Tween(begin: 0.0, end: 1.0),
                                duration: Duration(milliseconds: 300 + (index * 50)),
                                curve: Curves.easeOut,
                                builder: (context, value, child) {
                                  return Opacity(
                                    opacity: value,
                                    child: Transform.translate(
                                      offset: Offset(0, 20 * (1 - value)),
                                      child: child,
                                    ),
                                  );
                                },
                                child: Padding(
                                  padding: const EdgeInsets.only(bottom: 10),
                                  child: GestureDetector(
                                    onTap: () {
                                      HapticFeedback.selectionClick();
                                      setState(() {
                                        _selectedCollege = college;
                                        _searchController.text = college['collegeName'];
                                        _searchResults = [];
                                      });
                                    },
                                    child: AnimatedContainer(
                                      duration: const Duration(milliseconds: 200),
                                      padding: const EdgeInsets.all(16),
                                      decoration: BoxDecoration(
                                        color: isSelected
                                            ? AppColors.primarySoft
                                            : AppColors.bgCard,
                                        borderRadius: BorderRadius.circular(16),
                                        border: Border.all(
                                          color: isSelected
                                              ? AppColors.primary.withOpacity(0.5)
                                              : AppColors.borderSubtle,
                                        ),
                                      ),
                                      child: Row(
                                        children: [
                                          // Icon container
                                          Container(
                                            width: 40,
                                            height: 40,
                                            decoration: BoxDecoration(
                                              color: AppColors.primarySoft,
                                              borderRadius: BorderRadius.circular(10),
                                            ),
                                            child: const Icon(Icons.school_rounded, color: AppColors.primary, size: 20),
                                          ),
                                          const SizedBox(width: 14),
                                          // Text
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  college['collegeName'] ?? 'Unknown',
                                                  style: AppTypography.h3,
                                                ),
                                                const SizedBox(height: 2),
                                                Row(
                                                  children: [
                                                    const Icon(Icons.pin_drop_rounded, size: 11, color: AppColors.textTertiary),
                                                    const SizedBox(width: 4),
                                                    Text(
                                                      college['slug'] ?? '',
                                                      style: AppTypography.caption,
                                                    ),
                                                  ],
                                                ),
                                              ],
                                            ),
                                          ),
                                          // Checkmark
                                          if (isSelected)
                                            TweenAnimationBuilder<double>(
                                              tween: Tween(begin: 0.0, end: 1.0),
                                              duration: const Duration(milliseconds: 300),
                                              curve: Curves.elasticOut,
                                              builder: (context, value, child) {
                                                return Transform.scale(scale: value, child: child);
                                              },
                                              child: Container(
                                                width: 28,
                                                height: 28,
                                                decoration: const BoxDecoration(
                                                  color: AppColors.primary,
                                                  shape: BoxShape.circle,
                                                ),
                                                child: const Icon(Icons.check_rounded, color: AppColors.textInverse, size: 16),
                                              ),
                                            )
                                          else
                                            const Icon(Icons.chevron_right_rounded, size: 18, color: AppColors.textTertiary),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
                  ),

                  const SizedBox(height: 16),

                  // Continue Button
                  PrimaryButton(
                    text: _selectedCollege != null
                        ? 'Continue as ${_selectedCollege!['collegeName']} →'
                        : 'Continue to Login',
                    trailingIcon: _selectedCollege != null ? Icons.arrow_forward_rounded : null,
                    onPressed: _selectedCollege != null
                        ? () {
                            ref.read(selectedCollegeIdProvider.notifier).state = _selectedCollege!['collegeId'];
                            ref.read(selectedCollegeProvider.notifier).state = _selectedCollege;
                            context.go('/login', extra: _selectedCollege);
                          }
                        : null,
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
          ),
        );
      }
    }

