# 하루기록 (Daily Log)

삼성페이 및 카드 결제 알림을 자동으로 수집하여 하루 소비를 기록하는 앱입니다.

## 📱 주요 기능

- ✅ **자동 결제 기록**: 삼성페이, 카카오페이, 카드사 앱 알림을 자동 수집
- ✅ **소비 내역 관리**: 날짜별 결제 내역 확인
- ✅ **오늘 소비 요약**: 하루 총 지출 금액 한눈에 확인
- ✅ **카테고리 분류**: 결제처에 따라 자동 카테고리 분류
- ✅ **수동 입력**: 현금 결제 등 직접 입력 가능

## 🔧 지원 결제 앱

- 삼성페이
- 카카오페이
- 네이버페이
- 토스
- 페이코
- 각종 카드사 앱 (국민, 신한, 삼성, 현대, 롯데, 하나, 우리, NH 등)
- 각종 은행 앱

## 🚀 빌드 방법

### 사전 요구사항

- Node.js 20+
- Android Studio
- JDK 17+

### 빌드 단계

1. **의존성 설치**
```bash
npm install
```

2. **웹 앱 빌드**
```bash
npm run build
```

3. **Capacitor 동기화**
```bash
npx cap sync android
```

4. **Android Studio에서 열기**
```bash
npx cap open android
```

5. **빌드 및 실행**
   - Android Studio에서 Run 버튼 클릭
   - 또는 Build > Build Bundle(s) / APK(s) > Build APK(s)

## 📲 앱 설치 후 설정

### 알림 접근 권한 허용

앱이 삼성페이 등의 결제 알림을 읽으려면 **알림 접근 권한**이 필요합니다.

1. 앱 실행 후 **🔔 알림 설정** 버튼 클릭
2. 설정 화면에서 **하루기록** 앱 찾기
3. **알림 접근 허용** 토글 ON

### 작동 확인

1. 권한 허용 후 앱으로 돌아오기
2. 삼성페이 등으로 결제하기
3. 결제 내역이 자동으로 앱에 기록됨!

## 🛠️ 기술 스택

- **Frontend**: React 19 + Vite
- **Mobile**: Capacitor 6
- **Storage**: LocalForage (IndexedDB)
- **Android Native**: NotificationListenerService

## 📁 프로젝트 구조

```
daily-log/
├── src/
│   ├── App.jsx          # 메인 앱 컴포넌트
│   ├── App.css          # 스타일
│   └── main.jsx         # 엔트리 포인트
├── android/
│   └── app/src/main/java/com/dailylog/app/
│       ├── MainActivity.java                  # 메인 액티비티
│       └── PaymentNotificationListener.java   # 알림 수집 서비스
├── capacitor.config.json
└── package.json
```

## 🔒 개인정보 보호

- 모든 데이터는 **기기 내부**에만 저장됩니다.
- 서버로 데이터가 전송되지 않습니다.
- 수집되는 정보: 결제 가게명, 금액, 시간, 카드사

## 📝 TODO

- [ ] 월별 통계 차트
- [ ] 카테고리별 분석
- [ ] 데이터 백업/복원
- [ ] AI 일기 생성
- [ ] 예산 설정 및 알림

## 📄 라이선스

개인 사용 목적으로 제작되었습니다.
