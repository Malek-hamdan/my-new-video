package com.fieldlog.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import java.io.File
import java.io.RandomAccessFile
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.concurrent.thread

/**
 * Foreground microphone service. The audio file is written LIVE to a WAV while
 * recording (so it is saved even if enhancement fails or the app is killed),
 * then optionally enhanced on stop. Capture failures are surfaced, not hidden.
 */
class RecordingService : Service() {

    companion object {
        const val ACTION_START = "start"
        const val ACTION_STOP_SAVE = "stop_save"
        const val ACTION_CANCEL = "cancel"
        const val CHANNEL = "session"
        const val NOTIF_ID = 42

        fun start(ctx: Context) = ctx.startForegroundService(Intent(ctx, RecordingService::class.java).setAction(ACTION_START))
        fun stopSave(ctx: Context) = ctx.startService(Intent(ctx, RecordingService::class.java).setAction(ACTION_STOP_SAVE))
        fun cancel(ctx: Context) = ctx.startService(Intent(ctx, RecordingService::class.java).setAction(ACTION_CANCEL))

        fun recordingsDir(ctx: Context): File =
            File(ctx.getExternalFilesDir(null) ?: ctx.filesDir, "recordings").apply { mkdirs() }
    }

    @Volatile private var running = false
    @Volatile private var bytesWritten = 0L
    private var recorder: AudioRecord? = null
    private var captureThread: Thread? = null
    private var liveWav: File? = null
    private var stamp: String = ""
    private var level: Enhancer.Level = Enhancer.Level.MEDIUM
    private lateinit var prefs: Prefs

    override fun onBind(i: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        prefs = Prefs(this)
        when (intent?.action) {
            ACTION_START -> startRecording()
            ACTION_STOP_SAVE -> finishRecording(save = true)
            ACTION_CANCEL -> finishRecording(save = false)
        }
        return START_STICKY
    }

    @SuppressLint("MissingPermission")
    private fun startRecording() {
        if (running) return
        createChannel()
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
                startForeground(NOTIF_ID, buildNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
            else startForeground(NOTIF_ID, buildNotification())
        } catch (e: Exception) {
            fail("Microphone permission is required. Open Settings → Apps → FieldLog → Permissions → Microphone → Allow.")
            return
        }
        val hasMic = ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        if (!hasMic) {
            fail("Microphone permission not granted. Open Settings → Apps → FieldLog → Permissions → Microphone → Allow.")
            stopForegroundCompat(); return
        }

        val minBuf = AudioRecord.getMinBufferSize(
            WavIo.SR, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT
        ).coerceAtLeast(8192)
        val rec = try {
            AudioRecord(
                MediaRecorder.AudioSource.MIC,
                WavIo.SR, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, minBuf * 4
            )
        } catch (e: Exception) { null }
        if (rec == null || rec.state != AudioRecord.STATE_INITIALIZED) {
            runCatching { rec?.release() }
            fail("Microphone is busy or unavailable. Close other apps using the mic and try again.")
            stopForegroundCompat(); return
        }
        recorder = rec

        stamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        level = prefs.level
        val dir = recordingsDir(this)
        val wav = File(dir, "FieldLog_${stamp}__RAW.wav")
        liveWav = wav
        bytesWritten = 0L
        running = true
        RecorderBus.recording = true
        RecorderBus.paused = false
        RecorderBus.startElapsed = SystemClock.elapsedRealtime()
        RecorderBus.notifyChanged()

        captureThread = thread(name = "rec-loop") {
            val raf = RandomAccessFile(wav, "rw")
            raf.setLength(0)
            raf.write(ByteArray(44))          // placeholder WAV header; filled in on stop
            val buf = ByteArray(minBuf)
            runCatching { rec.startRecording() }
            var errors = 0
            while (running) {
                val n = rec.read(buf, 0, buf.size)
                when {
                    n > 0 -> { raf.write(buf, 0, n); bytesWritten += n; errors = 0 }
                    n < 0 -> { if (++errors > 50) { running = false } }
                }
            }
            runCatching { rec.stop() }
            runCatching { rec.release() }
            WavIo.fixWavHeader(raf, bytesWritten)   // write RIFF/data sizes
            raf.close()
        }
        thread(name = "notif-timer") {
            while (running) { updateNotification(); Thread.sleep(2000) }
        }
    }

    private fun finishRecording(save: Boolean) {
        if (!running && liveWav == null) { stopForegroundCompat(); stopSelf(); return }
        running = false
        RecorderBus.recording = false
        RecorderBus.notifyChanged()
        val wav = liveWav
        val st = stamp
        val lvl = level
        thread(name = "finish") {
            captureThread?.join(5000)         // wait for the live file to be finalized
            val dir = recordingsDir(this)
            if (!save) { wav?.delete() }
            else if (wav == null || bytesWritten <= 0L) {
                wav?.delete()
                fail("No audio was captured. Check the Microphone permission for FieldLog.")
            } else {
                RecorderBus.processing = true; RecorderBus.notifyChanged()
                // The raw recording is already saved as `wav`. Try to enhance into a cleaned file.
                val enhanced = runCatching {
                    val raw = WavIo.readWavSamples(wav)
                    val ai = prefs.aiEnabled
                    val cleaned = Enhancer.process(raw, lvl, ai)
                    val tag = if (ai && Rnnoise.available) "${lvl.name}-AI" else lvl.name
                    WavIo.writeWav(File(dir, "FieldLog_${st}__${tag}.wav"), cleaned)
                }.isSuccess

                if (enhanced) {
                    if (prefs.keepOriginal) wav.renameTo(File(dir, "FieldLog_${st}__ORIGINAL.wav"))
                    else wav.delete()
                } else {
                    // Enhancement failed → keep the raw recording as the result.
                    wav.renameTo(File(dir, "FieldLog_${st}__${lvl.name}.wav"))
                }
                RecorderBus.processing = false; RecorderBus.notifyChanged()
            }
            liveWav = null
            stopForegroundCompat()
            stopSelf()
        }
    }

    private fun fail(msg: String) {
        RecorderBus.recording = false
        RecorderBus.processing = false
        RecorderBus.lastError = msg
        RecorderBus.notifyChanged()
        running = false
        stopSelf()
    }

    private fun elapsedMs(): Long =
        if (RecorderBus.startElapsed == 0L) 0 else SystemClock.elapsedRealtime() - RecorderBus.startElapsed

    private fun timeText(): String {
        val s = (elapsedMs() / 1000).toInt()
        return String.format(Locale.US, "%02d:%02d:%02d", s / 3600, (s % 3600) / 60, s % 60)
    }

    private fun buildNotification(): Notification {
        val openIntent = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val stopIntent = PendingIntent.getService(
            this, 1, Intent(this, RecordingService::class.java).setAction(ACTION_STOP_SAVE),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        return NotificationCompat.Builder(this, CHANNEL)
            .setContentTitle(getString(R.string.notif_title))
            .setContentText("${getString(R.string.notif_active)} · ${timeText()}")
            .setSmallIcon(R.drawable.ic_mic)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(openIntent)
            .addAction(0, getString(R.string.notif_stop), stopIntent)
            .build()
    }

    private fun updateNotification() {
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
            .notify(NOTIF_ID, buildNotification())
    }

    private fun createChannel() {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val ch = NotificationChannel(CHANNEL, getString(R.string.channel_name), NotificationManager.IMPORTANCE_LOW).apply {
            description = getString(R.string.channel_desc)
            setShowBadge(false); setSound(null, null); enableVibration(false)
        }
        nm.createNotificationChannel(ch)
    }

    private fun stopForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_REMOVE)
        else @Suppress("DEPRECATION") stopForeground(true)
    }

    override fun onDestroy() {
        running = false
        super.onDestroy()
    }
}
