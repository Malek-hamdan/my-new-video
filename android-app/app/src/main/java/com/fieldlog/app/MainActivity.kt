package com.fieldlog.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.View
import android.widget.EditText
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.recyclerview.widget.LinearLayoutManager
import com.fieldlog.app.databinding.ActivityMainBinding
import java.io.File
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var b: ActivityMainBinding
    private lateinit var prefs: Prefs
    private var player: MediaPlayer? = null
    private val ui = Handler(Looper.getMainLooper())
    private lateinit var adapter: RecordingsAdapter

    private val busListener = { refreshRecordingUi() }

    private val permLauncher = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = Prefs(this)
        b = ActivityMainBinding.inflate(layoutInflater)
        setContentView(b.root)

        setupPin()
        setupLevels()
        setupRecord()
        setupList()
        b.btnSettings.setOnClickListener { showSettings() }
        requestPerms()
    }

    // ---- PIN ----
    private fun setupPin() {
        b.pinOverlay.visibility = View.VISIBLE
        b.content.visibility = View.INVISIBLE
        val unlock = {
            if (b.pinInput.text.toString() == prefs.pin) {
                b.pinOverlay.visibility = View.GONE
                b.content.visibility = View.VISIBLE
            } else {
                b.pinHint.text = getString(R.string.pin_wrong)
                b.pinInput.text?.clear()
            }
        }
        b.btnUnlock.setOnClickListener { unlock() }
    }

    // ---- levels ----
    private fun setupLevels() {
        val id = when (prefs.level) {
            Enhancer.Level.LIGHT -> b.levelLight.id
            Enhancer.Level.MEDIUM -> b.levelMedium.id
            Enhancer.Level.STRONG -> b.levelStrong.id
        }
        b.levelGroup.check(id)
        b.levelGroup.addOnButtonCheckedListener { _, checkedId, isChecked ->
            if (!isChecked) return@addOnButtonCheckedListener
            prefs.level = when (checkedId) {
                b.levelLight.id -> Enhancer.Level.LIGHT
                b.levelStrong.id -> Enhancer.Level.STRONG
                else -> Enhancer.Level.MEDIUM
            }
        }
    }

    // ---- record ----
    private fun setupRecord() {
        b.btnRecord.setOnClickListener {
            if (RecorderBus.recording) {
                RecordingService.stopSave(this)
            } else {
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                    requestPerms(); return@setOnClickListener
                }
                RecordingService.start(this)
            }
        }
    }

    private fun refreshRecordingUi() {
        val rec = RecorderBus.recording
        b.btnRecord.text = if (rec) "Stop & save" else "Record"
        b.status.text = when {
            RecorderBus.processing -> "Saving & cleaning…"
            rec -> "Recording · you can turn off the screen"
            else -> getString(R.string.tap_to_record)
        }
        if (!rec && !RecorderBus.processing) loadList()
    }

    private val ticker = object : Runnable {
        override fun run() {
            if (RecorderBus.recording && RecorderBus.startElapsed != 0L) {
                val s = ((android.os.SystemClock.elapsedRealtime() - RecorderBus.startElapsed) / 1000).toInt()
                b.timer.text = String.format(Locale.US, "%02d:%02d:%02d", s / 3600, (s % 3600) / 60, s % 60)
            } else {
                b.timer.text = "00:00:00"
            }
            ui.postDelayed(this, 500)
        }
    }

    // ---- list ----
    private fun setupList() {
        adapter = RecordingsAdapter(emptyList(), ::play, ::itemMenu)
        b.list.layoutManager = LinearLayoutManager(this)
        b.list.adapter = adapter
    }

    private fun loadList() {
        val files = RecordingService.recordingsDir(this)
            .listFiles { f -> f.extension == "wav" && !f.name.contains("ORIGINAL") }
            ?.sortedByDescending { it.lastModified() } ?: emptyList()
        adapter.submit(files)
    }

    private fun play(f: File) {
        runCatching {
            player?.release()
            player = MediaPlayer().apply { setDataSource(f.absolutePath); prepare(); start() }
            Toast.makeText(this, "Playing", Toast.LENGTH_SHORT).show()
        }.onFailure { Toast.makeText(this, "Can't play", Toast.LENGTH_SHORT).show() }
    }

    private fun itemMenu(f: File) {
        AlertDialog.Builder(this)
            .setItems(arrayOf("Split by speaker", "Share", "Rename", "Delete")) { _, which ->
                when (which) {
                    0 -> splitBySpeaker(f)
                    1 -> share(f)
                    2 -> rename(f)
                    3 -> { f.delete(); File(f.parent, f.name.replace(Regex("__[\\w-]+\\.wav"), "__ORIGINAL.wav")).delete(); loadList() }
                }
            }.show()
    }

    // ---- speaker split ----
    private fun splitBySpeaker(f: File) {
        val progress = AlertDialog.Builder(this)
            .setTitle("Split by speaker")
            .setMessage("Analyzing voices… this runs on your phone and may take a moment.")
            .setCancelable(false).show()
        Thread {
            val result = runCatching {
                val pcm = WavIo.readPcm16(f)
                Diarizer.diarize(pcm, maxSpeakers = 2)
            }.getOrNull()
            ui.post {
                progress.dismiss()
                if (result == null || result.segments.isEmpty()) {
                    Toast.makeText(this, "Couldn't analyze this recording", Toast.LENGTH_SHORT).show()
                    return@post
                }
                showSpeakers(f, result)
            }
        }.start()
    }

    private fun showSpeakers(f: File, r: Diarizer.Result) {
        if (r.speakers <= 1) {
            AlertDialog.Builder(this).setTitle("One speaker")
                .setMessage("Only one voice was detected in this recording.")
                .setPositiveButton("OK", null).show()
            return
        }
        val names = (0 until r.speakers).map { sp ->
            val sec = (r.talkMs[sp] / 1000).toInt()
            "Speaker ${sp + 1}  ·  ${sec / 60}:${String.format(Locale.US, "%02d", sec % 60)}"
        }.toTypedArray()
        AlertDialog.Builder(this)
            .setTitle("${r.speakers} speakers found")
            .setItems(names) { _, which -> playSpeaker(f, r, which) }
            .setNegativeButton("Close", null)
            .show()
    }

    private var segRunner: Runnable? = null

    private fun playSpeaker(f: File, r: Diarizer.Result, speaker: Int) {
        val segs = r.segments.filter { it.speaker == speaker }
        if (segs.isEmpty()) return
        player?.release()
        val mp = MediaPlayer().apply { setDataSource(f.absolutePath); prepare() }
        player = mp
        Toast.makeText(this, "Playing Speaker ${speaker + 1} only", Toast.LENGTH_SHORT).show()
        var idx = 0
        val step = object : Runnable {
            override fun run() {
                if (player !== mp) return
                if (idx >= segs.size) { mp.pause(); return }
                val s = segs[idx]
                mp.seekTo(s.startMs.toInt())
                mp.start()
                val dur = (s.endMs - s.startMs).coerceAtLeast(200)
                idx++
                ui.postDelayed(this, dur)
            }
        }
        segRunner = step
        ui.post(step)
    }

    private fun share(f: File) {
        val uri: Uri = FileProvider.getUriForFile(this, "$packageName.files", f)
        val i = Intent(Intent.ACTION_SEND).apply {
            type = "audio/wav"; putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        startActivity(Intent.createChooser(i, "Share"))
    }

    private fun rename(f: File) {
        val input = EditText(this).apply { setText(f.nameWithoutExtension) }
        AlertDialog.Builder(this).setTitle("Rename").setView(input)
            .setPositiveButton("OK") { _, _ ->
                val nn = input.text.toString().trim()
                if (nn.isNotEmpty()) { f.renameTo(File(f.parent, "$nn.wav")); loadList() }
            }.setNegativeButton("Cancel", null).show()
    }

    // ---- settings ----
    private fun showSettings() {
        val v = layoutInflater.inflate(android.R.layout.simple_list_item_1, null)
        AlertDialog.Builder(this)
            .setTitle(R.string.settings)
            .setItems(
                arrayOf(
                    "Change PIN",
                    if (prefs.aiEnabled) "AI noise removal: ON" else "AI noise removal: OFF",
                    if (prefs.keepOriginal) "Keep original copy: ON" else "Keep original copy: OFF",
                    if (prefs.volumeStop) "Volume-Down ×3 stop: ON" else "Volume-Down ×3 stop: OFF",
                    "Enable stop control (Accessibility)"
                )
            ) { _, which ->
                when (which) {
                    0 -> changePin()
                    1 -> {
                        prefs.aiEnabled = !prefs.aiEnabled
                        if (prefs.aiEnabled && !Rnnoise.available)
                            Toast.makeText(this, "AI engine unavailable on this device", Toast.LENGTH_SHORT).show()
                        showSettings()
                    }
                    2 -> { prefs.keepOriginal = !prefs.keepOriginal; showSettings() }
                    3 -> { prefs.volumeStop = !prefs.volumeStop; showSettings() }
                    4 -> startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                }
            }.show()
    }

    private fun changePin() {
        val input = EditText(this).apply { inputType = android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_VARIATION_PASSWORD; setText(prefs.pin) }
        AlertDialog.Builder(this).setTitle("Change PIN").setView(input)
            .setPositiveButton("Save") { _, _ ->
                val np = input.text.toString()
                if (np.length in 4..8) { prefs.pin = np; Toast.makeText(this, "PIN updated", Toast.LENGTH_SHORT).show() }
                else Toast.makeText(this, "Use 4–8 digits", Toast.LENGTH_SHORT).show()
            }.setNegativeButton("Cancel", null).show()
    }

    private fun requestPerms() {
        val perms = mutableListOf(Manifest.permission.RECORD_AUDIO)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) perms.add(Manifest.permission.POST_NOTIFICATIONS)
        permLauncher.launch(perms.toTypedArray())
    }

    override fun onResume() {
        super.onResume()
        RecorderBus.addListener(busListener)
        refreshRecordingUi()
        loadList()
        ui.post(ticker)
    }

    override fun onPause() {
        super.onPause()
        RecorderBus.removeListener(busListener)
        ui.removeCallbacks(ticker)
    }

    override fun onDestroy() {
        player?.release(); player = null
        super.onDestroy()
    }
}
