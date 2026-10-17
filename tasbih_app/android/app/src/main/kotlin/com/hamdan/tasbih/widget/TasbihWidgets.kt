package com.hamdan.tasbih.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.os.Bundle
import android.widget.RemoteViews
import com.hamdan.tasbih.MainActivity
import com.hamdan.tasbih.R
import kotlin.math.min
import kotlin.math.sqrt

/** Common plumbing: size the bitmap to the widget's cell size and open the app on tap. */
abstract class TasbihWidget : AppWidgetProvider() {
    /** Size in dp used when the launcher doesn't report one. */
    abstract val defaultSize: Pair<Int, Int>

    abstract fun draw(r: WidgetRenderer, d: WidgetData): Bitmap

    abstract fun describe(d: WidgetData): String

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        for (id in ids) update(context, manager, id)
    }

    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
        update(context, manager, id)
    }

    private fun update(context: Context, manager: AppWidgetManager, id: Int) {
        val options = manager.getAppWidgetOptions(id)
        var wDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH)
        var hDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT)
        if (wDp <= 0 || hDp <= 0) {
            wDp = defaultSize.first
            hDp = defaultSize.second
        }
        // Stay well inside the RemoteViews bitmap memory limit.
        var scale = min(context.resources.displayMetrics.density, 3f)
        val maxPixels = 1_100_000f
        if (wDp * hDp * scale * scale > maxPixels) scale = sqrt(maxPixels / (wDp * hDp))

        val data = WidgetData.load(context)
        val renderer = WidgetRenderer(context, (wDp * scale).toInt(), (hDp * scale).toInt(), scale)
        val views = RemoteViews(context.packageName, R.layout.widget_image)
        views.setImageViewBitmap(R.id.widget_image, draw(renderer, data))
        views.setContentDescription(R.id.widget_image, describe(data))
        val open = Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        views.setOnClickPendingIntent(
            R.id.widget_image,
            PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT),
        )
        manager.updateAppWidget(id, views)
    }
}

/** 4x2: phrase of the day, beads, streak and a button into the app. */
class LargeWidget : TasbihWidget() {
    override val defaultSize = 320 to 150
    override fun draw(r: WidgetRenderer, d: WidgetData) = r.large(d)
    override fun describe(d: WidgetData) = "${d.kicker}. ${d.phrase}. ${d.footer}"
}

/** 2x2: progress ring for the current tasbih. */
class CounterWidget : TasbihWidget() {
    override val defaultSize = 150 to 150
    override fun draw(r: WidgetRenderer, d: WidgetData) = r.counter(d)
    override fun describe(d: WidgetData) = "${d.progress} من ${d.total}"
}

/** 2x2: verse of the day. */
class VerseWidget : TasbihWidget() {
    override val defaultSize = 150 to 150
    override fun draw(r: WidgetRenderer, d: WidgetData) = r.verse(d)
    override fun describe(d: WidgetData) = "${d.verse} — ${d.verseRef}"
}
