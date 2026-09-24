package com.dispatch.app;

import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.view.View;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Lets the site recolour the strips behind the status and navigation bars
 * when it switches between light and dark, so they always match the page
 * instead of staying lavender over a dark screen.
 *
 * While the opening screen is up the bars belong to it (violet, light
 * icons); a request that arrives then is remembered and applied when it goes.
 */
@CapacitorPlugin(name = "DispatchBars")
public class SystemBarsPlugin extends Plugin {

    private static int color = Color.parseColor("#F2F0F8");
    private static boolean dark = false;

    @PluginMethod
    public void set(PluginCall call) {
        String requested = call.getString("color", "#F2F0F8");
        try {
            color = Color.parseColor(requested);
        } catch (IllegalArgumentException e) {
            call.reject("Bad colour: " + requested);
            return;
        }
        dark = Boolean.TRUE.equals(call.getBoolean("dark", false));
        getActivity().runOnUiThread(() -> {
            if (!MainActivity.splashShowing) {
                apply(getActivity(), color, !dark);
                getBridge().getWebView().setBackgroundColor(color);
            }
            call.resolve();
        });
    }

    /** The page's current colours (or the light theme's, before the page has said). */
    static void applyCurrent(Activity activity) {
        apply(activity, color, !dark);
    }

    static int currentColor() {
        return color;
    }

    static void applySplash(Activity activity) {
        apply(activity, Color.parseColor("#6B4EF0"), false);
    }

    private static void apply(Activity activity, int background, boolean lightIcons) {
        Window window = activity.getWindow();
        View decor = window.getDecorView();
        decor.setBackgroundColor(background);
        if (Build.VERSION.SDK_INT < 35) {
            window.setStatusBarColor(background);
            window.setNavigationBarColor(background);
        }
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(window, decor);
        bars.setAppearanceLightStatusBars(lightIcons);
        bars.setAppearanceLightNavigationBars(lightIcons);
    }
}
