package com.malek.photovault

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.View
import android.widget.ImageView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import kotlin.concurrent.thread

class ViewerActivity : SecureActivity() {
    private lateinit var id: String

    private val writePerm = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) restore() else Toast.makeText(this, "لازم تسمح بالتخزين حتى ترجع الصورة", Toast.LENGTH_SHORT).show()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_viewer)
        id = intent.getStringExtra("id") ?: return finish()

        val photo = findViewById<ImageView>(R.id.photo)
        val progress = findViewById<View>(R.id.progress)
        thread {
            val bmp = try {
                Vault.decode(Vault.photo(this, id), 2048)
            } catch (e: Exception) {
                null
            }
            runOnUiThread {
                progress.visibility = View.GONE
                if (bmp != null) photo.setImageBitmap(bmp)
                else Toast.makeText(this, "ما قدرنا نفتح الصورة", Toast.LENGTH_SHORT).show()
            }
        }

        findViewById<View>(R.id.backBtn).setOnClickListener { finish() }
        findViewById<View>(R.id.restoreBtn).setOnClickListener {
            if (Build.VERSION.SDK_INT < 29 &&
                checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED
            ) {
                beginExternal()
                writePerm.launch(Manifest.permission.WRITE_EXTERNAL_STORAGE)
            } else {
                restore()
            }
        }
        findViewById<View>(R.id.deleteBtn).setOnClickListener {
            MaterialAlertDialogBuilder(this)
                .setTitle("حذف نهائي؟")
                .setMessage("الصورة رح تنحذف من الخزنة وما بترجع.")
                .setNegativeButton("إلغاء", null)
                .setPositiveButton("حذف") { _, _ ->
                    Vault.delete(this, id)
                    Thumbs.evict("v:$id")
                    finish()
                }
                .show()
        }
    }

    private fun restore() {
        thread {
            val ok = Vault.restore(this, id)
            runOnUiThread {
                if (ok) {
                    Thumbs.evict("v:$id")
                    Toast.makeText(this, "رجعت الصورة للجالري (Pictures/Restored)", Toast.LENGTH_LONG).show()
                    finish()
                } else {
                    Toast.makeText(this, "ما زبط إرجاع الصورة", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
}
