/// Google Polyline Encoding Algorithm.
/// Encodes a list of lat/lng pairs into a compressed string
/// for efficient storage and transfer.
///
/// See: https://developers.google.com/maps/documentation/utilities/polylinealgorithm

class PolylineEncoder {
  /// Encode a list of (lat, lng) coordinate pairs into a polyline string.
  static String encode(List<List<double>> coordinates) {
    final sb = StringBuffer();
    int prevLat = 0;
    int prevLng = 0;

    for (final coord in coordinates) {
      final lat = (coord[0] * 1e5).round();
      final lng = (coord[1] * 1e5).round();

      sb.write(_encodeValue(lat - prevLat));
      sb.write(_encodeValue(lng - prevLng));

      prevLat = lat;
      prevLng = lng;
    }

    return sb.toString();
  }

  /// Encode a single value using the polyline encoding algorithm.
  static String _encodeValue(int value) {
    int v = value < 0 ? ~(value << 1) : (value << 1);
    final sb = StringBuffer();

    while (v >= 0x20) {
      sb.writeCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    sb.writeCharCode(v + 63);

    return sb.toString();
  }

  /// Decode a polyline string into a list of [lat, lng] coordinate pairs.
  static List<List<double>> decode(String encoded) {
    final result = <List<double>>[];
    int index = 0;
    int lat = 0;
    int lng = 0;

    while (index < encoded.length) {
      int shift = 0;
      int result_ = 0;
      int b;
      do {
        b = encoded.codeUnitAt(index++) - 63;
        result_ |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      lat += (result_ & 1) != 0 ? ~(result_ >> 1) : (result_ >> 1);

      shift = 0;
      result_ = 0;
      do {
        b = encoded.codeUnitAt(index++) - 63;
        result_ |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      lng += (result_ & 1) != 0 ? ~(result_ >> 1) : (result_ >> 1);

      result.add([lat / 1e5, lng / 1e5]);
    }

    return result;
  }
}
