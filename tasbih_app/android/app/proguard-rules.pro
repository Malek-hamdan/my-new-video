# Plugins call into Kotlin suspend functions by their real signatures.
-keep class kotlin.coroutines.** { *; }
-keep class kotlinx.coroutines.** { *; }
-keep class io.flutter.plugins.** { *; }
-keep class es.antonborri.home_widget.** { *; }
-keep class xyz.luan.audioplayers.** { *; }
-keep class dev.fluttercommunity.plus.sensors.** { *; }
-keep class com.hamdan.tasbih.** { *; }
