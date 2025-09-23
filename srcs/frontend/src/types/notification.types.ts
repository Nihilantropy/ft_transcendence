/**
 * @brief Notification system type definitions
 * 
 * @description Types for the real-time notification system integrated with WebSocket.
 * Supports friend notifications, game events, and system announcements.
 */

/**
 * @brief Notification priority levels
 */
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent'

/**
 * @brief Notification categories
 */
export type NotificationCategory = 'system' | 'friend' | 'game' | 'achievement'

/**
 * @brief Supported notification types
 */
export type NotificationType = 
  | 'friend_request' 
  | 'friend_accepted' 
  | 'friend_online'
  | 'game_invite' 
  | 'game_result'
  | 'achievement_unlocked'
  | 'system_announcement'
  | 'tournament_update'

/**
 * @brief Core notification data structure
 */
export interface NotificationData {
  /** Unique notification identifier */
  id: string
  
  /** Type of notification */
  type: NotificationType
  
  /** Notification title/header */
  title: string
  
  /** Main notification message */
  message: string
  
  /** Additional data specific to notification type */
  data?: Record<string, any>
  
  /** Whether notification has been read */
  isRead: boolean
  
  /** When notification was created */
  createdAt: Date
  
  /** Optional expiration time */
  expiresAt?: Date
  
  /** Notification priority level */
  priority: NotificationPriority
  
  /** Notification category */
  category: NotificationCategory
  
  /** User ID this notification belongs to */
  userId: string
  
  /** Optional action data for interactive notifications */
  actions?: NotificationAction[]
}

/**
 * @brief Notification action for interactive notifications
 */
export interface NotificationAction {
  /** Action identifier */
  id: string
  
  /** Action label */
  label: string
  
  /** Action type */
  type: 'primary' | 'secondary' | 'danger'
  
  /** Optional URL to navigate to */
  url?: string
  
  /** Whether action dismisses notification */
  dismisses?: boolean
}

/**
 * @brief Notification state for service management
 */
export interface NotificationState {
  /** All notifications */
  notifications: NotificationData[]
  
  /** Count of unread notifications */
  unreadCount: number
  
  /** Whether notifications are enabled */
  enabled: boolean
  
  /** Last time notifications were checked */
  lastChecked?: Date
}

/**
 * @brief Notification subscription preferences
 */
export interface NotificationPreferences {
  /** Global notification toggle */
  enabled: boolean
  
  /** Per-category preferences */
  categories: {
    [K in NotificationCategory]: {
      enabled: boolean
      priority: NotificationPriority
      sound: boolean
      desktop: boolean
    }
  }
  
  /** Do not disturb mode */
  quietHours?: {
    enabled: boolean
    start: string // HH:MM format
    end: string   // HH:MM format
  }
}

/**
 * @brief Notification event handlers
 */
export interface NotificationEventHandlers {
  onReceived?: (notification: NotificationData) => void
  onRead?: (notificationId: string) => void
  onDeleted?: (notificationId: string) => void
  onClicked?: (notification: NotificationData) => void
  onActionClicked?: (notification: NotificationData, action: NotificationAction) => void
}