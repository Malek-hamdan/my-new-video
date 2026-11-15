package com.streak.app

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

const val DAY = 86_400_000L

data class Streak(var id: Long, var title: String, var color: Int, var start: Long, var best: Int, var resets: Int, var created: Long, var notified: Int, var hist: String = "[]") {
    fun days(now: Long = System.currentTimeMillis()) = ((now - start) / DAY).toInt()
    fun bestNow() = maxOf(best, days())
    fun nextIn(now: Long = System.currentTimeMillis()) = DAY - ((now - start) % DAY)
}

object Store {
    private fun p(c: Context) = c.getSharedPreferences("streak", 0)
    fun all(c: Context): MutableList<Streak> {
        val a = JSONArray(p(c).getString("list", "[]"))
        return (0 until a.length()).map { val o = a.getJSONObject(it)
            Streak(o.getLong("id"), o.getString("title"), o.getInt("color"), o.getLong("start"), o.optInt("best"),
                o.optInt("resets"), o.optLong("created"), o.optInt("notified"), o.optString("hist", "[]")) }.toMutableList()
    }
    fun saveAll(c: Context, l: List<Streak>) {
        val a = JSONArray()
        l.forEach { s -> a.put(JSONObject().apply {
            put("id", s.id); put("title", s.title); put("color", s.color); put("start", s.start); put("best", s.best)
            put("resets", s.resets); put("created", s.created); put("notified", s.notified); put("hist", s.hist) }) }
        p(c).edit().putString("list", a.toString()).commit()
    }
    fun get(c: Context, id: Long) = all(c).find { it.id == id }
    fun upsert(c: Context, s: Streak) {
        val l = all(c); val i = l.indexOfFirst { it.id == s.id }
        if (i >= 0) l[i] = s else l.add(s); saveAll(c, l)
    }
    fun delete(c: Context, id: Long) = saveAll(c, all(c).filter { it.id != id })
    fun reset(c: Context, s: Streak) {
        val h = JSONArray(s.hist); h.put(JSONObject().put("s", s.start).put("e", System.currentTimeMillis()).put("d", s.days())); s.hist = h.toString()
        s.best = s.bestNow(); s.resets++; s.start = System.currentTimeMillis(); s.notified = 0; upsert(c, s)
    }

    // ---- duas
    private fun sp(c: Context) = c.getSharedPreferences("streak_set", 0)
    fun duaOn(c: Context) = sp(c).getBoolean("on", false)
    fun duaStart(c: Context): Long = sp(c).getLong("dstart", Calendar.getInstance().apply {
        set(2027, Calendar.JANUARY, 1, 0, 0, 0); set(Calendar.MILLISECOND, 0) }.timeInMillis)
    fun duaHour(c: Context) = sp(c).getInt("hour", 8)
    fun setDua(c: Context, on: Boolean, start: Long, hour: Int) {
        sp(c).edit().putBoolean("on", on).putLong("dstart", start).putInt("hour", hour).commit()
    }
    private fun midnight(t: Long) = Calendar.getInstance().apply { timeInMillis = t
        set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }.timeInMillis
    /** index of today's dua, or negative = days until start */
    fun duaIndex(c: Context): Int {
        val d = Math.round((midnight(System.currentTimeMillis()) - midnight(duaStart(c))) / DAY.toDouble()).toInt()
        return if (d < 0) d else d % 365
    }
    private var cache: JSONArray? = null
    fun dua(c: Context, i: Int): Pair<String, String> {
        val a = cache ?: JSONArray(c.resources.openRawResource(R.raw.duas).bufferedReader().readText()).also { cache = it }
        val o = a.getJSONObject(i % a.length()); return o.getString("t") to o.getString("r")
    }
}
