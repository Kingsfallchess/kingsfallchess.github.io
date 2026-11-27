package com.kingsfallchess.app;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;

/** Only reads APK assets; no network, game state or game clock interaction. */
final class BackgroundMusic {
    private static final String[] TRACKS = {
        "moonlight", "snowfall", "undertow", "sleep", "friday-morning",
        "dream-culture", "meditation-01", "meditation-02", "clear-air",
        "morning", "november-lullaby", "a-visit-to-virginia", "eastern-wind"
    };
    private final Activity activity;
    private final SharedPreferences prefs;
    private final AudioManager manager;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final AudioAttributes attributes = new AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_GAME)
        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build();
    private final ArrayList<String> bag = new ArrayList<>();
    private MediaPlayer player;
    private AudioFocusRequest focusRequest;
    private volatile boolean enabled;
    private boolean foreground, focused, prepared, closed;
    private int consecutiveErrors;
    private String last = "";
    private final AudioManager.OnAudioFocusChangeListener focusListener = change -> {
        if (change == AudioManager.AUDIOFOCUS_GAIN) {
            focused = true;
            if (player != null) player.setVolume(0.24f, 0.24f);
            playIfPossible();
        } else if (change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK) {
            if (player != null) player.setVolume(0.06f, 0.06f);
        } else {
            focused = false;
            pausePlayer();
            if (change == AudioManager.AUDIOFOCUS_LOSS) abandonFocus();
        }
    };

    BackgroundMusic(Activity activity) {
        this.activity = activity;
        prefs = activity.getSharedPreferences("kf_native_music", Context.MODE_PRIVATE);
        enabled = prefs.getBoolean("enabled", true);
        manager = (AudioManager) activity.getSystemService(Context.AUDIO_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) {
            focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(attributes)
                .setOnAudioFocusChangeListener(focusListener, main).build();
        }
    }
    boolean isEnabled() { return enabled; }
    boolean hasPreference() { return prefs.contains("enabled"); }
    void setEnabled(boolean value) {
        enabled = value;
        prefs.edit().putBoolean("enabled", value).apply();
        if (value) { consecutiveErrors = 0; resume(); }
        else { pausePlayer(); abandonFocus(); }
    }
    void onResume() { foreground = true; consecutiveErrors = 0; resume(); }
    void onPause() { foreground = false; pausePlayer(); abandonFocus(); }
    void close() {
        closed = true; foreground = false;
        main.removeCallbacksAndMessages(null);
        release(); abandonFocus();
    }
    private boolean active() { return !closed && foreground && enabled; }
    private void resume() {
        if (!active() || manager == null) return;
        if (!focused) {
            int result = Build.VERSION.SDK_INT >= 26
                ? manager.requestAudioFocus(focusRequest)
                : manager.requestAudioFocus(focusListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN);
            focused = result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        }
        playIfPossible();
    }
    private void abandonFocus() {
        focused = false;
        if (manager == null) return;
        if (Build.VERSION.SDK_INT >= 26) manager.abandonAudioFocusRequest(focusRequest);
        else manager.abandonAudioFocus(focusListener);
    }
    private void playIfPossible() {
        if (!active() || !focused) return;
        if (player == null) { if (consecutiveErrors < TRACKS.length) next(); return; }
        if (prepared) {
            try { if (!player.isPlaying()) player.start(); }
            catch (IllegalStateException error) { fail(player); }
        }
    }
    private void pausePlayer() {
        if (player != null && prepared) {
            try { if (player.isPlaying()) player.pause(); }
            catch (IllegalStateException ignored) {}
        }
    }
    private void release() {
        MediaPlayer old = player;
        player = null; prepared = false;
        if (old != null) old.release();
    }
    private void next() {
        if (!active() || !focused || consecutiveErrors >= TRACKS.length) return;
        release();
        if (bag.isEmpty()) {
            bag.addAll(Arrays.asList(TRACKS));
            Collections.shuffle(bag);
            if (bag.get(bag.size() - 1).equals(last))
                Collections.swap(bag, 0, bag.size() - 1);
        }
        last = bag.remove(bag.size() - 1);
        MediaPlayer p = new MediaPlayer();
        player = p;
        try (AssetFileDescriptor fd = activity.getAssets().openFd("music/" + last + ".mp3")) {
            p.setAudioAttributes(attributes);
            p.setVolume(0.24f, 0.24f);
            p.setDataSource(fd.getFileDescriptor(), fd.getStartOffset(), fd.getLength());
            p.setOnPreparedListener(mp -> {
                if (mp != player) return;
                prepared = true; consecutiveErrors = 0;
                playIfPossible();
            });
            p.setOnCompletionListener(mp -> {
                if (mp != player) return;
                release();
                next();
            });
            p.setOnErrorListener((mp, what, extra) -> { fail(mp); return true; });
            p.prepareAsync();
        } catch (Exception error) {
            Log.w("KingsfallMusic", "Bundled track could not be played: " + last, error);
            fail(p);
        }
    }
    private void fail(MediaPlayer p) {
        if (p != player) return;
        release();
        consecutiveErrors++;
        if (active() && focused && consecutiveErrors < TRACKS.length) main.postDelayed(() -> {
            if (player == null) next();
        }, 100);
    }
}
