package com.kingsfallchess.app;

import android.app.Activity;
import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.webkit.WebMessage;
import com.google.firebase.messaging.FirebaseMessaging;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import android.widget.ImageView;
import android.os.Handler;
import android.os.Looper;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

public class MainActivity extends Activity {
    private static final String URL = "https://kingsfallchess.github.io/";
    private static final int PICK_FILE = 4001;
    private WebView web;
    private BackgroundMusic music;
    private FrameLayout root;
    private View offline;
    private View startupSplash;
    private long splashStartedAt;
    private final Handler splashHandler = new Handler(Looper.getMainLooper());
    private ValueCallback<Uri[]> fileCallback;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        music = new BackgroundMusic(this);
        getWindow().setStatusBarColor(Color.rgb(27, 2, 8));
        getWindow().setNavigationBarColor(Color.rgb(27, 2, 8));
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(27, 2, 8));
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        showStartupSplash();
        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);

        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUserAgentString(settings.getUserAgentString() + " KingsfallAndroid/1 KingsfallLeaguePush/1 KingsfallLocalMusic/1");
        web.addJavascriptInterface(new MusicPreferenceBridge(), "KingsfallMusic");
        CookieManager.getInstance().setAcceptCookie(true);

        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb,
                    FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                try {
                    startActivityForResult(params.createIntent(), PICK_FILE);
                    return true;
                } catch (ActivityNotFoundException ex) {
                    fileCallback = null;
                    cb.onReceiveValue(null);
                    return false;
                }
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri target = request.getUrl();
                if (request.hasGesture() && "https://kingsfallchess.github.io/enable-league-push".equals(target.toString())
                        && web.getUrl() != null && web.getUrl().startsWith(URL)) {
                    enableLeagueAlerts();
                    return true;
                }
                if ("https".equalsIgnoreCase(target.getScheme())
                        && "kingsfallchess.github.io".equalsIgnoreCase(target.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, target)); }
                catch (ActivityNotFoundException ignored) {}
                return true;
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) { showOffline(); dismissStartupSplash(); }
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (url.startsWith(URL)) { hideOffline(); dismissStartupSplash(); }
            }
        });
        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) {
            web.loadUrl(URL);
        }
    }

    // This bridge exposes only a non-sensitive, device-local music preference.
    private final class MusicPreferenceBridge {
        @android.webkit.JavascriptInterface public boolean isEnabled() { return music.isEnabled(); }
        @android.webkit.JavascriptInterface public boolean hasPreference() { return music.hasPreference(); }
        @android.webkit.JavascriptInterface public void setEnabled(boolean enabled) {
            runOnUiThread(() -> {
                if (!isDestroyed() && web != null && web.getUrl() != null
                        && web.getUrl().startsWith(URL)) music.setEnabled(enabled);
            });
        }
    }

    private void enableLeagueAlerts() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 4102);
            return;
        }
        sendLeagueToken();
    }

    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code == 4102 && results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) {
            sendLeagueToken();
        }
    }

    private void sendLeagueToken() {
        FirebaseMessaging.getInstance().getToken().addOnSuccessListener(this, token -> {
            if (web.getUrl() != null && web.getUrl().startsWith(URL)) {
                web.postWebMessage(new WebMessage("kf-league-token:" + token), Uri.parse(URL));
            }
        }).addOnFailureListener(this, error ->
            android.util.Log.w("Kingsfall", "Could not obtain Firebase push token", error));
    }

    /* Native black startup view: exact crown image from the website's header.
       The WebView loads beneath it. Do not change the live chess interface. */
    private void showStartupSplash() {
        FrameLayout splash = new FrameLayout(this);
        splash.setBackgroundColor(Color.BLACK);
        ImageView logo = new ImageView(this);
        logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        int diameter = (int) (180f * getResources().getDisplayMetrics().density + 0.5f);
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(diameter, diameter, Gravity.CENTER);
        splash.addView(logo, params);
        try (java.io.InputStream input = getAssets().open("kingsfall_crown.webp.b64")) {
            java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream();
            byte[] chunk = new byte[4096];
            int n;
            while ((n = input.read(chunk)) != -1) buffer.write(chunk, 0, n);
            byte[] bytes = Base64.decode(buffer.toByteArray(), Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (bitmap != null) logo.setImageBitmap(bitmap);
        } catch (java.io.IOException | IllegalArgumentException err) {
            android.util.Log.w("Kingsfall", "Startup crown unavailable", err);
        }
        startupSplash = splash;
        splashStartedAt = android.os.SystemClock.uptimeMillis();
        root.addView(splash, new FrameLayout.LayoutParams(-1, -1));
    }

    private void dismissStartupSplash() {
        if (startupSplash == null) return;
        long elapsed = android.os.SystemClock.uptimeMillis() - splashStartedAt;
        long remaining = Math.max(0L, 950L - elapsed);
        splashHandler.postDelayed(() -> {
            if (startupSplash == null || isFinishing() || isDestroyed()) return;
            getWindow().setStatusBarColor(Color.rgb(27, 2, 8));
            getWindow().setNavigationBarColor(Color.rgb(27, 2, 8));
            View current = startupSplash;
            current.animate().alpha(0f).setDuration(210).withEndAction(() -> {
                if (current.getParent() == root) root.removeView(current);
                if (startupSplash == current) startupSplash = null;
            }).start();
        }, remaining);
    }

    private void showOffline() {
        if (offline != null) return;
        LinearLayout layout = new LinearLayout(this);
        layout.setGravity(Gravity.CENTER);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(30, 30, 30, 30);
        layout.setBackgroundColor(Color.rgb(27, 2, 8));
        TextView title = new TextView(this);
        title.setText("Kingsfall Chess");
        title.setTextSize(25);
        title.setTextColor(Color.rgb(237, 197, 107));
        layout.addView(title);
        TextView message = new TextView(this);
        message.setGravity(Gravity.CENTER);
        message.setText("Connection unavailable.\nConnect to the internet and try again.");
        message.setTextColor(Color.WHITE);
        message.setPadding(0, 24, 0, 20);
        layout.addView(message);
        Button retry = new Button(this);
        retry.setText("Retry");
        retry.setOnClickListener(v -> { hideOffline(); web.loadUrl(URL); });
        layout.addView(retry);
        offline = layout;
        root.addView(layout, new FrameLayout.LayoutParams(-1, -1));
    }
    private void hideOffline() {
        if (offline != null) {
            root.removeView(offline);
            offline = null;
        }
    }

    @Override protected void onActivityResult(int req, int result, Intent data) {
        super.onActivityResult(req, result, data);
        if (req == PICK_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            fileCallback = null;
        }
    }
    @Override public void onConfigurationChanged(Configuration config) {
        super.onConfigurationChanged(config);
    }
    @Override protected void onSaveInstanceState(Bundle out) {
        web.saveState(out);
        super.onSaveInstanceState(out);
    }
    @Override protected void onPause() {
        super.onPause();
        web.onPause();
        if (music != null) music.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        web.onResume();
        if (music != null) music.onResume();
    }
    @Override protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        splashHandler.removeCallbacksAndMessages(null);
        if (music != null) music.close();
        web.removeJavascriptInterface("KingsfallMusic");
        root.removeView(web);
        web.destroy();
        super.onDestroy();
    }
    @Override public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else new AlertDialog.Builder(this)
            .setTitle("Leave Kingsfall Chess?")
            .setMessage("Leaving during a game will not pause your chess clock.")
            .setNegativeButton("Stay", null)
            .setPositiveButton("Exit", (dialog, which) -> finish())
            .show();
    }
}
