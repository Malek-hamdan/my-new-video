package com.fieldlog.app

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import java.io.File
import java.io.RandomAccessFile
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.concurrent.thread

/**
 * Foreground microphone service. Records raw PCM while the screen is off,
 * then applies the chosen enhancement level and saves a WAV on stop.
 * The notification is intentionally neutral (no "recording" wording).
 */
class RecordingService : Service() {

    companion object {
        const val ACTION_START = "start"
        const val ACTION_STOP_SAVE = "stop_save"
        const val ACTION_CANCEL = "cancel"
        const val ACTION_PAUSE = "pause"
        const val CHANNEL = "session"
        const val NOTIF_ID = 42

        fun start(ctx: Context) = ctx.startForegroundService(Intent(ctx, RecordingService::class.java).setAction(ACTION_START))
        fun stopSave(ctx: Context) = ctx.startService(Intent(ctx, RecordingService::class.java).setAction(ACTION_STOP_SAVE))
        fun cancel(ctx: Context) = ctx.startService(Intent(ctx, RecordingService::class.java).setAction(ACTION_CANCEL))

        fun recordingsDir(ctx: Context): File =
            File(ctx.getExternalFilesDir(null) ?: ctx.filesDir, "recordings").apply { mkdirs() }
    }

    @Volatile private var running = false
    private var recorder: AudioRecord? = null
    private var pcmFile: File? = null
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
        startForeground(NOTIF_ID, buildNotification())

        val minBuf = AudioRecord.getMinBufferSize(
            WavIo.SR, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT
        ).coerceAtLeast(4096)
        val rec = AudioRecord(
            MediaRecorder.AudioSource.VOICE_RECOGNITION,
            WavIo.SR, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, minBuf * 2
        )
        if (rec.state != AudioRecord.STATE_INITIALIZED) { stopSelf(); return }
        recorder = rec
        pcmFile = File(cacheDir, "current.pcm")
        running = true
        RecorderBus.recording = true
        RecorderBus.paused = false
        RecorderBus.pausedAccum = 0
        RecorderBus.startElapsed = SystemClock.elapsedRealtime()
        RecorderBus.notifyChanged()

        thread(name = "rec-loop") {
            val raf = RandomAccessFile(pcmFile, "rw"); raf.setLength(0)
            val buf = ByteArray(minBuf)
            rec.startRecording()
            while (running) {
                val n = rec.read(buf, 0, buf.size)
                if (n > 0) raf.write(buf, 0, n)
            }
            runCatching { rec.stop() }
            runCatching { rec.release() }
            raf.close()
        }
        // refresh the timer text on the notification every few seconds
        thread(name = "notif-timer") {
            while (running) {
                updateNotification()
                Thread.sleep(2000)
            }
        }
    }

    private fun finishRecording(save: Boolean) {
        if (!running && pcmFile == null) { stopForegroundCompat(); stopSelf(); return }
        running = false
        RecorderBus.recording = false
        RecorderBus.notifyChanged()
        val pcm = pcmFile
        thread(name = "finish") {
            Thread.sleep(250) // let the capture loop flush
            if (save && pcm != null && pcm.length() > 0) {
                RecorderBus.processing = true; RecorderBus.notifyChanged()
                runCatching {
                    val raw = WavIo.readPcm16(pcm)
                    val stamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
                    val level = prefs.level
                    val dir = recordingsDir(this)
                    val cleaned = Enhancer.process(raw, level)
                    WavIo.writeWav(File(dir, "FieldLog_${stamp}__${level.name}.wav"), cleaned)
                    if (prefs.keepOriginal) WavIo.writeWav(File(dir, "FieldLog_${stamp}__ORIGINAL.wav"), raw)
                }
                RecorderBus.processing = false; RecorderBus.notifyChanged()
            }
            pcm?.delete()
            pcmFile = null
            stopForegroundCompat()
            stopSelf()
        }
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
            setShowBadge(false)
            setSound(null, null)
            enableVibration(false)
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
