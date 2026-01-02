import { useState, useEffect } from 'react'
import { format, isToday, isYesterday, parseISO, startOfDay } from 'date-fns'
import { ko } from 'date-fns/locale'
import localforage from 'localforage'
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

  // Load transactions from storage
  useEffect(() => {
    loadTransactions()
    checkNotificationPermission()
    
    // Listen for new transactions from native layer
    window.addEventListener('newTransaction', handleNewTransaction)
    return () => window.removeEventListener('newTransaction', handleNewTransaction)
  }, [])

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
      const status = await window.NotificationListener.checkPermission()
      setNotificationStatus(status)
    }
  }

  const requestNotificationPermission = async () => {
    if (window.NotificationListener) {
      await window.NotificationListener.requestPermission()
      checkNotificationPermission()
    } else {
      alert('알림 권한 설정을 위해 앱 설정으로 이동합니다.')
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

      {/* Add Transaction Modal */}
      {showAddModal && (
        <AddTransactionModal 
          onClose={() => setShowAddModal(false)}
          onAdd={addTransaction}
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

export default App
