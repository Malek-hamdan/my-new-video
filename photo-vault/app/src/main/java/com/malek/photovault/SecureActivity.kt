package com.malek.photovault

import android.content.Intent
import android.os.Bundle
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity

/** Base for every vault screen: hidden from screenshots/recents and gated by the lock screen. */
open class SecureActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
    }

    override fun onResume() {
        super.onResume()
        if (VaultApp.locked) startActivity(Intent(this, LockActivity::class.java))
        VaultApp.externalInProgress = false
    }

    protected fun beginExternal() {
        VaultApp.externalInProgress = true
    }
}
