package com.dispatch.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String HOST = "dispatch-delivery.vercel.app";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        openLink(getIntent());
    }

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
        getBridge().getWebView().post(() -> getBridge().getWebView().loadUrl(uri.toString()));
    }
}
