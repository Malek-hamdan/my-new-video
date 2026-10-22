package com.fieldlog.app

import android.Manifest
import android.animation.ObjectAnimator
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.MotionEvent
import android.view.View
import android.view.animation.OvershootInterpolator
import android.widget.EditText
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.dynamicanimation.animation.SpringAnimation
import androidx.dynamicanimation.animation.SpringForce
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
        setupToggles()
        setupList()
        b.btnSettings.setOnClickListener { showSettings() }
        requestPerms()
    }

    // ---- AI + backup toggles on the home screen ----
    private fun setupToggles() {
        val aiOk = Rnnoise.available
        b.swAi.isChecked = prefs.aiEnabled && aiOk
        b.swAi.isEnabled = aiOk
        b.aiSub.text = if (aiOk) "On-device · free · offline" else "Not supported on this device"
        b.swAi.setOnCheckedChangeListener { _, checked -> prefs.aiEnabled = checked }

        b.swKeep.isChecked = prefs.keepOriginal
        b.swKeep.setOnCheckedChangeListener { _, checked -> prefs.keepOriginal = checked }
    }

    // ---- PIN (create + confirm on first run, unlock afterwards) ----
    private enum class PinStep { CREATE, CONFIRM, UNLOCK }
    private var pinStep = PinStep.UNLOCK
    private var pinFirst = ""

    private fun setupPin() {
        b.pinOverlay.visibility = View.VISIBLE
        b.content.alpha = 0f
        b.content.visibility = View.INVISIBLE
        pinStep = if (prefs.pinSet) PinStep.UNLOCK else PinStep.CREATE
        renderPinStep()
        b.btnUnlock.setOnClickListener { bounce(it); submitPin() }
        b.pinInput.setOnEditorActionListener { _, _, _ -> submitPin(); true }
    }

    private fun renderPinStep() {
        b.pinInput.text?.clear()
        b.pinInput.requestFocus()
        when (pinStep) {
            PinStep.CREATE -> { b.pinTitle.text = "Create a PIN"; b.pinHint.text = "Choose a 4–8 digit PIN"; b.btnUnlock.text = "Continue" }
            PinStep.CONFIRM -> { b.pinTitle.text = "Confirm PIN"; b.pinHint.text = "Re-enter your PIN"; b.btnUnlock.text = "Confirm" }
            PinStep.UNLOCK -> { b.pinTitle.text = "Enter PIN"; b.pinHint.text = ""; b.btnUnlock.text = "Unlock" }
        }
    }

    private fun submitPin() {
        val entered = b.pinInput.text.toString()
        when (pinStep) {
            PinStep.CREATE -> {
                if (entered.length < 4) { b.pinHint.text = "Use 4–8 digits"; shake(b.pinInput); return }
                pinFirst = entered; pinStep = PinStep.CONFIRM; renderPinStep()
            }
            PinStep.CONFIRM -> {
                if (entered == pinFirst) { prefs.pin = entered; Toast.makeText(this, "PIN set", Toast.LENGTH_SHORT).show(); unlockToApp() }
                else { b.pinHint.text = "PINs don't match — try again"; shake(b.pinInput); pinStep = PinStep.CREATE; pinFirst = "" }
            }
            PinStep.UNLOCK -> {
                if (entered == prefs.pin) unlockToApp()
                else { b.pinHint.text = getString(R.string.pin_wrong); shake(b.pinInput); b.pinInput.text?.clear() }
            }
        }
    }

    private fun unlockToApp() {
        b.pinOverlay.animate().alpha(0f).translationY(-40f).setDuration(280).withEndAction {
            b.pinOverlay.visibility = View.GONE
        }.start()
        b.content.visibility = View.VISIBLE
        b.content.alpha = 0f
        b.content.translationY = 40f
        b.content.animate().alpha(1f).translationY(0f).setDuration(320).start()
    }

    private fun shake(v: View) {
        ObjectAnimator.ofFloat(v, "translationX", 0f, 24f, -24f, 18f, -18f, 10f, -10f, 0f)
            .setDuration(420).start()
    }

    private fun bounce(v: View) {
        SpringAnimation(v, SpringAnimation.SCALE_X, 1f).apply { spring.stiffness = SpringForce.STIFFNESS_MEDIUM; spring.dampingRatio = 0.35f; setStartValue(0.9f) }.start()
        SpringAnimation(v, SpringAnimation.SCALE_Y, 1f).apply { spring.stiffness = SpringForce.STIFFNESS_MEDIUM; spring.dampingRatio = 0.35f; setStartValue(0.9f) }.start()
    }

    // ---- levels ----
    private val levelViews by lazy {
        listOf(
            b.levelLight to Enhancer.Level.LIGHT,
            b.levelMedium to Enhancer.Level.MEDIUM,
            b.levelStrong to Enhancer.Level.STRONG
        )
    }

    private fun levelIndex(l: Enhancer.Level) = when (l) {
        Enhancer.Level.LIGHT -> 0; Enhancer.Level.MEDIUM -> 1; Enhancer.Level.STRONG -> 2
    }

    private fun setupLevels() {
        levelViews.forEach { (view, lvl) -> view.setOnClickListener { selectLevel(lvl, true) } }
        b.levelGroup.post { positionHighlight(prefs.level, false); applyLevelText(prefs.level) }
    }

    private fun selectLevel(lvl: Enhancer.Level, animate: Boolean) {
        prefs.level = lvl
        positionHighlight(lvl, animate)
        applyLevelText(lvl)
    }

    private fun positionHighlight(lvl: Enhancer.Level, animate: Boolean) {
        val item = b.levelLight
        val w = item.width; val h = item.height
        if (w == 0) return
        b.levelHighlight.layoutParams = b.levelHighlight.layoutParams.apply { width = w; height = h }
        val target = (levelIndex(lvl) * w).toFloat()
        if (animate) {
            SpringAnimation(b.levelHighlight, SpringAnimation.TRANSLATION_X, target).apply {
                spring.stiffness = SpringForce.STIFFNESS_LOW
                spring.dampingRatio = 0.72f
            }.start()
        } else {
            b.levelHighlight.translationX = target
        }
    }

    private fun applyLevelText(lvl: Enhancer.Level) {
        levelViews.forEach { (view, l) ->
            view.setTextColor(ContextCompat.getColor(this, if (l == lvl) R.color.white else R.color.muted))
            view.setTypeface(null, if (l == lvl) Typeface.BOLD else Typeface.NORMAL)
        }
        b.levelHint.text = when (lvl) {
            Enhancer.Level.LIGHT -> "Natural sound · gentle clean-up"
            Enhancer.Level.MEDIUM -> "Best for most conversations"
            Enhancer.Level.STRONG -> "For loud places"
        }
    }

    // ---- record ----
    private var lastRec: Boolean? = null
    private var recPulse: ObjectAnimator? = null
    private var recPulseAlpha: ObjectAnimator? = null

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
        b.btnRecord.setOnTouchListener { v, e ->
            if (e.action == MotionEvent.ACTION_DOWN) v.animate().scaleX(0.92f).scaleY(0.92f).setDuration(90).start()
            else if (e.action == MotionEvent.ACTION_UP || e.action == MotionEvent.ACTION_CANCEL) v.animate().scaleX(1f).scaleY(1f).setDuration(120).start()
            false
        }
        // gentle ambient breathing on the inner ring
        ObjectAnimator.ofFloat(b.ring1, "scaleX", 1f, 1.05f).apply { duration = 2400; repeatMode = ObjectAnimator.REVERSE; repeatCount = ObjectAnimator.INFINITE; start() }
        ObjectAnimator.ofFloat(b.ring1, "scaleY", 1f, 1.05f).apply { duration = 2400; repeatMode = ObjectAnimator.REVERSE; repeatCount = ObjectAnimator.INFINITE; start() }
    }

    private fun startRecPulse() {
        if (recPulse != null) return
        recPulse = ObjectAnimator.ofFloat(b.ring2, "scaleX", 1f, 1.15f).apply { duration = 1300; repeatCount = ObjectAnimator.INFINITE; start() }
        ObjectAnimator.ofFloat(b.ring2, "scaleY", 1f, 1.15f).apply { duration = 1300; repeatCount = ObjectAnimator.INFINITE; start() }
        recPulseAlpha = ObjectAnimator.ofFloat(b.ring2, "alpha", 0.7f, 0f).apply { duration = 1300; repeatCount = ObjectAnimator.INFINITE; start() }
    }

    private fun stopRecPulse() {
        recPulse?.cancel(); recPulseAlpha?.cancel(); recPulse = null; recPulseAlpha = null
        b.ring2.scaleX = 1f; b.ring2.scaleY = 1f; b.ring2.alpha = 1f
    }

    private fun refreshRecordingUi() {
        val rec = RecorderBus.recording
        if (rec != lastRec) {
            b.recordIcon.animate().alpha(0f).setDuration(110).withEndAction {
                b.recordIcon.setImageResource(if (rec) R.drawable.ic_stop else R.drawable.ic_mic)
                b.recordIcon.animate().alpha(1f).setDuration(140).start()
            }.start()
            if (rec) startRecPulse() else stopRecPulse()
            lastRec = rec
        }
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

    private fun originalOf(f: File) = File(f.parent, f.name.replace(Regex("__[\\w-]+\\.wav"), "__ORIGINAL.wav"))

    private fun itemMenu(f: File) {
        AlertDialog.Builder(this)
            .setItems(arrayOf("▶ Play ORIGINAL (before)", "Split by speaker", "Share", "Rename", "Delete")) { _, which ->
                when (which) {
                    0 -> {
                        val orig = originalOf(f)
                        if (orig.exists()) { play(orig); Toast.makeText(this, "Playing ORIGINAL (raw) — tap the card to hear the cleaned one", Toast.LENGTH_LONG).show() }
                        else Toast.makeText(this, "No original saved. Turn on 'Keep original copy' before recording.", Toast.LENGTH_LONG).show()
                    }
                    1 -> splitBySpeaker(f)
                    2 -> share(f)
                    3 -> rename(f)
                    4 -> { f.delete(); originalOf(f).delete(); loadList() }
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
                val dur = (s.endMs - s.startMs).coerceAtLeast(200L)
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
