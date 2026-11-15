package com.streak.app

import android.app.Activity
import android.app.AlertDialog
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView

class DetailActivity : Activity() {
    private lateinit var s: Streak
    private lateinit var ring: Ring
    private lateinit var next: TextView
    private lateinit var stats: LinearLayout
    private lateinit var title: TextView
    private val h = Handler(Looper.getMainLooper())
    private val tick = object : Runnable { override fun run() { update(); h.postDelayed(this, 1000) } }

    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        s = Store.get(this, intent.getLongExtra("id", 0)) ?: return finish()
        val root = vbox().apply { setPadding(dp(20), dp(20), dp(20), dp(24)) }
        val top = hbox()
        top.addView(tv("→ رجوع", 15f, C.DIM).apply { setOnClickListener { finish() } }, lp(0, -2, 1f))
        top.addView(tv("✎ تعديل", 15f, C.DIM).apply { setOnClickListener { edit() } })
        root.addView(top)
        title = tv(s.title, 26f, C.TXT, true).apply { gravity = Gravity.CENTER }
        root.addView(title, lp(t = 14))
        ring = Ring(this).apply { color = s.color; small = "يوم 🔥" }
        root.addView(ring, lp(-1, dp(250), t = 20))
        next = tv("", 15f, C.DIM).apply { gravity = Gravity.CENTER }
        root.addView(next, lp(t = 10, b = 18))
        stats = hbox(); root.addView(stats)
        root.addView(LinearLayout(this), lp(-1, 0, 1f))
        root.addView(btn("↺ صفّر الستريك", C.BG, 0xFFFF6B6B.toInt(), 0x88FF6B6B.toInt()) {
            AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert).setTitle("⚠️ أكيد بدك تصفّر؟")
                .setMessage("رح يرجع \"${s.title}\" من ${s.days()} لـ 0")
                .setPositiveButton("صفّر") { _, _ -> Store.reset(this, s); update() }
                .setNegativeButton("لا، كمّل", null).show()
        }, lp(t = 16))
        root.addView(tv("🗑 احذف الستريك", 14f, 0xFF777777.toInt()).apply {
            gravity = Gravity.CENTER; setPadding(0, dp(14), 0, dp(4))
            setOnClickListener {
                AlertDialog.Builder(this@DetailActivity, android.R.style.Theme_DeviceDefault_Dialog_Alert).setMessage("تحذف \"${s.title}\" نهائياً؟")
                    .setPositiveButton("احذف") { _, _ -> Store.delete(this@DetailActivity, s.id); finish() }
                    .setNegativeButton("لا", null).show()
            }
        })
        setContentView(root)
    }
    override fun onResume() { super.onResume(); h.post(tick) }
    override fun onPause() { super.onPause(); h.removeCallbacks(tick) }

    private fun update() {
        val n = s.nextIn()
        ring.big = s.days().toString(); ring.progress = 1f - n / DAY.toFloat(); ring.invalidate()
        val sec = n / 1000
        next.text = "اليوم الجاي بعد %02d:%02d:%02d".format(sec / 3600, sec / 60 % 60, sec % 60)
        stats.removeAllViews()
        listOf(s.bestNow().toString() to "أطول ستريك", s.resets.toString() to "مرات صفّرت",
            android.text.format.DateFormat.format("d/M", s.start).toString() to "بلشت").forEach { (v, l) ->
            stats.addView(vbox().apply {
                gravity = Gravity.CENTER; background = shape(C.CARD, dp(16).toFloat()); setPadding(0, dp(12), 0, dp(12))
                addView(tv(v, 22f, C.TXT, true).apply { gravity = Gravity.CENTER })
                addView(tv(l, 12f, C.DIM).apply { gravity = Gravity.CENTER })
            }, lp(0, -2, 1f, l = 5, r = 5))
        }
    }

    private fun edit() {
        val inp = input("العنوان").apply { setText(s.title) }
        val box = vbox().apply { setPadding(dp(20), dp(10), dp(20), 0); addView(inp) }
        AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert).setTitle("تعديل العنوان").setView(box)
            .setPositiveButton("احفظ") { _, _ ->
                val t = inp.text.toString().trim(); if (t.isNotEmpty()) { s.title = t; Store.upsert(this, s); title.text = t }
            }.setNegativeButton("إلغاء", null).show()
    }
}
