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
        android.app.AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert).setTitle("Your code 🔑").setView(box)
            .setPositiveButton("Copy") { _, _ ->
                getSystemService(android.content.ClipboardManager::class.java).setPrimaryClip(android.content.ClipData.newPlainText("Streak", code))
                Toast.makeText(this, "Copied ✓ keep it somewhere safe", Toast.LENGTH_LONG).show()
            }
            .setNeutralButton("Share") { _, _ ->
                startActivity(android.content.Intent.createChooser(android.content.Intent(android.content.Intent.ACTION_SEND)
                    .setType("text/plain").putExtra(android.content.Intent.EXTRA_TEXT, code), "Save code"))
            }
            .setNegativeButton("Close", null).show()
    }

    private fun restore() {
        val inp = input("Paste the code here").apply { isSingleLine = false; maxLines = 6; textSize = 12f }
        val clip = getSystemService(android.content.ClipboardManager::class.java).primaryClip
        clip?.getItemAt(0)?.text?.toString()?.let { if (it.trim().startsWith("STK1-")) inp.setText(it) }
        val box = vbox().apply { setPadding(dp(20), dp(8), dp(20), 0); addView(inp)
            addView(tv("⚠️ This replaces your current streaks.", 12f, C.DIM), lp(t = 8)) }
        android.app.AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert).setTitle("Restore from code").setView(box)
            .setPositiveButton("Restore") { _, _ ->
                val n = Store.importCode(this, inp.text.toString())
                if (n < 0) Toast.makeText(this, "Invalid or incomplete code ❌", Toast.LENGTH_LONG).show()
                else { Rx.schedule(this); Toast.makeText(this, "Restored $n streaks ✓", Toast.LENGTH_LONG).show(); finish() }
            }.setNegativeButton("Cancel", null).show()
    }

    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        var start = Store.duaStart(this)
        var hour = Store.duaHour(this)
        val root = vbox().apply { setPadding(dp(20), dp(20), dp(20), dp(24)) }
        root.addView(tv("Settings", 26f, C.TXT, true))
        root.addView(tv("🤲 Daily Quran verses", 18f, C.G, true), lp(t = 22, b = 8))
        val sw = Switch(this).apply {
            text = "Show daily verses"; textSize = 17f; setTextColor(C.TXT); isChecked = Store.duaOn(this@SettingsActivity)
            setPadding(dp(14), dp(14), dp(14), dp(14)); background = shape(C.CARD, dp(14).toFloat())
        }
        root.addView(sw)
        val startBtn = btn("", C.CARD, C.TXT) {}
        fun showStart() { startBtn.text = "📅 Start date: " + DateFormat.format("d/M/yyyy", start) }
        showStart()
        startBtn.setOnClickListener {
            val cal = Calendar.getInstance().apply { timeInMillis = start }
            DatePickerDialog(this, { _, y, m, d ->
                start = Calendar.getInstance().apply { set(y, m, d, 0, 0, 0); set(Calendar.MILLISECOND, 0) }.timeInMillis; showStart()
            }, cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), cal.get(Calendar.DAY_OF_MONTH)).show()
        }
        root.addView(startBtn, lp(t = 10))
        val hourBtn = btn("", C.CARD, C.TXT) {}
        fun showHour() { hourBtn.text = "⏰ Notification time: $hour:00" }
        showHour()
        hourBtn.setOnClickListener {
            android.app.TimePickerDialog(this, { _, hh, _ -> hour = hh; showHour() }, hour, 0, true).show()
        }
        root.addView(hourBtn, lp(t = 10))
        root.addView(tv("Duas and verses from the Holy Quran (Uthmani script), 365 days, then it starts over.", 13f, C.DIM), lp(t = 12))
        root.addView(btn("Save", C.G, 0xFF04130D.toInt()) {
            Store.setDua(this, sw.isChecked, start, hour); Rx.schedule(this)
            Toast.makeText(this, "Saved ✓", Toast.LENGTH_SHORT).show(); finish()
        }, lp(t = 26))
        root.addView(btn("🔔 Test notification", C.CARD, C.TXT) {
            val i = Store.duaIndex(this).coerceAtLeast(0); val (t, r) = Store.dua(this, i)
            Rx.notify(this, 1, "🤲 Verse of the day • ${i + 1}/365", "﴿ $t ﴾\n$r")
        }, lp(t = 10))
        root.addView(tv("🤲 Istighfar reminders", 18f, C.G, true), lp(t = 28, b = 8))
        val isw = android.widget.Switch(this).apply {
            text = "Send istighfar notifications"; textSize = 17f; setTextColor(C.TXT); isChecked = Istighfar.on(this@SettingsActivity)
            setPadding(dp(14), dp(14), dp(14), dp(14)); background = shape(C.CARD, dp(14).toFloat())
        }
        root.addView(isw)
        root.addView(tv("Times (hours, comma separated) — one istighfar per notification", 13f, C.DIM), lp(t = 10, b = 6))
        val ih = input("10,15,21").apply { setText(Istighfar.hours(this@SettingsActivity).joinToString(",")) }
        root.addView(ih)
        root.addView(btn("Save istighfar settings", C.G, 0xFF04130D.toInt()) {
            Istighfar.setNotif(this, isw.isChecked, ih.text.toString()); Rx.scheduleIsti(this)
            Toast.makeText(this, "Saved ✓", Toast.LENGTH_SHORT).show()
        }, lp(t = 10))
        root.addView(btn("🔔 Test istighfar notification", C.CARD, C.TXT) { Rx.sendIsti(this) }, lp(t = 10))

        root.addView(tv("💾 Backup code", 18f, C.G, true), lp(t = 28, b = 4))
        root.addView(tv("Create a code and keep it somewhere safe (WhatsApp, Notes, email). If you delete the app or change phones, paste it here to get everything back.", 13f, C.DIM), lp(b = 10))
        root.addView(btn("📤 Create code", C.CARD, C.TXT) { showCode() })
        root.addView(btn("📥 Restore from code", C.CARD, C.TXT) { restore() }, lp(t = 10))
        setContentView(android.widget.ScrollView(this).apply { addView(root) })
    }
}
