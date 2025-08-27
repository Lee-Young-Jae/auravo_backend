import { Request, Response, NextFunction } from "express";
import { NotificationService } from "../services/notificationService";
import {
  NotificationsListResponse,
  NotificationStatsResponse,
  MarkAsReadRequest,
} from "../types/notification";

// 알림 목록 조회
export const getNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }

    const { cursor, limit } = req.query;
    const limitNum = limit ? Math.min(parseInt(limit as string), 50) : 20;

    const result = await NotificationService.getNotifications(
      userId,
      cursor as string,
      limitNum
    );

    const response: NotificationsListResponse = {
      data: result.data.map((notification) => ({
        id: notification.id,
        type: notification.type as any,
        isRead: notification.isRead,
        actor: notification.actor,
        postId: notification.postId,
        commentId: notification.commentId,
        metadata: notification.metadata,
        createdAt: notification.createdAt.toISOString(),
      })),
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

// 읽지 않은 알림 개수
export const getUnreadCount = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }

    const unreadCount = await NotificationService.getUnreadCount(userId);

    const response: NotificationStatsResponse = {
      unreadCount,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
};

// 특정 알림들 읽음 처리
export const markAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }

    const { notificationIds }: MarkAsReadRequest = req.body;

    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return res.status(400).json({
        message: "알림 ID 배열이 필요합니다",
      });
    }

    await NotificationService.markAsRead(userId, notificationIds);

    res.json({ message: "알림을 읽음 처리했습니다" });
  } catch (error) {
    next(error);
  }
};

// 모든 알림 읽음 처리
export const markAllAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }

    await NotificationService.markAllAsRead(userId);

    res.json({ message: "모든 알림을 읽음 처리했습니다" });
  } catch (error) {
    next(error);
  }
};
