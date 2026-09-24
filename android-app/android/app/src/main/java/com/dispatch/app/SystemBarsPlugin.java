package com.dispatch.app;

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
 */
@CapacitorPlugin(name = "DispatchBars")
public class SystemBarsPlugin extends Plugin {

    @PluginMethod
    public void set(PluginCall call) {
        String color = call.getString("color", "#F2F0F8");
        boolean dark = Boolean.TRUE.equals(call.getBoolean("dark", false));
        int parsed;
        try {
            parsed = Color.parseColor(color);
        } catch (IllegalArgumentException e) {
            call.reject("Bad colour: " + color);
            return;
        }
        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            View decor = window.getDecorView();
            decor.setBackgroundColor(parsed);
            getBridge().getWebView().setBackgroundColor(parsed);
            if (Build.VERSION.SDK_INT < 35) {
                window.setStatusBarColor(parsed);
                window.setNavigationBarColor(parsed);
            }
            WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(window, decor);
            bars.setAppearanceLightStatusBars(!dark);
            bars.setAppearanceLightNavigationBars(!dark);
            call.resolve();
        });
    }
}
