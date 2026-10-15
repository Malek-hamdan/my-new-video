package com.malek.photovault

import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.GridLayout
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat

class LockActivity : AppCompatActivity() {
    private val entered = StringBuilder()
    private var firstPin: String? = null
    private var settingUp = false
    private lateinit var subtitle: TextView
    private lateinit var dots: LinearLayout

    private val bioAllowed = BiometricManager.Authenticators.BIOMETRIC_WEAK

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
        setContentView(R.layout.activity_lock)
        subtitle = findViewById(R.id.subtitle)
        dots = findViewById(R.id.dots)

        settingUp = !Pin.isSet(this)
        val bio = !settingUp &&
            BiometricManager.from(this).canAuthenticate(bioAllowed) == BiometricManager.BIOMETRIC_SUCCESS
        if (settingUp) subtitle.text = "اختار رمز من ٤ أرقام لحماية الخزنة"
        findViewById<View>(R.id.hint).visibility = if (bio) View.VISIBLE else View.GONE

        for (i in 0 until 4) {
            dots.addView(View(this).apply {
                layoutParams = LinearLayout.LayoutParams(dp(14), dp(14)).apply { setMargins(dp(9), 0, dp(9), 0) }
            })
        }
        updateDots()
        buildKeypad(bio)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                finishAffinity()
            }
        })
        if (bio) window.decorView.post { showBiometric() }
    }

    override fun onResume() {
        super.onResume()
        if (!VaultApp.locked) finish()
    }

    private fun buildKeypad(bio: Boolean) {
        val grid = findViewById<GridLayout>(R.id.keypad)
        val keys = listOf("1", "2", "3", "4", "5", "6", "7", "8", "9", "bio", "0", "del")
        for (k in keys) {
            val v: View = when (k) {
                "bio" -> ImageButton(this).apply {
                    setImageResource(R.drawable.ic_fingerprint)
                    setColorFilter(ContextCompat.getColor(context, R.color.accent))
                    background = null
                    scaleType = android.widget.ImageView.ScaleType.CENTER
                    contentDescription = "فتح بالبصمة"
                    visibility = if (bio) View.VISIBLE else View.INVISIBLE
                    setOnClickListener { showBiometric() }
                }
                "del" -> ImageButton(this).apply {
                    setImageResource(R.drawable.ic_backspace)
                    setColorFilter(ContextCompat.getColor(context, R.color.muted))
                    background = null
                    contentDescription = "حذف"
                    setOnClickListener {
                        if (entered.isNotEmpty()) entered.deleteCharAt(entered.length - 1)
                        updateDots()
                    }
                }
                else -> TextView(this).apply {
                    text = k
                    textSize = 28f
                    gravity = Gravity.CENTER
                    setBackgroundResource(R.drawable.bg_key)
                    isClickable = true
                    isFocusable = true
                    setOnClickListener { press(k) }
                }
            }
            v.layoutParams = GridLayout.LayoutParams().apply {
                width = dp(76)
                height = dp(76)
                setMargins(dp(12), dp(8), dp(12), dp(8))
            }
            grid.addView(v)
        }
    }

    private fun press(d: String) {
        if (entered.length >= 4) return
        entered.append(d)
        updateDots()
        if (entered.length == 4) dots.postDelayed({ submit() }, 120)
    }

    private fun submit() {
        val pin = entered.toString()
        entered.clear()
        if (settingUp) {
            when (firstPin) {
                null -> {
                    firstPin = pin
                    subtitle.text = "أعد إدخال الرمز للتأكيد"
                }
                pin -> {
                    Pin.set(this, pin)
                    unlock()
                }
                else -> {
                    firstPin = null
                    subtitle.text = "الرمزين مش متطابقين، اختار رمز من جديد"
                }
            }
        } else if (Pin.check(this, pin)) {
            unlock()
        } else {
            subtitle.text = "رمز غلط، جرّب مرة تانية"
            dots.animate().translationX(dp(12).toFloat()).setDuration(60).withEndAction {
                dots.animate().translationX(0f).setDuration(60).start()
            }.start()
        }
        updateDots()
    }

    private fun updateDots() {
        for (i in 0 until dots.childCount) {
            dots.getChildAt(i).setBackgroundResource(if (i < entered.length) R.drawable.dot_on else R.drawable.dot_off)
        }
    }

    private fun showBiometric() {
        val prompt = BiometricPrompt(this, ContextCompat.getMainExecutor(this),
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    unlock()
                }
            })
        prompt.authenticate(
            BiometricPrompt.PromptInfo.Builder()
                .setTitle("فتح الخزنة")
                .setNegativeButtonText("استعمل الرمز")
                .setAllowedAuthenticators(bioAllowed)
                .build()
        )
    }

    private fun unlock() {
        VaultApp.locked = false
        finish()
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()
}
