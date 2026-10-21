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
            .setItems(arrayOf("Share", "Rename", "Delete")) { _, which ->
                when (which) {
                    0 -> share(f)
                    1 -> rename(f)
                    2 -> { f.delete(); File(f.parent, f.name.replace(Regex("__\\w+\\.wav"), "__ORIGINAL.wav")).delete(); loadList() }
                }
            }.show()
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
                    if (prefs.keepOriginal) "Keep original copy: ON" else "Keep original copy: OFF",
                    if (prefs.volumeStop) "Volume-Down ×3 stop: ON" else "Volume-Down ×3 stop: OFF",
                    "Enable stop control (Accessibility)"
                )
            ) { _, which ->
                when (which) {
                    0 -> changePin()
                    1 -> { prefs.keepOriginal = !prefs.keepOriginal; showSettings() }
                    2 -> { prefs.volumeStop = !prefs.volumeStop; showSettings() }
                    3 -> startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
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
