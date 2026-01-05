package com.songwh.dailylog;

import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.text.TextUtils;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    
    public static TransactionListener transactionListener;
    
    public interface TransactionListener {
        void onNewTransaction(String transactionJson);
    }
    
    private BroadcastReceiver transactionReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String transaction = intent.getStringExtra("transaction");
            if (transaction != null) {
                sendTransactionToWebView(transaction);
            }
        }
    };
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        IntentFilter filter = new IntentFilter("com.songwh.dailylog.NEW_TRANSACTION");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(transactionReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(transactionReceiver, filter);
        }
        
        transactionListener = new TransactionListener() {
            @Override
            public void onNewTransaction(String transactionJson) {
                runOnUiThread(() -> sendTransactionToWebView(transactionJson));
            }
        };
        
        getBridge().getWebView().addJavascriptInterface(
            new NotificationListenerBridge(this), 
            "NotificationListener"
        );
    }
    
    private void sendTransactionToWebView(String transactionJson) {
        WebView webView = getBridge().getWebView();
        String js = "window.dispatchEvent(new CustomEvent('newTransaction', { detail: " + transactionJson + " }));";
        webView.evaluateJavascript(js, null);
    }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        unregisterReceiver(transactionReceiver);
        transactionListener = null;
    }
    
    public boolean isNotificationListenerEnabled() {
        String pkgName = getPackageName();
        String flat = Settings.Secure.getString(getContentResolver(), "enabled_notification_listeners");
        if (!TextUtils.isEmpty(flat)) {
            String[] names = flat.split(":");
            for (String name : names) {
                ComponentName cn = ComponentName.unflattenFromString(name);
                if (cn != null && TextUtils.equals(pkgName, cn.getPackageName())) {
                    return true;
                }
            }
        }
        return false;
    }
    
    public void openNotificationListenerSettings() {
        Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        startActivity(intent);
    }
    
    public static class NotificationListenerBridge {
        private MainActivity activity;
        
        public NotificationListenerBridge(MainActivity activity) {
            this.activity = activity;
        }
        
        @android.webkit.JavascriptInterface
        public boolean checkPermission() {
            return activity.isNotificationListenerEnabled();
        }
        
        @android.webkit.JavascriptInterface
        public void requestPermission() {
            activity.openNotificationListenerSettings();
        }
    }
}
