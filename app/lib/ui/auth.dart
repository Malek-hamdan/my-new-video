import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:material_ui/material_ui.dart';

import '../state.dart';
import '../theme.dart';
import 'widgets.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  bool _signUp = false;
  bool _hide = true;
  String? _error;
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _pass = TextEditingController();

  String _readable(Object e) {
    final code = e is FirebaseAuthException ? e.code : '$e';
    if (code.contains('invalid-credential') || code.contains('wrong-password') || code.contains('user-not-found')) {
      return 'Email or password is wrong.';
    }
    if (code.contains('email-already-in-use')) return 'This email already has an account. Sign in instead.';
    if (code.contains('weak-password')) return 'Use at least 6 characters for the password.';
    if (code.contains('invalid-email')) return 'That email address is not valid.';
    if (code.contains('network')) return 'No internet connection.';
    if (code.contains('too-many-requests')) return 'Too many tries. Wait a minute and try again.';
    return 'Something went wrong. Try again.';
  }

  Future<void> _submit() async {
    final app = AppScope.read(context);
    final email = _email.text.trim();
    final pass = _pass.text;
    if (email.isEmpty || pass.isEmpty || (_signUp && _name.text.trim().isEmpty)) {
      setState(() => _error = _signUp ? 'Fill in your name, email and password.' : 'Enter your email and password.');
      throw StateError('incomplete');
    }
    setState(() => _error = null);
    try {
      if (_signUp) {
        await app.backend.signUp(_name.text.trim(), email, pass);
      } else {
        await app.backend.signIn(email, pass);
      }
    } catch (e) {
      setState(() => _error = _readable(e));
      rethrow;
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    return Scaffold(
      body: Stack(children: [
        Positioned(
          top: -120,
          right: -100,
          child: Container(
            width: 320,
            height: 320,
            decoration: BoxDecoration(shape: BoxShape.circle, gradient: RadialGradient(colors: [C.red.withValues(alpha: .35), Colors.transparent])),
          ).animate(onPlay: (c) => c.repeat(reverse: true)).scale(begin: const Offset(1, 1), end: const Offset(1.15, 1.15), duration: 4.seconds, curve: Curves.easeInOut),
        ),
        SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
              physics: const BouncingScrollPhysics(),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Center(
                    child: const LogoMark(size: 96)
                        .animate()
                        .scale(begin: const Offset(.6, .6), duration: 700.ms, curve: Curves.easeOutBack)
                        .fadeIn(duration: 400.ms),
                  ),
                  const SizedBox(height: 20),
                  Text('ANIMEWEAR.LB', textAlign: TextAlign.center, style: display(28)).animate().fadeIn(delay: 150.ms).slideY(begin: .3),
                  const SizedBox(height: 6),
                  const Text('Business ledger', textAlign: TextAlign.center, style: subStyle).animate().fadeIn(delay: 250.ms),
                  if (app.demo) ...[
                    const SizedBox(height: 12),
                    const Center(child: Tag('Demo · any email works', C.gold)),
                  ],
                  const SizedBox(height: 32),
                  SlidePicker(
                    options: const ['in', 'up'],
                    labels: const ['Sign in', 'Create account'],
                    selected: _signUp ? 'up' : 'in',
                    onChanged: (v) => setState(() {
                      _signUp = v == 'up';
                      _error = null;
                    }),
                  ).animate().fadeIn(delay: 300.ms),
                  const SizedBox(height: 18),
                  AnimatedSize(
                    duration: kMed,
                    curve: kCurve,
                    child: _signUp
                        ? Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: TextField(
                              controller: _name,
                              textCapitalization: TextCapitalization.words,
                              decoration: const InputDecoration(hintText: 'Your name', prefixIcon: Icon(Icons.person_rounded, color: C.mute, size: 20)),
                            ),
                          ).animate().fadeIn(duration: kMed)
                        : const SizedBox(width: double.infinity),
                  ),
                  TextField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    autocorrect: false,
                    decoration: const InputDecoration(hintText: 'Email', prefixIcon: Icon(Icons.alternate_email_rounded, color: C.mute, size: 20)),
                  ).animate().fadeIn(delay: 350.ms),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _pass,
                    obscureText: _hide,
                    onSubmitted: (_) => _submit().catchError((_) {}),
                    decoration: InputDecoration(
                      hintText: 'Password',
                      prefixIcon: const Icon(Icons.lock_rounded, color: C.mute, size: 20),
                      suffixIcon: IconButton(
                        icon: Icon(_hide ? Icons.visibility_rounded : Icons.visibility_off_rounded, color: C.mute, size: 20),
                        onPressed: () => setState(() => _hide = !_hide),
                      ),
                    ),
                  ).animate().fadeIn(delay: 400.ms),
                  AnimatedSize(
                    duration: kMed,
                    curve: kCurve,
                    child: _error == null
                        ? const SizedBox(width: double.infinity)
                        : Padding(
                            padding: const EdgeInsets.only(top: 12),
                            child: Text(_error!, style: const TextStyle(color: C.down, fontSize: 12.5)).animate().shakeX(hz: 5, amount: 3),
                          ),
                  ),
                  const SizedBox(height: 20),
                  ActionButton(label: _signUp ? 'Create account' : 'Sign in', icon: Icons.arrow_forward_rounded, onPressed: _submit)
                      .animate()
                      .fadeIn(delay: 450.ms)
                      .slideY(begin: .3),
                  if (!_signUp) ...[
                    const SizedBox(height: 14),
                    Center(
                      child: Pressable(
                        onTap: () async {
                          final email = _email.text.trim();
                          if (email.isEmpty) {
                            setState(() => _error = 'Type your email first, then tap Forgot password.');
                            return;
                          }
                          try {
                            await app.backend.resetPassword(email);
                            if (context.mounted) toast(context, 'Reset link sent to $email');
                          } catch (e) {
                            setState(() => _error = _readable(e));
                          }
                        },
                        child: const Padding(padding: EdgeInsets.all(8), child: Text('Forgot password?', style: TextStyle(color: C.mute, fontSize: 12.5))),
                      ),
                    ),
                  ],
                  const SizedBox(height: 18),
                  Text(
                    _signUp
                        ? 'The first account becomes the owner. Everyone after waits for the owner to give them a role.'
                        : 'New to the team? Create an account, then ask the owner for access.',
                    textAlign: TextAlign.center,
                    style: subStyle.copyWith(fontSize: 11.5),
                  ),
                ]),
              ),
            ),
          ),
        ),
      ]),
    );
  }
}

class WaitingScreen extends StatelessWidget {
  const WaitingScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const LogoMark(size: 84)
                  .animate(onPlay: (c) => c.repeat(reverse: true))
                  .scale(begin: const Offset(1, 1), end: const Offset(1.06, 1.06), duration: 1200.ms, curve: Curves.easeInOut),
              const SizedBox(height: 26),
              Text('Almost there', style: display(24)),
              const SizedBox(height: 10),
              Text(
                'Hi ${app.myName}. Your account is ready. The owner needs to give you a role in Team before you can see the ledger.',
                textAlign: TextAlign.center,
                style: subStyle.copyWith(fontSize: 13.5, height: 1.5),
              ),
              const SizedBox(height: 10),
              Text('This screen opens by itself once you have access.', textAlign: TextAlign.center, style: subStyle.copyWith(fontSize: 12)),
              const SizedBox(height: 28),
              SizedBox(width: 200, child: ActionButton(label: 'Sign out', filled: false, onPressed: () => app.backend.signOut())),
            ]),
          ),
        ),
      ),
    );
  }
}
