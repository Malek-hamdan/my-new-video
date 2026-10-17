package com.hamdan.tasbih

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private var ticks: TickPlayer? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        val player = TickPlayer(applicationContext).also { ticks = it }
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "tasbih/sound").setMethodCallHandler { call, result ->
            try {
                when (call.method) {
                    "load" -> {
                        player.load(call.argument<List<String>>("names") ?: emptyList())
                        result.success(null)
                    }
                    "play" -> result.success(
                        player.play(call.argument<String>("name") ?: "", (call.argument<Double>("volume") ?: 1.0).toFloat()),
                    )
                    else -> result.notImplemented()
                }
            } catch (e: Exception) {
                result.error("sound", e.toString(), null)
            }
        }
    }

    override fun onDestroy() {
        ticks?.release()
        ticks = null
        super.onDestroy()
    }
}
