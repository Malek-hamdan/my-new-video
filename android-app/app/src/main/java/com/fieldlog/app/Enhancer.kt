package com.fieldlog.app

import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.math.tanh

/**
 * Three noise-reduction levels, applied offline to the recorded PCM.
 *
 * Direct port of the reference pipeline:
 *   high-pass -> spectral noise reduction (decision-directed Wiener with a
 *   speech-gated noise tracker) -> de-mud / presence / air EQ -> top cut
 *   -> auto level -> compressor + downward expander -> soft limiter.
 *
 * Works on 48 kHz mono float samples in [-1, 1].
 */
object Enhancer {

    enum class Level { LIGHT, MEDIUM, STRONG }

    private class Params(
        val hp: Double, val floorDb: Double, val over: Double,
        val mud: Double, val pres: Double, val air: Double, val topCut: Double?,
        val thr: Double, val ratio: Double, val expRatio: Double
    )

    private fun params(level: Level): Params = when (level) {
        Level.LIGHT  -> Params(80.0,  -8.0,  1.0,  -1.5, 2.0, 1.5, null,    -16.0, 2.0, 1.0)
        Level.MEDIUM -> Params(90.0,  -14.0, 1.15, -2.0, 3.0, 2.5, null,    -18.0, 2.5, 1.5)
        Level.STRONG -> Params(100.0, -24.0, 1.25, -2.5, 3.5, 3.5, 14000.0, -20.0, 3.0, 2.0)
    }

    private const val SR = 48000.0

    fun process(input: FloatArray, level: Level, ai: Boolean = false): FloatArray {
        if (ai && Rnnoise.available) return processAi(input, level)
        val p = params(level)
        var y = biquad(input, "hp", p.hp)
        y = denoise(y, p.floorDb, p.over)
        y = autoLevel(y)
        y = biquad(y, "peak", 300.0, 1.0, p.mud)
        y = biquad(y, "peak", 3000.0, 0.9, p.pres)
        if (p.air != 0.0) y = biquad(y, "shelf", 5000.0, 0.707, p.air)
        p.topCut?.let { y = biquad(y, "lp", it) }
        y = compress(y, p.thr, p.ratio, p.expRatio)
        return limit(y)
    }

    // AI path: RNNoise as the core remover, blended with a little dry signal to stay natural.
    private class AiParams(
        val dryDb: Double, val postFloor: Double?, val hp: Double,
        val mud: Double, val pres: Double, val air: Double, val topCut: Double?,
        val thr: Double, val ratio: Double, val expRatio: Double
    )

    private fun aiParams(level: Level): AiParams = when (level) {
        Level.LIGHT  -> AiParams(-10.0, null,  80.0,  -1.5, 2.0, 1.5, null,    -16.0, 2.0, 1.0)
        Level.MEDIUM -> AiParams(-20.0, null,  90.0,  -2.0, 3.0, 2.5, null,    -18.0, 2.5, 1.5)
        Level.STRONG -> AiParams(-30.0, -10.0, 100.0, -2.5, 3.5, 3.5, 14000.0, -20.0, 3.0, 2.0)
    }

    private fun processAi(input: FloatArray, level: Level): FloatArray {
        val p = aiParams(level)
        var y = biquad(input, "hp", p.hp)
        val dry = Math.pow(10.0, p.dryDb / 20.0).toFloat()
        val wet = Rnnoise.denoise(y)
        val blended = FloatArray(y.size) { wet[it] + y[it] * dry }
        y = blended
        p.postFloor?.let { y = denoise(y, it, 1.0) }
        y = autoLevel(y)
        y = biquad(y, "peak", 300.0, 1.0, p.mud)
        y = biquad(y, "peak", 3000.0, 0.9, p.pres)
        if (p.air != 0.0) y = biquad(y, "shelf", 5000.0, 0.707, p.air)
        p.topCut?.let { y = biquad(y, "lp", it) }
        y = compress(y, p.thr, p.ratio, p.expRatio)
        return limit(y)
    }

    // ---- biquad ----
    private fun biquad(x: FloatArray, kind: String, f0: Double, q: Double = 0.707, gainDb: Double = 0.0): FloatArray {
        val a = Math.pow(10.0, gainDb / 40.0)
        val w = 2 * Math.PI * f0 / SR
        val cw = cos(w); val alpha = sin(w) / (2 * q)
        val b = DoubleArray(3); val d = DoubleArray(3)
        when (kind) {
            "hp" -> { b[0] = (1 + cw) / 2; b[1] = -(1 + cw); b[2] = (1 + cw) / 2; d[0] = 1 + alpha; d[1] = -2 * cw; d[2] = 1 - alpha }
            "lp" -> { b[0] = (1 - cw) / 2; b[1] = 1 - cw; b[2] = (1 - cw) / 2; d[0] = 1 + alpha; d[1] = -2 * cw; d[2] = 1 - alpha }
            "shelf" -> {
                val sa = 2 * sqrt(a) * alpha
                b[0] = a * ((a + 1) + (a - 1) * cw + sa); b[1] = -2 * a * ((a - 1) + (a + 1) * cw); b[2] = a * ((a + 1) + (a - 1) * cw - sa)
                d[0] = (a + 1) - (a - 1) * cw + sa; d[1] = 2 * ((a - 1) - (a + 1) * cw); d[2] = (a + 1) - (a - 1) * cw - sa
            }
            else -> { b[0] = 1 + alpha * a; b[1] = -2 * cw; b[2] = 1 - alpha * a; d[0] = 1 + alpha / a; d[1] = -2 * cw; d[2] = 1 - alpha / a }
        }
        val b0 = b[0] / d[0]; val b1 = b[1] / d[0]; val b2 = b[2] / d[0]; val a1 = d[1] / d[0]; val a2 = d[2] / d[0]
        val out = FloatArray(x.size)
        var x1 = 0.0; var x2 = 0.0; var y1 = 0.0; var y2 = 0.0
        for (i in x.indices) {
            val x0 = x[i].toDouble()
            val y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
            out[i] = y0.toFloat(); x2 = x1; x1 = x0; y2 = y1; y1 = y0
        }
        return out
    }

    // ---- spectral noise reduction (overlap-add STFT) ----
    private fun denoise(x: FloatArray, floorDb: Double, over: Double): FloatArray {
        val n = 1024; val hop = 256
        val win = DoubleArray(n) { 0.5 - 0.5 * cos(2 * Math.PI * it / n) }
        var normB = 0.0; for (v in win) normB += v * v; normB /= hop
        val bins = n / 2 + 1
        val gmin = Math.pow(10.0, floorDb / 20.0)
        val fft = Fft(n)

        // Seed the background estimate from the first ~0.3 s of real signal.
        val noise = DoubleArray(bins); val smooth = DoubleArray(bins)
        var seeded = 0; var k = 0
        val re = DoubleArray(n); val im = DoubleArray(n)
        while (k + n <= min(x.size, 14400)) {
            for (i in 0 until n) { re[i] = x[k + i] * win[i]; im[i] = 0.0 }
            fft.forward(re, im)
            for (bI in 0 until bins) noise[bI] += re[bI] * re[bI] + im[bI] * im[bI]
            seeded++; k += hop
        }
        if (seeded == 0) for (i in 0 until bins) { noise[i] = 1e-12; smooth[i] = 1e-12 }
        else for (i in 0 until bins) { noise[i] = noise[i] / seeded + 1e-12; smooth[i] = noise[i] }

        val out = FloatArray(x.size)
        val gPrev = DoubleArray(bins) { 1.0 }; val gammaPrev = DoubleArray(bins) { 1.0 }
        val gain = DoubleArray(bins); val gSm = DoubleArray(bins)
        val frames = (x.size + 2 * n - n) / hop
        for (f in 0 until frames) {
            val start = f * hop - n
            for (i in 0 until n) { val idx = start + i; re[i] = if (idx in x.indices) x[idx] * win[i] else 0.0; im[i] = 0.0 }
            fft.forward(re, im)
            for (bI in 0 until bins) {
                val pw = re[bI] * re[bI] + im[bI] * im[bI]
                smooth[bI] = 0.9 * smooth[bI] + 0.1 * pw
                if (smooth[bI] < 3.0 * noise[bI]) noise[bI] = 0.96 * noise[bI] + 0.04 * smooth[bI] else noise[bI] *= 1.0015
                noise[bI] = min(noise[bI], smooth[bI] * 1.5) + 1e-12
                val gamma = pw / (noise[bI] * over)
                val xi = 0.98 * gPrev[bI] * gPrev[bI] * gammaPrev[bI] + 0.02 * max(gamma - 1, 0.0)
                gain[bI] = xi / (1 + xi)
                gammaPrev[bI] = gamma
            }
            for (bI in 0 until bins) {
                val lo = if (bI > 0) gain[bI - 1] else gain[bI]
                val hi = if (bI < bins - 1) gain[bI + 1] else gain[bI]
                var gg = 0.25 * lo + 0.5 * gain[bI] + 0.25 * hi
                if (gg < gmin) gg = gmin
                gSm[bI] = gg; gPrev[bI] = gg
            }
            // apply gain to the complex spectrum and mirror to the upper half
            for (bI in 0 until bins) { re[bI] *= gSm[bI]; im[bI] *= gSm[bI] }
            for (bI in 1 until bins - 1) { val mir = n - bI; re[mir] = re[bI]; im[mir] = -im[bI] }
            fft.inverse(re, im)
            for (i in 0 until n) { val idx = start + i; if (idx in x.indices) out[idx] += (re[i] * win[i]).toFloat() }
        }
        val inv = (1.0 / normB).toFloat()
        for (i in out.indices) out[i] *= inv
        return out
    }

    private fun autoLevel(x: FloatArray, targetDb: Double = -20.0, maxBoostDb: Double = 24.0): FloatArray {
        val block = (0.02 * SR).toInt()
        var level = targetDb; var gainDb = 0.0
        val up = exp(-0.02 / 0.5); val down = exp(-0.02 / 3.0)
        val out = FloatArray(x.size)
        var k = 0
        while (k < x.size) {
            val end = min(k + block, x.size)
            var s = 0.0; for (i in k until end) s += x[i] * x[i]
            val db = 10 * log10(s / max(1, end - k) + 1e-12)
            if (db > level - 10) { val a = if (db > level) up else down; level = a * level + (1 - a) * db }
            val want = max(-6.0, min(maxBoostDb, targetDb - level))
            gainDb = 0.9 * gainDb + 0.1 * want
            val g = Math.pow(10.0, gainDb / 20.0).toFloat()
            for (i in k until end) out[i] = x[i] * g
            k = end
        }
        return out
    }

    private fun compress(x: FloatArray, thrDb: Double, ratio: Double, expRatio: Double): FloatArray {
        val attack = 0.005; val release = 0.2; val knee = 6.0
        val aAt = exp(-1 / (attack * SR)); val aRel = exp(-1 / (release * SR))
        val expThr = thrDb - 18
        var env = 0.0
        val out = FloatArray(x.size)
        for (i in x.indices) {
            val s = x[i].toDouble(); val lvl = s * s
            val a = if (lvl > env) aAt else aRel
            env = a * env + (1 - a) * lvl
            val db = 10 * log10(env + 1e-12)
            val over = db - thrDb
            var red = when {
                over <= -knee / 2 -> 0.0
                over < knee / 2 -> (1 / ratio - 1) * (over + knee / 2) * (over + knee / 2) / (2 * knee)
                else -> (1 / ratio - 1) * over
            }
            if (db < expThr) red += max(-30.0, (expRatio - 1) * (expThr - db))
            out[i] = (s * Math.pow(10.0, red / 20.0)).toFloat()
        }
        return out
    }

    private fun limit(x: FloatArray, ceiling: Double = 0.89): FloatArray {
        val out = FloatArray(x.size)
        for (i in x.indices) out[i] = (ceiling * tanh(x[i] / ceiling)).toFloat()
        return out
    }

    private fun log10(v: Double) = ln(v) / ln(10.0)
}
