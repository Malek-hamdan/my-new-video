package com.fieldlog.app

import kotlin.math.cos
import kotlin.math.ln
import kotlin.math.min
import kotlin.math.sqrt

/**
 * Lightweight, on-device, model-free speaker split for turn-taking conversations.
 *
 * MFCC features -> energy VAD -> ~1 s segment embeddings -> k-means (k speakers).
 * It groups *who speaks when* by voice similarity. It is approximate: it works best
 * when people talk in turns, not over each other, and cannot name the speakers.
 */
object Diarizer {

    data class Segment(val startMs: Long, val endMs: Long, val speaker: Int)
    data class Result(val speakers: Int, val segments: List<Segment>, val talkMs: LongArray)

    private const val SR = 48000
    private const val WIN = 1200   // 25 ms
    private const val HOP = 480    // 10 ms
    private const val NFFT = 2048
    private const val MEL = 26
    private const val NCEP = 13

    fun diarize(samples: FloatArray, maxSpeakers: Int = 2): Result {
        if (samples.size < SR) return Result(1, listOf(Segment(0, samples.size * 1000L / SR, 0)), longArrayOf(samples.size * 1000L / SR))
        val (feats, energies) = mfcc(samples)
        if (feats.isEmpty()) return Result(1, emptyList(), LongArray(1))

        // VAD: frames above a fraction of the median energy are speech.
        val sorted = energies.sortedArray()
        val med = sorted[sorted.size / 2]
        val thr = med * 1.3f
        val speech = BooleanArray(feats.size) { energies[it] > thr }

        // Build ~1 s segments of contiguous speech; average the cepstra.
        val segLen = 100 // frames (~1 s)
        val segVecs = ArrayList<FloatArray>()
        val segBounds = ArrayList<IntArray>()
        var i = 0
        while (i < feats.size) {
            if (!speech[i]) { i++; continue }
            var j = i; val acc = FloatArray(NCEP); var cnt = 0
            while (j < feats.size && speech[j] && j - i < segLen) {
                for (c in 0 until NCEP) acc[c] += feats[j][c]; cnt++; j++
            }
            if (cnt >= 10) { for (c in 0 until NCEP) acc[c] = acc[c] / cnt.toFloat(); segVecs.add(acc); segBounds.add(intArrayOf(i, j)) }
            i = j
        }
        if (segVecs.size < 2) {
            val dur = samples.size * 1000L / SR
            return Result(1, listOf(Segment(0, dur, 0)), longArrayOf(dur))
        }

        // Standardize features across segments.
        val d = NCEP; val mean = FloatArray(d); val sd = FloatArray(d)
        for (v in segVecs) for (c in 0 until d) mean[c] += v[c]
        for (c in 0 until d) mean[c] = mean[c] / segVecs.size.toFloat()
        for (v in segVecs) for (c in 0 until d) { val t = v[c] - mean[c]; sd[c] += t * t }
        for (c in 0 until d) sd[c] = sqrt(sd[c] / segVecs.size) + 1e-6f
        val norm = segVecs.map { v -> FloatArray(d) { (v[it] - mean[it]) / sd[it] } }

        val k = min(maxSpeakers, segVecs.size).coerceAtLeast(1)
        val labels = if (k == 1) IntArray(norm.size) else kmeans(norm, k)

        // Map each frame-segment to a time range; merge adjacent same-speaker ranges.
        val raw = ArrayList<Segment>()
        for (s in segBounds.indices) {
            val startMs = segBounds[s][0].toLong() * HOP * 1000 / SR
            val endMs = segBounds[s][1].toLong() * HOP * 1000 / SR
            raw.add(Segment(startMs, endMs, labels[s]))
        }
        val merged = ArrayList<Segment>()
        for (seg in raw) {
            val last = merged.lastOrNull()
            if (last != null && last.speaker == seg.speaker && seg.startMs - last.endMs < 800)
                merged[merged.size - 1] = last.copy(endMs = seg.endMs)
            else merged.add(seg)
        }
        val talk = LongArray(k)
        for (seg in merged) if (seg.speaker in 0 until k) talk[seg.speaker] += seg.endMs - seg.startMs
        // Order speaker ids by who talks most, so "Speaker 1" is the dominant voice.
        val order = (0 until k).sortedByDescending { talk[it] }
        val remap = IntArray(k); order.forEachIndexed { idx, old -> remap[old] = idx }
        val finalSegs = merged.map { it.copy(speaker = remap[it.speaker]) }.sortedBy { it.startMs }
        val finalTalk = LongArray(k); for (o in 0 until k) finalTalk[remap[o]] = talk[o]
        return Result(k, finalSegs, finalTalk)
    }

    private fun kmeans(data: List<FloatArray>, k: Int, iters: Int = 25): IntArray {
        val d = data[0].size
        var best: IntArray = IntArray(data.size); var bestCost = Double.MAX_VALUE
        val rnd = java.util.Random(1234)
        repeat(4) {
            val cent = Array(k) { data[rnd.nextInt(data.size)].copyOf() }
            val lab = IntArray(data.size)
            repeat(iters) {
                for (p in data.indices) {
                    var bi = 0; var bd = Double.MAX_VALUE
                    for (c in 0 until k) { var s = 0.0; val cc = cent[c]; val dp = data[p]; for (j in 0 until d) { val t = dp[j] - cc[j]; s += t * t }; if (s < bd) { bd = s; bi = c } }
                    lab[p] = bi
                }
                val sum = Array(k) { DoubleArray(d) }; val cnt = IntArray(k)
                for (p in data.indices) {
                    val c = lab[p]; cnt[c] = cnt[c] + 1
                    val dp = data[p]; val sc = sum[c]
                    for (j in 0 until d) sc[j] = sc[j] + dp[j]
                }
                for (c in 0 until k) if (cnt[c] > 0) {
                    val sc = sum[c]; val cc = cent[c]
                    for (j in 0 until d) cc[j] = (sc[j] / cnt[c]).toFloat()
                }
            }
            var cost = 0.0
            for (p in data.indices) { val cc = cent[lab[p]]; val dp = data[p]; for (j in 0 until d) { val t = dp[j] - cc[j]; cost += t * t } }
            if (cost < bestCost) { bestCost = cost; best = lab.copyOf() }
        }
        return best
    }

    // ---- MFCC ----
    private fun mfcc(x: FloatArray): Pair<Array<FloatArray>, FloatArray> {
        val fft = Fft(NFFT)
        val win = FloatArray(WIN) { (0.54 - 0.46 * cos(2 * Math.PI * it / (WIN - 1))).toFloat() }
        val melFb = melFilterbank()
        val dct = Array(NCEP) { c -> DoubleArray(MEL) { m -> cos(Math.PI * c * (m + 0.5) / MEL) } }
        val frames = ArrayList<FloatArray>(); val energy = ArrayList<Float>()
        val re = DoubleArray(NFFT); val im = DoubleArray(NFFT)
        var k = 0
        while (k + WIN <= x.size) {
            var e = 0.0
            for (i in 0 until NFFT) {
                if (i < WIN) { val s = x[k + i] * win[i]; re[i] = s.toDouble(); e += s.toDouble() * s } else re[i] = 0.0
                im[i] = 0.0
            }
            fft.forward(re, im)
            val power = DoubleArray(NFFT / 2 + 1) { re[it] * re[it] + im[it] * im[it] }
            val mel = DoubleArray(MEL)
            for (m in 0 until MEL) { var s = 0.0; val fb = melFb[m]; for (b in fb.indices) s += power[b] * fb[b]; mel[m] = ln(s + 1e-10) }
            val cep = FloatArray(NCEP) { c -> var s = 0.0; for (m in 0 until MEL) s += dct[c][m] * mel[m]; s.toFloat() }
            frames.add(cep); energy.add(e.toFloat())
            k += HOP
        }
        return Pair(frames.toTypedArray(), energy.toFloatArray())
    }

    private fun melFilterbank(): Array<FloatArray> {
        val fMin = 0.0; val fMax = SR / 2.0
        fun hz2mel(f: Double) = 2595.0 * Math.log10(1 + f / 700.0)
        fun mel2hz(m: Double) = 700.0 * (Math.pow(10.0, m / 2595.0) - 1)
        val mLo = hz2mel(fMin); val mHi = hz2mel(fMax)
        val pts = DoubleArray(MEL + 2) { mel2hz(mLo + (mHi - mLo) * it / (MEL + 1)) }
        val bin = IntArray(MEL + 2) { ((NFFT + 1) * pts[it] / SR).toInt() }
        return Array(MEL) { m ->
            val fb = FloatArray(NFFT / 2 + 1)
            for (b in bin[m] until bin[m + 1]) if (b in fb.indices && bin[m + 1] > bin[m]) fb[b] = (b - bin[m]).toFloat() / (bin[m + 1] - bin[m])
            for (b in bin[m + 1] until bin[m + 2]) if (b in fb.indices && bin[m + 2] > bin[m + 1]) fb[b] = (bin[m + 2] - b).toFloat() / (bin[m + 2] - bin[m + 1])
            fb
        }
    }
}
