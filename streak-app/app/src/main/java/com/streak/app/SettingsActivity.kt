package com.streak.app

import android.app.Activity
import android.app.DatePickerDialog
import android.os.Bundle
import android.text.format.DateFormat
import android.widget.Switch
import android.widget.Toast
import java.util.Calendar

class SettingsActivity : Activity() {
    private fun showCode() {
        val code = Store.exportCode(this)
        val box = vbox().apply { setPadding(dp(20), dp(8), dp(20), 0) }
        box.addView(input("").apply { setText(code); isSingleLine = false; maxLines = 6; textSize = 12f; setTextIsSelectable(true); keyListener = null })
        android.app.AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert).setTitle("كودك 🔑").setView(box)
            .setPositiveButton("انسخ") { _, _ ->
                getSystemService(android.content.ClipboardManager::class.java).setPrimaryClip(android.content.ClipData.newPlainText("Streak", code))
                Toast.makeText(this, "انسخ ✓ حطو بمكان آمن", Toast.LENGTH_LONG).show()
            }
            .setNeutralButton("شارك") { _, _ ->
                startActivity(android.content.Intent.createChooser(android.content.Intent(android.content.Intent.ACTION_SEND)
                    .setType("text/plain").putExtra(android.content.Intent.EXTRA_TEXT, code), "احفظ الكود"))
            }
            .setNegativeButton("سكّر", null).show()
    }

    private fun restore() {
        val inp = input("الزق الكود هون").apply { isSingleLine = false; maxLines = 6; textSize = 12f }
        val clip = getSystemService(android.content.ClipboardManager::class.java).primaryClip
        clip?.getItemAt(0)?.text?.toString()?.let { if (it.trim().startsWith("STK1-")) inp.setText(it) }
        val box = vbox().apply { setPadding(dp(20), dp(8), dp(20), 0); addView(inp)
            addView(tv("⚠️ رح ينحط محل الستريكات الموجودة هلأ.", 12f, C.DIM), lp(t = 8)) }
        android.app.AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert).setTitle("رجّع بالكود").setView(box)
            .setPositiveButton("رجّع") { _, _ ->
                val n = Store.importCode(this, inp.text.toString())
                if (n < 0) Toast.makeText(this, "الكود غلط أو ناقص ❌", Toast.LENGTH_LONG).show()
                else { Rx.schedule(this); Toast.makeText(this, "رجعو $n ستريكات ✓", Toast.LENGTH_LONG).show(); finish() }
            }.setNegativeButton("إلغاء", null).show()
    }

    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        var start = Store.duaStart(this)
        var hour = Store.duaHour(this)
        val root = vbox().apply { setPadding(dp(20), dp(20), dp(20), dp(24)) }
        root.addView(tv("الإعدادات", 26f, C.TXT, true))
        root.addView(tv("🤲 الأدعية والآيات", 18f, C.G, true), lp(t = 22, b = 8))
        val sw = Switch(this).apply {
            text = "اسمح للأدعية تطلع"; textSize = 17f; setTextColor(C.TXT); isChecked = Store.duaOn(this@SettingsActivity)
            setPadding(dp(14), dp(14), dp(14), dp(14)); background = shape(C.CARD, dp(14).toFloat())
        }
        root.addView(sw)
        val startBtn = btn("", C.CARD, C.TXT) {}
        fun showStart() { startBtn.text = "📅 تاريخ البداية: " + DateFormat.format("d/M/yyyy", start) }
        showStart()
        startBtn.setOnClickListener {
            val cal = Calendar.getInstance().apply { timeInMillis = start }
            DatePickerDialog(this, { _, y, m, d ->
                start = Calendar.getInstance().apply { set(y, m, d, 0, 0, 0); set(Calendar.MILLISECOND, 0) }.timeInMillis; showStart()
            }, cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), cal.get(Calendar.DAY_OF_MONTH)).show()
        }
        root.addView(startBtn, lp(t = 10))
        val hourBtn = btn("", C.CARD, C.TXT) {}
        fun showHour() { hourBtn.text = "⏰ وقت الإشعار: $hour:00" }
        showHour()
        hourBtn.setOnClickListener {
            android.app.TimePickerDialog(this, { _, hh, _ -> hour = hh; showHour() }, hour, 0, true).show()
        }
        root.addView(hourBtn, lp(t = 10))
        root.addView(tv("الأدعية والآيات من القرآن الكريم (النص العثماني)، 365 يوم وبعدها بترجع من الأول.", 13f, C.DIM), lp(t = 12))
        root.addView(btn("احفظ", C.G, 0xFF04130D.toInt()) {
            Store.setDua(this, sw.isChecked, start, hour); Rx.schedule(this)
            Toast.makeText(this, "انحفظ ✓", Toast.LENGTH_SHORT).show(); finish()
        }, lp(t = 26))
        root.addView(btn("🔔 جرّب الإشعار هلأ", C.CARD, C.TXT) {
            val i = Store.duaIndex(this).coerceAtLeast(0); val (t, r) = Store.dua(this, i)
            Rx.notify(this, 1, "🤲 دعاء اليوم • ${i + 1}/365", "﴿ $t ﴾\n$r")
        }, lp(t = 10))
        root.addView(tv("💾 نسخة احتياطية بالكود", 18f, C.G, true), lp(t = 28, b = 4))
        root.addView(tv("اعمل كود واحفظو بمكان آمن (واتساب، نوتس، إيميل). إذا مسحت التطبيق أو غيّرت تلفونك، لزقو هون وبيرجع كل شي.", 13f, C.DIM), lp(b = 10))
        root.addView(btn("📤 اعمل كود", C.CARD, C.TXT) { showCode() })
        root.addView(btn("📥 رجّع بالكود", C.CARD, C.TXT) { restore() }, lp(t = 10))
        setContentView(android.widget.ScrollView(this).apply { addView(root) })
    }
}
