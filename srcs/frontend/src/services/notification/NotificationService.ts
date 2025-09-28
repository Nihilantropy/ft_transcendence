/**
 * @brief Notification Service for ft_transcendence
 * 
 * @description Central notification management service that integrates with WebSocket
 * for real-time notifications. Handles storage, state management, and UI interactions.
 */

import { webSocketService } from '../websocket'

/**
 * @brief Core notification management service
 * 
 * @description Singleton service that manages notification lifecycle:
 * - Receives notifications via WebSocket
 * - Stores notifications in memory with localStorage backup
 * - Manages read/unread states
 * - Provides API for UI components
 * - Handles notification actions and cleanup
 */
export class NotificationService {
  private static instance: NotificationService
  private state: NotificationState = {
    notifications: [],
    unreadCount: 0,
    enabled: true,
    lastChecked: undefined
  }
  private eventHandlers: NotificationEventHandlers = {}
  private readonly maxNotifications = 100 // Limit stored notifications

  /**
   * @brief Initialize notification service
   */
  constructor() {
    this.loadFromStorage()
    this.setupWebSocketListeners()
    console.log('🔔 NotificationService initialized')
  }

  /**
   * @brief Get singleton instance
   */
  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService()
    }
    return NotificationService.instance
  }

  /**
   * @brief Setup WebSocket event listeners
   */
  private setupWebSocketListeners(): void {
    // Listen for incoming notifications
    webSocketService.on('notification:received', (data) => {
      this.handleNotificationReceived(data.notification)
    })

    // Listen for read confirmations
    webSocketService.on('notification:read', (data) => {
      this.markAsRead(data.notificationId, false) // Don't send back to server
    })

    // Listen for deletion confirmations
    webSocketService.on('notification:deleted', (data) => {
      this.deleteNotification(data.notificationId, false) // Don't send back to server
    })

    // Listen for bulk read confirmations
    webSocketService.on('notification:bulk_read', (data) => {
      this.markMultipleAsRead(data.notificationIds, false) // Don't send back to server
    })
  }

  /**
   * @brief Handle received notification
   */
  private handleNotificationReceived(notification: NotificationData): void {
    console.log('🔔 Notification received:', notification.type, notification.title)

    // Add to state
    this.state.notifications.unshift(notification)
    
    // Limit stored notifications
    if (this.state.notifications.length > this.maxNotifications) {
      this.state.notifications = this.state.notifications.slice(0, this.maxNotifications)
    }

    // Update unread count
    this.updateUnreadCount()

    // Save to storage
    this.saveToStorage()

    // Trigger event handler
    if (this.eventHandlers.onReceived) {
      this.eventHandlers.onReceived(notification)
    }

    // Show toast for high priority notifications
    if (notification.priority === 'high' || notification.priority === 'urgent') {
      this.showToastNotification(notification)
    }
  }

  /**
   * @brief Show toast notification (temporary popup)
   */
  private showToastNotification(notification: NotificationData): void {
    // Create toast element
    const toast = document.createElement('div')
    toast.className = 'notification-toast'
    toast.innerHTML = `
      <div class="notification-toast-content">
        <div class="notification-toast-header">
          <span class="notification-toast-icon">${this.getNotificationIcon(notification.type)}</span>
          <span class="notification-toast-title">${notification.title}</span>
          <button class="notification-toast-close" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
        </div>
        <div class="notification-toast-message">${notification.message}</div>
      </div>
    `

    // Apply styles
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.9);
      border: 1px solid #00ff41;
      border-radius: 8px;
      padding: 1rem;
      max-width: 300px;
      z-index: 10000;
      color: #00ff41;
      font-family: monospace;
      animation: slideInRight 0.3s ease, fadeOut 0.3s ease 4.7s;
      cursor: pointer;
    `

    // Add click handler
    toast.addEventListener('click', () => {
      this.handleNotificationClick(notification)
      toast.remove()
    })

    // Add to DOM
    document.body.appendChild(toast)

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove()
      }
    }, 5000)
  }

  /**
   * @brief Get icon for notification type
   */
  private getNotificationIcon(type: string): string {
    const iconMap: Record<string, string> = {
      friend_request: '👤',
      friend_accepted: '✅',
      friend_online: '🟢',
      game_invite: '🎮',
      game_result: '🏆',
      achievement_unlocked: '🏅',
      system_announcement: '📢',
      tournament_update: '🏟️'
    }
    return iconMap[type] || '🔔'
  }

  /**
   * @brief Handle notification click
   */
  private handleNotificationClick(notification: NotificationData): void {
    // Mark as read
    this.markAsRead(notification.id)

    // Trigger event handler
    if (this.eventHandlers.onClicked) {
      this.eventHandlers.onClicked(notification)
    }

    // Navigate based on notification type
    this.handleNotificationNavigation(notification)
  }

  /**
   * @brief Handle navigation based on notification type
   */
  private handleNotificationNavigation(notification: NotificationData): void {
    // Basic navigation logic - can be expanded
    switch (notification.type) {
      case 'friend_request':
        // Navigate to friends page
        window.location.hash = '/friends'
        break
      case 'game_invite':
        // Navigate to game
        window.location.hash = '/game'
        break
      default:
        // No specific navigation
        break
    }
  }

  /**
   * @brief Mark notification as read
   */
  public markAsRead(notificationId: string, sendToServer: boolean = true): void {
    const notification = this.state.notifications.find(n => n.id === notificationId)
    if (notification && !notification.isRead) {
      notification.isRead = true
      this.updateUnreadCount()
      this.saveToStorage()

      // Send to server if requested
      if (sendToServer && webSocketService.isConnected()) {
        webSocketService.emit('notification:read', { notificationId })
      }

      // Trigger event handler
      if (this.eventHandlers.onRead) {
        this.eventHandlers.onRead(notificationId)
      }
    }
  }

  /**
   * @brief Mark multiple notifications as read
   */
  public markMultipleAsRead(notificationIds: string[], sendToServer: boolean = true): void {
    let hasChanges = false

    notificationIds.forEach(id => {
      const notification = this.state.notifications.find(n => n.id === id)
      if (notification && !notification.isRead) {
        notification.isRead = true
        hasChanges = true
      }
    })

    if (hasChanges) {
      this.updateUnreadCount()
      this.saveToStorage()

      // Send to server if requested
      if (sendToServer && webSocketService.isConnected()) {
        webSocketService.emit('notification:bulk_read', { notificationIds })
      }
    }
  }

  /**
   * @brief Mark all notifications as read
   */
  public markAllAsRead(): void {
    const unreadIds = this.state.notifications
      .filter(n => !n.isRead)
      .map(n => n.id)

    if (unreadIds.length > 0) {
      this.markMultipleAsRead(unreadIds)
    }
  }

  /**
   * @brief Delete notification
   */
  public deleteNotification(notificationId: string, sendToServer: boolean = true): void {
    const index = this.state.notifications.findIndex(n => n.id === notificationId)
    if (index !== -1) {
      this.state.notifications.splice(index, 1)
      this.updateUnreadCount()
      this.saveToStorage()

      // Send to server if requested
      if (sendToServer && webSocketService.isConnected()) {
        webSocketService.emit('notification:deleted', { notificationId })
      }

      // Trigger event handler
      if (this.eventHandlers.onDeleted) {
        this.eventHandlers.onDeleted(notificationId)
      }
    }
  }

  /**
   * @brief Clear all notifications
   */
  public clearAll(): void {
    this.state.notifications = []
    this.state.unreadCount = 0
    this.saveToStorage()
  }

  /**
   * @brief Get all notifications
   */
  public getNotifications(): NotificationData[] {
    return [...this.state.notifications]
  }

  /**
   * @brief Get unread notifications
   */
  public getUnreadNotifications(): NotificationData[] {
    return this.state.notifications.filter(n => !n.isRead)
  }

  /**
   * @brief Get unread count
   */
  public getUnreadCount(): number {
    return this.state.unreadCount
  }

  /**
   * @brief Add a notification (for testing purposes)
   */
  public addNotification(notification: NotificationData): void {
    this.handleNotificationReceived(notification)
  }

  /**
   * @brief Get notifications by category
   */
  public getNotificationsByCategory(category: NotificationCategory): NotificationData[] {
    return this.state.notifications.filter(n => n.category === category)
  }

  /**
   * @brief Update unread count
   */
  private updateUnreadCount(): void {
    this.state.unreadCount = this.state.notifications.filter(n => !n.isRead).length
  }

  /**
   * @brief Set event handlers
   */
  public setEventHandlers(handlers: NotificationEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers }
  }

  /**
   * @brief Load notifications from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('ft_notifications')
      if (stored) {
        const data = JSON.parse(stored)
        this.state = {
          ...this.state,
          ...data,
          notifications: data.notifications.map((n: any) => ({
            ...n,
            createdAt: new Date(n.createdAt),
            expiresAt: n.expiresAt ? new Date(n.expiresAt) : undefined
          }))
        }
        this.updateUnreadCount()
      }
    } catch (error) {
      console.warn('Failed to load notifications from storage:', error)
    }
  }

  /**
   * @brief Save notifications to localStorage
   */
  private saveToStorage(): void {
    try {
      const data = {
        notifications: this.state.notifications,
        enabled: this.state.enabled,
        lastChecked: new Date()
      }
      localStorage.setItem('ft_notifications', JSON.stringify(data))
    } catch (error) {
      console.warn('Failed to save notifications to storage:', error)
    }
  }

  /**
   * @brief Enable/disable notifications
   */
  public setEnabled(enabled: boolean): void {
    this.state.enabled = enabled
    this.saveToStorage()
  }

  /**
   * @brief Check if notifications are enabled
   */
  public isEnabled(): boolean {
    return this.state.enabled
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance()