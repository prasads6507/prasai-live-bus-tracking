import 'package:flutter/material.dart';

class AppErrorBoundary extends StatelessWidget {
  final Widget child;

  const AppErrorBoundary({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return ErrorWidget.builder = (FlutterErrorDetails details) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error, color: Colors.red, size: 50),
              const SizedBox(height: 16),
              const Text('Something went wrong'),
              const SizedBox(height: 8),
              Text(details.exception.toString(), textAlign: TextAlign.center),
            ],
          ),
        ),
      );
    } as Widget Function(FlutterErrorDetails);
  }
}
