package com.scars.app

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.text.InputType
import android.widget.ScrollView
import android.widget.Toast

class SettingsActivity : Activity() {
    override fun onCreate(s: Bundle?) {
        super.onCreate(s)
        val b = vbox().apply { setPadding(dp(20), dp(20), dp(20), dp(30)) }
        b.addView(tv("الإعدادات", 26f, C.TXT, true))
        b.addView(label("أوقات الإشعارات (ساعات، مفصولة بفاصلة)"))
        val slots = input("9,14,20").apply { setText(Sched.slots(this@SettingsActivity).joinToString(",")) }
        b.addView(slots)
        b.addView(label("أقصى عدد إشعارات باليوم"))
        val max = input("5").apply { inputType = InputType.TYPE_CLASS_NUMBER; setText(Sched.maxDay(this@SettingsActivity).toString()) }
        b.addView(max)
        b.addView(btn("احفظ", true) {
            Sched.setSettings(this, slots.text.toString(), max.text.toString().toIntOrNull() ?: 5)
            Toast.makeText(this, "انحفظ ✓", Toast.LENGTH_SHORT).show(); finish()
        }, lp(t = 20))

        b.addView(label("نسخة احتياطية"))
        b.addView(btn("📤 صدّر الدروس لملف", false) {
            startActivityForResult(Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                .setType("application/json").putExtra(Intent.EXTRA_TITLE, "scars-backup.json"), 1)
        })
        b.addView(btn("📥 رجّع الدروس من ملف", false) {
            startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                .setType("*/*"), 2)
        }, lp(t = 10))
        b.addView(btn("🔔 جرّب إشعار هلأ", false) {
            val l = Store.all(this).randomOrNull()
            if (l == null) Toast.makeText(this, "ضيف درس أول", Toast.LENGTH_SHORT).show() else Notif.show(this, l)
        }, lp(t = 10))
        setContentView(ScrollView(this).apply { addView(b) })
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(req: Int, res: Int, data: Intent?) {
        super.onActivityResult(req, res, data)
        val uri = data?.data ?: return
        if (res != RESULT_OK) return
        try {
            if (req == 1) {
                contentResolver.openOutputStream(uri)?.use { it.write(Store.export(this).toByteArray()) }
                Toast.makeText(this, "انحفظت النسخة ✓", Toast.LENGTH_SHORT).show()
            } else {
                val txt = contentResolver.openInputStream(uri)?.use { it.readBytes().toString(Charsets.UTF_8) } ?: return
                val n = Store.import(this, txt)
                Toast.makeText(this, "انضاف $n درس ✓", Toast.LENGTH_SHORT).show()
            }
        } catch (e: Exception) {
            Toast.makeText(this, "صار خطأ بالملف", Toast.LENGTH_SHORT).show()
        }
    }
}
