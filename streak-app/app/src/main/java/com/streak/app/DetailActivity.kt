package com.streak.app

import android.animation.ValueAnimator
import android.app.Activity
import android.app.AlertDialog
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.format.DateFormat
import android.view.Gravity
import android.view.View
import android.view.animation.DecelerateInterpolator
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import org.json.JSONArray
import java.util.Calendar

class DetailActivity : Activity() {
    private lateinit var s: Streak
    private lateinit var body: LinearLayout
    private var next: TextView? = null
    private val h = Handler(Looper.getMainLooper())
    private val tick = object : Runnable { override fun run() { countdown(); h.postDelayed(this, 1000) } }

    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        s = Store.get(this, intent.getLongExtra("id", 0)) ?: return finish()
        body = vbox().apply { setPadding(dp(20), dp(20), dp(20), dp(30)) }
        setContentView(ScrollView(this).apply { addView(body); isVerticalScrollBarEnabled = false; overScrollMode = View.OVER_SCROLL_NEVER })
        build(true)
    }
    override fun onResume() { super.onResume(); h.post(tick) }
    override fun onPause() { super.onPause(); h.removeCallbacks(tick) }
    override fun finish() { super.finish(); overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out) }

    private fun countdown() {
        val sec = s.nextIn() / 1000
        next?.text = if (s.pending()) {
            val dd = sec / 86400
            "⏳ بيبلش بعد " + (if (dd > 0) "$dd يوم و " else "") + "%02d:%02d:%02d".format(sec / 3600 % 24, sec / 60 % 60, sec % 60)
        } else "اليوم الجاي بعد  %02d:%02d:%02d".format(sec / 3600, sec / 60 % 60, sec % 60)
        if (sec <= 1) h.postDelayed({ build(true) }, 1500)
    }

    private fun build(anim: Boolean) {
        body.removeAllViews()
        val d = s.days(); val nm = nextMile(d); val pm = prevMile(d)
        var i = 0
        fun add(v: View, lp: LinearLayout.LayoutParams) { body.addView(v, lp); if (anim) v.enter(i++) }

        val top = hbox().apply { gravity = Gravity.CENTER_VERTICAL }
        top.addView(tv("→", 22f, C.TXT).apply { gravity = Gravity.CENTER; background = shape(C.CARD, dp(22).toFloat()); pressable { finish() } }, lp(dp(44), dp(44)))
        top.addView(tv(s.title, 18f, C.TXT, true).apply { gravity = Gravity.CENTER }, lp(0, -2, 1f))
        top.addView(tv("✎", 20f, C.TXT).apply { gravity = Gravity.CENTER; background = shape(C.CARD, dp(22).toFloat()); pressable { edit() } }, lp(dp(44), dp(44)))
        add(top, lp())

        val flame = Flame(this).apply { days = d }
        add(flame, lp(dp(130), dp(160), t = 26).apply { gravity = Gravity.CENTER_HORIZONTAL })
        val num = tv("0", 76f, C.TXT, true).apply { gravity = Gravity.CENTER; includeFontPadding = false }
        add(num, lp(t = 8))
        if (anim && d > 0) ValueAnimator.ofInt(0, d).apply { duration = 1000; interpolator = DecelerateInterpolator(); startDelay = 150
            addUpdateListener { num.text = "${it.animatedValue}" } }.start() else num.text = "$d"
        add(tv(if (s.mask != 127) "📅 ${maskText(s.mask)}" else "", 13f, s.color).apply { gravity = Gravity.CENTER }, lp())
        add(tv(if (s.pending()) "بيبلش ${DateFormat.format("d/M/yyyy", s.start)}" else if (d == 1) "يوم 🔥" else "يوم متتالي", 16f, C.DIM).apply { gravity = Gravity.CENTER }, lp())
        next = tv("", 14f, s.color).apply { gravity = Gravity.CENTER }
        add(next!!, lp(t = 6, b = 22)); countdown()

        // next milestone
        val mc = vbox().apply { background = shape(C.CARD, dp(20).toFloat()); setPadding(dp(16), dp(14), dp(16), dp(16)) }
        val mr = hbox()
        mr.addView(tv("🎯 الهدف الجاي: $nm يوم", 15f, C.TXT, true), lp(0, -2, 1f))
        mr.addView(tv("باقي ${nm - d}", 13f, C.DIM))
        mc.addView(mr)
        val bar = Bar(this).apply { color = s.color }; mc.addView(bar, lp(-1, dp(8), t = 12))
        bar.animateTo((d - pm).toFloat() / (nm - pm).coerceAtLeast(1), if (anim) 300 else 0)
        add(mc, lp(b = 12))

        // last 7 days
        val wk = vbox().apply { background = shape(C.CARD, dp(20).toFloat()); setPadding(dp(14), dp(14), dp(14), dp(14)) }
        wk.addView(tv("آخر 7 أيام", 14f, C.DIM), lp(b = 10))
        val wr = hbox()
        val names = arrayOf("ح", "ن", "ث", "ر", "خ", "ج", "س")
        val startMid = Calendar.getInstance().apply { timeInMillis = s.start; set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }.timeInMillis
        for (k in 6 downTo 0) {
            val cal = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, -k); set(Calendar.HOUR_OF_DAY, 12) }
            val off = !s.dayOn(cal.timeInMillis)
            val done = !off && cal.timeInMillis >= startMid && (k > 0 || d > 0)
            val today = k == 0
            wr.addView(vbox().apply {
                gravity = Gravity.CENTER
                addView(tv(names[cal.get(Calendar.DAY_OF_WEEK) - 1], 12f, if (today) C.TXT else C.DIM).apply { gravity = Gravity.CENTER })
                addView(tv(if (done) "🔥" else if (off) "–" else "", 15f, C.DIM).apply {
                    gravity = Gravity.CENTER
                    background = shape(if (done) (s.color and 0x00FFFFFF or 0x40000000) else 0xFF1F2A26.toInt(), dp(17).toFloat(), if (today) dp(2) else 0, s.color)
                }, lp(dp(34), dp(34), t = 6))
            }, lp(0, -2, 1f))
        }
        wk.addView(wr); add(wk, lp(b = 12))

        // badges
        val bc = vbox().apply { background = shape(C.CARD, dp(20).toFloat()); setPadding(dp(14), dp(14), dp(14), dp(14)) }
        bc.addView(tv("الإنجازات", 14f, C.DIM), lp(b = 10))
        val br = hbox()
        intArrayOf(7, 30, 100, 365).forEach { m ->
            val got = s.bestNow() >= m
            br.addView(vbox().apply {
                gravity = Gravity.CENTER; alpha = if (got) 1f else 0.35f
                addView(Flame(this@DetailActivity).apply { days = if (got) m else 0 }, lp(dp(30), dp(38)).apply { gravity = Gravity.CENTER })
                addView(tv("$m يوم", 12f, if (got) C.TXT else C.DIM, got).apply { gravity = Gravity.CENTER }, lp(t = 4))
            }, lp(0, -2, 1f))
        }
        bc.addView(br); add(bc, lp(b = 12))

        // stats
        val st = hbox()
        listOf(s.bestNow().toString() to "أطول ستريك", s.resets.toString() to "مرات صفّرت",
            DateFormat.format("d/M/yy", s.start).toString() to "آخر بداية").forEach { (v, l) ->
            st.addView(vbox().apply {
                gravity = Gravity.CENTER; background = shape(C.CARD, dp(16).toFloat()); setPadding(0, dp(12), 0, dp(12))
                addView(tv(v, 20f, C.TXT, true).apply { gravity = Gravity.CENTER })
                addView(tv(l, 11f, C.DIM).apply { gravity = Gravity.CENTER })
            }, lp(0, -2, 1f, l = 4, r = 4))
        }
        add(st, lp(b = 12))

        // history
        val hist = JSONArray(s.hist)
        if (hist.length() > 0) {
            val hc = vbox().apply { background = shape(C.CARD, dp(20).toFloat()); setPadding(dp(16), dp(14), dp(16), dp(10)) }
            hc.addView(tv("المحاولات السابقة", 14f, C.DIM), lp(b = 6))
            for (k in hist.length() - 1 downTo maxOf(0, hist.length() - 8)) {
                val o = hist.getJSONObject(k)
                val r = hbox().apply { setPadding(0, dp(6), 0, dp(6)) }
                r.addView(tv(DateFormat.format("d/M", o.getLong("s")).toString() + "  ←  " + DateFormat.format("d/M", o.getLong("e")), 14f, C.TXT), lp(0, -2, 1f))
                r.addView(tv("${o.getInt("d")} يوم", 14f, if (o.getInt("d") == s.bestNow()) s.color else C.DIM, true))
                hc.addView(r)
            }
            add(hc, lp(b = 12))
        }

        add(HoldButton(this, "اضغط مطوّل لتصفّر ↺", 0xFFFF6B6B.toInt()) {
            val old = s.days(); Store.reset(this, s)
            Toast.makeText(this, if (old > 0) "انطفت النار بعد $old يوم. ولّعها من جديد 💪" else "صفّرت", Toast.LENGTH_LONG).show()
            build(true)
        }, lp(-1, dp(56), t = 8))
        add(tv("🗑 احذف الستريك", 14f, 0xFF777777.toInt()).apply {
            gravity = Gravity.CENTER; setPadding(0, dp(16), 0, dp(4))
            setOnClickListener {
                AlertDialog.Builder(this@DetailActivity, android.R.style.Theme_DeviceDefault_Dialog_Alert).setMessage("تحذف \"${s.title}\" نهائياً؟")
                    .setPositiveButton("احذف") { _, _ -> Store.delete(this@DetailActivity, s.id); finish() }
                    .setNegativeButton("لا", null).show()
            }
        }, lp())
    }

    private fun edit() {
        val inp = input("العنوان").apply { setText(s.title) }
        var color = s.color
        val box = vbox().apply { setPadding(dp(22), dp(8), dp(22), 0); addView(inp) }
        box.addView(tv("الأيام اللي بتنحسب", 13f, C.DIM), lp(t = 14))
        val getMask = dayPicker(box, s.mask)
        val row = hbox(); box.addView(row, lp(t = 14))
        fun draw() { row.removeAllViews(); C.COLORS.forEach { col ->
            row.addView(View(this).apply { background = shape(col, dp(19).toFloat(), if (col == color) dp(3) else 0, C.TXT)
                setOnClickListener { color = col; draw() } }, lp(dp(38), dp(38), l = 12)) } }
        draw()
        AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert).setTitle("تعديل").setView(box)
            .setPositiveButton("احفظ") { _, _ ->
                val t = inp.text.toString().trim(); if (t.isNotEmpty()) s.title = t
                s.color = color; s.mask = getMask(); Store.upsert(this, s); build(false)
            }.setNegativeButton("إلغاء", null).show()
    }
}
