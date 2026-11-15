package com.scars.app

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

data class Lesson(
    var id: Long, var title: String, var story: String, var cat: String, var imp: Int,
    var stage: Int, var due: Long, var fails: Int, var created: Long
)

object Store {
    private fun p(c: Context) = c.getSharedPreferences("scars", 0)

    private fun toJ(l: Lesson) = JSONObject().apply {
        put("id", l.id); put("title", l.title); put("story", l.story); put("cat", l.cat); put("imp", l.imp)
        put("stage", l.stage); put("due", l.due); put("fails", l.fails); put("created", l.created)
    }

    private fun fromJ(o: JSONObject) = Lesson(
        o.getLong("id"), o.getString("title"), o.optString("story"), o.optString("cat", "نفسي"),
        o.optInt("imp", 1), o.optInt("stage", 0), o.optLong("due", 0), o.optInt("fails", 0), o.optLong("created", 0)
    )

    private fun parse(s: String): MutableList<Lesson> {
        val a = JSONArray(s)
        return (0 until a.length()).map { fromJ(a.getJSONObject(it)) }.toMutableList()
    }

    fun all(c: Context) = parse(p(c).getString("lessons", "[]") ?: "[]")

    fun saveAll(c: Context, list: List<Lesson>) {
        val a = JSONArray(); list.forEach { a.put(toJ(it)) }
        p(c).edit().putString("lessons", a.toString()).commit()
        Widget.refresh(c)
    }

    fun get(c: Context, id: Long) = all(c).find { it.id == id }

    fun upsert(c: Context, l: Lesson) {
        val list = all(c)
        val i = list.indexOfFirst { it.id == l.id }
        if (i >= 0) list[i] = l else list.add(0, l)
        saveAll(c, list)
    }

    fun delete(c: Context, id: Long) = saveAll(c, all(c).filter { it.id != id })

    fun export(c: Context) = p(c).getString("lessons", "[]") ?: "[]"

    fun import(c: Context, s: String): Int {
        val incoming = parse(s)
        val list = all(c)
        val ids = list.map { it.id }.toSet()
        val fresh = incoming.filter { it.id !in ids }
        list.addAll(fresh)
        saveAll(c, list)
        return fresh.size
    }
}
