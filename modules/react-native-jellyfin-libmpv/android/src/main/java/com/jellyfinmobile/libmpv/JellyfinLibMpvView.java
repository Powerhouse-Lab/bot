package com.jellyfinmobile.libmpv;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.view.Surface;
import android.view.SurfaceHolder;
import android.view.SurfaceView;
import android.widget.FrameLayout;

import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.events.RCTEventEmitter;

import java.lang.reflect.Method;

public class JellyfinLibMpvView extends FrameLayout implements SurfaceHolder.Callback {
  private final ThemedReactContext reactContext;
  private final SurfaceView surfaceView;
  private final Handler handler = new Handler(Looper.getMainLooper());
  private final Runnable progressRunnable = new Runnable() {
    @Override
    public void run() {
      if (isPlaying) {
        emit("progress", elapsedSeconds(), null);
        handler.postDelayed(this, 10000);
      }
    }
  };

  private Class<?> mpvLibClass;
  private String sourceUrl;
  private String title;
  private boolean sourceLoaded;
  private boolean paused;
  private boolean isPlaying;
  private long playbackStartedAtMs;
  private double accumulatedSeconds;

  public JellyfinLibMpvView(ThemedReactContext context) {
    super(context);
    reactContext = context;
    setKeepScreenOn(true);
    setBackgroundColor(0xFF000000);

    surfaceView = new SurfaceView(context);
    surfaceView.getHolder().addCallback(this);
    addView(surfaceView, new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT));
  }

  public void setTitle(@Nullable String nextTitle) {
    title = nextTitle;
  }

  public void setSourceUrl(@Nullable String nextSourceUrl) {
    if (nextSourceUrl == null || nextSourceUrl.isEmpty() || nextSourceUrl.equals(sourceUrl)) {
      return;
    }

    sourceUrl = nextSourceUrl;
    sourceLoaded = false;
    loadIfReady();
  }

  public void setPaused(boolean nextPaused) {
    paused = nextPaused;
    if (!sourceLoaded) {
      return;
    }

    try {
      invoke("setPropertyString", new Class<?>[] { String.class, String.class }, "pause", paused ? "yes" : "no");
      if (paused) {
        accumulatedSeconds = elapsedSeconds();
        isPlaying = false;
        emit("pause", accumulatedSeconds, null);
      } else {
        playbackStartedAtMs = System.currentTimeMillis();
        isPlaying = true;
        emit("play", accumulatedSeconds, null);
        handler.postDelayed(progressRunnable, 10000);
      }
    } catch (Exception error) {
      emit("error", elapsedSeconds(), error.getMessage());
    }
  }

  @Override
  public void surfaceCreated(SurfaceHolder holder) {
    loadIfReady();
  }

  @Override
  public void surfaceChanged(SurfaceHolder holder, int format, int width, int height) {
    // libmpv's android video output tracks the attached Surface size.
  }

  @Override
  public void surfaceDestroyed(SurfaceHolder holder) {
    try {
      invoke("detachSurface", new Class<?>[] {});
    } catch (Exception ignored) {
      // The AAR may already have released the surface while the view is being dropped.
    }
  }

  public void release() {
    handler.removeCallbacks(progressRunnable);
    isPlaying = false;
    try {
      invoke("command", new Class<?>[] { String[].class }, (Object) new String[] { "stop" });
      invoke("destroy", new Class<?>[] {});
    } catch (Exception ignored) {
      // Release must be best-effort so React Native teardown never crashes the app.
    }
  }

  private void loadIfReady() {
    if (sourceLoaded || sourceUrl == null || surfaceView.getHolder().getSurface() == null || !surfaceView.getHolder().getSurface().isValid()) {
      return;
    }

    try {
      ensureMpv();
      configureMpv();
      attachSurface(surfaceView.getHolder().getSurface());
      invoke("command", new Class<?>[] { String[].class }, (Object) new String[] { "loadfile", sourceUrl, "replace" });
      sourceLoaded = true;
      isPlaying = !paused;
      accumulatedSeconds = 0;
      playbackStartedAtMs = System.currentTimeMillis();
      emit("ready", 0, null);
      emit("play", 0, null);
      handler.postDelayed(progressRunnable, 10000);
    } catch (Exception error) {
      emit("error", elapsedSeconds(), error.getMessage());
    }
  }

  private void ensureMpv() throws Exception {
    if (mpvLibClass != null) {
      return;
    }

    mpvLibClass = resolveMpvLibClass();
    invoke("create", new Class<?>[] { Context.class }, getContext().getApplicationContext());
  }

  private Class<?> resolveMpvLibClass() throws ClassNotFoundException {
    try {
      return Class.forName("dev.jdtech.mpv.MPVLib");
    } catch (ClassNotFoundException ignored) {
      return Class.forName("is.xyz.mpv.MPVLib");
    }
  }

  private void configureMpv() throws Exception {
    invoke("setOptionString", new Class<?>[] { String.class, String.class }, "vo", "mediacodec_embed");
    invoke("setOptionString", new Class<?>[] { String.class, String.class }, "hwdec", "mediacodec");
    invoke("setOptionString", new Class<?>[] { String.class, String.class }, "ao", "audiotrack");
    invoke("setOptionString", new Class<?>[] { String.class, String.class }, "force-window", "yes");
    invoke("setOptionString", new Class<?>[] { String.class, String.class }, "keep-open", "no");
    invoke("setOptionString", new Class<?>[] { String.class, String.class }, "title", title == null ? "Jellyfin" : title);
    try {
      invoke("init", new Class<?>[] {});
    } catch (NoSuchMethodException ignored) {
      // Older libmpv Android wrappers initialize during create().
    }
  }

  private void attachSurface(Surface surface) {
    try {
      invoke("attachSurface", new Class<?>[] { Surface.class }, surface);
    } catch (Exception error) {
      emit("error", elapsedSeconds(), error.getMessage());
    }
  }

  private Object invoke(String methodName, Class<?>[] parameterTypes, Object... args) throws Exception {
    if (mpvLibClass == null) {
      throw new IllegalStateException("libmpv is not initialized.");
    }
    Method method = mpvLibClass.getMethod(methodName, parameterTypes);
    return method.invoke(null, args);
  }

  private double elapsedSeconds() {
    if (!isPlaying) {
      return accumulatedSeconds;
    }
    return accumulatedSeconds + Math.max(0, System.currentTimeMillis() - playbackStartedAtMs) / 1000.0;
  }

  private void emit(String type, double currentTime, @Nullable String message) {
    WritableMap payload = Arguments.createMap();
    payload.putString("type", type);
    payload.putDouble("currentTime", currentTime);
    if (message != null) {
      payload.putString("message", message);
    }
    reactContext.getJSModule(RCTEventEmitter.class).receiveEvent(getId(), "onPlayerEvent", payload);
  }
}
