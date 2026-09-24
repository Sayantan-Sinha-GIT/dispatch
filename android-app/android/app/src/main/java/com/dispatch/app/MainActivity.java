package com.dispatch.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.PathInterpolator;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {

    private static final String HOST = "dispatch-delivery.vercel.app";
    /** Long enough for the wordmark to be seen, short enough not to feel slow. */
    private static final long MIN_SPLASH_MS = 1300;
    /** Never trap anyone behind the splash if the site is slow or offline. */
    private static final long MAX_SPLASH_MS = 10000;

    /** True while the opening screen covers the app; see SystemBarsPlugin. */
    static boolean splashShowing = false;

    private final Handler main = new Handler(Looper.getMainLooper());
    private View splash;
    private long splashShownAt;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SystemBarsPlugin.class);
        bridgeBuilder.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView webView) {
                hideSplash();
            }
        });
        super.onCreate(savedInstanceState);
        showSplash();
    }

    // BridgeActivity also hands the launch intent to this method.
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        openLink(intent);
    }

    /**
     * A link to the site (an email's confirmation link, a shared order page)
     * opens this app, but Capacitor always starts on the site's home page.
     * Load the page the link actually pointed at instead.
     */
    private void openLink(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) return;
        Uri uri = intent.getData();
        if (uri == null || !"https".equals(uri.getScheme()) || !HOST.equals(uri.getHost())) return;
        if (getBridge() == null) return;
        getBridge().getWebView().post(() -> getBridge().getWebView().loadUrl(uri.toString()));
    }

    /**
     * The opening screen: brand violet with the logo where Android's own splash
     * left it. The logo then rises and the wordmark fades in below it, and the
     * whole screen stays until the site's first page has loaded, so there is
     * never a blank frame between the splash and the app.
     */
    private void showSplash() {
        splash = getLayoutInflater().inflate(R.layout.dispatch_splash, null);
        addContentView(splash, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        splashShowing = true;
        splashShownAt = SystemClock.uptimeMillis();
        SystemBarsPlugin.applySplash(this);

        float dp = getResources().getDisplayMetrics().density;
        PathInterpolator ease = new PathInterpolator(0.16f, 1f, 0.3f, 1f);
        View glyph = splash.findViewById(R.id.splash_glyph);
        View wordmark = splash.findViewById(R.id.splash_wordmark);
        View footer = splash.findViewById(R.id.splash_footer);
        wordmark.setTranslationY(110 * dp);
        glyph.animate().translationY(-62 * dp).setStartDelay(120).setDuration(650).setInterpolator(ease).start();
        wordmark.animate().alpha(1f).translationY(72 * dp).setStartDelay(220).setDuration(650).setInterpolator(ease).start();
        footer.animate().alpha(1f).setStartDelay(420).setDuration(500).start();

        main.postDelayed(this::hideSplash, MAX_SPLASH_MS);
    }

    private void hideSplash() {
        if (splash == null) return;
        long wait = MIN_SPLASH_MS - (SystemClock.uptimeMillis() - splashShownAt);
        if (wait > 0) {
            main.postDelayed(this::hideSplash, wait);
            return;
        }
        View leaving = splash;
        splash = null;
        splashShowing = false;
        SystemBarsPlugin.applyCurrent(this);
        getBridge().getWebView().setBackgroundColor(SystemBarsPlugin.currentColor());
        leaving.animate().alpha(0f).setDuration(280).withEndAction(() -> {
            ViewGroup parent = (ViewGroup) leaving.getParent();
            if (parent != null) parent.removeView(leaving);
        }).start();
    }
}
