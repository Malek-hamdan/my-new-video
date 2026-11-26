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

class Sale {
  final String id;
  final DateTime date;
  final String customer, phone, item, size, currency, method, channel, status, note, by, byName;
  final String productId, type;
  final int qty;
  final double unitPrice, discount, total, totalUsd;

  /// Cost per piece in USD when sold (0 = unknown).
  final double unitCost;

  const Sale({
    this.productId = '',
    this.type = 'T-shirt',
    this.id = '',
    required this.date,
    this.customer = '',
    this.phone = '',
    required this.item,
    this.size = 'M',
    this.currency = 'USD',
    this.method = 'Cash',
    this.channel = 'Instagram',
    this.status = 'completed',
    this.note = '',
    this.by = '',
    this.byName = '',
    required this.qty,
    required this.unitPrice,
    this.unitCost = 0,
    this.discount = 0,
    required this.total,
    required this.totalUsd,
  });

  bool get completed => status == 'completed';

  /// Profit on the pieces themselves: what came in minus what they cost.
  /// Null when the cost is unknown.
  double? get profit => unitCost <= 0 || !completed ? null : totalUsd - unitCost * qty;

  /// Pieces this sale takes out of stock (none when refunded or not from stock).
  Map<String, int> get stockUse =>
      productId.isEmpty || !completed || qty <= 0 ? const {} : {'$productId|$size': qty};

  Map<String, dynamic> toMap() => {
        'productId': productId,
        'type': type,
        'date': date,
        'customer': customer,
        'phone': phone,
        'item': item,
        'size': size,
        'currency': currency,
        'method': method,
        'channel': channel,
        'status': status,
        'note': note,
        'by': by,
        'byName': byName,
        'qty': qty,
        'unitPrice': unitPrice,
        'unitCost': unitCost,
        'discount': discount,
        'total': total,
        'totalUsd': totalUsd,
      };

  factory Sale.fromMap(String id, Map<String, dynamic> m) => Sale(
        id: id,
        productId: readStr(m['productId']),
        type: readStr(m['type']).isEmpty ? 'T-shirt' : readStr(m['type']),
        date: readDate(m['date']),
        customer: readStr(m['customer']),
        phone: readStr(m['phone']),
        item: readStr(m['item']),
        size: readStr(m['size']),
        currency: readStr(m['currency']).isEmpty ? 'USD' : readStr(m['currency']),
        method: readStr(m['method']),
        channel: readStr(m['channel']),
        status: readStr(m['status']).isEmpty ? 'completed' : readStr(m['status']),
        note: readStr(m['note']),
        by: readStr(m['by']),
        byName: readStr(m['byName']),
        qty: readNum(m['qty']).round(),
        unitPrice: readNum(m['unitPrice']),
        unitCost: readNum(m['unitCost']),
        discount: readNum(m['discount']),
        total: readNum(m['total']),
        totalUsd: readNum(m['totalUsd']),
      );
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
