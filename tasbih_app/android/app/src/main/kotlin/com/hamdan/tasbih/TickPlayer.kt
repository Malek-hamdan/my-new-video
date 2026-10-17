package com.hamdan.tasbih

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool
import java.io.File

/**
 * Low-latency bead clicks through SoundPool.
 *
 * Plays on the media stream (USAGE_GAME), so the clicks follow the media volume
 * and still sound with the ringer on silent. No audio focus is requested, so
 * music or podcasts keep playing underneath.
 */
class TickPlayer(private val context: Context) {
    private val pool = SoundPool.Builder()
        .setMaxStreams(6)
        .setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_GAME)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build(),
        )
        .build()
    private val ids = HashMap<String, Int>()
    private val loaded = HashSet<Int>()

    init {
        pool.setOnLoadCompleteListener { _, sampleId, status ->
            if (status == 0) synchronized(loaded) { loaded.add(sampleId) }
        }
    }

    /** Loads `assets/sounds/<name>.wav` from the Flutter assets. */
    fun load(names: List<String>) {
        val dir = File(context.cacheDir, "sounds").apply { mkdirs() }
        for (name in names) {
            if (ids.containsKey(name)) continue
            // Flutter assets may be compressed inside the APK, so SoundPool can't
            // read them in place; copy each one to a plain file first.
            val file = File(dir, "$name.wav")
            context.assets.open("flutter_assets/assets/sounds/$name.wav").use { input ->
                file.outputStream().use { input.copyTo(it) }
            }
            ids[name] = pool.load(file.path, 1)
        }
    }

    /** Returns false if the sound isn't loaded (yet). */
    fun play(name: String, volume: Float): Boolean {
        val id = ids[name] ?: return false
        if (!synchronized(loaded) { loaded.contains(id) }) return false
        val v = volume.coerceIn(0f, 1f)
        return pool.play(id, v, v, 1, 0, 1f) != 0
    }

    fun release() = pool.release()
}
