package com.scars.app

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import kotlin.math.ceil

object Sched {
    // hours until next show, by stage: 3 days x 3/day, then daily x4, then 3d, 1w, 2w, 1m
    private val H = longArrayOf(4, 4, 4, 4, 4, 4, 4, 4, 4, 20, 20, 20, 20, 68, 164, 332, 716)
    fun interval(stage: Int) = H[stage.coerceIn(0, H.size - 1)] * 3_600_000L

    private fun p(c: Context) = c.getSharedPreferences("scars_set", 0)

    fun slots(c: Context): List<Int> =
        (p(c).getString("slots", "9,14,20") ?: "9,14,20").split(",")
            .mapNotNull { it.trim().toIntOrNull() }.filter { it in 0..23 }.distinct().sorted()
            .ifEmpty { listOf(9, 14, 20) }

    fun maxDay(c: Context) = p(c).getInt("max", 5)

    fun setSettings(c: Context, slots: String, max: Int) {
        p(c).edit().putString("slots", slots).putInt("max", max.coerceIn(1, 20)).commit()
        scheduleNext(c)
    }

    private fun pi(c: Context) = PendingIntent.getBroadcast(
        c, 0, Intent(c, Rx::class.java).setAction(Rx.SLOT),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )

    fun scheduleNext(c: Context) {
        val now = System.currentTimeMillis()
        var best = Long.MAX_VALUE
        for (dayOff in 0..1) for (h in slots(c)) {
            val cal = Calendar.getInstance().apply {
                add(Calendar.DAY_OF_YEAR, dayOff)
                set(Calendar.HOUR_OF_DAY, h); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
            }
            if (cal.timeInMillis > now + 30_000 && cal.timeInMillis < best) best = cal.timeInMillis
        }
        val am = c.getSystemService(AlarmManager::class.java)
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, best, pi(c))
    }

    fun fire(c: Context) {
        val sp = p(c)
        val today = SimpleDateFormat("yyyyMMdd", Locale.US).format(Date())
        var count = if (sp.getString("day", "") == today) sp.getInt("count", 0) else 0
        val left = maxDay(c) - count
        if (left <= 0) return
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        val slotsLeft = slots(c).count { it >= hour }.coerceAtLeast(1)
        val n = ceil(left.toDouble() / slotsLeft).toInt().coerceIn(1, 2)
        val now = System.currentTimeMillis()
        val list = Store.all(c)
        val pick = list.filter { it.due <= now }
            .sortedWith(compareByDescending<Lesson> { it.imp }.thenByDescending { it.fails }.thenBy { it.due })
            .take(n)
        for (l in pick) {
            Notif.show(c, l)
            l.stage++; l.due = now + interval(l.stage)
            count++
        }
        if (pick.isNotEmpty()) Store.saveAll(c, list)
        sp.edit().putString("day", today).putInt("count", count).commit()
    }
}

object Notif {
    private const val CH = "lessons"
    fun nid(id: Long) = (id % 100_000_000L).toInt()

    fun show(c: Context, l: Lesson) {
        val nm = c.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CH, "الدروس", NotificationManager.IMPORTANCE_HIGH).apply {
            enableVibration(true)
        })
        val open = PendingIntent.getActivity(
            c, nid(l.id), Intent(c, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE
        )
        fun act(a: String, k: Int) = PendingIntent.getBroadcast(
            c, nid(l.id) * 2 + k, Intent(c, Rx::class.java).setAction(a).putExtra("id", l.id),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val body = if (l.story.isBlank()) "📌 ${l.cat}" else "تذكّر: ${l.story}"
        val n = Notification.Builder(c, CH)
            .setSmallIcon(R.drawable.ic_stat)
            .setColor(C.Y)
            .setContentTitle(l.title)
            .setContentText(body)
            .setStyle(Notification.BigTextStyle().bigText(body))
            .setContentIntent(open)
            .setAutoCancel(true)
            .addAction(Notification.Action.Builder(null as android.graphics.drawable.Icon?, "✓ متذكّرو", act(Rx.OK, 0)).build())
            .addAction(Notification.Action.Builder(null as android.graphics.drawable.Icon?, "🔁 وقعت فيه", act(Rx.FELL, 1)).build())
            .build()
        try { nm.notify(nid(l.id), n) } catch (_: SecurityException) {}
    }
}
