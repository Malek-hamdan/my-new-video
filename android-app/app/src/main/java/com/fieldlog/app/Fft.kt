package com.fieldlog.app

/** Minimal radix-2 in-place complex FFT. n must be a power of two. */
class Fft(private val n: Int) {
    private val cosT = DoubleArray(n / 2)
    private val sinT = DoubleArray(n / 2)
    private val rev = IntArray(n)

    init {
        require(n > 0 && (n and (n - 1)) == 0) { "n must be a power of two" }
        for (i in 0 until n / 2) {
            cosT[i] = Math.cos(-2.0 * Math.PI * i / n)
            sinT[i] = Math.sin(-2.0 * Math.PI * i / n)
        }
        var bits = 0; var t = n; while (t > 1) { t = t shr 1; bits++ }
        for (i in 0 until n) {
            var x = i; var r = 0
            for (b in 0 until bits) { r = (r shl 1) or (x and 1); x = x shr 1 }
            rev[i] = r
        }
    }

    fun forward(re: DoubleArray, im: DoubleArray) = transform(re, im, false)
    fun inverse(re: DoubleArray, im: DoubleArray) {
        transform(re, im, true)
        val inv = 1.0 / n
        for (i in 0 until n) { re[i] *= inv; im[i] *= inv }
    }

    private fun transform(re: DoubleArray, im: DoubleArray, inverse: Boolean) {
        for (i in 0 until n) {
            val j = rev[i]
            if (j > i) { var tr = re[i]; re[i] = re[j]; re[j] = tr; tr = im[i]; im[i] = im[j]; im[j] = tr }
        }
        var len = 2
        while (len <= n) {
            val half = len / 2; val step = n / len
            var i = 0
            while (i < n) {
                var idx = 0
                for (j in i until i + half) {
                    val c = cosT[idx]; val s = if (inverse) -sinT[idx] else sinT[idx]
                    val k = j + half
                    val tr = re[k] * c - im[k] * s
                    val ti = re[k] * s + im[k] * c
                    re[k] = re[j] - tr; im[k] = im[j] - ti
                    re[j] += tr; im[j] += ti
                    idx += step
                }
                i += len
            }
            len = len shl 1
        }
    }
}
