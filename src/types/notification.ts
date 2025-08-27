export interface NotificationResponse {
  id: number;
  type: "FOLLOW" | "POST_LIKE" | "COMMENT" | "MENTION" | "POST_TAG";
  isRead: boolean;
  actor: {
    id: number;
    name: string;
    profileImageUrl: string | null;
  } | null;
  postId: number | null;
  commentId: number | null;
  metadata: any;
  createdAt: string;
}

export interface NotificationsListResponse {
  data: NotificationResponse[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface NotificationStatsResponse {
  unreadCount: number;
}

export interface MarkAsReadRequest {
  notificationIds: number[];
}