import 'package:cloud_firestore/cloud_firestore.dart' show Timestamp;
import 'package:material_ui/material_ui.dart';

import 'theme.dart';

enum Role { owner, manager, seller, accountant, pending }

extension RoleX on Role {
  String get label => switch (this) {
        Role.owner => 'Owner',
        Role.manager => 'Manager',
        Role.seller => 'Seller',
        Role.accountant => 'Accountant',
        Role.pending => 'No access',
      };
  String get blurb => switch (this) {
        Role.owner => 'Full access',
        Role.manager => 'Sales, payments, reports',
        Role.seller => 'Records sales only',
        Role.accountant => 'Reads everything, edits nothing',
        Role.pending => 'Waiting for the owner',
      };
  Color get color => switch (this) {
        Role.owner => C.gold,
        Role.manager => C.silver,
        Role.seller => C.red,
        Role.accountant => C.up,
        Role.pending => C.mute,
      };

  bool get active => this != Role.pending;
  bool get canAddSale => this == Role.owner || this == Role.manager || this == Role.seller;
  bool get canEditSale => this == Role.owner || this == Role.manager;
  bool get canSeeMoney => this == Role.owner || this == Role.manager || this == Role.accountant;
  bool get canEditPayments => this == Role.owner || this == Role.manager;
  bool get canManageStock => this == Role.owner || this == Role.manager;
  bool get canEditCapital => this == Role.owner;
  bool get canManageTeam => this == Role.owner;

  static Role parse(Object? v) =>
      Role.values.firstWhere((r) => r.name == v, orElse: () => Role.pending);
}

DateTime readDate(Object? v) {
  if (v is Timestamp) return v.toDate();
  if (v is DateTime) return v;
  if (v is String) return DateTime.tryParse(v) ?? DateTime.now();
  return DateTime.now();
}

double readNum(Object? v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;
String readStr(Object? v) => v == null ? '' : '$v';

class AppUser {
  final String id, name, email;
  final Role role;
  const AppUser({required this.id, required this.name, required this.email, required this.role});

  factory AppUser.fromMap(String id, Map<String, dynamic> m) => AppUser(
        id: id,
        name: readStr(m['name']),
        email: readStr(m['email']),
        role: RoleX.parse(m['role']),
      );

  AppUser copyWith({Role? role, String? name}) =>
      AppUser(id: id, name: name ?? this.name, email: email, role: role ?? this.role);

  String get initial => name.trim().isEmpty ? '?' : name.trim()[0].toUpperCase();
}

class AppConfig {
  final double lbpRate;
  final String ownerUid;
  final String website;
  const AppConfig({this.lbpRate = 89500, this.ownerUid = '', this.website = ''});
  factory AppConfig.fromMap(Map<String, dynamic> m) => AppConfig(
        lbpRate: readNum(m['lbpRate']) > 0 ? readNum(m['lbpRate']) : 89500,
        ownerUid: readStr(m['ownerUid']),
        website: readStr(m['website']),
      );
  AppConfig copyWith({double? lbpRate, String? website}) =>
      AppConfig(lbpRate: lbpRate ?? this.lbpRate, ownerUid: ownerUid, website: website ?? this.website);
}

/// One line of an order: a design, size, how many, and its price and cost.
class SaleItem {
  final String productId, name, type, size;
  final int qty;

  /// Price per piece in the order's currency.
  final double price;

  /// What one piece cost you, in USD (0 = unknown).
  final double cost;

  const SaleItem({
    this.productId = '',
    required this.name,
    this.type = 'T-shirt',
    this.size = 'M',
    this.qty = 1,
    this.price = 0,
    this.cost = 0,
  });

  double get subtotal => price * qty;
  String get label => '$name · $size${qty > 1 ? ' ×$qty' : ''}';

  Map<String, dynamic> toMap() => {
        'productId': productId,
        'name': name,
        'type': type,
        'size': size,
        'qty': qty,
        'price': price,
        'cost': cost,
      };

  factory SaleItem.fromMap(Map m) => SaleItem(
        productId: readStr(m['productId']),
        name: readStr(m['name']),
        type: readStr(m['type']).isEmpty ? 'T-shirt' : readStr(m['type']),
        size: readStr(m['size']),
        qty: readNum(m['qty']).round(),
        price: readNum(m['price']),
        cost: readNum(m['cost']),
      );
}

/// One order. It can hold several items, each with its own design, size,
/// price and cost.
class Sale {
  final String id;
  final DateTime date;
  final String customer, phone, currency, method, channel, status, note, by, byName;
  final List<SaleItem> items;
  final double discount, total, totalUsd;

  const Sale({
    this.id = '',
    required this.date,
    this.customer = '',
    this.phone = '',
    required this.items,
    this.currency = 'USD',
    this.method = 'Cash',
    this.channel = 'Instagram',
    this.status = 'completed',
    this.note = '',
    this.by = '',
    this.byName = '',
    this.discount = 0,
    required this.total,
    required this.totalUsd,
  });

  bool get completed => status == 'completed';

  /// Pieces in the order.
  int get qty => items.fold(0, (a, i) => a + i.qty);

  /// Every design in the order, joined.
  String get item => items.map((i) => i.name).join(' + ');
  String get label => items.map((i) => i.label).join(' + ');
  String get size => items.isEmpty ? '' : items.first.size;
  String get type => items.isEmpty ? 'T-shirt' : items.first.type;
  bool hasProduct(String productId) => items.any((i) => i.productId == productId);
  int piecesOf(String productId) => items.where((i) => i.productId == productId).fold(0, (a, i) => a + i.qty);

  /// USD each currency unit is worth in this order (also spreads the discount).
  double get _usdRate {
    final sub = items.fold(0.0, (a, i) => a + i.subtotal);
    return sub <= 0 ? 0 : totalUsd / sub;
  }

  /// What one item brought in, in USD, after its share of the discount.
  double usdOf(SaleItem i) => i.subtotal * _usdRate;

  bool get allCostsKnown => items.isNotEmpty && items.every((i) => i.cost > 0);
  double get costUsd => items.fold(0.0, (a, i) => a + i.cost * i.qty);

  /// Profit on the pieces: what came in minus what they cost. Null when any
  /// item's cost is unknown.
  double? get profit => !completed || !allCostsKnown ? null : totalUsd - costUsd;

  /// Pieces this order takes out of stock (none when refunded).
  Map<String, int> get stockUse {
    if (!completed) return const {};
    final m = <String, int>{};
    for (final i in items) {
      if (i.productId.isEmpty || i.qty <= 0) continue;
      final k = '${i.productId}|${i.size}';
      m[k] = (m[k] ?? 0) + i.qty;
    }
    return m;
  }

  Map<String, dynamic> toMap() => {
        'items': [for (final i in items) i.toMap()],
        'date': date,
        'customer': customer,
        'phone': phone,
        'currency': currency,
        'method': method,
        'channel': channel,
        'status': status,
        'note': note,
        'by': by,
        'byName': byName,
        'discount': discount,
        'total': total,
        'totalUsd': totalUsd,
        // Summary fields, kept so older app versions can still read the order.
        'item': item,
        'size': size,
        'type': type,
        'qty': qty,
        'unitPrice': items.isEmpty ? 0 : items.first.price,
        'unitCost': items.isEmpty ? 0 : items.first.cost,
        'productId': items.isEmpty ? '' : items.first.productId,
      };

  factory Sale.fromMap(String id, Map<String, dynamic> m) {
    final raw = m['items'];
    final items = raw is List && raw.isNotEmpty
        ? [for (final x in raw) if (x is Map) SaleItem.fromMap(x)]
        : [
            // An order saved before orders could hold several items.
            SaleItem(
              productId: readStr(m['productId']),
              name: readStr(m['item']),
              type: readStr(m['type']).isEmpty ? 'T-shirt' : readStr(m['type']),
              size: readStr(m['size']),
              qty: readNum(m['qty']).round(),
              price: readNum(m['unitPrice']),
              cost: readNum(m['unitCost']),
            ),
          ];
    return Sale(
      id: id,
      date: readDate(m['date']),
      customer: readStr(m['customer']),
      phone: readStr(m['phone']),
      items: items,
      currency: readStr(m['currency']).isEmpty ? 'USD' : readStr(m['currency']),
      method: readStr(m['method']),
      channel: readStr(m['channel']),
      status: readStr(m['status']).isEmpty ? 'completed' : readStr(m['status']),
      note: readStr(m['note']),
      by: readStr(m['by']),
      byName: readStr(m['byName']),
      discount: readNum(m['discount']),
      total: readNum(m['total']),
      totalUsd: readNum(m['totalUsd']),
    );
  }
}

class Payment {
  final String id;
  final DateTime date;
  final String category, description, payee, currency, method, status, note, by, byName;
  final double amount, amountUsd;

  const Payment({
    this.id = '',
    required this.date,
    required this.category,
    required this.description,
    this.payee = '',
    this.currency = 'USD',
    this.method = 'Cash',
    this.status = 'paid',
    this.note = '',
    this.by = '',
    this.byName = '',
    required this.amount,
    required this.amountUsd,
  });

  bool get paid => status == 'paid';

  Map<String, dynamic> toMap() => {
        'date': date,
        'category': category,
        'description': description,
        'payee': payee,
        'currency': currency,
        'method': method,
        'status': status,
        'note': note,
        'by': by,
        'byName': byName,
        'amount': amount,
        'amountUsd': amountUsd,
      };

  factory Payment.fromMap(String id, Map<String, dynamic> m) => Payment(
        id: id,
        date: readDate(m['date']),
        category: readStr(m['category']).isEmpty ? 'Other' : readStr(m['category']),
        description: readStr(m['description']),
        payee: readStr(m['payee']),
        currency: readStr(m['currency']).isEmpty ? 'USD' : readStr(m['currency']),
        method: readStr(m['method']),
        status: readStr(m['status']).isEmpty ? 'paid' : readStr(m['status']),
        note: readStr(m['note']),
        by: readStr(m['by']),
        byName: readStr(m['byName']),
        amount: readNum(m['amount']),
        amountUsd: readNum(m['amountUsd']),
      );
}

/// kind: 'deposit' = money put into the business, 'allocation' = a budget
/// set aside for one spending category.
class CapitalEntry {
  final String id, kind, label, category, by, byName;
  final DateTime date;
  final double amount;

  const CapitalEntry({
    this.id = '',
    required this.kind,
    required this.date,
    required this.amount,
    this.label = '',
    this.category = '',
    this.by = '',
    this.byName = '',
  });

  bool get isDeposit => kind == 'deposit';

  Map<String, dynamic> toMap() => {
        'kind': kind,
        'date': date,
        'amount': amount,
        'label': label,
        'category': category,
        'by': by,
        'byName': byName,
      };

  factory CapitalEntry.fromMap(String id, Map<String, dynamic> m) => CapitalEntry(
        id: id,
        kind: readStr(m['kind']) == 'allocation' ? 'allocation' : 'deposit',
        date: readDate(m['date']),
        amount: readNum(m['amount']),
        label: readStr(m['label']),
        category: readStr(m['category']),
        by: readStr(m['by']),
        byName: readStr(m['byName']),
      );
}

class Category {
  final String name;
  final IconData icon;
  final Color color;
  const Category(this.name, this.icon, this.color);
}

const categories = <Category>[
  Category('Stock', Icons.inventory_2_rounded, C.red),
  Category('Printing', Icons.print_rounded, C.silver),
  Category('Ads', Icons.campaign_rounded, C.gold),
  Category('Delivery', Icons.local_shipping_rounded, C.up),
  Category('Packaging', Icons.redeem_rounded, Color(0xFFB892FF)),
  Category('Equipment', Icons.precision_manufacturing_rounded, Color(0xFF5BC0EB)),
  Category('Salaries', Icons.badge_rounded, Color(0xFFFF9F45)),
  Category('Rent', Icons.storefront_rounded, Color(0xFFE88AB8)),
  Category('Website', Icons.language_rounded, Color(0xFF7DD3FC)),
  Category('Other', Icons.more_horiz_rounded, C.mute),
];

Category categoryOf(String name) =>
    categories.firstWhere((c) => c.name == name, orElse: () => categories.last);

const payMethods = ['Cash', 'Whish', 'OMT', 'Bank', 'Card'];
const saleMethods = ['Cash', 'Whish', 'OMT', 'COD', 'Card'];
const channels = ['Instagram', 'WhatsApp', 'TikTok', 'Store', 'Website'];
const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

/// One design kept in stock, counted per size.
class Product {
  final String id, name, type;
  final Map<String, int> sizes;
  final double cost, price;
  final bool active;

  const Product({
    this.id = '',
    required this.name,
    this.type = 'T-shirt',
    this.sizes = const {},
    this.cost = 0,
    this.price = 0,
    this.active = true,
  });

  int get total => sizes.values.fold(0, (a, b) => a + (b > 0 ? b : 0));
  int qty(String size) => sizes[size] ?? 0;
  double get value => total * cost;
  double get profitEach => price - cost;
  double get marginPct => price <= 0 ? 0 : (price - cost) / price * 100;
  List<String> get lowSizes => [for (final s in productSizes) if (sizes.containsKey(s) && qty(s) <= kLowStock) s];

  Map<String, dynamic> toMap() => {
        'name': name,
        'type': type,
        'sizes': sizes,
        'cost': cost,
        'price': price,
        'active': active,
      };

  factory Product.fromMap(String id, Map<String, dynamic> m) => Product(
        id: id,
        name: readStr(m['name']),
        type: readStr(m['type']).isEmpty ? 'T-shirt' : readStr(m['type']),
        sizes: {
          for (final e in ((m['sizes'] as Map?) ?? const {}).entries) '${e.key}': readNum(e.value).round(),
        },
        cost: readNum(m['cost']),
        price: readNum(m['price']),
        active: m['active'] != false,
      );
}

const productTypes = ['T-shirt', 'Oversized', 'Hoodie', 'Sweater', 'Other'];
const productSizes = sizes;

/// At or below this many pieces a size counts as running low.
const kLowStock = 2;

/// How stock must change when a sale goes from [before] to [after]
/// (either may be null for a new or deleted sale). Keys are "productId|size".
Map<String, int> stockDelta(Sale? before, Sale? after) {
  final d = <String, int>{};
  for (final e in (before?.stockUse ?? const <String, int>{}).entries) {
    d[e.key] = (d[e.key] ?? 0) + e.value; // give back what the old sale took
  }
  for (final e in (after?.stockUse ?? const <String, int>{}).entries) {
    d[e.key] = (d[e.key] ?? 0) - e.value; // take what the new sale needs
  }
  d.removeWhere((_, v) => v == 0);
  return d;
}
