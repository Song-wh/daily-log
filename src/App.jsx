import { useState, useEffect } from 'react'
import { format, isToday, isYesterday, parseISO, startOfDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import localforage from 'localforage'
import NotificationService from './services/NotificationService'
import './App.css'

// Initialize localforage
localforage.config({
  name: 'DailyLog',
  storeName: 'transactions'
})

function App() {
  const [transactions, setTransactions] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [view, setView] = useState('home') // home, calendar, stats, settings
  const [showAddModal, setShowAddModal] = useState(false)
  const [notificationStatus, setNotificationStatus] = useState('unknown')
  const [reportSettings, setReportSettings] = useState({ enabled: false, hour: 22, minute: 0 })
  const [showPermissionModal, setShowPermissionModal] = useState(false)
  const [permissionCheckCount, setPermissionCheckCount] = useState(0)

  // Load transactions from storage
  useEffect(() => {
    loadTransactions()
    checkNotificationPermission()
    initNotifications()
    
    // Listen for new transactions from native layer
    window.addEventListener('newTransaction', handleNewTransaction)
    
    // 앱이 다시 포커스될 때 권한 재확인
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkNotificationPermission()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      window.removeEventListener('newTransaction', handleNewTransaction)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const initNotifications = async () => {
    await NotificationService.init()
    const settings = await NotificationService.getSettings()
    setReportSettings(settings)
  }

  const loadTransactions = async () => {
    try {
      const stored = await localforage.getItem('transactions')
      if (stored) {
        setTransactions(stored)
      }
    } catch (e) {
      console.error('Failed to load transactions:', e)
    }
  }

  const saveTransactions = async (newTransactions) => {
    try {
      await localforage.setItem('transactions', newTransactions)
      setTransactions(newTransactions)
    } catch (e) {
      console.error('Failed to save transactions:', e)
    }
  }

  const handleNewTransaction = (event) => {
    const newTx = event.detail
    setTransactions(prev => {
      const updated = [newTx, ...prev]
      localforage.setItem('transactions', updated)
      return updated
    })
  }

  const checkNotificationPermission = async () => {
    // Will be implemented in native layer
    if (window.NotificationListener) {
      const hasPermission = await window.NotificationListener.checkPermission()
      setNotificationStatus(hasPermission ? 'granted' : 'denied')
      
      // 권한이 없으면 모달 표시
      if (!hasPermission) {
        setShowPermissionModal(true)
      } else {
        setShowPermissionModal(false)
      }
    }
  }

  const requestNotificationPermission = async () => {
    if (window.NotificationListener) {
      await window.NotificationListener.requestPermission()
      // 설정 화면 갔다가 돌아오면 자동으로 체크됨 (visibilitychange 이벤트)
    } else {
      alert('이 기능은 Android 앱에서만 사용 가능합니다.')
    }
  }

  const handlePermissionLater = async () => {
    // "나중에" 선택 시 카운트 증가
    setPermissionCheckCount(prev => prev + 1)
    
    // 3번까지는 나중에 선택 가능, 그 이후로는 계속 표시
    if (permissionCheckCount < 3) {
      setShowPermissionModal(false)
      // 5초 후 다시 체크
      setTimeout(() => {
        checkNotificationPermission()
      }, 5000)
    }
  }

  // Add manual transaction
  const addTransaction = async (tx) => {
    const newTx = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      ...tx
    }
    await saveTransactions([newTx, ...transactions])
    setShowAddModal(false)
  }

  // Filter transactions by date
  const getTransactionsForDate = (date) => {
    const dayStart = startOfDay(date).getTime()
    const dayEnd = dayStart + 24 * 60 * 60 * 1000
    return transactions.filter(tx => {
      const txTime = new Date(tx.timestamp).getTime()
      return txTime >= dayStart && txTime < dayEnd
    })
  }

  // Calculate daily total
  const getDailyTotal = (date) => {
    return getTransactionsForDate(date).reduce((sum, tx) => sum + (tx.amount || 0), 0)
  }

  // Get top category for a date
  const getTopCategory = (date) => {
    const txs = getTransactionsForDate(date)
    const categoryTotals = txs.reduce((acc, tx) => {
      const cat = tx.category || 'other'
      acc[cat] = (acc[cat] || 0) + (tx.amount || 0)
      return acc
    }, {})
    
    const topCat = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]
    if (!topCat) return null
    
    const categoryNames = {
      food: '식비', cafe: '카페', shopping: '쇼핑', transport: '교통',
      entertainment: '여가', grocery: '마트', health: '건강', other: '기타'
    }
    return categoryNames[topCat[0]] || '기타'
  }

  // Get today's transactions
  const todayTransactions = getTransactionsForDate(new Date())
  const todayTotal = getDailyTotal(new Date())

  // Group transactions by date
  const groupedTransactions = transactions.reduce((groups, tx) => {
    const date = format(new Date(tx.timestamp), 'yyyy-MM-dd')
    if (!groups[date]) groups[date] = []
    groups[date].push(tx)
    return groups
  }, {})

  const formatDateHeader = (dateStr) => {
    const date = parseISO(dateStr)
    if (isToday(date)) return '오늘'
    if (isYesterday(date)) return '어제'
    return format(date, 'M월 d일 (EEE)', { locale: ko })
  }

  const formatTime = (timestamp) => {
    return format(new Date(timestamp), 'HH:mm')
  }

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('ko-KR').format(amount)
  }

  const getCategoryIcon = (category) => {
    const icons = {
      food: '🍽️',
      cafe: '☕',
      shopping: '🛍️',
      transport: '🚇',
      entertainment: '🎬',
      grocery: '🛒',
      health: '💊',
      other: '💳'
    }
    return icons[category] || icons.other
  }

  // Render different views
  const renderView = () => {
    switch (view) {
      case 'settings':
        return (
          <SettingsView 
            reportSettings={reportSettings}
            setReportSettings={setReportSettings}
            todayTotal={todayTotal}
            todayCount={todayTransactions.length}
            topCategory={getTopCategory(new Date())}
            requestNotificationPermission={requestNotificationPermission}
          />
        )
      case 'stats':
        return <StatsView transactions={transactions} formatMoney={formatMoney} />
      default:
        return (
          <>
            {/* Today Summary Card */}
            <div className="summary-card">
              <div className="summary-date">
                {format(new Date(), 'M월 d일 EEEE', { locale: ko })}
              </div>
              <div className="summary-amount">
                <span className="currency">₩</span>
                <span className="amount">{formatMoney(todayTotal)}</span>
              </div>
              <div className="summary-count">
                오늘 {todayTransactions.length}건 결제
              </div>
            </div>

            {/* Quick Actions */}
            <div className="quick-actions">
              <button className="action-btn primary" onClick={() => setShowAddModal(true)}>
                <span className="icon">➕</span>
                <span>직접 입력</span>
              </button>
              <button className="action-btn" onClick={requestNotificationPermission}>
                <span className="icon">🔔</span>
                <span>알림 설정</span>
              </button>
            </div>

            {/* Transaction List */}
            <div className="transaction-list">
              {Object.keys(groupedTransactions)
                .sort((a, b) => b.localeCompare(a))
                .map(dateStr => (
                  <div key={dateStr} className="transaction-group">
                    <div className="date-header">
                      <span>{formatDateHeader(dateStr)}</span>
                      <span className="date-total">
                        ₩{formatMoney(groupedTransactions[dateStr].reduce((s, t) => s + (t.amount || 0), 0))}
                      </span>
                    </div>
                    {groupedTransactions[dateStr].map(tx => (
                      <div key={tx.id} className="transaction-item">
                        <div className="tx-icon">{getCategoryIcon(tx.category)}</div>
                        <div className="tx-details">
                          <div className="tx-store">{tx.store || '결제'}</div>
                          <div className="tx-meta">
                            <span className="tx-time">{formatTime(tx.timestamp)}</span>
                            {tx.card && <span className="tx-card">{tx.card}</span>}
                          </div>
                        </div>
                        <div className="tx-amount">₩{formatMoney(tx.amount)}</div>
                      </div>
                    ))}
                  </div>
                ))}
              
              {transactions.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">📝</div>
                  <div className="empty-text">아직 기록이 없어요</div>
                  <div className="empty-hint">
                    삼성페이 결제 시 자동으로 기록됩니다
                  </div>
                </div>
              )}
            </div>
          </>
        )
    }
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <h1>하루기록</h1>
        <div className="header-right">
          <button 
            className={`notification-badge ${notificationStatus === 'granted' ? 'active' : ''}`}
            onClick={requestNotificationPermission}
          >
            {notificationStatus === 'granted' ? '🔔' : '🔕'}
          </button>
        </div>
      </header>

      {renderView()}

      {/* Add Transaction Modal */}
      {showAddModal && (
        <AddTransactionModal 
          onClose={() => setShowAddModal(false)}
          onAdd={addTransaction}
        />
      )}

      {/* Permission Required Modal */}
      {showPermissionModal && (
        <PermissionModal 
          onAllow={requestNotificationPermission}
          onLater={handlePermissionLater}
          canSkip={permissionCheckCount < 3}
        />
      )}

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <button className={`nav-item ${view === 'home' ? 'active' : ''}`} onClick={() => setView('home')}>
          <span className="nav-icon">🏠</span>
          <span className="nav-label">홈</span>
        </button>
        <button className={`nav-item ${view === 'calendar' ? 'active' : ''}`} onClick={() => setView('calendar')}>
          <span className="nav-icon">📅</span>
          <span className="nav-label">달력</span>
        </button>
        <button className={`nav-item ${view === 'stats' ? 'active' : ''}`} onClick={() => setView('stats')}>
          <span className="nav-icon">📊</span>
          <span className="nav-label">통계</span>
        </button>
        <button className={`nav-item ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>
          <span className="nav-icon">⚙️</span>
          <span className="nav-label">설정</span>
        </button>
      </nav>
    </div>
  )
}

// Settings View Component
function SettingsView({ reportSettings, setReportSettings, todayTotal, todayCount, topCategory, requestNotificationPermission }) {
  const [hour, setHour] = useState(reportSettings.hour)
  const [minute, setMinute] = useState(reportSettings.minute)
  const [enabled, setEnabled] = useState(reportSettings.enabled)
  const [saving, setSaving] = useState(false)

  const handleToggle = async () => {
    setSaving(true)
    const newEnabled = !enabled
    
    if (newEnabled) {
      const success = await NotificationService.scheduleDailyReport(hour, minute)
      if (success) {
        setEnabled(true)
        setReportSettings({ enabled: true, hour, minute })
      }
    } else {
      await NotificationService.cancelDailyReport()
      setEnabled(false)
      setReportSettings({ enabled: false, hour, minute })
    }
    
    setSaving(false)
  }

  const handleTimeChange = async () => {
    if (enabled) {
      setSaving(true)
      await NotificationService.scheduleDailyReport(hour, minute)
      setReportSettings({ enabled: true, hour, minute })
      setSaving(false)
    }
  }

  const handleTestNotification = async () => {
    const success = await NotificationService.sendDailyReport(todayTotal, todayCount, topCategory)
    if (success) {
      alert('테스트 알림을 보냈어요! 📱')
    } else {
      alert('알림 권한을 먼저 허용해주세요.')
    }
  }

  return (
    <div className="settings-view">
      <div className="settings-section">
        <h2>📊 하루 리포트 알림</h2>
        <p className="settings-desc">매일 정해진 시간에 오늘의 소비 요약을 알려드려요</p>
        
        <div className="setting-item">
          <div className="setting-info">
            <span className="setting-label">하루 리포트 알림</span>
            <span className="setting-hint">
              {enabled ? `매일 ${hour}시 ${minute.toString().padStart(2, '0')}분에 알림` : '꺼짐'}
            </span>
          </div>
          <button 
            className={`toggle-btn ${enabled ? 'active' : ''}`}
            onClick={handleToggle}
            disabled={saving}
          >
            <span className="toggle-knob"></span>
          </button>
        </div>

        {enabled && (
          <div className="time-picker">
            <label>알림 시간</label>
            <div className="time-inputs">
              <select 
                value={hour} 
                onChange={e => setHour(parseInt(e.target.value))}
                onBlur={handleTimeChange}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{i}시</option>
                ))}
              </select>
              <span>:</span>
              <select 
                value={minute} 
                onChange={e => setMinute(parseInt(e.target.value))}
                onBlur={handleTimeChange}
              >
                {[0, 15, 30, 45].map(m => (
                  <option key={m} value={m}>{m.toString().padStart(2, '0')}분</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <button className="test-btn" onClick={handleTestNotification}>
          🔔 테스트 알림 보내기
        </button>
      </div>

      <div className="settings-section">
        <h2>🔐 알림 수집 권한</h2>
        <p className="settings-desc">삼성페이/카드 알림을 자동으로 수집하려면 권한이 필요해요</p>
        
        <button className="setting-action-btn" onClick={requestNotificationPermission}>
          알림 접근 권한 설정 →
        </button>
      </div>

      <div className="settings-section">
        <h2>ℹ️ 앱 정보</h2>
        <div className="app-info">
          <div className="info-row">
            <span>버전</span>
            <span>1.0.0</span>
          </div>
          <div className="info-row">
            <span>개발</span>
            <span>개인 프로젝트</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Stats View Component
function StatsView({ transactions, formatMoney }) {
  const now = new Date()
  const thisMonth = transactions.filter(tx => {
    const txDate = new Date(tx.timestamp)
    return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear()
  })

  const monthlyTotal = thisMonth.reduce((sum, tx) => sum + (tx.amount || 0), 0)

  // Category breakdown
  const categoryTotals = thisMonth.reduce((acc, tx) => {
    const cat = tx.category || 'other'
    acc[cat] = (acc[cat] || 0) + (tx.amount || 0)
    return acc
  }, {})

  const categoryNames = {
    food: { name: '식비', icon: '🍽️' },
    cafe: { name: '카페', icon: '☕' },
    shopping: { name: '쇼핑', icon: '🛍️' },
    transport: { name: '교통', icon: '🚇' },
    entertainment: { name: '여가', icon: '🎬' },
    grocery: { name: '마트', icon: '🛒' },
    health: { name: '건강', icon: '💊' },
    other: { name: '기타', icon: '💳' }
  }

  const sortedCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])

  return (
    <div className="stats-view">
      <div className="stats-card">
        <h2>{format(now, 'M월')} 총 지출</h2>
        <div className="stats-total">₩{formatMoney(monthlyTotal)}</div>
        <div className="stats-count">{thisMonth.length}건 결제</div>
      </div>

      <div className="category-breakdown">
        <h3>카테고리별 지출</h3>
        {sortedCategories.length > 0 ? (
          sortedCategories.map(([cat, amount]) => {
            const info = categoryNames[cat] || categoryNames.other
            const percentage = monthlyTotal > 0 ? (amount / monthlyTotal * 100).toFixed(0) : 0
            return (
              <div key={cat} className="category-row">
                <div className="category-info">
                  <span className="cat-icon">{info.icon}</span>
                  <span className="cat-name">{info.name}</span>
                </div>
                <div className="category-bar-container">
                  <div className="category-bar" style={{ width: `${percentage}%` }}></div>
                </div>
                <div className="category-amount">
                  <span className="amount">₩{formatMoney(amount)}</span>
                  <span className="percentage">{percentage}%</span>
                </div>
              </div>
            )
          })
        ) : (
          <div className="empty-stats">이번 달 기록이 없어요</div>
        )}
      </div>
    </div>
  )
}

// Add Transaction Modal Component
function AddTransactionModal({ onClose, onAdd }) {
  const [store, setStore] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('other')
  const [card, setCard] = useState('')

  const categories = [
    { id: 'food', label: '식비', icon: '🍽️' },
    { id: 'cafe', label: '카페', icon: '☕' },
    { id: 'shopping', label: '쇼핑', icon: '🛍️' },
    { id: 'transport', label: '교통', icon: '🚇' },
    { id: 'entertainment', label: '여가', icon: '🎬' },
    { id: 'grocery', label: '마트', icon: '🛒' },
    { id: 'health', label: '건강', icon: '💊' },
    { id: 'other', label: '기타', icon: '💳' },
  ]

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!store || !amount) return
    onAdd({
      store,
      amount: parseInt(amount.replace(/,/g, '')),
      category,
      card: card || null
    })
  }

  const formatAmountInput = (value) => {
    const numbers = value.replace(/[^0-9]/g, '')
    return numbers ? parseInt(numbers).toLocaleString('ko-KR') : ''
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>직접 입력</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>가게명</label>
            <input
              type="text"
              value={store}
              onChange={e => setStore(e.target.value)}
              placeholder="스타벅스 강남점"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>금액</label>
            <div className="amount-input">
              <span className="currency-prefix">₩</span>
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={e => setAmount(formatAmountInput(e.target.value))}
                placeholder="0"
              />
            </div>
          </div>
          <div className="form-group">
            <label>카테고리</label>
            <div className="category-grid">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  className={`category-btn ${category === cat.id ? 'active' : ''}`}
                  onClick={() => setCategory(cat.id)}
                >
                  <span className="cat-icon">{cat.icon}</span>
                  <span className="cat-label">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>카드 (선택)</label>
            <input
              type="text"
              value={card}
              onChange={e => setCard(e.target.value)}
              placeholder="삼성카드"
            />
          </div>
          <button type="submit" className="submit-btn">저장</button>
        </form>
      </div>
    </div>
  )
}

// Permission Modal Component
function PermissionModal({ onAllow, onLater, canSkip }) {
  return (
    <div className="permission-overlay">
      <div className="permission-modal">
        <div className="permission-icon">🔔</div>
        <h2>알림 접근 권한이 필요해요</h2>
        <p>
          삼성페이, 카드 결제 알림을 자동으로 수집하려면
          <strong> 알림 접근 권한</strong>이 필요합니다.
        </p>
        
        <div className="permission-features">
          <div className="feature-item">
            <span className="feature-icon">💳</span>
            <span>삼성페이 결제 자동 기록</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🏦</span>
            <span>카드사 알림 자동 수집</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">📊</span>
            <span>실시간 소비 분석</span>
          </div>
        </div>

        <div className="permission-note">
          <span>🔒</span>
          <span>결제 정보는 기기에만 저장되며, 외부로 전송되지 않습니다.</span>
        </div>

        <button className="permission-allow-btn" onClick={onAllow}>
          권한 설정하러 가기
        </button>
        
        {canSkip ? (
          <button className="permission-later-btn" onClick={onLater}>
            나중에 하기
          </button>
        ) : (
          <p className="permission-required-text">
            앱 사용을 위해 권한이 필요합니다
          </p>
        )}
      </div>
    </div>
  )
}

export default App
