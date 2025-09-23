/**
 * @brief Notification Bell component
 * 
 * @description Header notification bell with unread count badge and dropdown.
 * Shows real-time notification count and provides access to notification list.
 */

import { Component } from '../../base/Component'
import { notificationService } from '../../../services/notification'
import type { NotificationData } from '../../../types/notification.types'

export interface NotificationBellProps {
  /** Maximum number of notifications to show in dropdown */
  maxVisible?: number
  /** Whether to show notification preview on hover */
  showPreview?: boolean
}

export interface NotificationBellState {
  /** Current unread count */
  unreadCount: number
  /** Whether dropdown is open */
  isOpen: boolean
  /** Recent notifications for dropdown */
  recentNotifications: NotificationData[]
  /** Loading state */
  isLoading: boolean
}

/**
 * @brief Notification bell with dropdown
 * 
 * @description Shows notification count badge and provides dropdown access
 * to recent notifications. Integrates with NotificationService for real-time updates.
 */
export class NotificationBell extends Component<NotificationBellProps, NotificationBellState> {

  constructor(props: NotificationBellProps = {}) {
    const initialState: NotificationBellState = {
      unreadCount: 0,
      isOpen: false,
      recentNotifications: [],
      isLoading: false
    }
    
    super(props, initialState)
    
    this.setupNotificationListeners()
    this.loadInitialData()
  }

  /**
   * @brief Setup notification service listeners
   */
  private setupNotificationListeners(): void {
    notificationService.setEventHandlers({
      onReceived: (notification) => {
        this.handleNotificationReceived(notification)
      },
      onRead: () => {
        this.updateNotificationData()
      },
      onDeleted: () => {
        this.updateNotificationData()
      }
    })
  }

  /**
   * @brief Load initial notification data
   */
  private loadInitialData(): void {
    this.updateNotificationData()
  }

  /**
   * @brief Handle new notification received
   */
  private handleNotificationReceived(_notification: NotificationData): void {
    // Update count and animate bell
    this.updateNotificationData()
    this.animateBell()
  }

  /**
   * @brief Update notification data from service
   */
  private updateNotificationData(): void {
    const unreadCount = notificationService.getUnreadCount()
    const maxVisible = this.props.maxVisible || 10
    const recentNotifications = notificationService.getNotifications().slice(0, maxVisible)

    this.setState({
      unreadCount,
      recentNotifications
    })
  }

  /**
   * @brief Animate bell on new notification
   */
  private animateBell(): void {
    const bell = this.element?.querySelector('.notification-bell-icon')
    if (bell) {
      bell.classList.add('notification-bell-shake')
      setTimeout(() => {
        bell.classList.remove('notification-bell-shake')
      }, 600)
    }
  }

  /**
   * @brief Toggle dropdown visibility
   */
  private toggleDropdown(): void {
    this.setState({ isOpen: !this.state.isOpen })
  }

  /**
   * @brief Close dropdown
   */
  private closeDropdown(): void {
    if (this.state.isOpen) {
      this.setState({ isOpen: false })
    }
  }

  /**
   * @brief Handle notification item click
   */
  private handleNotificationClick(notification: NotificationData): void {
    // Mark as read
    notificationService.markAsRead(notification.id)
    
    // Close dropdown
    this.closeDropdown()

    // Handle navigation (basic implementation)
    this.handleNotificationNavigation(notification)
  }

  /**
   * @brief Handle notification navigation
   */
  private handleNotificationNavigation(notification: NotificationData): void {
    // Basic navigation - can be enhanced with router integration
    switch (notification.type) {
      case 'friend_request':
        window.location.hash = '/friends'
        break
      case 'game_invite':
        window.location.hash = '/game'
        break
      default:
        // No specific navigation
        break
    }
  }

  /**
   * @brief Mark all notifications as read
   */
  private markAllAsRead(): void {
    notificationService.markAllAsRead()
    this.closeDropdown()
  }

  /**
   * @brief Render notification bell
   */
  public render(): string {
    const { unreadCount, isOpen, recentNotifications } = this.state

    return `
      <div class="notification-bell">
        <!-- Bell Icon with Badge -->
        <button class="notification-bell-button" data-action="toggle-dropdown">
          <div class="notification-bell-icon">
            🔔
          </div>
          ${unreadCount > 0 ? `
            <div class="notification-bell-badge">
              ${unreadCount > 99 ? '99+' : unreadCount}
            </div>
          ` : ''}
        </button>

        <!-- Dropdown -->
        ${isOpen ? `
          <div class="notification-dropdown">
            <div class="notification-dropdown-header">
              <h3 class="notification-dropdown-title">Notifications</h3>
              ${unreadCount > 0 ? `
                <button class="notification-dropdown-clear" data-action="mark-all-read">
                  Mark all read
                </button>
              ` : ''}
            </div>

            <div class="notification-dropdown-content">
              ${recentNotifications.length > 0 ? `
                ${recentNotifications.map(notification => `
                  <div class="notification-item ${notification.isRead ? 'read' : 'unread'}" 
                       data-action="click-notification" 
                       data-notification-id="${notification.id}">
                    <div class="notification-item-icon">
                      ${this.getNotificationIcon(notification.type)}
                    </div>
                    <div class="notification-item-content">
                      <div class="notification-item-title">${notification.title}</div>
                      <div class="notification-item-message">${notification.message}</div>
                      <div class="notification-item-time">${this.formatTime(notification.createdAt)}</div>
                    </div>
                    ${!notification.isRead ? '<div class="notification-item-unread-dot"></div>' : ''}
                  </div>
                `).join('')}
              ` : `
                <div class="notification-empty">
                  <div class="notification-empty-icon">📭</div>
                  <div class="notification-empty-text">No notifications</div>
                </div>
              `}
            </div>

            ${recentNotifications.length > 0 ? `
              <div class="notification-dropdown-footer">
                <a href="#/notifications" class="notification-view-all">View all notifications</a>
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `
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
   * @brief Format notification time
   */
  private formatTime(date: Date): string {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  /**
   * @brief Setup event listeners after render
   */
  protected afterMount(): void {
    this.addStyles()
    this.setupEventListeners()
  }

  /**
   * @brief Setup event listeners after mount
   */
  private setupEventListeners(): void {
    if (!this.element) return

    // Toggle dropdown
    const toggleButton = this.element.querySelector('[data-action="toggle-dropdown"]')
    if (toggleButton) {
      toggleButton.addEventListener('click', () => this.toggleDropdown())
    }

    // Mark all as read
    const markAllButton = this.element.querySelector('[data-action="mark-all-read"]')
    if (markAllButton) {
      markAllButton.addEventListener('click', () => this.markAllAsRead())
    }

    // Notification clicks
    const notificationItems = this.element.querySelectorAll('[data-action="click-notification"]')
    notificationItems.forEach((item: Element) => {
      item.addEventListener('click', () => {
        const notificationId = item.getAttribute('data-notification-id')
        if (notificationId) {
          const notification = this.state.recentNotifications.find(n => n.id === notificationId)
          if (notification) {
            this.handleNotificationClick(notification)
          }
        }
      })
    })

    // Close dropdown when clicking outside
    document.addEventListener('click', (event) => {
      if (this.element && !this.element.contains(event.target as Node)) {
        this.closeDropdown()
      }
    })
  }

  /**
   * @brief Add component styles
   */
  public addStyles(): void {
    const style = document.createElement('style')
    style.textContent = `
      .notification-bell {
        position: relative;
        display: inline-block;
      }

      .notification-bell-button {
        position: relative;
        background: none;
        border: none;
        cursor: pointer;
        padding: 0.5rem;
        border-radius: 50%;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .notification-bell-button:hover {
        background: rgba(0, 255, 65, 0.1);
      }

      .notification-bell-icon {
        font-size: 1.25rem;
        transition: transform 0.3s ease;
      }

      .notification-bell-shake {
        animation: bellShake 0.6s ease-in-out;
      }

      @keyframes bellShake {
        0%, 100% { transform: rotate(0deg); }
        10%, 30%, 50%, 70%, 90% { transform: rotate(-10deg); }
        20%, 40%, 60%, 80% { transform: rotate(10deg); }
      }

      .notification-bell-badge {
        position: absolute;
        top: -2px;
        right: -2px;
        background: #ff4444;
        color: white;
        border-radius: 10px;
        padding: 2px 6px;
        font-size: 0.75rem;
        font-weight: bold;
        min-width: 18px;
        height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: badgePulse 2s infinite;
      }

      @keyframes badgePulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }

      .notification-dropdown {
        position: absolute;
        top: 100%;
        right: 0;
        background: rgba(0, 0, 0, 0.95);
        border: 1px solid #00ff41;
        border-radius: 8px;
        width: 320px;
        max-height: 400px;
        z-index: 1000;
        box-shadow: 0 4px 20px rgba(0, 255, 65, 0.2);
        animation: dropdownSlide 0.2s ease;
      }

      @keyframes dropdownSlide {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .notification-dropdown-header {
        padding: 1rem;
        border-bottom: 1px solid #333;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .notification-dropdown-title {
        color: #00ff41;
        font-size: 1rem;
        font-weight: bold;
        margin: 0;
      }

      .notification-dropdown-clear {
        background: none;
        border: none;
        color: #00ff41;
        cursor: pointer;
        font-size: 0.875rem;
        text-decoration: underline;
      }

      .notification-dropdown-content {
        max-height: 300px;
        overflow-y: auto;
      }

      .notification-item {
        display: flex;
        align-items: flex-start;
        padding: 0.75rem 1rem;
        border-bottom: 1px solid #222;
        cursor: pointer;
        transition: background 0.2s ease;
        position: relative;
      }

      .notification-item:hover {
        background: rgba(0, 255, 65, 0.05);
      }

      .notification-item.unread {
        background: rgba(0, 255, 65, 0.02);
      }

      .notification-item-icon {
        font-size: 1.25rem;
        margin-right: 0.75rem;
        flex-shrink: 0;
      }

      .notification-item-content {
        flex: 1;
        min-width: 0;
      }

      .notification-item-title {
        color: #00ff41;
        font-weight: bold;
        font-size: 0.875rem;
        margin-bottom: 0.25rem;
      }

      .notification-item-message {
        color: #ccc;
        font-size: 0.8rem;
        line-height: 1.3;
        margin-bottom: 0.25rem;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }

      .notification-item-time {
        color: #888;
        font-size: 0.75rem;
      }

      .notification-item-unread-dot {
        position: absolute;
        top: 50%;
        right: 0.75rem;
        transform: translateY(-50%);
        width: 8px;
        height: 8px;
        background: #00ff41;
        border-radius: 50%;
      }

      .notification-empty {
        padding: 2rem;
        text-align: center;
        color: #888;
      }

      .notification-empty-icon {
        font-size: 2rem;
        margin-bottom: 0.5rem;
      }

      .notification-dropdown-footer {
        padding: 0.75rem 1rem;
        border-top: 1px solid #333;
        text-align: center;
      }

      .notification-view-all {
        color: #00ff41;
        text-decoration: none;
        font-size: 0.875rem;
      }

      .notification-view-all:hover {
        text-decoration: underline;
      }
    `
    document.head.appendChild(style)
  }
}