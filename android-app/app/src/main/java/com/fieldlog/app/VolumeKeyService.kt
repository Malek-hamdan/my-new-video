package com.fieldlog.app

import android.accessibilityservice.AccessibilityService
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent

/**
 * Accessibility service used only to catch Volume-Down pressed 3 times quickly
 * while a session is active, and stop it — even with the screen off.
 * It reads no screen content; onAccessibilityEvent is intentionally empty.
 */
class VolumeKeyService : AccessibilityService() {

    private var count = 0
    private var firstAt = 0L

    override fun onKeyEvent(event: KeyEvent): Boolean {
        val prefs = Prefs(this)
        if (!prefs.volumeStop || !RecorderBus.recording) return false
        if (event.keyCode == KeyEvent.KEYCODE_VOLUME_DOWN && event.action == KeyEvent.ACTION_DOWN) {
            val now = System.currentTimeMillis()
            if (now - firstAt > 2000) { count = 0; firstAt = now }
            count++
            if (count >= 3) {
                count = 0
                if (prefs.volumeAction == "cancel") RecordingService.cancel(this)
                else RecordingService.stopSave(this)
                return true // swallow this press so the volume UI doesn't flash
            }
        }
        return false
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) { /* not used */ }
    override fun onInterrupt() { }
}
