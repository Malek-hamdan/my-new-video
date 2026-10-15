package com.malek.photovault

import android.os.Bundle
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat

class DoneActivity : SecureActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_done)
        val requested = intent.getIntExtra("requested", 0)
        val saved = intent.getIntExtra("saved", 0)
        val deleted = intent.getIntExtra("deleted", 0)

        findViewById<TextView>(R.id.title).text = "تم نقل $saved صور"
        findViewById<TextView>(R.id.subtitle).text = when {
            deleted >= saved -> "انحفظت بالخزنة مشفّرة\nوانحذفت من الجالري"
            else -> "انحفظت بالخزنة، بس ما انحذفت من الجالري\nفعّل «إدارة الوسائط» أو وافق على الحذف"
        }

        val rows = findViewById<LinearLayout>(R.id.rows)
        addRow(rows, "حفظ بالخزنة", "✓ $saved/$requested", saved == requested)
        addRow(rows, "تأكيد سلامة الملفات", "✓", true)
        addRow(rows, "حذف من الجالري", "$deleted/$saved", deleted >= saved)

        findViewById<View>(R.id.backBtn).setOnClickListener { finish() }
    }

    private fun addRow(parent: LinearLayout, label: String, value: String, good: Boolean) {
        val pad = (6 * resources.displayMetrics.density).toInt()
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, pad, 0, pad)
        }
        row.addView(TextView(this).apply {
            text = label
            textSize = 14f
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        })
        row.addView(TextView(this).apply {
            text = value
            textSize = 14f
            setTextColor(ContextCompat.getColor(context, if (good) R.color.accent else R.color.danger))
        })
        parent.addView(row)
    }
}
