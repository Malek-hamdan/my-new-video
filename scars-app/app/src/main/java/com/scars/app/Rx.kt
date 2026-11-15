package com.scars.app

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class Rx : BroadcastReceiver() {
    companion object {
        const val SLOT = "com.scars.app.SLOT"
        const val OK = "com.scars.app.OK"
        const val FELL = "com.scars.app.FELL"
        const val NEXT = "com.scars.app.NEXT"

        fun remembered(c: Context, l: Lesson) {
            l.stage++; l.due = System.currentTimeMillis() + Sched.interval(l.stage)
            Store.upsert(c, l)
        }

        fun fell(c: Context, l: Lesson) {
            l.stage = 0; l.fails++; l.due = System.currentTimeMillis()
            Store.upsert(c, l)
        }
    }

    override fun onReceive(c: Context, i: Intent) {
        when (i.action) {
            SLOT -> { Sched.fire(c); Sched.scheduleNext(c) }
            Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED -> Sched.scheduleNext(c)
            OK, FELL -> {
                val id = i.getLongExtra("id", 0)
                val l = Store.get(c, id) ?: return
                if (i.action == OK) remembered(c, l) else fell(c, l)
                c.getSystemService(NotificationManager::class.java).cancel(Notif.nid(id))
            }
            NEXT -> Widget.next(c)
        }
    }
}
