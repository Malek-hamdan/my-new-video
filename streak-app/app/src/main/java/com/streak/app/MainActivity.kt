package com.streak.app

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Toast

class MainActivity : Activity() {
    private lateinit var body: LinearLayout
    private val h = Handler(Looper.getMainLooper())
    private val tick = object : Runnable { override fun run() { render(); h.postDelayed(this, 60_000) } }

    override fun onCreate(s: Bundle?) {
        super.onCreate(s)
        if (Build.VERSION.SDK_INT >= 33) requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
        Rx.schedule(this)
        val root = FrameLayout(this)
        body = vbox().apply { setPadding(dp(18), dp(22), dp(18), dp(110)) }
        root.addView(ScrollView(this).apply { addView(body) })
        root.addView(btn("＋ ستريك جديد", C.G, 0xFF04130D.toInt()) { addDialog() },
            FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM).apply { setMargins(dp(20), 0, dp(20), dp(24)) })
        setContentView(root)
    }
    override fun onResume() { super.onResume(); h.post(tick) }
    override fun onPause() { super.onPause(); h.removeCallbacks(tick) }

    private fun render() {
        body.removeAllViews()
        val list = Store.all(this)
        val top = hbox().apply { gravity = Gravity.CENTER_VERTICAL }
        top.addView(vbox().apply {
            addView(tv("Streak", 28f, C.TXT, true))
            addView(tv(if (list.isEmpty()) "ما في ستريكات بعد" else "${list.size} ستريكات شغّالة", 14f, C.DIM))
        }, lp(0, -2, 1f))
        top.addView(tv("⚙", 24f, C.DIM).apply { setPadding(dp(10), dp(6), dp(10), dp(6))
            setOnClickListener { startActivity(Intent(this@MainActivity, SettingsActivity::class.java)) } })
        body.addView(top, lp(b = 16))

        if (Store.duaOn(this)) {
            val i = Store.duaIndex(this)
            val card = vbox().apply { background = shape(C.CARD, dp(16).toFloat()); setPadding(dp(16), dp(12), dp(16), dp(14)) }
            if (i >= 0) {
                val (t, r) = Store.dua(this, i)
                card.addView(tv("🤲 دعاء اليوم • ${i + 1}/365", 12f, C.G))
                card.addView(tv(t, 20f, C.TXT).apply { setLineSpacing(0f, 1.3f); setPadding(0, dp(6), 0, dp(4)) })
                card.addView(tv(r, 12f, C.DIM))
            } else card.addView(tv("🤲 الأدعية بتبلش بعد ${-i} يوم", 15f, C.G))
            body.addView(card, lp(b = 16))
        }

        for (s in list) {
            val card = hbox().apply { gravity = Gravity.CENTER_VERTICAL; background = shape(C.CARD, dp(20).toFloat()); setPadding(dp(14), dp(14), dp(14), dp(14)) }
            card.addView(Ring(this).apply { progress = 1f - s.nextIn() / DAY.toFloat(); color = s.color; big = s.days().toString() }, lp(dp(72), dp(72)))
            card.addView(vbox().apply {
                addView(tv(s.title, 18f, C.TXT, true))
                addView(tv("أطول ستريك: ${s.bestNow()} • من ${android.text.format.DateFormat.format("d/M", s.created)}", 12f, C.DIM))
            }, lp(0, -2, 1f, l = 14))
            card.setOnClickListener { startActivity(Intent(this, DetailActivity::class.java).putExtra("id", s.id)) }
            body.addView(card, lp(b = 12))
        }
        if (list.isEmpty()) body.addView(tv("اكبس \"ستريك جديد\" وابدأ العدّ 🔥", 16f, C.DIM).apply { gravity = Gravity.CENTER; setPadding(0, dp(60), 0, 0) })
    }

    private fun addDialog() {
        var color = C.COLORS[0]
        val v = vbox().apply { setPadding(dp(20), dp(10), dp(20), dp(4)) }
        v.addView(tv("العنوان", 14f, C.DIM))
        val name = input("مثلاً: بلا دخان 🚭"); v.addView(name, lp(t = 6, b = 14))
        v.addView(tv("اللون", 14f, C.DIM))
        val row = hbox(); v.addView(row, lp(t = 6))
        fun draw() { row.removeAllViews(); C.COLORS.forEach { col ->
            row.addView(View(this).apply { background = shape(col, dp(18).toFloat(), if (col == color) dp(3) else 0, C.TXT)
                setOnClickListener { color = col; draw() } }, lp(dp(36), dp(36), l = 10)) } }
        draw()
        AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert).setTitle("ستريك جديد").setView(v)
            .setPositiveButton("ابدأ من اليوم") { _, _ ->
                val t = name.text.toString().trim()
                if (t.isEmpty()) { Toast.makeText(this, "اكتب عنوان", Toast.LENGTH_SHORT).show(); return@setPositiveButton }
                val now = System.currentTimeMillis()
                Store.upsert(this, Streak(now, t, color, now, 0, 0, now, 0)); render()
            }.setNegativeButton("إلغاء", null).show()
    }
}
