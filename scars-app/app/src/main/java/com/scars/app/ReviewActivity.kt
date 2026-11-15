package com.scars.app

import android.app.Activity
import android.os.Bundle
import android.view.Gravity
import android.widget.LinearLayout

class ReviewActivity : Activity() {
    private lateinit var queue: MutableList<Lesson>
    private var pos = 0
    private lateinit var root: LinearLayout

    override fun onCreate(s: Bundle?) {
        super.onCreate(s)
        val now = System.currentTimeMillis()
        val all = Store.all(this)
        queue = (all.filter { it.due <= now }.shuffled() + all.filter { it.due > now }.shuffled()).take(10).toMutableList()
        root = vbox().apply { setPadding(dp(20), dp(20), dp(20), dp(20)) }
        setContentView(root)
        show(false)
    }

    private fun show(revealed: Boolean) {
        root.removeAllViews()
        root.addView(tv("مراجعة", 26f, C.TXT, true))
        if (pos >= queue.size) {
            root.addView(tv(if (queue.isEmpty()) "ما في دروس للمراجعة." else "خلصت المراجعة 👏", 20f, C.TXT, true).apply {
                gravity = Gravity.CENTER; setPadding(0, dp(120), 0, dp(30))
            })
            root.addView(btn("رجوع", true) { finish() })
            return
        }
        val l = queue[pos]
        root.addView(tv("${pos + 1} من ${queue.size}", 14f, C.DIM))
        root.addView(LinearLayout(this), lp(-1, 0, 1f))
        val card = vbox().apply {
            gravity = Gravity.CENTER
            background = shape(C.CARD, dp(24).toFloat(), dp(2), 0xFF333333.toInt())
            setPadding(dp(22), dp(34), dp(22), dp(34))
        }
        val prompt = if (l.story.isBlank()) "📌 ${l.cat}" else l.story
        card.addView(tv(if (revealed) "الدرس" else "شو الدرس؟", 14f, C.Y).apply { gravity = Gravity.CENTER })
        card.addView(tv(if (revealed) l.title else prompt, if (revealed) 30f else 22f, C.TXT, true).apply {
            gravity = Gravity.CENTER; setPadding(0, dp(16), 0, dp(16))
        })
        if (!revealed) card.addView(tv("اضغط لتشوف الجواب", 14f, C.DIM).apply { gravity = Gravity.CENTER })
        card.setOnClickListener { show(true) }
        root.addView(card)
        root.addView(LinearLayout(this), lp(-1, 0, 1f))
        val row = hbox()
        row.addView(btn("✓ متذكّرو", true) { Rx.remembered(this, l); pos++; show(false) }, lp(0, -2, 1f, l = 6))
        row.addView(btn("نسيتو", false) { Rx.fell(this, l); pos++; show(false) }, lp(0, -2, 1f, r = 6))
        root.addView(row)
    }
}
