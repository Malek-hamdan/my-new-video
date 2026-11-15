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
import android.widget.TextView
import android.widget.Toast

class MainActivity : Activity() {
    private lateinit var body: LinearLayout
    private val h = Handler(Looper.getMainLooper())
    private var animate = true
    private val tick = object : Runnable { override fun run() { render(); h.postDelayed(this, 60_000) } }

    override fun onCreate(s: Bundle?) {
        super.onCreate(s)
        if (Build.VERSION.SDK_INT >= 33) requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
        Rx.schedule(this)
        val root = FrameLayout(this)
        body = vbox().apply { setPadding(dp(18), dp(24), dp(18), dp(120)) }
        root.addView(ScrollView(this).apply { addView(body); isVerticalScrollBarEnabled = false; overScrollMode = View.OVER_SCROLL_NEVER })
        val add = btn("＋  New streak", C.G, 0xFF04130D.toInt()) {}
        add.elevation = dp(8).toFloat(); add.pressable { addDialog() }
        root.addView(add, FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM).apply { setMargins(dp(20), 0, dp(20), dp(24)) })
        setContentView(root)
    }
    override fun onResume() { super.onResume(); animate = true; h.post(tick) }
    override fun onPause() { super.onPause(); h.removeCallbacks(tick) }

    private fun greeting(): String {
        val hr = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
        return when { hr < 12 -> "Good morning ☀️"; hr < 18 -> "Good afternoon 🌤"; else -> "Good evening 🌙" }
    }

    private fun render() {
        body.removeAllViews()
        val list = Store.all(this).sortedWith(compareBy<Streak> { it.pending() }.thenByDescending { it.days() })
        var i = 0
        fun add(v: View, lp: LinearLayout.LayoutParams) { body.addView(v, lp); if (animate) v.enter(i++) }

        val top = hbox().apply { gravity = Gravity.CENTER_VERTICAL }
        top.addView(vbox().apply {
            addView(tv(greeting(), 14f, C.DIM))
            addView(tv("My streaks", 30f, C.TXT, true))
        }, lp(0, -2, 1f))
        top.addView(tv("⚙", 22f, C.DIM).apply {
            gravity = Gravity.CENTER; background = shape(C.CARD, dp(22).toFloat())
            pressable { startActivity(Intent(this@MainActivity, SettingsActivity::class.java)) }
        }, lp(dp(44), dp(44)))
        add(top, lp(b = 18))

        if (list.isNotEmpty()) {
            val total = list.sumOf { it.days() }; val best = list.maxOf { it.bestNow() }
            val sum = hbox()
            listOf("$total" to "Total days", "$best" to "Best", "${list.size}" to "Streaks").forEach { (v, l) ->
                sum.addView(vbox().apply {
                    gravity = Gravity.CENTER; background = shape(C.CARD, dp(16).toFloat()); setPadding(0, dp(10), 0, dp(10))
                    addView(tv(v, 20f, C.TXT, true).apply { gravity = Gravity.CENTER })
                    addView(tv(l, 11f, C.DIM).apply { gravity = Gravity.CENTER })
                }, lp(0, -2, 1f, l = 4, r = 4))
            }
            add(sum, lp(b = 16))
        }

        if (Store.duaOn(this)) {
            val di = Store.duaIndex(this)
            val card = vbox().apply { background = shape(C.CARD, dp(18).toFloat(), dp(1), 0x333DDC97); setPadding(dp(16), dp(14), dp(16), dp(14)) }
            if (di >= 0) {
                val (t, r) = Store.dua(this, di)
                card.addView(tv("🤲  Verse of the day • ${di + 1}/365", 12f, C.G, true))
                card.addView(tv(t, 19f, C.TXT).apply { textDirection = View.TEXT_DIRECTION_RTL; gravity = Gravity.END; setLineSpacing(0f, 1.35f); setPadding(0, dp(8), 0, dp(6)) })
                card.addView(tv(r, 12f, C.DIM).apply { textDirection = View.TEXT_DIRECTION_RTL; gravity = Gravity.END })
            } else card.addView(tv("🤲  Verses start in ${-di} days", 15f, C.G))
            add(card, lp(b = 16))
        }

        for (s in list) {
            val d = s.days(); val nm = nextMile(d); val pm = prevMile(d)
            val card = vbox().apply { background = shape(C.CARD, dp(22).toFloat()); setPadding(dp(16), dp(16), dp(16), dp(16)) }
            val row = hbox().apply { gravity = Gravity.CENTER_VERTICAL }
            row.addView(Flame(this).apply { days = d }, lp(dp(46), dp(56)))
            row.addView(vbox().apply {
                addView(tv(s.title, 18f, C.TXT, true))
                addView(tv(if (s.pending()) "⏳ Starts ${android.text.format.DateFormat.format("d/M", s.start)} • in ${(s.nextIn() + DAY - 1) / DAY} days" else (if (d == 0) "Started today" else "${nm - d} to go until $nm days") + (if (s.mask != 127) " • ${maskText(s.mask)}" else ""), 12f, C.DIM))
            }, lp(0, -2, 1f, l = 14, r = 10))
            row.addView(vbox().apply {
                gravity = Gravity.CENTER
                addView(tv(if (s.pending()) "⏳" else "$d", 30f, flameColors(d)[1].let { if (d == 0) C.DIM else it }, true).apply { gravity = Gravity.CENTER })
                addView(tv("days", 11f, C.DIM).apply { gravity = Gravity.CENTER })
            })
            card.addView(row)
            val bar = Bar(this).apply { color = s.color }
            card.addView(bar, lp(-1, dp(6), t = 14))
            bar.animateTo((d - pm).toFloat() / (nm - pm).coerceAtLeast(1), if (animate) 200L + 60 * i else 0)
            card.pressable {
                startActivity(Intent(this, DetailActivity::class.java).putExtra("id", s.id))
                overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
            }
            add(card, lp(b = 12))
        }
        if (list.isEmpty()) {
            val e = vbox().apply { gravity = Gravity.CENTER; setPadding(0, dp(50), 0, 0) }
            e.addView(Flame(this).apply { days = 0 }, lp(dp(80), dp(100)).apply { gravity = Gravity.CENTER })
            e.addView(tv("No streaks yet", 18f, C.TXT, true).apply { gravity = Gravity.CENTER; setPadding(0, dp(16), 0, dp(4)) })
            e.addView(tv("Tap \"New streak\" and light your first fire 🔥", 14f, C.DIM).apply { gravity = Gravity.CENTER })
            add(e, lp())
        }
        animate = false
    }

    private fun addDialog() {
        var color = C.COLORS[0]
        val v = vbox().apply { setPadding(dp(22), dp(8), dp(22), dp(4)) }
        val name = input("e.g. No smoking 🚭"); v.addView(name, lp(t = 6, b = 16))
        v.addView(tv("Color", 14f, C.DIM))
        val row = hbox(); v.addView(row, lp(t = 8))
        fun draw() { row.removeAllViews(); C.COLORS.forEach { col ->
            row.addView(View(this).apply {
                background = shape(col, dp(19).toFloat(), if (col == color) dp(3) else 0, C.TXT)
                scaleX = if (col == color) 1.1f else 1f; scaleY = scaleX
                setOnClickListener { color = col; draw() } }, lp(dp(38), dp(38), l = 12)) } }
        draw()
        v.addView(tv("Days that count", 14f, C.DIM), lp(t = 16))
        val getMask = dayPicker(v, 127)
        v.addView(tv("Days that are off don't count and don't break the streak.", 12f, C.DIM), lp(t = 6))
        var start = System.currentTimeMillis()
        v.addView(tv("Starts from", 14f, C.DIM), lp(t = 16))
        val dateBtn = btn("📅 Now", C.CARD, C.TXT) {}
        fun showDate() { dateBtn.text = if (Math.abs(start - System.currentTimeMillis()) < 60_000) "📅 Now" else "📅 " + android.text.format.DateFormat.format("d/M/yyyy", start) }
        dateBtn.setOnClickListener {
            val cal = java.util.Calendar.getInstance().apply { timeInMillis = start }
            android.app.DatePickerDialog(this, { _, y, m, dd ->
                val pick = java.util.Calendar.getInstance().apply { set(y, m, dd, 0, 0, 0); set(java.util.Calendar.MILLISECOND, 0) }.timeInMillis
                val today = java.util.Calendar.getInstance().apply { set(java.util.Calendar.HOUR_OF_DAY, 0); set(java.util.Calendar.MINUTE, 0); set(java.util.Calendar.SECOND, 0); set(java.util.Calendar.MILLISECOND, 0) }.timeInMillis
                start = if (pick == today) System.currentTimeMillis() else pick
                showDate()
            }, cal.get(java.util.Calendar.YEAR), cal.get(java.util.Calendar.MONTH), cal.get(java.util.Calendar.DAY_OF_MONTH)).show()
        }
        showDate(); v.addView(dateBtn, lp(t = 8))
        v.addView(tv("Pick a past date (counts days since then) or a future date (starts automatically).", 12f, C.DIM), lp(t = 6))
        val dlg = AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert).setTitle("New streak 🔥").setView(v)
            .setPositiveButton("Start", null).setNegativeButton("Cancel", null).create()
        dlg.setOnShowListener {
            dlg.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val t = name.text.toString().trim()
                if (t.isEmpty()) { name.error = "Enter a title"; return@setOnClickListener }
                val now = System.currentTimeMillis()
                Store.upsert(this, Streak(now, t, color, start, 0, 0, start, 0, "[]", getMask())); dlg.dismiss(); animate = true; render()
            }
        }
        dlg.show()
    }
}
