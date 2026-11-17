package com.kingsfallchess.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
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
    private FrameLayout root;
    private View offline;
    private ValueCallback<Uri[]> fileCallback;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(27, 2, 8));
        getWindow().setNavigationBarColor(Color.rgb(27, 2, 8));
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(27, 2, 8));
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);

        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUserAgentString(settings.getUserAgentString() + " KingsfallAndroid/1");
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
                if ("https".equalsIgnoreCase(target.getScheme())
                        && "kingsfallchess.github.io".equalsIgnoreCase(target.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, target)); }
                catch (ActivityNotFoundException ignored) {}
                return true;
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showOffline();
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (url.startsWith(URL)) hideOffline();
            }
        });
        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) {
            web.loadUrl(URL);
        }
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
    }
    @Override protected void onResume() {
        super.onResume();
        web.onResume();
    }
    @Override protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
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
