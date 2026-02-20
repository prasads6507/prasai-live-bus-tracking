class Stop {
  final String id;
  final String name;
  final double lat;
  final double lng;
  final int order;

  Stop({
    required this.id,
    required this.name,
    required this.lat,
    required this.lng,
    required this.order,
  });

  factory Stop.fromJson(Map<String, dynamic> json) {
    return Stop(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      lat: json['lat']?.toDouble() ?? 0.0,
      lng: json['lng']?.toDouble() ?? 0.0,
      order: json['order'] ?? 0,
    );
  }
}
