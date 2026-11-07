package com.malek.workout;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private WebView web;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable pendingAlarm;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setStatusBarColor(0xFF0F1115);
        getWindow().setNavigationBarColor(0xFF0F1115);

        web = new WebView(this);
        web.setBackgroundColor(0xFF0F1115);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        web.addJavascriptInterface(new Bridge(), "Android");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("file:///android_asset/")) return false;
                openExternal(url);
                return true;
            }
        });
        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
    }

    private void openExternal(String url) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Exception ignored) {
        }
    }

    private void fireAlarm() {
        pendingAlarm = null;
        try {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null && v.hasVibrator()) {
                v.vibrate(VibrationEffect.createWaveform(new long[]{0, 500, 200, 500, 200, 700}, -1));
            }
        } catch (Exception ignored) {
        }
        try {
            final ToneGenerator tone = new ToneGenerator(AudioManager.STREAM_ALARM, 100);
            tone.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 1500);
            handler.postDelayed(tone::release, 2000);
        } catch (Exception ignored) {
        }
        if (web != null) web.evaluateJavascript("window.onTimerDone && window.onTimerDone()", null);
    }

    private class Bridge {
        @JavascriptInterface
        public void openUrl(final String url) {
            handler.post(() -> openExternal(url));
        }

        @JavascriptInterface
        public void startTimer(final int seconds) {
            handler.post(() -> {
                if (pendingAlarm != null) handler.removeCallbacks(pendingAlarm);
                pendingAlarm = MainActivity.this::fireAlarm;
                handler.postDelayed(pendingAlarm, Math.max(0, seconds) * 1000L);
            });
        }

        @JavascriptInterface
        public void cancelTimer() {
            handler.post(() -> {
                if (pendingAlarm != null) handler.removeCallbacks(pendingAlarm);
                pendingAlarm = null;
            });
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        web.evaluateJavascript("window.handleBack ? window.handleBack() : false", value -> {
            if (!"true".equals(value)) MainActivity.super.onBackPressed();
        });
    }

    @Override
    protected void onDestroy() {
        if (pendingAlarm != null) handler.removeCallbacks(pendingAlarm);
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
