package com.streak.app

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView

object C {
    val BG = 0xFF0D1412.toInt()
    val CARD = 0xFF15201C.toInt()
    val CHIP = 0xFF2A302E.toInt()
    val G = 0xFF3DDC97.toInt()
    val RED = 0xFFFF5252.toInt()
    val TXT = 0xFFEEEEEE.toInt()
    val DIM = 0xFF88AA99.toInt()
    val COLORS = intArrayOf(0xFF3DDC97.toInt(), 0xFFFFB347.toInt(), 0xFF6FA8FF.toInt(), 0xFFB57BFF.toInt(), 0xFFFF6B6B.toInt())
}

fun Context.dp(v: Int) = (v * resources.displayMetrics.density).toInt()
fun shape(color: Int, r: Float, stroke: Int = 0, sc: Int = 0) = GradientDrawable().apply {
    setColor(color); cornerRadius = r; if (stroke > 0) setStroke(stroke, sc)
}
fun Context.tv(s: String, size: Float = 16f, color: Int = C.TXT, bold: Boolean = false) = TextView(this).apply {
    text = s; textSize = size; setTextColor(color); if (bold) typeface = Typeface.DEFAULT_BOLD
    textDirection = View.TEXT_DIRECTION_RTL
}
fun Context.vbox() = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; layoutDirection = View.LAYOUT_DIRECTION_RTL }
fun Context.hbox() = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; layoutDirection = View.LAYOUT_DIRECTION_RTL }
fun Context.btn(s: String, bg: Int, fg: Int, stroke: Int = 0, onClick: () -> Unit) = tv(s, 17f, fg, true).apply {
    gravity = Gravity.CENTER
    background = shape(bg, dp(16).toFloat(), if (stroke != 0) dp(1) else 0, stroke)
    setPadding(dp(12), dp(15), dp(12), dp(15)); setOnClickListener { onClick() }
}
fun Context.input(hint: String) = EditText(this).apply {
    this.hint = hint; setHintTextColor(C.DIM); setTextColor(C.TXT); textSize = 18f; isSingleLine = true
    textDirection = View.TEXT_DIRECTION_RTL
    background = shape(BG_IN, dp(14).toFloat(), dp(1), C.G); setPadding(dp(14), dp(14), dp(14), dp(14))
}
val BG_IN = 0xFF0D1412.toInt()
fun Context.lp(w: Int = -1, h: Int = -2, weight: Float = 0f, l: Int = 0, t: Int = 0, r: Int = 0, b: Int = 0) =
    LinearLayout.LayoutParams(w, h, weight).apply { setMargins(dp(l), dp(t), dp(r), dp(b)) }

class Ring(c: Context) : View(c) {
    var progress = 0f; var color = C.G; var big = ""; var small = ""
    private val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND }
    private val t = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER; color = C.TXT; typeface = Typeface.DEFAULT_BOLD }
    override fun onDraw(cv: Canvas) {
        val s = minOf(width, height).toFloat(); val sw = s * 0.08f
        val r = RectF((width - s) / 2 + sw, (height - s) / 2 + sw, (width + s) / 2 - sw, (height + s) / 2 - sw)
        p.strokeWidth = sw; p.color = Color.argb(60, Color.red(color), Color.green(color), Color.blue(color))
        cv.drawArc(r, 0f, 360f, false, p)
        p.color = color; cv.drawArc(r, -90f, 360f * progress.coerceIn(0.01f, 1f), false, p)
        t.textSize = s * (if (small.isEmpty()) 0.34f else 0.32f); t.color = C.TXT
        val cy = height / 2f + (if (small.isEmpty()) t.textSize / 3 else 0f)
        cv.drawText(big, width / 2f, cy, t)
        if (small.isNotEmpty()) { t.textSize = s * 0.08f; t.color = C.DIM; cv.drawText(small, width / 2f, cy + s * 0.14f, t) }
    }
}
