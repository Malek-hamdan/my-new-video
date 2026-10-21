package com.fieldlog.app

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.fieldlog.app.databinding.ItemRecordingBinding
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class RecordingsAdapter(
    private var items: List<File>,
    private val onPlay: (File) -> Unit,
    private val onMenu: (File) -> Unit
) : RecyclerView.Adapter<RecordingsAdapter.VH>() {

    class VH(val b: ItemRecordingBinding) : RecyclerView.ViewHolder(b.root)

    fun submit(list: List<File>) { items = list; notifyDataSetChanged() }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH =
        VH(ItemRecordingBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun getItemCount() = items.size

    override fun onBindViewHolder(h: VH, position: Int) {
        val f = items[position]
        h.b.title.text = displayName(f)
        h.b.meta.text = meta(f)
        h.b.btnPlay.setOnClickListener { onPlay(f) }
        h.b.btnMenu.setOnClickListener { onMenu(f) }
        h.b.root.setOnClickListener { onPlay(f) }
    }

    private fun displayName(f: File): String {
        // FieldLog_20261021_094312__MEDIUM.wav -> "Oct 21, 09:43 · Medium"
        val m = Regex("FieldLog_(\\d{8})_(\\d{6})__([\\w-]+)").find(f.name)
        if (m != null) {
            val (d, t, tag) = m.destructured
            val date = runCatching {
                SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).parse("${d}_$t")
            }.getOrNull()
            val label = when {
                tag == "ORIGINAL" -> "Original"
                tag.endsWith("-AI") -> tag.removeSuffix("-AI").lowercase().replaceFirstChar { it.uppercase() } + " · AI"
                else -> tag.lowercase().replaceFirstChar { it.uppercase() }
            }
            val when_ = if (date != null) SimpleDateFormat("MMM d, HH:mm", Locale.getDefault()).format(date) else f.name
            return "$when_ · $label"
        }
        return f.name
    }

    private fun meta(f: File): String {
        val seconds = (f.length() / 2 / WavIo.SR).toInt()  // 16-bit mono
        val mm = seconds / 60; val ss = seconds % 60
        val mb = f.length() / (1024 * 1024)
        return String.format(Locale.US, "%d:%02d · %d MB", mm, ss, mb)
    }
}
