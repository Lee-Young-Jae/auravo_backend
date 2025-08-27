import { Router } from "express";
import { authenticate } from "../middlewares/auth";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead
} from "../controllers/notificationController";

const router = Router();

// 알림 목록 조회 (페이지네이션)
router.get("/", authenticate, getNotifications);

// 읽지 않은 알림 개수
router.get("/unread-count", authenticate, getUnreadCount);

// 특정 알림들 읽음 처리
router.patch("/read", authenticate, markAsRead);

// 모든 알림 읽음 처리
router.patch("/read-all", authenticate, markAllAsRead);

export default router;