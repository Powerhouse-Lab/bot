package com.jellyfinmobile.libmpv;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.common.MapBuilder;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;

import java.util.Map;

public class JellyfinLibMpvViewManager extends SimpleViewManager<JellyfinLibMpvView> {
  public static final String REACT_CLASS = "JellyfinLibMpvView";

  @NonNull
  @Override
  public String getName() {
    return REACT_CLASS;
  }

  @NonNull
  @Override
  protected JellyfinLibMpvView createViewInstance(@NonNull ThemedReactContext reactContext) {
    return new JellyfinLibMpvView(reactContext);
  }

  @ReactProp(name = "sourceUrl")
  public void setSourceUrl(JellyfinLibMpvView view, @Nullable String sourceUrl) {
    view.setSourceUrl(sourceUrl);
  }

  @ReactProp(name = "title")
  public void setTitle(JellyfinLibMpvView view, @Nullable String title) {
    view.setTitle(title);
  }

  @ReactProp(name = "paused", defaultBoolean = false)
  public void setPaused(JellyfinLibMpvView view, boolean paused) {
    view.setPaused(paused);
  }

  @Nullable
  @Override
  public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
    return MapBuilder.<String, Object>builder()
      .put("onPlayerEvent", MapBuilder.of("registrationName", "onPlayerEvent"))
      .build();
  }

  @Override
  public void onDropViewInstance(@NonNull JellyfinLibMpvView view) {
    view.release();
    super.onDropViewInstance(view);
  }
}
