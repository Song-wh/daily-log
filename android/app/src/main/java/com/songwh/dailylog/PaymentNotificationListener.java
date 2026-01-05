package com.songwh.dailylog;

import android.app.Notification;
import android.content.Intent;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class PaymentNotificationListener extends NotificationListenerService {
    private static final String TAG = "PaymentNotificationListener";
    
    // 결제 알림을 보내는 앱 패키지명 목록
    private static final Set<String> PAYMENT_APPS = new HashSet<>();
    static {
        // 삼성페이
        PAYMENT_APPS.add("com.samsung.android.spay");
        PAYMENT_APPS.add("com.samsung.android.samsungpay.gear");
        
        // 카카오페이
        PAYMENT_APPS.add("com.kakao.talk");
        PAYMENT_APPS.add("com.kakaopay.app");
        
        // 네이버페이
        PAYMENT_APPS.add("com.nhn.android.search");
        PAYMENT_APPS.add("com.naverpay.android");
        
        // 토스
        PAYMENT_APPS.add("viva.republica.toss");
        
        // 페이코
        PAYMENT_APPS.add("com.nhnent.payapp");
        
        // 카드사 앱들
        PAYMENT_APPS.add("com.kbcard.kbkookmincard");
        PAYMENT_APPS.add("com.shinhancard.smartshinhan");
        PAYMENT_APPS.add("com.samsung.android.spaylite");
        PAYMENT_APPS.add("com.lotte.lottesmartpay");
        PAYMENT_APPS.add("com.hyundaicard.appcard");
        PAYMENT_APPS.add("nh.smart.nhallonepay");
        PAYMENT_APPS.add("com.wooricard.smartapp");
        PAYMENT_APPS.add("com.hanaskcard.paycla");
        PAYMENT_APPS.add("com.kbankwith.smartbank");
        PAYMENT_APPS.add("com.kakaobank.channel");
        
        // 은행 앱들
        PAYMENT_APPS.add("com.kbstar.kbbank");
        PAYMENT_APPS.add("com.shinhan.sbanking");
        PAYMENT_APPS.add("com.wooribank.smart.npib");
        PAYMENT_APPS.add("com.ibk.neobanking");
        PAYMENT_APPS.add("com.nh.android.nhbank");
        PAYMENT_APPS.add("com.hanabank.ebk.channel.android.hananbank");
    }
    
    // 금액 패턴 (한국 원화)
    private static final Pattern AMOUNT_PATTERN = Pattern.compile(
        "([\\d,]+)\\s*원|₩\\s*([\\d,]+)|KRW\\s*([\\d,]+)"
    );

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        String packageName = sbn.getPackageName();
        
        if (!PAYMENT_APPS.contains(packageName)) {
            return;
        }
        
        try {
            Notification notification = sbn.getNotification();
            Bundle extras = notification.extras;
            
            String title = extras.getString(Notification.EXTRA_TITLE, "");
            String text = extras.getString(Notification.EXTRA_TEXT, "");
            String bigText = extras.getString(Notification.EXTRA_BIG_TEXT, "");
            
            String fullText = title + " " + text + " " + bigText;
            
            Log.d(TAG, "Payment notification from: " + packageName);
            
            if (isPaymentNotification(fullText)) {
                JSONObject transaction = parseTransaction(fullText, packageName);
                
                if (transaction != null) {
                    sendTransactionToApp(transaction);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error processing notification", e);
        }
    }
    
    private boolean isPaymentNotification(String text) {
        String lowerText = text.toLowerCase();
        return lowerText.contains("결제") || 
               lowerText.contains("승인") || 
               lowerText.contains("출금") ||
               lowerText.contains("이용") ||
               lowerText.contains("payment") ||
               lowerText.contains("원") && AMOUNT_PATTERN.matcher(text).find();
    }
    
    private JSONObject parseTransaction(String text, String packageName) {
        try {
            JSONObject transaction = new JSONObject();
            
            transaction.put("id", String.valueOf(System.currentTimeMillis()));
            
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
            transaction.put("timestamp", sdf.format(new Date()));
            
            int amount = extractAmount(text);
            transaction.put("amount", amount);
            
            String store = extractStore(text);
            transaction.put("store", store);
            
            String card = extractCard(text, packageName);
            transaction.put("card", card);
            
            String category = guessCategory(store);
            transaction.put("category", category);
            
            transaction.put("rawText", text);
            transaction.put("source", packageName);
            
            return transaction;
        } catch (Exception e) {
            Log.e(TAG, "Error parsing transaction", e);
            return null;
        }
    }
    
    private int extractAmount(String text) {
        Matcher matcher = AMOUNT_PATTERN.matcher(text);
        while (matcher.find()) {
            for (int i = 1; i <= matcher.groupCount(); i++) {
                String amountStr = matcher.group(i);
                if (amountStr != null && !amountStr.isEmpty()) {
                    try {
                        return Integer.parseInt(amountStr.replace(",", ""));
                    } catch (NumberFormatException e) {
                        // Continue
                    }
                }
            }
        }
        return 0;
    }
    
    private String extractStore(String text) {
        String[] lines = text.split("\\n");
        
        for (String line : lines) {
            line = line.trim();
            
            if (AMOUNT_PATTERN.matcher(line).find()) {
                String beforeAmount = line.split("[\\d,]+\\s*원")[0].trim();
                if (!beforeAmount.isEmpty() && beforeAmount.length() > 1) {
                    return cleanStoreName(beforeAmount);
                }
            }
            
            if (line.contains("에서")) {
                String[] parts = line.split("에서");
                if (parts.length > 0 && !parts[0].isEmpty()) {
                    return cleanStoreName(parts[0].trim());
                }
            }
        }
        
        for (String line : lines) {
            line = line.trim();
            if (line.length() > 2 && !line.matches(".*\\d{4}.*") && !line.contains("카드")) {
                return cleanStoreName(line);
            }
        }
        
        return "결제";
    }
    
    private String cleanStoreName(String name) {
        name = name.replaceAll("[\\[\\]()\\-_]", " ");
        name = name.replaceAll("\\s+", " ");
        name = name.trim();
        
        if (name.length() > 30) {
            name = name.substring(0, 30);
        }
        
        return name.isEmpty() ? "결제" : name;
    }
    
    private String extractCard(String text, String packageName) {
        String[] cardNames = {
            "국민", "KB", "신한", "삼성", "현대", "롯데", "하나", "우리", "NH", "농협",
            "BC", "씨티", "카카오", "토스", "케이뱅크"
        };
        
        for (String cardName : cardNames) {
            if (text.contains(cardName)) {
                return cardName + "카드";
            }
        }
        
        if (packageName.contains("samsung")) return "삼성페이";
        if (packageName.contains("kakao")) return "카카오페이";
        if (packageName.contains("toss")) return "토스";
        if (packageName.contains("naver")) return "네이버페이";
        
        return null;
    }
    
    private String guessCategory(String store) {
        String lowerStore = store.toLowerCase();
        
        if (lowerStore.matches(".*(카페|커피|스타벅스|투썸|이디야|빽다방|메가|컴포즈).*")) {
            return "cafe";
        }
        if (lowerStore.matches(".*(치킨|피자|햄버거|맥도날드|버거킹|KFC|롯데리아|배민|요기요).*")) {
            return "food";
        }
        if (lowerStore.matches(".*(편의점|GS25|CU|세븐|이마트24|미니스톱).*")) {
            return "grocery";
        }
        if (lowerStore.matches(".*(마트|이마트|홈플러스|롯데마트|코스트코|트레이더스).*")) {
            return "grocery";
        }
        if (lowerStore.matches(".*(CGV|롯데시네마|메가박스|영화|극장).*")) {
            return "entertainment";
        }
        if (lowerStore.matches(".*(지하철|버스|택시|카카오T|우버|대리).*")) {
            return "transport";
        }
        if (lowerStore.matches(".*(올리브영|다이소|무신사|쿠팡|11번가|G마켓|옥션).*")) {
            return "shopping";
        }
        if (lowerStore.matches(".*(병원|약국|의원|클리닉|pharmacy).*")) {
            return "health";
        }
        if (lowerStore.matches(".*(식당|음식|밥|국|찌개|고기|삼겹|족발|보쌈|중국|일식|한식).*")) {
            return "food";
        }
        
        return "other";
    }
    
    private void sendTransactionToApp(JSONObject transaction) {
        Intent intent = new Intent("com.songwh.dailylog.NEW_TRANSACTION");
        intent.putExtra("transaction", transaction.toString());
        sendBroadcast(intent);
        
        if (MainActivity.transactionListener != null) {
            MainActivity.transactionListener.onNewTransaction(transaction.toString());
        }
    }
    
    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        // 알림 제거 시 처리 불필요
    }
}

