import 'dart:async';
import 'dart:math';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import 'models.dart';

abstract class Backend {
  Stream<AppUser?> me();
  Future<void> signIn(String email, String password);
  Future<void> signUp(String name, String email, String password);
  Future<void> resetPassword(String email);
  Future<void> signOut();

  Stream<List<Sale>> sales();
  Stream<List<Payment>> payments();
  Stream<List<CapitalEntry>> capital();
  Stream<List<AppUser>> users();
  Stream<AppConfig> config();

  /// Saves a sale and moves stock to match; pass the sale as it was before
  /// an edit so the old quantity is given back first.
  Future<void> saveSale(Sale s, {Sale? previous});
  Future<void> deleteSale(Sale s);
  Stream<List<Product>> products();
  Future<void> saveProduct(Product p);
  Future<void> archiveProduct(String id);
  Future<void> addStock(String productId, Map<String, int> add);
  Future<void> savePayment(Payment p);
  Future<void> deletePayment(String id);
  Future<void> saveCapital(CapitalEntry c);
  Future<void> deleteCapital(String id);
  Future<void> setRole(String uid, Role role);
  Future<void> setRate(double rate);
  Future<void> setWebsite(String url);
}

/// Live, shared data in the business's Firebase project.
class FirebaseBackend implements Backend {
  final _auth = FirebaseAuth.instance;
  final _db = FirebaseFirestore.instance;

  @override
  Stream<AppUser?> me() => _auth.authStateChanges().asyncExpand((u) {
        if (u == null) return Stream<AppUser?>.value(null);
        return _db.doc('users/${u.uid}').snapshots().asyncMap((s) async {
          if (s.exists) return AppUser.fromMap(s.id, s.data()!);
          // Account exists but its profile was never written (e.g. the app
          // closed mid sign-up): write it now.
          await _ensureProfile(u, u.displayName ?? '');
          return AppUser(id: u.uid, name: u.displayName ?? '', email: u.email ?? '', role: Role.pending);
        });
      });

  Future<void> _ensureProfile(User u, String name) async {
    final ref = _db.doc('users/${u.uid}');
    if ((await ref.get()).exists) return;
    final profile = {
      'name': name.isEmpty ? (u.email ?? '').split('@').first : name,
      'email': u.email ?? '',
      'createdAt': FieldValue.serverTimestamp(),
    };
    final cfg = await _db.doc('config/app').get();
    if (!cfg.exists) {
      // The very first account becomes the owner.
      final batch = _db.batch();
      batch.set(_db.doc('config/app'), {
        'ownerUid': u.uid,
        'lbpRate': 89500,
        'createdAt': FieldValue.serverTimestamp(),
      });
      batch.set(ref, {...profile, 'role': 'owner'});
      await batch.commit();
    } else {
      await ref.set({...profile, 'role': 'pending'});
    }
  }

  @override
  Future<void> signIn(String email, String password) async {
    final c = await _auth.signInWithEmailAndPassword(email: email, password: password);
    await _ensureProfile(c.user!, c.user!.displayName ?? '');
  }

  @override
  Future<void> signUp(String name, String email, String password) async {
    final c = await _auth.createUserWithEmailAndPassword(email: email, password: password);
    await c.user!.updateDisplayName(name);
    await _ensureProfile(c.user!, name);
  }

  @override
  Future<void> resetPassword(String email) => _auth.sendPasswordResetEmail(email: email);

  @override
  Future<void> signOut() => _auth.signOut();

  Stream<List<T>> _list<T>(String col, T Function(String, Map<String, dynamic>) f) => _db
      .collection(col)
      .orderBy('date', descending: true)
      .snapshots()
      .map((q) => q.docs.map((d) => f(d.id, d.data())).toList());

  @override
  Stream<List<Sale>> sales() => _list('sales', Sale.fromMap);
  @override
  Stream<List<Payment>> payments() => _list('payments', Payment.fromMap);
  @override
  Stream<List<CapitalEntry>> capital() => _list('capital', CapitalEntry.fromMap);

  @override
  Stream<List<AppUser>> users() => _db
      .collection('users')
      .snapshots()
      .map((q) => q.docs.map((d) => AppUser.fromMap(d.id, d.data())).toList());

  @override
  Stream<AppConfig> config() => _db
      .doc('config/app')
      .snapshots()
      .map((s) => s.exists ? AppConfig.fromMap(s.data()!) : const AppConfig());

  Future<void> _save(String col, String id, Map<String, dynamic> data) {
    if (id.isEmpty) {
      return _db.collection(col).add({...data, 'createdAt': FieldValue.serverTimestamp()});
    }
    return _db.doc('$col/$id').set({...data, 'updatedAt': FieldValue.serverTimestamp()}, SetOptions(merge: true));
  }

  @override
  Future<void> saveSale(Sale s, {Sale? previous}) {
    final batch = _db.batch();
    final ref = s.id.isEmpty ? _db.collection('sales').doc() : _db.doc('sales/${s.id}');
    batch.set(
      ref,
      {...s.toMap(), s.id.isEmpty ? 'createdAt' : 'updatedAt': FieldValue.serverTimestamp()},
      SetOptions(merge: true),
    );
    _applyStock(batch, stockDelta(previous, s));
    return batch.commit();
  }

  @override
  Future<void> deleteSale(Sale s) {
    final batch = _db.batch();
    batch.delete(_db.doc('sales/${s.id}'));
    _applyStock(batch, stockDelta(s, null));
    return batch.commit();
  }

  void _applyStock(WriteBatch batch, Map<String, int> delta) {
    for (final e in delta.entries) {
      final [pid, size] = e.key.split('|');
      batch.update(_db.doc('products/$pid'), {
        'sizes.$size': FieldValue.increment(e.value),
        'updatedAt': FieldValue.serverTimestamp(),
      });
    }
  }

  @override
  Stream<List<Product>> products() => _db
      .collection('products')
      .snapshots()
      .map((q) => q.docs.map((d) => Product.fromMap(d.id, d.data())).where((p) => p.active).toList()
        ..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase())));

  @override
  Future<void> saveProduct(Product p) => _save('products', p.id, p.toMap());

  @override
  Future<void> archiveProduct(String id) =>
      _db.doc('products/$id').update({'active': false, 'updatedAt': FieldValue.serverTimestamp()});

  @override
  Future<void> addStock(String productId, Map<String, int> add) => _db.doc('products/$productId').update({
        for (final e in add.entries) 'sizes.${e.key}': FieldValue.increment(e.value),
        'updatedAt': FieldValue.serverTimestamp(),
      });
  @override
  Future<void> savePayment(Payment p) => _save('payments', p.id, p.toMap());
  @override
  Future<void> deletePayment(String id) => _db.doc('payments/$id').delete();
  @override
  Future<void> saveCapital(CapitalEntry c) => _save('capital', c.id, c.toMap());
  @override
  Future<void> deleteCapital(String id) => _db.doc('capital/$id').delete();
  @override
  Future<void> setRole(String uid, Role role) => _db.doc('users/$uid').update({'role': role.name});
  @override
  Future<void> setRate(double rate) => _db.doc('config/app').update({'lbpRate': rate});
  @override
  Future<void> setWebsite(String url) => _db.doc('config/app').update({'website': url});
}

/// In-memory sample data, used when the app is not connected to Firebase yet.
class DemoBackend implements Backend {
  DemoBackend() {
    _seed();
  }

  final _me = _Box<AppUser?>(null);
  final _sales = _Box<List<Sale>>([]);
  final _payments = _Box<List<Payment>>([]);
  final _capital = _Box<List<CapitalEntry>>([]);
  final _users = _Box<List<AppUser>>([]);
  final _products = _Box<List<Product>>([]);
  final _config = _Box<AppConfig>(const AppConfig(ownerUid: 'u0'));
  int _n = 1000;

  void _seed() {
    final r = Random(7);
    final now = DateTime.now();
    const designs = [
      'Akatsuki Cloud Tee',
      'Gear 5 Luffy Oversized',
      'Gojo Infinity Tee',
      'Hashira Pack',
      'Zoro Santoryu Tee',
      'Itachi Crows Tee',
      'Eren Titan Hoodie',
      'Tanjiro Water Tee',
    ];
    const customers = ['Karim H.', 'Lea S.', 'Rami K.', 'Nour A.', 'Jad M.', 'Maya F.', 'Hadi T.', 'Yara B.'];
    final users = [
      const AppUser(id: 'u0', name: 'Owner', email: 'owner@demo', role: Role.owner),
      const AppUser(id: 'u1', name: 'Sara', email: 'sara@demo', role: Role.manager),
      const AppUser(id: 'u2', name: 'Ali', email: 'ali@demo', role: Role.seller),
      const AppUser(id: 'u3', name: 'Rita', email: 'rita@demo', role: Role.accountant),
      const AppUser(id: 'u4', name: 'Jad', email: 'jad@demo', role: Role.pending),
    ];
    final sales = <Sale>[];
    for (var i = 0; i < 70; i++) {
      final d = now.subtract(Duration(days: r.nextInt(60), hours: r.nextInt(10), minutes: r.nextInt(60)));
      final qty = 1 + r.nextInt(3);
      final price = [22.0, 25.0, 28.0, 35.0][r.nextInt(4)];
      final seller = users[r.nextInt(3)];
      sales.add(Sale(
        id: 's$i',
        date: d,
        customer: customers[r.nextInt(customers.length)],
        phone: '7${r.nextInt(9)} ${100 + r.nextInt(899)} ${100 + r.nextInt(899)}',
        items: [
          SaleItem(name: designs[r.nextInt(designs.length)], size: sizes[1 + r.nextInt(4)], qty: qty, price: price, cost: 8),
          if (i % 4 == 0) SaleItem(name: designs[r.nextInt(designs.length)], size: sizes[1 + r.nextInt(4)], qty: 1, price: 25, cost: 9),
        ],
        method: saleMethods[r.nextInt(4)],
        channel: channels[r.nextInt(3)],
        status: r.nextInt(18) == 0 ? 'refunded' : 'completed',
        total: qty * price + (i % 4 == 0 ? 25 : 0),
        totalUsd: qty * price + (i % 4 == 0 ? 25 : 0),
        by: seller.id,
        byName: seller.name,
      ));
    }
    final pays = <Payment>[
      for (var i = 0; i < 18; i++)
        () {
          final cat = categories[r.nextInt(5)];
          final amt = (40 + r.nextInt(420)).toDouble();
          return Payment(
            id: 'p$i',
            date: now.subtract(Duration(days: r.nextInt(60), hours: r.nextInt(10))),
            category: cat.name,
            description: switch (cat.name) {
              'Stock' => 'Blank tees · ${50 + r.nextInt(100)} pcs',
              'Printing' => 'DTF printing batch',
              'Ads' => 'Instagram ads',
              'Delivery' => 'Delivery batch',
              _ => 'Mailer bags & stickers',
            },
            payee: ['Supplier Dora', 'PrintHub', 'Meta', 'Wakilni', 'PackCo'][r.nextInt(5)],
            method: payMethods[r.nextInt(4)],
            status: i < 2 ? 'pending' : 'paid',
            amount: amt,
            amountUsd: amt,
            by: 'u1',
            byName: 'Sara',
          );
        }(),
    ];
    final cap = <CapitalEntry>[
      CapitalEntry(id: 'c0', kind: 'deposit', date: now.subtract(const Duration(days: 110)), amount: 4000, label: 'Owner savings', by: 'u0', byName: 'Owner'),
      CapitalEntry(id: 'c1', kind: 'deposit', date: now.subtract(const Duration(days: 40)), amount: 2000, label: 'Partner investment', by: 'u0', byName: 'Owner'),
      for (final (i, e) in [('Stock', 2000.0), ('Printing', 1200.0), ('Ads', 1000.0), ('Delivery', 500.0), ('Packaging', 400.0)].indexed)
        CapitalEntry(id: 'a$i', kind: 'allocation', date: now.subtract(const Duration(days: 100)), amount: e.$2, category: e.$1, label: 'Budget', by: 'u0', byName: 'Owner'),
    ];
    _products.value = [
      const Product(id: 'pr1', name: 'Akatsuki Cloud Tee', type: 'T-shirt', cost: 8, price: 25, sizes: {'S': 4, 'M': 9, 'L': 6, 'XL': 2}),
      const Product(id: 'pr2', name: 'Gear 5 Luffy', type: 'Oversized', cost: 10, price: 28, sizes: {'M': 5, 'L': 1, 'XL': 3}),
      const Product(id: 'pr3', name: 'Gojo Infinity Tee', type: 'T-shirt', cost: 8, price: 25, sizes: {'S': 2, 'M': 7, 'L': 8, 'XL': 0}),
      const Product(id: 'pr4', name: 'Eren Titan Hoodie', type: 'Hoodie', cost: 18, price: 45, sizes: {'M': 3, 'L': 4, 'XL': 1}),
    ];
    _users.value = users;
    _sales.value = _sorted(sales);
    _payments.value = _sorted(pays);
    _capital.value = _sorted(cap);
    _me.value = users.first;
  }

  List<T> _sorted<T>(List<T> l) {
    DateTime d(Object o) => switch (o) { Sale s => s.date, Payment p => p.date, CapitalEntry c => c.date, _ => DateTime(0) };
    return [...l]..sort((a, b) => d(b as Object).compareTo(d(a as Object)));
  }

  String _id() => 'd${_n++}';
  Future<void> _tick() => Future.delayed(const Duration(milliseconds: 450));

  @override
  Stream<AppUser?> me() => _me.stream;
  @override
  Future<void> signIn(String email, String password) async {
    await _tick();
    _me.value = _users.value.first;
  }

  @override
  Future<void> signUp(String name, String email, String password) => signIn(email, password);
  @override
  Future<void> resetPassword(String email) => _tick();
  @override
  Future<void> signOut() async => _me.value = null;

  @override
  Stream<List<Sale>> sales() => _sales.stream;
  @override
  Stream<List<Payment>> payments() => _payments.stream;
  @override
  Stream<List<CapitalEntry>> capital() => _capital.stream;
  @override
  Stream<List<AppUser>> users() => _users.stream;
  @override
  Stream<AppConfig> config() => _config.stream;

  List<T> _upsert<T>(List<T> list, T item, String id, String Function(T) idOf) =>
      _sorted([for (final x in list) if (idOf(x) != id) x, item]);

  @override
  Future<void> saveSale(Sale s, {Sale? previous}) async {
    await _tick();
    final id = s.id.isEmpty ? _id() : s.id;
    _sales.value = _upsert(_sales.value, Sale.fromMap(id, s.toMap()), id, (x) => x.id);
    _moveStock(stockDelta(previous, s));
  }

  @override
  Future<void> deleteSale(Sale s) async {
    _sales.value = [for (final x in _sales.value) if (x.id != s.id) x];
    _moveStock(stockDelta(s, null));
  }

  void _moveStock(Map<String, int> delta) {
    _products.value = [
      for (final p in _products.value)
        Product(
          id: p.id,
          name: p.name,
          type: p.type,
          cost: p.cost,
          price: p.price,
          sizes: {
            ...p.sizes,
            for (final e in delta.entries)
              if (e.key.startsWith('${p.id}|'))
                e.key.split('|')[1]: (p.sizes[e.key.split('|')[1]] ?? 0) + e.value,
          },
        ),
    ];
  }

  @override
  Stream<List<Product>> products() => _products.stream.map((l) => l.where((p) => p.active).toList());

  @override
  Future<void> saveProduct(Product p) async {
    await _tick();
    final id = p.id.isEmpty ? _id() : p.id;
    final saved = Product.fromMap(id, p.toMap());
    _products.value = [for (final x in _products.value) if (x.id != id) x, saved]
      ..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
  }

  @override
  Future<void> archiveProduct(String id) async => _products.value = [for (final x in _products.value) if (x.id != id) x];

  @override
  Future<void> addStock(String productId, Map<String, int> add) async {
    await _tick();
    _moveStock({for (final e in add.entries) '$productId|${e.key}': e.value});
  }

  @override
  Future<void> savePayment(Payment p) async {
    await _tick();
    final id = p.id.isEmpty ? _id() : p.id;
    _payments.value = _upsert(_payments.value, Payment.fromMap(id, p.toMap()), id, (x) => x.id);
  }

  @override
  Future<void> deletePayment(String id) async => _payments.value = [for (final x in _payments.value) if (x.id != id) x];

  @override
  Future<void> saveCapital(CapitalEntry c) async {
    await _tick();
    final id = c.id.isEmpty ? _id() : c.id;
    _capital.value = _upsert(_capital.value, CapitalEntry.fromMap(id, c.toMap()), id, (x) => x.id);
  }

  @override
  Future<void> deleteCapital(String id) async => _capital.value = [for (final x in _capital.value) if (x.id != id) x];

  @override
  Future<void> setRole(String uid, Role role) async {
    _users.value = [for (final u in _users.value) u.id == uid ? u.copyWith(role: role) : u];
    // In the demo you may also preview other roles on yourself.
    if (_me.value?.id == uid) _me.value = _me.value!.copyWith(role: role);
  }

  @override
  Future<void> setRate(double rate) async => _config.value = _config.value.copyWith(lbpRate: rate);
  @override
  Future<void> setWebsite(String url) async => _config.value = _config.value.copyWith(website: url);
}

/// A value that replays its latest state to every new listener.
class _Box<T> {
  _Box(this._value);
  T _value;
  final _ctrl = StreamController<T>.broadcast();
  T get value => _value;
  set value(T v) {
    _value = v;
    _ctrl.add(v);
  }

  Stream<T> get stream => Stream<T>.multi((c) {
        c.add(_value);
        final sub = _ctrl.stream.listen(c.add);
        c.onCancel = sub.cancel;
      });
}
