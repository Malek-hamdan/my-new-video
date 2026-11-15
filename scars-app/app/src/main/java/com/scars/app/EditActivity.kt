package com.scars.app

import android.app.Activity
import android.app.AlertDialog
import android.os.Bundle
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Toast

class EditActivity : Activity() {
    private var cat = C.CATS[0]
    private var imp = 1
    private lateinit var catRow: LinearLayout
    private lateinit var impRow: LinearLayout

    override fun onCreate(s: Bundle?) {
        super.onCreate(s)
        val id = intent.getLongExtra("id", 0)
        val old = if (id != 0L) Store.get(this, id) else null
        old?.let { cat = it.cat; imp = it.imp }

        val b = vbox().apply { setPadding(dp(20), dp(20), dp(20), dp(30)) }
        b.addView(tv(if (old == null) "درس جديد" else "تعديل الدرس", 26f, C.TXT, true))
        b.addView(label("الدرس"))
        val title = input("مثلاً: لا تثق بالوجه البشوش").apply { setText(old?.title ?: "") }
        b.addView(title)
        b.addView(label("شو صار معي؟"))
        val story = input("احكي الموقف باختصار...", true).apply { setText(old?.story ?: "") }
        b.addView(story)
        b.addView(label("التصنيف"))
        catRow = hbox(); b.addView(catRow)
        b.addView(label("قديش مهم؟"))
        impRow = hbox(); b.addView(impRow)
        drawChips()

        b.addView(btn("احفظ الدرس", true) {
            val t = title.text.toString().trim()
            if (t.isEmpty()) { Toast.makeText(this, "اكتب الدرس أول", Toast.LENGTH_SHORT).show(); return@btn }
            val now = System.currentTimeMillis()
            val l = old?.apply { this.title = t; this.story = story.text.toString().trim(); this.cat = this@EditActivity.cat; this.imp = this@EditActivity.imp }
                ?: Lesson(now, t, story.text.toString().trim(), cat, imp, 0, now, 0, now)
            Store.upsert(this, l)
            if (old == null) Notif.show(this, l)
            finish()
        }, lp(t = 28))

        if (old != null) b.addView(btn("حذف", false) {
            AlertDialog.Builder(this).setMessage("أكيد بدك تحذف هالدرس؟")
                .setPositiveButton("حذف") { _, _ -> Store.delete(this, old.id); finish() }
                .setNegativeButton("لا", null).show()
        }, lp(t = 12))

        setContentView(ScrollView(this).apply { addView(b) })
    }

    private fun drawChips() {
        catRow.removeAllViews(); impRow.removeAllViews()
        C.CATS.forEach { c -> catRow.addView(chip(c, c == cat) { cat = c; drawChips() }, lp(-2, -2, l = 6)) }
        C.IMPS.forEachIndexed { i, s -> impRow.addView(chip(s, i == imp) { imp = i; drawChips() }, lp(-2, -2, l = 6)) }
    }
}
