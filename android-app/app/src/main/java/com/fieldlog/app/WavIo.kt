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

    /** Append raw 16-bit PCM bytes to a file (used live during recording). */
    fun appendPcm(raf: RandomAccessFile, buf: ByteArray, len: Int) {
        raf.write(buf, 0, len)
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
