package com.malek.photovault

import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.MediaScannerConnection
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.exifinterface.media.ExifInterface
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.security.MessageDigest
import java.util.UUID

/**
 * Encrypted photo store in the app's private folder. Each photo is three files:
 * <id>.enc (photo), <id>.thumb (small preview), <id>.meta ("mime\nname").
 */
object Vault {
    data class Item(val id: String, val time: Long)

    private fun dir(c: Context) = File(c.filesDir, "vault").apply { mkdirs() }
    private fun file(c: Context, id: String, ext: String) = File(dir(c), "$id.$ext")

    fun list(c: Context): List<Item> =
        dir(c).listFiles { f -> f.name.endsWith(".enc") }
            ?.map { Item(it.name.removeSuffix(".enc"), it.lastModified()) }
            ?.sortedByDescending { it.time }
            ?: emptyList()

    /** Encrypts and stores the photo, then reads it back and checks it byte-for-byte. Returns false on any failure. */
    fun store(c: Context, bytes: ByteArray, name: String, mime: String): Boolean {
        val id = UUID.randomUUID().toString()
        return try {
            val f = file(c, id, "enc")
            f.writeBytes(Crypto.encrypt(bytes))
            if (!MessageDigest.isEqual(sha(bytes), sha(Crypto.decrypt(f.readBytes())))) {
                delete(c, id)
                return false
            }
            file(c, id, "meta").writeBytes(Crypto.encrypt("$mime\n$name".toByteArray()))
            decode(bytes, 360)?.let { bmp ->
                val out = ByteArrayOutputStream()
                bmp.compress(Bitmap.CompressFormat.JPEG, 80, out)
                file(c, id, "thumb").writeBytes(Crypto.encrypt(out.toByteArray()))
            }
            true
        } catch (e: Exception) {
            delete(c, id)
            false
        }
    }

    fun photo(c: Context, id: String): ByteArray = Crypto.decrypt(file(c, id, "enc").readBytes())

    fun thumb(c: Context, id: String): Bitmap? {
        val t = file(c, id, "thumb")
        return if (t.exists()) {
            val b = Crypto.decrypt(t.readBytes())
            BitmapFactory.decodeByteArray(b, 0, b.size)
        } else {
            decode(photo(c, id), 360)
        }
    }

    private fun meta(c: Context, id: String): Pair<String, String> {
        val m = file(c, id, "meta")
        if (!m.exists()) return "image/jpeg" to "IMG_$id.jpg"
        val parts = String(Crypto.decrypt(m.readBytes())).split("\n", limit = 2)
        return parts[0] to parts.getOrElse(1) { "IMG_$id.jpg" }
    }

    fun delete(c: Context, id: String) {
        for (ext in listOf("enc", "thumb", "meta")) file(c, id, ext).delete()
    }

    /** Writes the photo back to the phone gallery (Pictures/Restored) and removes it from the vault. */
    fun restore(c: Context, id: String): Boolean = try {
        val bytes = photo(c, id)
        val (mime, name) = meta(c, id)
        if (Build.VERSION.SDK_INT >= 29) {
            val values = ContentValues().apply {
                put(MediaStore.Images.Media.DISPLAY_NAME, name)
                put(MediaStore.Images.Media.MIME_TYPE, mime)
                put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Restored")
                put(MediaStore.Images.Media.IS_PENDING, 1)
            }
            val uri = c.contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)!!
            c.contentResolver.openOutputStream(uri)!!.use { it.write(bytes) }
            values.clear()
            values.put(MediaStore.Images.Media.IS_PENDING, 0)
            c.contentResolver.update(uri, values, null, null)
        } else {
            @Suppress("DEPRECATION")
            val outDir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "Restored")
            outDir.mkdirs()
            val out = File(outDir, name)
            out.writeBytes(bytes)
            MediaScannerConnection.scanFile(c, arrayOf(out.absolutePath), arrayOf(mime), null)
        }
        delete(c, id)
        true
    } catch (e: Exception) {
        false
    }

    /** Decodes a photo scaled down to roughly [maxSize] px and rotated upright. */
    fun decode(bytes: ByteArray, maxSize: Int): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        var sample = 1
        while (bounds.outWidth / (sample * 2) >= maxSize && bounds.outHeight / (sample * 2) >= maxSize) sample *= 2
        val bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample })
            ?: return null
        val degrees = try {
            ExifInterface(ByteArrayInputStream(bytes)).rotationDegrees
        } catch (e: Exception) {
            0
        }
        if (degrees == 0) return bmp
        val m = Matrix().apply { postRotate(degrees.toFloat()) }
        return Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, m, true)
    }

    private fun sha(b: ByteArray) = MessageDigest.getInstance("SHA-256").digest(b)
}
