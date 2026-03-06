import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../data/providers.dart';
import '../../../data/models/user_notification.dart';
import '../../../core/theme/colors.dart';
import '../../../core/theme/typography.dart';

class NotificationScreen extends ConsumerWidget {
  const NotificationScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notificationsAsync = ref.watch(userNotificationsProvider);

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        title: const Text('Notifications'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: AppColors.textPrimary,
      ),
      body: notificationsAsync.when(
        data: (notifications) {
          if (notifications.isEmpty) {
            return const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.notifications_none_rounded, size: 64, color: AppColors.textTertiary),
                  SizedBox(height: 16),
                  Text('No notifications yet', style: TextStyle(color: AppColors.textTertiary)),
                ],
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
            itemCount: notifications.length,
            itemBuilder: (context, index) {
              final notification = notifications[index];
              return _NotificationCard(notification: notification);
            },
          );
        },
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
        error: (err, _) => Center(child: Text('Error: $err')),
      ),
    );
  }
}

class _NotificationCard extends ConsumerWidget {
  final UserNotification notification;
  const _NotificationCard({required this.notification});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final timeStr = DateFormat('MMM dd, hh:mm a').format(notification.createdAt);

    return Dismissible(
      key: Key(notification.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        decoration: BoxDecoration(
          color: Colors.red.shade400,
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Icon(Icons.delete_outline, color: Colors.white),
      ),
      onDismissed: (_) {
        ref.read(firestoreProvider).collection('user_notifications').doc(notification.id).delete();
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.bgCard,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: notification.read ? Colors.transparent : AppColors.primarySoft,
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: notification.type == 'HANDOVER_OTP' 
                            ? AppColors.primarySoft 
                            : AppColors.bgBase,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        notification.type == 'HANDOVER_OTP' 
                            ? Icons.vpn_key_rounded 
                            : Icons.notifications_active_rounded,
                        size: 16,
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      notification.title,
                      style: AppTypography.h3.copyWith(
                        color: notification.read ? AppColors.textSecondary : AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
                Text(
                  timeStr,
                  style: AppTypography.caption.copyWith(color: AppColors.textTertiary),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              notification.body,
              style: AppTypography.bodyMd.copyWith(color: AppColors.textSecondary),
            ),
            if (notification.type == 'HANDOVER_OTP' && notification.otp != null) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: AppColors.bgBase,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.borderSubtle),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text('OTP: ', style: TextStyle(fontWeight: FontWeight.bold)),
                    Text(
                      notification.otp!,
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 4,
                        color: AppColors.primary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
            if (!notification.read) ...[
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () {
                    ref.read(firestoreProvider)
                        .collection('user_notifications')
                        .doc(notification.id)
                        .update({'read': true});
                  },
                  child: const Text('Mark as read'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
