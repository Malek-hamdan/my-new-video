package com.malek.photovault

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import androidx.recyclerview.widget.RecyclerView

class PhotoAdapter(
    private val size: () -> Int,
    private val bind: (Holder, Int) -> Unit,
    private val onClick: (Int) -> Unit,
) : RecyclerView.Adapter<PhotoAdapter.Holder>() {

    class Holder(v: View) : RecyclerView.ViewHolder(v) {
        val img: ImageView = v.findViewById(R.id.img)
        val ring: View = v.findViewById(R.id.ring)
        val check: ImageView = v.findViewById(R.id.check)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder {
        val h = Holder(LayoutInflater.from(parent.context).inflate(R.layout.item_photo, parent, false))
        h.itemView.setOnClickListener {
            val pos = h.bindingAdapterPosition
            if (pos != RecyclerView.NO_POSITION) onClick(pos)
        }
        return h
    }

    override fun getItemCount() = size()

    override fun onBindViewHolder(holder: Holder, position: Int) = bind(holder, position)
}
