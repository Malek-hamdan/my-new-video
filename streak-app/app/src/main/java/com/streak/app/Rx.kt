package com.streak.app

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import java.util.Calendar

class Rx : BroadcastReceiver() {
    companion object {
        const val DAILY = "com.streak.app.DAILY"
        const val ISTI = "com.streak.app.ISTI"
        const val ISTI_DONE = "com.streak.app.ISTI_DONE"

        fun scheduleIsti(c: Context) {
            val pi = PendingIntent.getBroadcast(c, 1, Intent(c, Rx::class.java).setAction(ISTI),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            val am = c.getSystemService(AlarmManager::class.java)
            if (!Istighfar.on(c)) { am.cancel(pi); return }
            val now = System.currentTimeMillis(); var best = Long.MAX_VALUE
            for (off in 0..1) for (h in Istighfar.hours(c)) {
                val t = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, off); set(Calendar.HOUR_OF_DAY, h)
                    set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }.timeInMillis
                if (t > now + 30_000 && t < best) best = t
            }
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, best, pi)
        }

        fun sendIsti(c: Context) {
            val k = Istighfar.nextLine(c)
            val nm = c.getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(NotificationChannel("isti", "Istighfar", NotificationManager.IMPORTANCE_HIGH))
            val open = PendingIntent.getActivity(c, 200, Intent(c, IstighfarActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
            val doneI = PendingIntent.getBroadcast(c, 300 + k, Intent(c, Rx::class.java).setAction(ISTI_DONE).putExtra("k", k),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            val line = Istighfar.LINES[k]
            val n = Notification.Builder(c, "isti").setSmallIcon(R.drawable.ic_stat).setColor(C.G)
                .setContentTitle("🤲 Istighfar • ${k + 1}/${Istighfar.LINES.size}").setContentText(line)
                .setStyle(Notification.BigTextStyle().bigText(line)).setContentIntent(open).setAutoCancel(true)
                .addAction(Notification.Action.Builder(null as android.graphics.drawable.Icon?, "✓ Said it", doneI).build())
                .build()
            try { nm.notify(2, n) } catch (_: SecurityException) {}
        }
        private val MILES = intArrayOf(7, 30, 100, 365)

        fun schedule(c: Context) {
            val now = System.currentTimeMillis()
            val cal = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, Store.duaHour(c)); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
                if (timeInMillis <= now + 30_000) add(Calendar.DAY_OF_YEAR, 1)
            }
            val pi = PendingIntent.getBroadcast(c, 0, Intent(c, Rx::class.java).setAction(DAILY),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            c.getSystemService(AlarmManager::class.java).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.timeInMillis, pi)
        }

        fun notify(c: Context, id: Int, title: String, body: String) {
            val nm = c.getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(NotificationChannel("main", "Verses & streaks", NotificationManager.IMPORTANCE_HIGH))
            val open = PendingIntent.getActivity(c, id, Intent(c, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
            val n = Notification.Builder(c, "main").setSmallIcon(R.drawable.ic_stat).setColor(C.G)
                .setContentTitle(title).setContentText(body).setStyle(Notification.BigTextStyle().bigText(body))
                .setContentIntent(open).setAutoCancel(true).build()
            try { nm.notify(id, n) } catch (_: SecurityException) {}
        }

        fun daily(c: Context) {
            if (Store.duaOn(c)) {
                val i = Store.duaIndex(c)
                if (i >= 0) { val (t, r) = Store.dua(c, i); notify(c, 1, "🤲 Verse of the day • ${i + 1}/365", "﴿ $t ﴾\n$r") }
            }
            val list = Store.all(c); var changed = false
            for (s in list) {
                val d = s.days()
                val m = MILES.lastOrNull { d >= it } ?: continue
                if (s.notified < m) {
                    s.notified = m; changed = true
                    notify(c, (s.id % 100_000).toInt() + 10, "🔥 ${s.title}", "You've reached $d days, keep going!")
                }
            }
            if (changed) Store.saveAll(c, list)
        }
    }

    override fun onReceive(c: Context, i: Intent) {
        when (i.action) {
            DAILY -> { daily(c); schedule(c) }
            ISTI -> { sendIsti(c); scheduleIsti(c) }
            ISTI_DONE -> { Istighfar.mark(c, i.getIntExtra("k", 0)); c.getSystemService(NotificationManager::class.java).cancel(2) }
            else -> { schedule(c); scheduleIsti(c) }
        }
    }
}
