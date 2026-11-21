package com.streak.app

import android.app.Activity
import android.content.Context
import android.os.Bundle
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.View
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Toast

object Istighfar {
    val LINES = listOf(
        "أستغفرك ربي عن إهمالي",
        "أستغفرك ربي عن تقصيري",
        "أستغفرك ربي عن غفلتي",
        "أستغفرك ربي عن سهو قلبي",
        "أستغفرك ربي عن ضعف نفسي",
        "أستغفرك ربي عن قلة ذكري",
        "أستغفرك ربي عن كسل طاعتي",
        "أستغفرك ربي عن تأخير توبتي",
        "أستغفرك ربي عن سكوتي عن الحق",
        "أستغفرك ربي عن استثقالي للصلاة",
        "أستغفرك ربي عن نسياني للقرآن",
        "أستغفرك ربي عن برودي في الدعاء",
        "أستغفرك ربي عن تعلقي بالدنيا",
        "أستغفرك ربي عن تهاوني في الصدقة",
        "أستغفرك ربي عن استصغاري للذنب",
        "أستغفرك ربي عن غفلتي عن الموت",
        "أستغفرك ربي عن بعدي عنك"
    )
    private fun p(c: Context) = c.getSharedPreferences("istighfar", 0)
    private fun today() = java.text.SimpleDateFormat("yyyyMMdd", java.util.Locale.US).format(java.util.Date())
    fun done(c: Context): Int = if (p(c).getString("day", "") == today()) p(c).getInt("mask", 0) else 0
    fun set(c: Context, mask: Int) { p(c).edit().putString("day", today()).putInt("mask", mask).commit() }
    fun count(c: Context) = Integer.bitCount(done(c))
}

class IstighfarActivity : Activity() {
    private lateinit var body: LinearLayout

    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        body = vbox().apply { setPadding(dp(20), dp(20), dp(20), dp(30)) }
        setContentView(ScrollView(this).apply { addView(body); isVerticalScrollBarEnabled = false; overScrollMode = View.OVER_SCROLL_NEVER })
        render(true)
    }

    override fun finish() { super.finish(); overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out) }

    private fun render(anim: Boolean) {
        body.removeAllViews()
        val mask = Istighfar.done(this)
        val n = Integer.bitCount(mask); val total = Istighfar.LINES.size
        var i = 0
        fun add(v: View, lp: LinearLayout.LayoutParams) { body.addView(v, lp); if (anim) v.enter(i++) }

        val top = hbox().apply { gravity = Gravity.CENTER_VERTICAL }
        top.addView(tv("←", 22f, C.TXT).apply { gravity = Gravity.CENTER; background = shape(C.CARD, dp(22).toFloat()); pressable { finish() } }, lp(dp(44), dp(44)))
        top.addView(tv("Istighfar 🤲", 20f, C.TXT, true).apply { gravity = Gravity.CENTER }, lp(0, -2, 1f))
        top.addView(View(this), lp(dp(44), dp(44)))
        add(top, lp(b = 18))

        add(tv(if (n == total) "Done for today 🤍" else "$n / $total today", 15f, if (n == total) C.G else C.DIM).apply { gravity = Gravity.CENTER }, lp())
        val bar = Bar(this).apply { color = C.G }
        add(bar, lp(-1, dp(8), t = 10, b = 6)); bar.animateTo(n / total.toFloat(), if (anim) 200 else 0)
        add(tv("Tap each one as you say it", 12f, C.DIM).apply { gravity = Gravity.CENTER }, lp(b = 16))

        Istighfar.LINES.forEachIndexed { k, line ->
            val on = (mask shr k) and 1 == 1
            val row = hbox().apply {
                gravity = Gravity.CENTER_VERTICAL
                background = shape(if (on) 0xFF173A2C.toInt() else C.CARD, dp(16).toFloat(), if (on) dp(1) else 0, C.G)
                setPadding(dp(16), dp(14), dp(16), dp(14))
            }
            row.addView(tv(if (on) "✓" else "${k + 1}", 15f, if (on) C.G else C.DIM, true).apply { gravity = Gravity.CENTER }, lp(dp(28), -2))
            row.addView(tv(line, 19f, if (on) C.G else C.TXT).apply {
                textDirection = View.TEXT_DIRECTION_RTL; gravity = Gravity.END
            }, lp(0, -2, 1f, l = 10))
            row.pressable {
                val nm = mask xor (1 shl k); Istighfar.set(this, nm)
                if (Integer.bitCount(nm) == total) { row.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS); Toast.makeText(this, "Done for today 🤍", Toast.LENGTH_SHORT).show() }
                render(false)
            }
            add(row, lp(b = 8))
        }
        add(tv("ذكّر بها غيرك لعلها بميزان حسناتك", 14f, C.DIM).apply { textDirection = View.TEXT_DIRECTION_RTL; gravity = Gravity.CENTER }, lp(t = 10))
        if (n > 0) add(tv("↺ Start over", 14f, 0xFF777777.toInt()).apply {
            gravity = Gravity.CENTER; setPadding(0, dp(16), 0, dp(4))
            setOnClickListener { Istighfar.set(this@IstighfarActivity, 0); render(false) }
        }, lp())
    }
}
