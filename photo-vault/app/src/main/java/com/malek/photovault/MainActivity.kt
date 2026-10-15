package com.malek.photovault

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.provider.Settings
import android.view.View
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import java.io.File
import kotlin.concurrent.thread

class MainActivity : SecureActivity() {
    private var items = listOf<Vault.Item>()
    private lateinit var adapter: PhotoAdapter
    private var camPath: String? = null

    private val takePicture = registerForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        val f = camPath?.let { File(it) } ?: return@registerForActivityResult
        camPath = null
        if (ok && f.length() > 0) {
            thread {
                val saved = Vault.store(this, f.readBytes(), "IMG_${System.currentTimeMillis()}.jpg", "image/jpeg")
                f.delete()
                runOnUiThread {
                    if (!saved) Toast.makeText(this, "ما انحفظت الصورة", Toast.LENGTH_SHORT).show()
                    refresh()
                }
            }
        } else {
            f.delete()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        camPath = savedInstanceState?.getString("camPath")

        adapter = PhotoAdapter(
            size = { items.size },
            bind = { h, pos ->
                val id = items[pos].id
                h.ring.visibility = View.GONE
                h.check.visibility = View.GONE
                Thumbs.load("v:$id", h.img) { Vault.thumb(this, id) }
            },
            onClick = { pos ->
                startActivity(Intent(this, ViewerActivity::class.java).putExtra("id", items[pos].id))
            },
        )
        findViewById<RecyclerView>(R.id.grid).apply {
            layoutManager = GridLayoutManager(this@MainActivity, 3)
            adapter = this@MainActivity.adapter
        }

        findViewById<View>(R.id.lockBtn).setOnClickListener {
            VaultApp.locked = true
            startActivity(Intent(this, LockActivity::class.java))
        }
        findViewById<View>(R.id.importBtn).setOnClickListener {
            startActivity(Intent(this, PickerActivity::class.java))
        }
        findViewById<View>(R.id.cameraBtn).setOnClickListener { openCamera() }
        findViewById<View>(R.id.mediaBtn).setOnClickListener {
            if (Build.VERSION.SDK_INT >= 31) {
                beginExternal()
                startActivity(Intent(Settings.ACTION_REQUEST_MANAGE_MEDIA, Uri.parse("package:$packageName")))
            }
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putString("camPath", camPath)
    }

    override fun onResume() {
        super.onResume()
        val needsMedia = Build.VERSION.SDK_INT >= 31 && !MediaStore.canManageMedia(this)
        findViewById<View>(R.id.mediaCard).visibility = if (needsMedia) View.VISIBLE else View.GONE
        refresh()
    }

    private fun refresh() {
        thread {
            val list = Vault.list(this)
            runOnUiThread {
                items = list
                adapter.notifyDataSetChanged()
                findViewById<TextView>(R.id.count).text = "${list.size} صورة · مشفّرة على الجهاز"
                findViewById<View>(R.id.empty).visibility = if (list.isEmpty()) View.VISIBLE else View.GONE
            }
        }
    }

    private fun openCamera() {
        val dir = File(cacheDir, "cam").apply { mkdirs() }
        val f = File(dir, "shot_${System.currentTimeMillis()}.jpg")
        camPath = f.absolutePath
        val uri = FileProvider.getUriForFile(this, "$packageName.files", f)
        beginExternal()
        try {
            takePicture.launch(uri)
        } catch (e: ActivityNotFoundException) {
            VaultApp.externalInProgress = false
            camPath = null
            Toast.makeText(this, "ما في تطبيق كاميرا", Toast.LENGTH_SHORT).show()
        }
    }
}
