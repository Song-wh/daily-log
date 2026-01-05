import { LocalNotifications } from '@capacitor/local-notifications'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import localforage from 'localforage'

const DAILY_REPORT_ID = 1001

export const NotificationService = {
  // 알림 권한 요청
  async requestPermission() {
    try {
      const result = await LocalNotifications.requestPermissions()
      return result.display === 'granted'
    } catch (e) {
      console.error('Failed to request notification permission:', e)
      return false
    }
  },

  // 알림 권한 확인
  async checkPermission() {
    try {
      const result = await LocalNotifications.checkPermissions()
      return result.display === 'granted'
    } catch (e) {
      console.error('Failed to check notification permission:', e)
      return false
    }
  },

  // 하루 리포트 알림 예약
  async scheduleDailyReport(hour = 22, minute = 0) {
    try {
      // 기존 예약 취소
      await this.cancelDailyReport()

      // 알림 권한 확인
      const hasPermission = await this.checkPermission()
      if (!hasPermission) {
        const granted = await this.requestPermission()
        if (!granted) return false
      }

      // 오늘 또는 내일의 알림 시간 계산
      const now = new Date()
      let notificationTime = new Date()
      notificationTime.setHours(hour, minute, 0, 0)
      
      // 이미 지난 시간이면 내일로 설정
      if (notificationTime <= now) {
        notificationTime.setDate(notificationTime.getDate() + 1)
      }

      // 알림 예약
      await LocalNotifications.schedule({
        notifications: [
          {
            id: DAILY_REPORT_ID,
            title: '📊 오늘의 소비 리포트',
            body: '오늘 하루 소비 내역을 확인해보세요!',
            schedule: {
              at: notificationTime,
              repeats: true,
              every: 'day',
              on: {
                hour: hour,
                minute: minute
              }
            },
            sound: 'default',
            smallIcon: 'ic_stat_icon',
            largeIcon: 'ic_launcher',
            channelId: 'daily-report'
          }
        ]
      })

      // 설정 저장
      await localforage.setItem('dailyReportSettings', {
        enabled: true,
        hour,
        minute
      })

      console.log(`Daily report scheduled at ${hour}:${minute}`)
      return true
    } catch (e) {
      console.error('Failed to schedule daily report:', e)
      return false
    }
  },

  // 하루 리포트 알림 취소
  async cancelDailyReport() {
    try {
      await LocalNotifications.cancel({ notifications: [{ id: DAILY_REPORT_ID }] })
      await localforage.setItem('dailyReportSettings', {
        enabled: false,
        hour: 22,
        minute: 0
      })
      return true
    } catch (e) {
      console.error('Failed to cancel daily report:', e)
      return false
    }
  },

  // 즉시 테스트 알림 보내기
  async sendTestNotification(todayTotal, transactionCount) {
    try {
      const hasPermission = await this.checkPermission()
      if (!hasPermission) {
        const granted = await this.requestPermission()
        if (!granted) return false
      }

      const formattedAmount = new Intl.NumberFormat('ko-KR').format(todayTotal)
      const today = format(new Date(), 'M월 d일', { locale: ko })

      await LocalNotifications.schedule({
        notifications: [
          {
            id: Date.now(),
            title: `📊 ${today} 소비 리포트`,
            body: `오늘 ${transactionCount}건, 총 ₩${formattedAmount} 사용했어요!`,
            schedule: { at: new Date(Date.now() + 1000) }, // 1초 후
            sound: 'default'
          }
        ]
      })
      return true
    } catch (e) {
      console.error('Failed to send test notification:', e)
      return false
    }
  },

  // 하루 리포트 알림 보내기 (데이터 포함)
  async sendDailyReport(todayTotal, transactionCount, topCategory) {
    try {
      const formattedAmount = new Intl.NumberFormat('ko-KR').format(todayTotal)
      const today = format(new Date(), 'M월 d일 EEEE', { locale: ko })

      let body = `총 ${transactionCount}건, ₩${formattedAmount} 사용`
      if (topCategory) {
        body += ` | 가장 많이 쓴 곳: ${topCategory}`
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            id: Date.now(),
            title: `📊 ${today} 소비 리포트`,
            body: body,
            schedule: { at: new Date(Date.now() + 100) },
            sound: 'default',
            extra: {
              type: 'daily-report',
              total: todayTotal,
              count: transactionCount
            }
          }
        ]
      })
      return true
    } catch (e) {
      console.error('Failed to send daily report:', e)
      return false
    }
  },

  // 저장된 설정 불러오기
  async getSettings() {
    try {
      const settings = await localforage.getItem('dailyReportSettings')
      return settings || { enabled: false, hour: 22, minute: 0 }
    } catch (e) {
      return { enabled: false, hour: 22, minute: 0 }
    }
  },

  // 알림 채널 생성 (Android)
  async createChannel() {
    try {
      await LocalNotifications.createChannel({
        id: 'daily-report',
        name: '하루 리포트',
        description: '매일 소비 리포트 알림',
        importance: 4, // High
        visibility: 1, // Public
        sound: 'default',
        vibration: true
      })
    } catch (e) {
      console.error('Failed to create channel:', e)
    }
  },

  // 초기화
  async init() {
    await this.createChannel()
    
    // 저장된 설정으로 알림 재등록
    const settings = await this.getSettings()
    if (settings.enabled) {
      await this.scheduleDailyReport(settings.hour, settings.minute)
    }

    // 알림 클릭 리스너
    LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
      console.log('Notification clicked:', notification)
      // 앱 열기 등의 처리
    })
  }
}

export default NotificationService


