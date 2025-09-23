/**
 * @brief Notification service exports
 * 
 * @description Central export point for notification-related services.
 */

export { NotificationService, notificationService } from './NotificationService'
export type {
  NotificationData,
  NotificationType,
  NotificationPriority,
  NotificationCategory,
  NotificationState,
  NotificationEventHandlers
} from '../../types/notification.types'