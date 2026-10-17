package com.hamdan.tasbih.widget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.text.Layout
import android.text.StaticLayout
import android.text.TextDirectionHeuristics
import android.text.TextPaint
import android.text.TextUtils
import kotlin.math.max
import kotlin.math.min

/**
 * Draws each widget into a bitmap, so the widgets keep the app's fonts, amber
 * beads and warm glass look that plain RemoteViews can't style.
 */
class WidgetRenderer(context: Context, private val w: Int, private val h: Int, private val s: Float) {
    private val amiri = font(context, "Amiri-Bold.ttf", Typeface.SERIF)
    private val kufi = font(context, "NotoKufiArabic-Regular.ttf", Typeface.DEFAULT)
    private val kufiBold = font(context, "NotoKufiArabic-Bold.ttf", Typeface.DEFAULT_BOLD)

    val bitmap: Bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    private val c = Canvas(bitmap)

    private fun dp(v: Float) = v * s

    fun large(d: WidgetData): Bitmap {
        background()
        val pad = dp(16f)
        val beadColW = dp(46f)
        val textLeft = pad + beadColW + dp(10f)
        val textRight = w - dp(18f)
        val textW = (textRight - textLeft).toInt()

        val top = when (d.state) {
            WidgetData.State.NOT_YET -> 5
            WidgetData.State.PARTIAL -> 3
            WidgetData.State.DONE -> 0
        }
        beadColumn(pad + beadColW / 2, dp(12f), h - dp(12f), top, 5 - top)

        // Kicker.
        val kickerColor = if (d.state == WidgetData.State.DONE) GREEN else GOLD
        val kicker = paint(kufiBold, dp(11f), kickerColor)
        drawLine(d.kicker, kicker, textLeft, textRight, dp(16f) - kicker.ascent())

        // Bottom row: stats on the right, button on the left.
        val rowY = h - dp(16f)
        val btn = paint(kufiBold, dp(12f), INK)
        val btnTextW = btn.measureText(d.button)
        val btnRect = RectF(textLeft, rowY - dp(26f), textLeft + btnTextW + dp(28f), rowY)
        if (d.state == WidgetData.State.DONE) {
            c.drawRoundRect(btnRect, dp(13f), dp(13f), Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE; strokeWidth = dp(1f); color = GREEN
            })
            btn.color = GREEN
        } else {
            c.drawRoundRect(btnRect, dp(13f), dp(13f), Paint(Paint.ANTI_ALIAS_FLAG).apply { color = GOLD })
        }
        c.drawText(d.button, btnRect.centerX() - btnTextW / 2, btnRect.centerY() - (btn.ascent() + btn.descent()) / 2, btn)
        val stats = paint(kufi, dp(12f), MUTED)
        val footer = if (d.streak > 0) "${d.footer}  ·  🔥 ${d.streak}" else d.footer
        drawLine(footer, stats, btnRect.right + dp(10f), textRight, btnRect.centerY() - (stats.ascent() + stats.descent()) / 2)

        // Phrase fills the space between, shrinking until it fits.
        val phraseTop = dp(16f) + kicker.descent() - kicker.ascent() + dp(6f)
        val phraseBottom = btnRect.top - dp(8f)
        fitText(d.phrase, amiri, CREAM, textLeft, phraseTop, textW, phraseBottom - phraseTop, dp(23f), dp(13f), Layout.Alignment.ALIGN_NORMAL)
        return bitmap
    }

    fun counter(d: WidgetData): Bitmap {
        background()
        val complete = d.progress >= d.total
        val size = min(w, h) * 0.56f
        val cx = w / 2f
        val cy = h * 0.44f
        val stroke = size * 0.085f
        val ring = RectF(cx - size / 2, cy - size / 2, cx + size / 2, cy + size / 2)
        c.drawArc(ring, 0f, 360f, false, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE; strokeWidth = stroke; color = Color.argb(26, 255, 255, 255)
        })
        c.drawArc(ring, -90f, 360f * d.progress / d.total, false, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE; strokeWidth = stroke; strokeCap = Paint.Cap.ROUND
            color = if (complete) GREEN else GOLD
        })
        val num = paint(kufiBold, size * 0.3f, CREAM)
        val n = if (complete) "✓" else "${d.progress}"
        c.drawText(n, cx - num.measureText(n) / 2, cy - (num.ascent() + num.descent()) / 2 - size * 0.06f, num)
        val of = paint(kufi, size * 0.11f, MUTED)
        val ofText = "من ${d.total}"
        c.drawText(ofText, cx - of.measureText(ofText) / 2, cy + size * 0.24f, of)
        val label = paint(kufi, dp(11f), MUTED)
        val text = listOf(if (complete) "تقبّل الله" else d.stageLabel, if (d.streak > 0) "🔥${d.streak}" else "")
            .filter { it.isNotEmpty() }.joinToString("  ·  ")
        val lt = TextUtils.ellipsize(text, label, w - dp(20f), TextUtils.TruncateAt.END).toString()
        c.drawText(lt, cx - label.measureText(lt) / 2, h - dp(16f), label)
        return bitmap
    }

    fun verse(d: WidgetData): Bitmap {
        background()
        val pad = dp(14f)
        val ref = paint(kufi, dp(10f), MUTED)
        val refH = ref.descent() - ref.ascent()
        val area = h - pad * 2 - refH - dp(8f)
        val used = fitText(d.verse, amiri, CREAM, pad, pad, (w - pad * 2).toInt(), area, dp(22f), dp(12f), Layout.Alignment.ALIGN_CENTER, measureOnly = true)
        val top = (h - used - dp(8f) - refH) / 2
        fitText(d.verse, amiri, CREAM, pad, top, (w - pad * 2).toInt(), area, dp(22f), dp(12f), Layout.Alignment.ALIGN_CENTER)
        c.drawText(d.verseRef, w / 2f - ref.measureText(d.verseRef) / 2, top + used + dp(8f) - ref.ascent(), ref)
        return bitmap
    }

    private fun background() {
        val r = dp(24f)
        val rect = RectF(0f, 0f, w.toFloat(), h.toFloat())
        c.drawRoundRect(rect, r, r, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = LinearGradient(0f, 0f, w.toFloat(), h.toFloat(),
                Color.argb(240, 48, 28, 14), Color.argb(245, 18, 10, 5), Shader.TileMode.CLAMP)
        })
        c.drawRoundRect(rect, r, r, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = RadialGradient(0f, 0f, max(w, h) * 0.7f,
                Color.argb(56, 217, 164, 65), Color.argb(0, 217, 164, 65), Shader.TileMode.CLAMP)
        })
        val half = dp(0.5f)
        c.drawRoundRect(RectF(half, half, w - half, h - half), r, r, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE; strokeWidth = dp(1f); color = Color.argb(46, 255, 210, 150)
        })
    }

    private fun beadColumn(cx: Float, top: Float, bottom: Float, upper: Int, lower: Int) {
        c.drawLine(cx, top, cx, bottom, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.argb(150, 201, 178, 138); strokeWidth = dp(1f)
        })
        val rx = dp(13f)
        val ry = dp(9f)
        val step = ry * 2 - dp(0.5f)
        for (i in 0 until upper) bead(cx, top + ry + i * step, rx, ry)
        for (i in 0 until lower) bead(cx, bottom - ry - i * step, rx, ry)
    }

    private fun bead(cx: Float, cy: Float, rx: Float, ry: Float) {
        val rect = RectF(cx - rx, cy - ry, cx + rx, cy + ry)
        c.drawOval(RectF(rect).apply { offset(dp(2f), dp(3f)) }, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.argb(110, 0, 0, 0)
        })
        c.drawOval(rect, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = RadialGradient(cx - rx * 0.24f, cy - ry * 0.36f, max(rx, ry) * 1.5f,
                intArrayOf(0xFFFFF0C2.toInt(), 0xFFF7C055.toInt(), 0xFFD27A17.toInt(), 0xFF8A3A08.toInt(), 0xFF3D1603.toInt()),
                floatArrayOf(0f, 0.18f, 0.5f, 0.8f, 1f), Shader.TileMode.CLAMP)
        })
        c.drawOval(RectF(cx - rx * 0.62f, cy - ry * 0.62f, cx - rx * 0.06f, cy - ry * 0.22f),
            Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(185, 255, 255, 255) })
    }

    private fun paint(tf: Typeface, size: Float, color: Int) = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
        typeface = tf; textSize = size; this.color = color
    }

    /** One right-aligned line between [left] and [right], ellipsized if too long. */
    private fun drawLine(text: String, p: TextPaint, left: Float, right: Float, baseline: Float) {
        val t = TextUtils.ellipsize(text, p, right - left, TextUtils.TruncateAt.END).toString()
        c.drawText(t, right - p.measureText(t), baseline, p)
    }

    /** Draws [text] at the largest size in [maxSize]..[minSize] that fits; returns the height used. */
    private fun fitText(
        text: String, tf: Typeface, color: Int, left: Float, top: Float, width: Int, height: Float,
        maxSize: Float, minSize: Float, align: Layout.Alignment, measureOnly: Boolean = false,
    ): Float {
        if (width <= 0) return 0f
        fun build(size: Float): StaticLayout =
            StaticLayout.Builder.obtain(text, 0, text.length, paint(tf, size, color), width)
                .setAlignment(align)
                .setTextDirection(TextDirectionHeuristics.RTL)
                .setLineSpacing(0f, 1.12f)
                .setIncludePad(false)
                .build()
        var size = maxSize
        var layout = build(size)
        while (layout.height > height && size > minSize) {
            size -= dp(1f)
            layout = build(size)
        }
        if (!measureOnly) {
            c.save()
            c.translate(left, top)
            c.clipRect(0f, 0f, width.toFloat(), height)
            layout.draw(c)
            c.restore()
        }
        return min(layout.height.toFloat(), height)
    }

    companion object {
        val CREAM = Color.rgb(255, 243, 220)
        val MUTED = Color.rgb(201, 176, 143)
        val GOLD = Color.rgb(217, 164, 65)
        val GREEN = Color.rgb(127, 207, 122)
        val INK = Color.rgb(26, 15, 7)

        private val fonts = HashMap<String, Typeface>()

        private fun font(context: Context, file: String, fallback: Typeface): Typeface =
            fonts.getOrPut(file) {
                try {
                    Typeface.createFromAsset(context.assets, "flutter_assets/assets/fonts/$file")
                } catch (e: Exception) {
                    fallback
                }
            }
    }
}
