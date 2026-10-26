package com.fieldlog.app

import java.io.BufferedOutputStream
import java.io.DataInputStream
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile

/** 16-bit PCM WAV read/write helpers (mono, 48 kHz). */
object WavIo {
    const val SR = 48000

    fun writeWav(file: File, samples: FloatArray, sampleRate: Int = SR) {
        val dataLen = samples.size * 2
        BufferedOutputStream(FileOutputStream(file)).use { out ->
            fun i32(v: Int) { out.write(v and 0xff); out.write((v shr 8) and 0xff); out.write((v shr 16) and 0xff); out.write((v shr 24) and 0xff) }
            fun i16(v: Int) { out.write(v and 0xff); out.write((v shr 8) and 0xff) }
            out.write("RIFF".toByteArray()); i32(36 + dataLen); out.write("WAVE".toByteArray())
            out.write("fmt ".toByteArray()); i32(16); i16(1); i16(1)
            i32(sampleRate); i32(sampleRate * 2); i16(2); i16(16)
            out.write("data".toByteArray()); i32(dataLen)
            for (s in samples) {
                var v = (s * 32767f).toInt(); if (v > 32767) v = 32767; if (v < -32768) v = -32768
                out.write(v and 0xff); out.write((v shr 8) and 0xff)
            }
        }
    }

    /** Write the 44-byte WAV header at the start of a file once the data size is known. */
    fun fixWavHeader(raf: RandomAccessFile, dataLen: Long, sampleRate: Int = SR) {
        val dl = dataLen.toInt()
        val h = java.io.ByteArrayOutputStream(44)
        fun i32(v: Int) { h.write(v and 0xff); h.write((v shr 8) and 0xff); h.write((v shr 16) and 0xff); h.write((v shr 24) and 0xff) }
        fun i16(v: Int) { h.write(v and 0xff); h.write((v shr 8) and 0xff) }
        h.write("RIFF".toByteArray()); i32(36 + dl); h.write("WAVE".toByteArray())
        h.write("fmt ".toByteArray()); i32(16); i16(1); i16(1)
        i32(sampleRate); i32(sampleRate * 2); i16(2); i16(16)
        h.write("data".toByteArray()); i32(dl)
        raf.seek(0)
        raf.write(h.toByteArray())
    }

    /** Read 16-bit PCM samples from a WAV file, skipping its 44-byte header. */
    fun readWavSamples(file: File): FloatArray {
        val bytes = file.readBytes()
        val start = 44
        val n = (bytes.size - start).coerceAtLeast(0) / 2
        val out = FloatArray(n)
        var j = start
        for (i in 0 until n) {
            val lo = bytes[j].toInt() and 0xff; val hi = bytes[j + 1].toInt(); j += 2
            out[i] = ((hi shl 8) or lo) / 32768f
        }
        return out
    }

    /** Wrap a raw 16-bit PCM file into a WAV, streamed in blocks (constant memory). */
    fun pcmToWav(pcm: File, out: File, sampleRate: Int = SR) {
        val dataLen = pcm.length().toInt()
        BufferedOutputStream(FileOutputStream(out)).use { o ->
            fun i32(v: Int) { o.write(v and 0xff); o.write((v shr 8) and 0xff); o.write((v shr 16) and 0xff); o.write((v shr 24) and 0xff) }
            fun i16(v: Int) { o.write(v and 0xff); o.write((v shr 8) and 0xff) }
            o.write("RIFF".toByteArray()); i32(36 + dataLen); o.write("WAVE".toByteArray())
            o.write("fmt ".toByteArray()); i32(16); i16(1); i16(1)
            i32(sampleRate); i32(sampleRate * 2); i16(2); i16(16)
            o.write("data".toByteArray()); i32(dataLen)
            pcm.inputStream().use { input ->
                val buf = ByteArray(1 shl 16)
                while (true) { val n = input.read(buf); if (n <= 0) break; o.write(buf, 0, n) }
            }
        }
    }

    fun readPcm16(file: File): FloatArray {
        val bytes = file.readBytes()
        val n = bytes.size / 2
        val out = FloatArray(n)
        var j = 0
        for (i in 0 until n) {
            val lo = bytes[j].toInt() and 0xff; val hi = bytes[j + 1].toInt(); j += 2
            out[i] = ((hi shl 8) or lo) / 32768f
        }
        return out
    }
}
