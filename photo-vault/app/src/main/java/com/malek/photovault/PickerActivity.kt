package com.malek.photovault

import android.Manifest
import android.content.ContentUris
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.util.Size
import android.view.View
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.button.MaterialButton
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import kotlin.concurrent.thread

class PickerActivity : SecureActivity() {
    data class G(val id: Long, val uri: Uri, val name: String, val mime: String)

    private var items = listOf<G>()
    private val selected = LinkedHashSet<Long>()
    private lateinit var adapter: PhotoAdapter
    private lateinit var moveBtn: MaterialButton
    private lateinit var selectAll: TextView
    private var savedUris = listOf<Uri>()
    private var requestedCount = 0

    private val perms: Array<String>
        get() = when {
            Build.VERSION.SDK_INT >= 33 -> arrayOf(Manifest.permission.READ_MEDIA_IMAGES)
            Build.VERSION.SDK_INT >= 30 -> arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)
            else -> arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE, Manifest.permission.WRITE_EXTERNAL_STORAGE)
        }

    private val permLauncher = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { res ->
        if (res.values.all { it }) load() else showEmpty("لازم تسمح للتطبيق يشوف الصور حتى يقدر ينقلها")
    }

    private val deleteLauncher = registerForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) { r ->
        finishDone(if (r.resultCode == RESULT_OK) savedUris.size else 0)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_picker)
        moveBtn = findViewById(R.id.moveBtn)
        selectAll = findViewById(R.id.selectAll)

        adapter = PhotoAdapter(
            size = { items.size },
            bind = { h, pos ->
                val g = items[pos]
                val on = selected.contains(g.id)
                h.ring.visibility = if (on) View.VISIBLE else View.GONE
                h.check.visibility = View.VISIBLE
                h.check.setBackgroundResource(if (on) R.drawable.check_on else R.drawable.check_off)
                if (on) h.check.setImageResource(R.drawable.ic_check) else h.check.setImageDrawable(null)
                h.itemView.contentDescription = if (on) "صورة ${pos + 1}، مختارة" else "صورة ${pos + 1}"
                Thumbs.load("g:${g.id}", h.img) { thumbnail(g) }
            },
            onClick = { pos ->
                val id = items[pos].id
                if (!selected.remove(id)) selected.add(id)
                adapter.notifyItemChanged(pos)
                updateButton()
            },
        )
        findViewById<RecyclerView>(R.id.grid).apply {
            layoutManager = GridLayoutManager(this@PickerActivity, 3)
            adapter = this@PickerActivity.adapter
        }

        findViewById<View>(R.id.backBtn).setOnClickListener { finish() }
        selectAll.setOnClickListener {
            if (items.isNotEmpty() && selected.size == items.size) selected.clear() else selected.addAll(items.map { it.id })
            adapter.notifyDataSetChanged()
            updateButton()
        }
        moveBtn.setOnClickListener { move() }
        updateButton()

        if (perms.all { checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED }) {
            load()
        } else {
            beginExternal()
            permLauncher.launch(perms)
        }
    }

    private fun load() {
        thread {
            val list = mutableListOf<G>()
            val base = MediaStore.Images.Media.EXTERNAL_CONTENT_URI
            val projection = arrayOf(
                MediaStore.Images.Media._ID,
                MediaStore.Images.Media.DISPLAY_NAME,
                MediaStore.Images.Media.MIME_TYPE,
            )
            contentResolver.query(base, projection, null, null, "${MediaStore.Images.Media.DATE_ADDED} DESC")?.use { c ->
                while (c.moveToNext()) {
                    val id = c.getLong(0)
                    list.add(
                        G(
                            id,
                            ContentUris.withAppendedId(base, id),
                            c.getString(1) ?: "IMG_$id.jpg",
                            c.getString(2) ?: "image/jpeg",
                        )
                    )
                }
            }
            runOnUiThread {
                items = list
                adapter.notifyDataSetChanged()
                if (list.isEmpty()) showEmpty("ما في صور بالجالري") else findViewById<View>(R.id.empty).visibility = View.GONE
                updateButton()
            }
        }
    }

    private fun thumbnail(g: G): Bitmap? =
        if (Build.VERSION.SDK_INT >= 29) {
            contentResolver.loadThumbnail(g.uri, Size(300, 300), null)
        } else {
            @Suppress("DEPRECATION")
            MediaStore.Images.Thumbnails.getThumbnail(contentResolver, g.id, MediaStore.Images.Thumbnails.MINI_KIND, null)
        }

    private fun showEmpty(msg: String) {
        findViewById<TextView>(R.id.empty).apply {
            text = msg
            visibility = View.VISIBLE
        }
    }

    private fun updateButton() {
        val n = selected.size
        moveBtn.isEnabled = n > 0
        moveBtn.text = if (n == 0) "اختار صور" else "نقل $n صور للخزنة"
        selectAll.text = if (items.isNotEmpty() && n == items.size) "إلغاء التحديد" else "تحديد الكل"
    }

    private fun move() {
        val chosen = items.filter { selected.contains(it.id) }
        requestedCount = chosen.size
        val dialog = MaterialAlertDialogBuilder(this)
            .setTitle("عم ننقل الصور…")
            .setMessage("0 / ${chosen.size}")
            .setCancelable(false)
            .show()
        thread {
            val ok = mutableListOf<Uri>()
            chosen.forEachIndexed { i, g ->
                val bytes = try {
                    contentResolver.openInputStream(g.uri)?.use { it.readBytes() }
                } catch (e: Exception) {
                    null
                }
                // Only photos that were saved and verified get removed from the gallery.
                if (bytes != null && Vault.store(this, bytes, g.name, g.mime)) ok.add(g.uri)
                runOnUiThread { dialog.setMessage("${i + 1} / ${chosen.size}") }
            }
            runOnUiThread {
                dialog.dismiss()
                savedUris = ok
                if (ok.isEmpty()) {
                    Toast.makeText(this, "ما انحفظت ولا صورة، وما انحذف شي من الجالري", Toast.LENGTH_LONG).show()
                } else {
                    deleteFromGallery(ok)
                }
            }
        }
    }

    private fun deleteFromGallery(uris: List<Uri>) {
        if (Build.VERSION.SDK_INT >= 30) {
            // With "Media management" allowed (Android 12+) this completes without any dialog.
            val pi = MediaStore.createDeleteRequest(contentResolver, uris)
            beginExternal()
            deleteLauncher.launch(IntentSenderRequest.Builder(pi.intentSender).build())
        } else {
            thread {
                var n = 0
                for (u in uris) {
                    try {
                        n += contentResolver.delete(u, null, null)
                    } catch (e: Exception) {
                        // left in the gallery; reported on the result screen
                    }
                }
                runOnUiThread { finishDone(n) }
            }
        }
    }

    private fun finishDone(deleted: Int) {
        startActivity(
            Intent(this, DoneActivity::class.java)
                .putExtra("requested", requestedCount)
                .putExtra("saved", savedUris.size)
                .putExtra("deleted", deleted)
        )
        finish()
    }
}
