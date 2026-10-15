package com.malek.photovault

import android.app.Activity
import android.app.Application
import android.os.Bundle

/** Locks the vault whenever the whole app goes to the background. */
class VaultApp : Application(), Application.ActivityLifecycleCallbacks {
    private var started = 0

    override fun onCreate() {
        super.onCreate()
        registerActivityLifecycleCallbacks(this)
    }

    override fun onActivityStarted(activity: Activity) {
        started++
    }

    override fun onActivityStopped(activity: Activity) {
        started--
        if (started <= 0 && !externalInProgress && !activity.isChangingConfigurations) locked = true
    }

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
    override fun onActivityResumed(activity: Activity) {}
    override fun onActivityPaused(activity: Activity) {}
    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
    override fun onActivityDestroyed(activity: Activity) {}

    companion object {
        @Volatile
        var locked = true

        /** Set while the app hands off to the camera, a system dialog or settings, so that doesn't lock it. */
        @Volatile
        var externalInProgress = false
    }
}
