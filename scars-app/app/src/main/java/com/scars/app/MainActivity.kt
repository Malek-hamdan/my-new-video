package com.scars.app

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.ScrollView

class MainActivity : Activity() {
    private var filter: String? = null
    private lateinit var body: LinearLayout

    override fun onCreate(s: Bundle?) {
        super.onCreate(s)
        if (Build.VERSION.SDK_INT >= 33) requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
        Sched.scheduleNext(this)
        val root = FrameLayout(this)
        body = vbox().apply { setPadding(dp(18), dp(20), dp(18), dp(110)) }
        root.addView(ScrollView(this).apply { addView(body) })
        root.addView(tv("+", 34f, Color.BLACK, true).apply {
            gravity = Gravity.CENTER
            background = shape(C.Y, dp(32).toFloat())
            setOnClickListener { startActivity(Intent(this@MainActivity, EditActivity::class.java)) }
        }, FrameLayout.LayoutParams(dp(64), dp(64), Gravity.BOTTOM or Gravity.LEFT).apply { setMargins(dp(24), 0, 0, dp(28)) })
        setContentView(root)
    }

    override fun onResume() { super.onResume(); render() }

    private fun nextText(due: Long): String {
        val d = ((due - System.currentTimeMillis()) / 86_400_000L).toInt()
        return when { d <= 0 -> "المراجعة: اليوم"; d == 1 -> "المراجعة: بكرا"; else -> "بعد $d أيام" }
    }

    private fun render() {
        body.removeAllViews()
        val all = Store.all(this)
        val dueToday = all.count { it.due <= System.currentTimeMillis() + 86_400_000L }

        val top = hbox().apply { gravity = Gravity.CENTER_VERTICAL }
        top.addView(vbox().apply {
            addView(tv("Scars", 28f, C.TXT, true))
            addView(tv("${all.size} درس • $dueToday للمراجعة اليوم", 14f, C.DIM))
        }, lp(0, -2, 1f))
        top.addView(chip("مراجعة", true) { startActivity(Intent(this, ReviewActivity::class.java)) }, lp(-2, -2, r = 8))
        top.addView(chip("⚙", false) { startActivity(Intent(this, SettingsActivity::class.java)) }, lp(-2, -2, r = 8))
        body.addView(top)

        val chips = hbox()
        (listOf<String?>(null) + C.CATS).forEach { cat ->
            chips.addView(chip(cat ?: "الكل", filter == cat) { filter = cat; render() }, lp(-2, -2, l = 8))
        }
        body.addView(HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = false; layoutDirection = View.LAYOUT_DIRECTION_RTL; addView(chips)
        }, lp(t = 16, b = 12))

        val shown = all.filter { filter == null || it.cat == filter }
        if (shown.isEmpty()) body.addView(tv("ما في دروس بعد.\nاضغط + وسجّل أول درس تعلمتو.", 16f, C.DIM).apply {
            gravity = Gravity.CENTER; setPadding(0, dp(60), 0, 0)
        })
        for (l in shown) {
            val bad = l.fails >= 2
            val card = hbox().apply { background = shape(C.CARD, dp(18).toFloat()) }
            card.addView(View(this).apply { background = shape(if (bad) C.RED else C.Y, dp(3).toFloat()) }, lp(dp(2), -1))
            val inner = vbox().apply { setPadding(dp(14), dp(14), dp(14), dp(14)) }
            inner.addView(tv(l.title, 18f, C.TXT, true))
            val meta = hbox().apply { gravity = Gravity.CENTER_VERTICAL }
            meta.addView(tv(l.cat + if (l.imp == 2) " 🔥" else "", 12f).apply {
                background = shape(C.CHIP, dp(10).toFloat()); setPadding(dp(10), dp(2), dp(10), dp(2))
            })
            meta.addView(View(this), lp(0, 1, 1f))
            meta.addView(tv(if (bad) "🔁 وقعت فيها ${l.fails} مرات" else nextText(l.due), 12f, C.DIM))
            inner.addView(meta, lp(t = 6))
            card.addView(inner, lp(0, -2, 1f))
            card.setOnClickListener {
                startActivity(Intent(this, EditActivity::class.java).putExtra("id", l.id))
            }
            body.addView(card, lp(b = 12))
        }
    }
}
