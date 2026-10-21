package com.fieldlog.app

/** On-device RNNoise (Xiph, BSD). Loads the native lib lazily; falls back cleanly if missing. */
object Rnnoise {
    val available: Boolean = runCatching { System.loadLibrary("rnnoise_jni") }.isSuccess

    private external fun nativeCreate(): Long
    private external fun nativeDestroy(handle: Long)
    private external fun nativeFrameSize(): Int
    private external fun nativeProcess(handle: Long, input: FloatArray, output: FloatArray)

    /** Denoise 48 kHz mono float in [-1,1]; returns output aligned to the input. */
    fun denoise(x: FloatArray): FloatArray {
        if (!available) return x
        val h = nativeCreate()
        if (h == 0L) return x
        return try {
            val n = nativeFrameSize()
            val inB = FloatArray(n)
            val outB = FloatArray(n)
            val pad = x.size + 3 * n
            val out = FloatArray(pad)
            var k = 0
            while (k + n <= pad) {
                for (i in 0 until n) { val idx = k + i; inB[i] = if (idx < x.size) x[idx] * 32768f else 0f }
                nativeProcess(h, inB, outB)
                for (i in 0 until n) out[k + i] = outB[i] / 32768f
                k += n
            }
            // RNNoise delays its output by two frames (~20 ms); realign.
            FloatArray(x.size) { if (it + 2 * n < pad) out[it + 2 * n] else 0f }
        } finally {
            nativeDestroy(h)
        }
    }
}
