package com.hamdan.tasbih.widget

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

/** What the widgets show right now, worked out from the state the app saved. */
class WidgetData private constructor(
    val state: State,
    val kicker: String,
    val phrase: String,
    val button: String,
    val footer: String,
    val streak: Int,
    val streakPaused: Boolean,
    val todayCount: Int,
    val progress: Int,
    val total: Int,
    val stageLabel: String,
    val verse: String,
    val verseRef: String,
) {
    enum class State { NOT_YET, PARTIAL, DONE }

    companion object {
        // Written by the app through the home_widget plugin.
        private const val PREFS = "HomeWidgetPreferences"

        fun load(context: Context, now: Calendar = Calendar.getInstance()): WidgetData {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            fun str(key: String) = prefs.getString(key, null) ?: ""
            fun int(key: String) = str(key).toIntOrNull() ?: 0

            val today = dayKey(now)
            val yesterday = dayKey((now.clone() as Calendar).apply { add(Calendar.DAY_OF_MONTH, -1) })
            val dayBefore = dayKey((now.clone() as Calendar).apply { add(Calendar.DAY_OF_MONTH, -2) })
            val savedToday = str("today_key") == today
            val todayCount = if (savedToday) int("today_count") else 0
            val doneToday = savedToday && str("done_today") == "1"
            val lastQualified = str("last_qualified_day")
            // One missed day pauses the streak; two in a row end it (same rule as the app).
            val streakPaused = lastQualified == dayBefore
            val streak = if (lastQualified == today || lastQualified == yesterday || streakPaused) int("streak") else 0
            val progress = int("progress")
            val total = int("total").coerceAtLeast(1)
            val title = str("title")
            val stageText = str("stage_text")
            val stageLabel = if (stageText.isEmpty()) "" else "$stageText ${int("stage_done")}/${int("stage_total")}"

            val phrases = try {
                JSONObject(str("phrases").ifEmpty { "{}" })
            } catch (e: Exception) {
                JSONObject()
            }
            val day = epochDay(now)
            fun pick(name: String, fallback: String): String {
                val list = phrases.optJSONArray(name) ?: return fallback
                if (list.length() == 0) return fallback
                return list.optString((day % list.length()).toInt(), fallback)
            }
            fun fill(p: String) = p
                .replace("{count}", "$todayCount")
                .replace("{streak}", "$streak")
                .replace("{left}", "${(total - progress).coerceAtLeast(0)}")
                .replace("{title}", title)

            val hour = now.get(Calendar.HOUR_OF_DAY)
            val state: State
            val phrase: String
            val kicker: String
            val button: String
            val footer: String
            when {
                doneToday -> {
                    state = State.DONE
                    val milestone = phrases.optJSONObject("milestones")?.optString("$streak", "") ?: ""
                    phrase = fill(
                        when {
                            milestone.isNotEmpty() && lastQualified == today -> milestone
                            hour >= 21 -> pick("night", "تصبح على خير.. الله يتقبّل تسبيحك")
                            streak >= 3 && day % 3 == 0L -> pick("streak", "مشي الحال.. الله يتقبّل")
                            else -> pick("done", "مشي الحال.. الله يتقبّل")
                        }
                    )
                    kicker = "✓ تقبّل الله"
                    button = "زيد"
                    footer = "اليوم: $todayCount"
                }
                todayCount > 0 -> {
                    state = State.PARTIAL
                    phrase = fill(pick("partial", "قرّبت.. كمّل من وين وقفت"))
                    kicker = if (progress in 1 until total) "✦ وصلت $progress من $total" else "✦ اليوم: $todayCount"
                    button = "كمّل"
                    footer = if (progress in 1 until total && stageLabel.isNotEmpty()) stageLabel else "اليوم: $todayCount"
                }
                else -> {
                    state = State.NOT_YET
                    phrase = fill(
                        when {
                            streakPaused && streak > 0 -> pick("paused", "الستريك واقف ⏸ سبّح اليوم حتى ما يروح")
                            str("last_active_day") == yesterday -> pick("yesterday", "سبّحت مبارح، شو رأيك تكمّل اليوم كمان؟")
                            hour < 12 -> pick("morning", "صباحك نور.. شو رأيك تفتح نهارك بتسبيحة الزهراء؟")
                            else -> pick("notYet", "لسا ما سبّحت اليوم.. شو رأيك هلق؟")
                        }
                    )
                    kicker = "✦ كلمة اليوم"
                    button = "سبّح الآن"
                    footer = "اليوم: 0"
                }
            }

            val verses = phrases.optJSONArray("verses") ?: JSONArray()
            val verse = if (verses.length() > 0) verses.optJSONArray((day % verses.length()).toInt()) else null

            return WidgetData(
                state = state,
                kicker = kicker,
                phrase = phrase,
                button = button,
                footer = footer,
                streak = streak,
                streakPaused = streakPaused && streak > 0,
                todayCount = todayCount,
                progress = progress.coerceIn(0, total),
                total = total,
                stageLabel = stageLabel,
                verse = verse?.optString(0) ?: "أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ",
                verseRef = verse?.optString(1) ?: "الرعد · ٢٨",
            )
        }

        fun dayKey(c: Calendar): String = String.format(
            Locale.US, "%04d-%02d-%02d",
            c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH),
        )

        /** Days since 1970-01-01 for the local date; matches Phrases.ofDay in the app. */
        fun epochDay(c: Calendar): Long {
            val utc = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
            utc.clear()
            utc.set(c.get(Calendar.YEAR), c.get(Calendar.MONTH), c.get(Calendar.DAY_OF_MONTH))
            return utc.timeInMillis / 86_400_000L
        }
    }
}
