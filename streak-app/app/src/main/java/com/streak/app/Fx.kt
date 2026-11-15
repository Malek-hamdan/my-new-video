package com.streak.app

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.view.animation.DecelerateInterpolator
import android.view.animation.LinearInterpolator

val MILES = intArrayOf(1, 3, 7, 14, 30, 60, 100, 180, 365)
fun nextMile(d: Int) = MILES.firstOrNull { it > d } ?: ((d / 365 + 1) * 365)
fun prevMile(d: Int) = MILES.lastOrNull { it <= d } ?: 0

/** flame colours by streak level: top, bottom */
fun flameColors(d: Int): IntArray = when {
    d <= 0 -> intArrayOf(0xFF6A6F6D.toInt(), 0xFF3A3F3D.toInt())
    d < 7 -> intArrayOf(0xFFFFD25A.toInt(), 0xFFFF7A1A.toInt())
    d < 30 -> intArrayOf(0xFFFF9A3D.toInt(), 0xFFFF3D3D.toInt())
    d < 100 -> intArrayOf(0xFFFF7AD9.toInt(), 0xFF9B5BFF.toInt())
    d < 365 -> intArrayOf(0xFF7FE8FF.toInt(), 0xFF3D7BFF.toInt())
    else -> intArrayOf(0xFFFFF1A8.toInt(), 0xFFFFB300.toInt())
}

class Flame(c: Context) : View(c) {
    var days = 0; set(v) { field = v; invalidate() }
    private var flick = 1f
    private val p = Paint(Paint.ANTI_ALIAS_FLAG)
    private val anim = ValueAnimator.ofFloat(0f, (2 * Math.PI).toFloat()).apply {
        duration = 1600; repeatCount = ValueAnimator.INFINITE; interpolator = LinearInterpolator()
        addUpdateListener { flick = (1 + 0.035 * Math.sin((it.animatedValue as Float).toDouble()) + 0.02 * Math.sin(3.0 * (it.animatedValue as Float))).toFloat(); invalidate() }
    }
    override fun onAttachedToWindow() { super.onAttachedToWindow(); if (days > 0) anim.start() }
    override fun onDetachedFromWindow() { anim.cancel(); super.onDetachedFromWindow() }

    private fun path(w: Float, h: Float, outer: Boolean) = Path().apply {
        fun X(x: Float) = x * w; fun Y(y: Float) = y * h
        if (outer) {
            moveTo(X(0.5f), Y(0f))
            cubicTo(X(0.62f), Y(0.2f), X(0.92f), Y(0.36f), X(0.92f), Y(0.64f))
            cubicTo(X(0.92f), Y(0.88f), X(0.73f), Y(1f), X(0.5f), Y(1f))
            cubicTo(X(0.27f), Y(1f), X(0.08f), Y(0.88f), X(0.08f), Y(0.64f))
            cubicTo(X(0.08f), Y(0.5f), X(0.18f), Y(0.4f), X(0.29f), Y(0.31f))
            cubicTo(X(0.29f), Y(0.45f), X(0.35f), Y(0.52f), X(0.42f), Y(0.55f))
            cubicTo(X(0.37f), Y(0.35f), X(0.42f), Y(0.17f), X(0.5f), Y(0f))
        } else {
            moveTo(X(0.5f), Y(0.48f))
            cubicTo(X(0.57f), Y(0.6f), X(0.71f), Y(0.67f), X(0.71f), Y(0.8f))
            cubicTo(X(0.71f), Y(0.93f), X(0.61f), Y(1f), X(0.5f), Y(1f))
            cubicTo(X(0.39f), Y(1f), X(0.29f), Y(0.93f), X(0.29f), Y(0.8f))
            cubicTo(X(0.29f), Y(0.69f), X(0.43f), Y(0.62f), X(0.5f), Y(0.48f))
        }
        close()
    }

    override fun onDraw(cv: Canvas) {
        val w = width.toFloat(); val h = height.toFloat()
        val col = flameColors(days)
        cv.save(); cv.scale(2f - flick, flick, w / 2, h)
        if (days > 0) {   // glow
            p.shader = null; p.color = Color.argb(45, Color.red(col[1]), Color.green(col[1]), Color.blue(col[1]))
            cv.drawCircle(w / 2, h * 0.68f, w * 0.5f, p)
        }
        p.shader = LinearGradient(0f, 0f, 0f, h, col[0], col[1], Shader.TileMode.CLAMP)
        cv.drawPath(path(w, h, true), p)
        p.shader = LinearGradient(0f, h * 0.5f, 0f, h, 0xFFFFF6D8.toInt(), col[0], Shader.TileMode.CLAMP)
        p.alpha = if (days > 0) 230 else 90
        cv.drawPath(path(w, h, false), p); p.alpha = 255
        cv.restore()
    }
}

/** thin rounded progress bar with animated fill */
class Bar(c: Context) : View(c) {
    var color = C.G
    var progress = 0f; private set
    private val p = Paint(Paint.ANTI_ALIAS_FLAG)
    fun animateTo(v: Float, delay: Long = 0) {
        ValueAnimator.ofFloat(0f, v.coerceIn(0f, 1f)).apply {
            duration = 900; startDelay = delay; interpolator = DecelerateInterpolator()
            addUpdateListener { progress = it.animatedValue as Float; invalidate() }
        }.start()
    }
    override fun onDraw(cv: Canvas) {
        val h = height.toFloat(); val r = h / 2
        p.color = Color.argb(50, Color.red(color), Color.green(color), Color.blue(color))
        cv.drawRoundRect(RectF(0f, 0f, width.toFloat(), h), r, r, p)
        p.color = color
        val w = width * progress
        if (w > 0) cv.drawRoundRect(RectF(width - maxOf(w, h), 0f, width.toFloat(), h), r, r, p) // fills from the right (RTL)
    }
}

/** press-and-hold button: fills while held, fires when full */
class HoldButton(c: Context, private val label: String, private val color: Int, private val onDone: () -> Unit) : View(c) {
    private var prog = 0f
    private val p = Paint(Paint.ANTI_ALIAS_FLAG)
    private val t = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER; typeface = Typeface.DEFAULT_BOLD }
    private var anim: ValueAnimator? = null
    init { isClickable = true; isHapticFeedbackEnabled = true }

    override fun onTouchEvent(e: MotionEvent): Boolean {
        when (e.action) {
            MotionEvent.ACTION_DOWN -> {
                performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
                anim = ValueAnimator.ofFloat(prog, 1f).apply {
                    duration = (1600 * (1 - prog)).toLong(); interpolator = LinearInterpolator()
                    addUpdateListener { prog = it.animatedValue as Float; invalidate()
                        if (prog >= 1f) { cancel(); performHapticFeedback(HapticFeedbackConstants.LONG_PRESS); prog = 0f; invalidate(); onDone() } }
                    start()
                }
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                anim?.cancel()
                anim = ValueAnimator.ofFloat(prog, 0f).apply { duration = 250
                    addUpdateListener { prog = it.animatedValue as Float; invalidate() }; start() }
            }
        }
        return true
    }

    override fun onDraw(cv: Canvas) {
        val w = width.toFloat(); val h = height.toFloat(); val r = h * 0.3f
        val d = resources.displayMetrics.density
        p.style = Paint.Style.STROKE; p.strokeWidth = 1.5f * d
        p.color = Color.argb(120, Color.red(color), Color.green(color), Color.blue(color))
        cv.drawRoundRect(RectF(d, d, w - d, h - d), r, r, p)
        p.style = Paint.Style.FILL; p.color = Color.argb(70, Color.red(color), Color.green(color), Color.blue(color))
        cv.save(); cv.clipRect(w * (1 - prog), 0f, w, h); cv.drawRoundRect(RectF(0f, 0f, w, h), r, r, p); cv.restore()
        t.textSize = 16 * d; t.color = color
        cv.drawText(if (prog > 0) "كمّل ضاغط..." else label, w / 2, h / 2 + t.textSize / 3, t)
    }
}

/** springy press feedback for cards */
fun View.pressable(onClick: () -> Unit) {
    setOnTouchListener { v, e ->
        when (e.action) {
            MotionEvent.ACTION_DOWN -> v.animate().scaleX(0.97f).scaleY(0.97f).setDuration(90).start()
            MotionEvent.ACTION_UP -> { v.animate().scaleX(1f).scaleY(1f).setDuration(160).start(); v.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY); onClick() }
            MotionEvent.ACTION_CANCEL -> v.animate().scaleX(1f).scaleY(1f).setDuration(160).start()
        }
        true
    }
}

fun View.enter(i: Int) {
    alpha = 0f; translationY = 40f
    animate().alpha(1f).translationY(0f).setStartDelay(60L * i).setDuration(380).setInterpolator(DecelerateInterpolator()).start()
}
