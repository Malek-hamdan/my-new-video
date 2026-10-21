package com.fieldlog.app

import android.content.Context

/** App settings. PIN default is 2026 (the user is told to change it). */
class Prefs(context: Context) {
    private val sp = context.getSharedPreferences("fieldlog", Context.MODE_PRIVATE)

    var pin: String
        get() = sp.getString("pin", "2026") ?: "2026"
        set(v) = sp.edit().putString("pin", v).apply()

    var level: Enhancer.Level
        get() = runCatching { Enhancer.Level.valueOf(sp.getString("level", "MEDIUM")!!) }.getOrDefault(Enhancer.Level.MEDIUM)
        set(v) = sp.edit().putString("level", v.name).apply()

    var keepOriginal: Boolean
        get() = sp.getBoolean("keepOriginal", true)
        set(v) = sp.edit().putBoolean("keepOriginal", v).apply()

    var volumeStop: Boolean
        get() = sp.getBoolean("volumeStop", true)
        set(v) = sp.edit().putBoolean("volumeStop", v).apply()

    /** "stop_save" or "cancel" when Volume-Down x3 fires. */
    var volumeAction: String
        get() = sp.getString("volumeAction", "stop_save") ?: "stop_save"
        set(v) = sp.edit().putString("volumeAction", v).apply()
}
