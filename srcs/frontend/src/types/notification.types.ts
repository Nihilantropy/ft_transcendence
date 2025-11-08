/**
 * @file Notification type definitions for ft_transcendence
 * @description Type definitions for notification system
 */

/**
 * @brief Notification types
 */
export type NotificationType =
  | 'friend_request'
  | 'friend_accepted'
  | 'game_invitation'
  | 'game_invite' // Alias for game_invitation
  | 'game_started'
  | 'game_finished'
  | 'tournament_started'
  | 'achievement'
  | 'system'

/**
 * @brief Notification priority levels
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

/**
 * @brief Notification categories
 */
export type NotificationCategory = 'social' | 'game' | 'system' | 'achievement'

/**
 * @brief Notification state
 */
export type NotificationState = 'unread' | 'read' | 'archived'

/**
 * @brief Notification interface
 */
export interface Notification {
  id: string
  userId: number
  type: NotificationType
  title: string
  message: string
  data?: Record<string, any>
  read: boolean
  isRead: boolean // Alias for compatibility
  createdAt: Date | string
  priority?: NotificationPriority
  category?: NotificationCategory
  state?: NotificationState
}

/**
 * @brief Notification data (alias for Notification for backward compatibility)
 */
export type NotificationData = Notification

/**
 * @brief Notification event handlers
 */
export interface NotificationEventHandlers {
  onReceive?: (notification: Notification) => void
  onReceived?: (notification: Notification) => void // Alias
  onRead?: (notificationId: string) => void
  onDelete?: (notificationId: string) => void
  onDeleted?: (notificationId: string) => void // Alias
  onClicked?: (notificationId: string) => void
  onClear?: () => void
}

/**
 * @brief Notification response from API
 */
export interface NotificationResponse {
  success: boolean
  notifications: Notification[]
  total: number
  unreadCount: number
}
