import 'package:intl/intl.dart';

final _usd = NumberFormat.currency(locale: 'en_US', symbol: r'$', decimalDigits: 2);
final _usd0 = NumberFormat.currency(locale: 'en_US', symbol: r'$', decimalDigits: 0);
final _int = NumberFormat.decimalPattern('en_US');

String money(double v) => v < 0 ? '−${_usd.format(-v)}' : _usd.format(v);
String money0(double v) => v < 0 ? '−${_usd0.format(-v)}' : _usd0.format(v);
String signedMoney0(double v) => v >= 0 ? '+${_usd0.format(v)}' : '−${_usd0.format(-v)}';
String lbp(double v) => '${_int.format(v.round())} LBP';
String count(num v) => _int.format(v);

String dayLabel(DateTime d) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final that = DateTime(d.year, d.month, d.day);
  final diff = today.difference(that).inDays;
  final base = DateFormat('EEE d MMM').format(d);
  if (diff == 0) return 'Today · $base';
  if (diff == 1) return 'Yesterday · $base';
  return base;
}

String timeLabel(DateTime d) => DateFormat('h:mm a').format(d);
String dateLabel(DateTime d) => DateFormat('d MMM yyyy').format(d);
String monthLabel(DateTime d) => DateFormat('MMMM yyyy').format(d);
String monthShort(DateTime d) => DateFormat('MMM').format(d);

double parseNum(String s) => double.tryParse(s.replaceAll(',', '').replaceAll(' ', '').trim()) ?? 0;
