package com.scars.app

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView

object C {
    val BG = 0xFF0F1115.toInt()
    val CARD = 0xFF181B21.toInt()
    val CHIP = 0xFF262B33.toInt()
    val Y = 0xFFF5B301.toInt()
    val RED = 0xFFE55555.toInt()
    val TXT = 0xFFEEEEEE.toInt()
    val DIM = 0xFF8A8F98.toInt()
    val CATS = listOf("ناس", "مصاري", "شغل", "تجارة", "نفسي")
    val IMPS = listOf("عادي", "مهم", "مهم كتير 🔥")
}

fun Context.dp(v: Int) = (v * resources.displayMetrics.density).toInt()

fun shape(color: Int, r: Float, stroke: Int = 0, sc: Int = 0) = GradientDrawable().apply {
    setColor(color); cornerRadius = r
    if (stroke > 0) setStroke(stroke, sc)
}

fun Context.tv(s: String, size: Float = 16f, color: Int = C.TXT, bold: Boolean = false) = TextView(this).apply {
    text = s; textSize = size; setTextColor(color)
    if (bold) typeface = Typeface.DEFAULT_BOLD
    textDirection = View.TEXT_DIRECTION_RTL
}

fun Context.vbox() = LinearLayout(this).apply {
    orientation = LinearLayout.VERTICAL; layoutDirection = View.LAYOUT_DIRECTION_RTL
}

fun Context.hbox() = LinearLayout(this).apply {
    orientation = LinearLayout.HORIZONTAL; layoutDirection = View.LAYOUT_DIRECTION_RTL
}

fun Context.btn(s: String, primary: Boolean, onClick: () -> Unit) =
    tv(s, 17f, if (primary) Color.BLACK else C.TXT, true).apply {
        gravity = Gravity.CENTER
        background = shape(if (primary) C.Y else C.CHIP, dp(14).toFloat())
        setPadding(dp(12), dp(14), dp(12), dp(14))
        setOnClickListener { onClick() }
    }

fun Context.chip(s: String, on: Boolean, onClick: () -> Unit) =
    tv(s, 14f, if (on) Color.BLACK else C.TXT, on).apply {
        background = shape(if (on) C.Y else C.CHIP, dp(20).toFloat())
        setPadding(dp(14), dp(6), dp(14), dp(6))
        setOnClickListener { onClick() }
    }

fun Context.input(hint: String, multi: Boolean = false) = EditText(this).apply {
    this.hint = hint; setHintTextColor(C.DIM); setTextColor(C.TXT); textSize = 17f
    textDirection = View.TEXT_DIRECTION_RTL
    background = shape(C.CARD, dp(14).toFloat())
    setPadding(dp(14), dp(14), dp(14), dp(14))
    if (multi) { minLines = 4; gravity = Gravity.TOP or Gravity.START } else isSingleLine = true
}

fun Context.lp(w: Int = -1, h: Int = -2, weight: Float = 0f, l: Int = 0, t: Int = 0, r: Int = 0, b: Int = 0) =
    LinearLayout.LayoutParams(w, h, weight).apply { setMargins(dp(l), dp(t), dp(r), dp(b)) }

fun Context.label(s: String) = tv(s, 14f, C.DIM).apply { setPadding(0, dp(16), 0, dp(6)) }
