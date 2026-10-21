package com.fieldlog.app

import android.os.Handler
import android.os.Looper

/** Tiny in-process event bus so the UI can follow the recording service. */
object RecorderBus {
    @Volatile var recording = false
    @Volatile var paused = false
    @Volatile var startElapsed = 0L      // SystemClock.elapsedRealtime at start
    @Volatile var pausedAccum = 0L       // accumulated ms while paused
    @Volatile var processing = false

    private val main = Handler(Looper.getMainLooper())
    private val listeners = mutableSetOf<() -> Unit>()

    fun addListener(l: () -> Unit) { listeners.add(l) }
    fun removeListener(l: () -> Unit) { listeners.remove(l) }
    fun notifyChanged() { main.post { listeners.toList().forEach { it() } } }
}
