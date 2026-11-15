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
        if (i.action == DAILY) daily(c)
        schedule(c)
    }
}
