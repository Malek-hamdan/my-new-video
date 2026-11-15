package com.scars.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

class Widget : AppWidgetProvider() {
    override fun onUpdate(c: Context, m: AppWidgetManager, ids: IntArray) = refresh(c)

    companion object {
        fun refresh(c: Context) {
            val m = AppWidgetManager.getInstance(c)
            val ids = m.getAppWidgetIds(ComponentName(c, Widget::class.java))
            if (ids.isEmpty()) return
            val list = Store.all(c)
            val idx = c.getSharedPreferences("scars_set", 0).getInt("w", 0)
            val l = if (list.isEmpty()) null else list[Math.floorMod(idx, list.size)]
            val v = RemoteViews(c.packageName, R.layout.widget)
            v.setTextViewText(R.id.w_tag, "📌 درس اليوم" + (l?.let { " • ${it.cat}" } ?: ""))
            v.setTextViewText(R.id.w_title, l?.title ?: "ضيف أول درس")
            v.setTextViewText(R.id.w_count, "اضغط للدرس الجاي ↻   •   ${list.size} درس")
            v.setOnClickPendingIntent(
                R.id.w_root, PendingIntent.getBroadcast(
                    c, 7, Intent(c, Rx::class.java).setAction(Rx.NEXT),
                    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
                )
            )
            m.updateAppWidget(ids, v)
        }

        fun next(c: Context) {
            val sp = c.getSharedPreferences("scars_set", 0)
            sp.edit().putInt("w", sp.getInt("w", 0) + 1).commit()
            refresh(c)
        }
    }
}
