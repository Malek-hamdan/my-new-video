package com.streak.app

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

const val DAY = 86_400_000L

data class Streak(var id: Long, var title: String, var color: Int, var start: Long, var best: Int, var resets: Int, var created: Long, var notified: Int, var hist: String = "[]", var mask: Int = 127, var paused: String = "") {
    private fun counts(k: Int) = dayOn(start + k * DAY) && !isPaused(start + k * DAY)
    fun dateKey(t: Long) = java.text.SimpleDateFormat("yyyyMMdd", java.util.Locale.US).format(java.util.Date(t))
    private fun pausedSet() = paused.split(",").filter { it.isNotBlank() }.toMutableSet()
    fun isPaused(t: Long) = paused.isNotEmpty() && dateKey(t) in pausedSet()
    fun pauseCount() = pausedSet().size
    fun togglePause(t: Long) { val s = pausedSet(); val k = dateKey(t); if (!s.remove(k)) s.add(k); paused = s.joinToString(",") }
    fun dayOn(t: Long) = mask == 127 || (mask shr (java.util.Calendar.getInstance().apply { timeInMillis = t }.get(java.util.Calendar.DAY_OF_WEEK) - 1) and 1) == 1
    fun days(now: Long = System.currentTimeMillis()): Int {
        if (now < start) return 0
        val n = ((now - start) / DAY).toInt()
        if (mask == 127 && paused.isEmpty()) return n
        var c = 0; for (k in 0 until n) if (counts(k)) c++; return c
    }
    fun pending(now: Long = System.currentTimeMillis()) = now < start
    fun bestNow() = maxOf(best, days())
    fun nextIn(now: Long = System.currentTimeMillis()): Long {
        if (now < start) return start - now
        var k = ((now - start) / DAY).toInt()
        var guard = 0
        while (!counts(k) && guard++ < 400) k++
        return start + (k + 1) * DAY - now
    }
}

object Store {
    private fun p(c: Context) = c.getSharedPreferences("streak", 0)
    fun all(c: Context): MutableList<Streak> {
        val a = JSONArray(p(c).getString("list", "[]"))
        return (0 until a.length()).map { val o = a.getJSONObject(it)
            Streak(o.getLong("id"), o.getString("title"), o.getInt("color"), o.getLong("start"), o.optInt("best"),
                o.optInt("resets"), o.optLong("created"), o.optInt("notified"), o.optString("hist", "[]"), o.optInt("mask", 127), o.optString("paused", "")) }.toMutableList()
    }
    fun saveAll(c: Context, l: List<Streak>) {
        val a = JSONArray()
        l.forEach { s -> a.put(JSONObject().apply {
            put("id", s.id); put("title", s.title); put("color", s.color); put("start", s.start); put("best", s.best)
            put("resets", s.resets); put("created", s.created); put("notified", s.notified); put("hist", s.hist); put("mask", s.mask); put("paused", s.paused) }) }
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

    // ---- backup code
    fun exportCode(c: Context): String {
        val o = JSONObject().put("v", 1).put("list", JSONArray(p(c).getString("list", "[]")))
            .put("on", duaOn(c)).put("dstart", duaStart(c)).put("hour", duaHour(c))
        val bos = java.io.ByteArrayOutputStream()
        java.util.zip.GZIPOutputStream(bos).use { it.write(o.toString().toByteArray()) }
        return "STK1-" + android.util.Base64.encodeToString(bos.toByteArray(), android.util.Base64.NO_WRAP or android.util.Base64.URL_SAFE)
    }
    /** returns number of streaks restored, or -1 if the code is invalid */
    fun importCode(c: Context, code: String): Int = try {
        val raw = code.trim().replace(Regex("\\s"), "").removePrefix("STK1-")
        val bytes = android.util.Base64.decode(raw, android.util.Base64.NO_WRAP or android.util.Base64.URL_SAFE)
        val txt = java.util.zip.GZIPInputStream(bytes.inputStream()).use { it.readBytes().toString(Charsets.UTF_8) }
        val o = JSONObject(txt)
        p(c).edit().putString("list", o.getJSONArray("list").toString()).commit()
        val incoming = all(c)
        setDua(c, o.optBoolean("on"), o.optLong("dstart", duaStart(c)), o.optInt("hour", 8))
        incoming.size
    } catch (e: Exception) { -1 }

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
