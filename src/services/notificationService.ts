import { prisma } from "../config/db";
import { toPrismaJson } from "../utils/jsonHelpers";

export type NotificationType = 
  | "FOLLOW" 
  | "POST_LIKE" 
  | "COMMENT" 
  | "MENTION" 
  | "POST_TAG";

export interface NotificationMetadata {
  postTitle?: string;
  commentContent?: string;
  actorName?: string;
  [key: string]: any;
}

export class NotificationService {
  // 알림 생성 (중복 방지 로직 포함)
  static async createNotification(
    recipientId: number,
    type: NotificationType,
    actorId?: number,
    postId?: number,
    commentId?: number,
    metadata?: NotificationMetadata
  ) {
    try {
      // 자기 자신에게 알림 보내지 않기
      if (recipientId === actorId) {
        return null;
      }

      // 수신자 존재 여부 확인
      const recipient = await prisma.user.findUnique({
        where: { id: recipientId },
        select: { 
          id: true, 
          preferences: true 
        }
      });

      if (!recipient) {
        console.warn(`Recipient ${recipientId} not found`);
        return null;
      }

      // 사용자 알림 설정 확인
      const preferences = recipient.preferences as any;
      if (!this.shouldSendNotification(type, preferences)) {
        return null;
      }

      // 중복 알림 방지 (최근 1시간 내 같은 타입의 알림)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const existingNotification = await prisma.notification.findFirst({
        where: {
          recipientId,
          type,
          actorId,
          postId: postId || null,
          commentId: commentId || null,
          createdAt: { gte: oneHourAgo }
        }
      });

      if (existingNotification) {
        return null; // 중복 알림 방지
      }

      // 알림 생성
      const notification = await prisma.notification.create({
        data: {
          recipientId,
          actorId,
          type,
          postId,
          commentId,
          metadata: metadata ? toPrismaJson(metadata) : null
        },
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              profileImageUrl: true
            }
          }
        }
      });

      return notification;
    } catch (error) {
      console.error("Failed to create notification:", error);
      return null;
    }
  }

  // 팔로우 알림
  static async notifyFollow(followingId: number, followerId: number) {
    const follower = await prisma.user.findUnique({
      where: { id: followerId },
      select: { name: true }
    });

    return await this.createNotification(
      followingId,
      "FOLLOW",
      followerId,
      undefined,
      undefined,
      { actorName: follower?.name }
    );
  }

  // 게시글 좋아요 알림
  static async notifyPostLike(postId: number, likerId: number) {
    const [post, liker] = await Promise.all([
      prisma.post.findUnique({
        where: { id: postId },
        select: { title: true, authorId: true }
      }),
      prisma.user.findUnique({
        where: { id: likerId },
        select: { name: true }
      })
    ]);

    if (!post) return null;

    return await this.createNotification(
      post.authorId,
      "POST_LIKE",
      likerId,
      postId,
      undefined,
      { 
        postTitle: post.title,
        actorName: liker?.name
      }
    );
  }

  // 댓글 알림
  static async notifyComment(postId: number, commentId: number, commenterId: number, content: string) {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { title: true, authorId: true }
    });

    if (!post) return null;

    const commenter = await prisma.user.findUnique({
      where: { id: commenterId },
      select: { name: true }
    });

    // 댓글 내용 일부만 포함 (50자 제한)
    const shortContent = content.length > 50 ? content.substring(0, 50) + "..." : content;

    return await this.createNotification(
      post.authorId,
      "COMMENT",
      commenterId,
      postId,
      commentId,
      {
        postTitle: post.title,
        commentContent: shortContent,
        actorName: commenter?.name
      }
    );
  }

  // 멘션 알림
  static async notifyMention(mentionedUserId: number, commentId: number, mentionerId: number, content: string) {
    const [comment, mentioner] = await Promise.all([
      prisma.comment.findUnique({
        where: { id: commentId },
        include: {
          post: {
            select: { title: true }
          }
        }
      }),
      prisma.user.findUnique({
        where: { id: mentionerId },
        select: { name: true }
      })
    ]);

    if (!comment) return null;

    const shortContent = content.length > 50 ? content.substring(0, 50) + "..." : content;

    return await this.createNotification(
      mentionedUserId,
      "MENTION",
      mentionerId,
      comment.postId,
      commentId,
      {
        postTitle: comment.post.title,
        commentContent: shortContent,
        actorName: mentioner?.name
      }
    );
  }

  // 게시글 태그 알림
  static async notifyPostTag(taggedUserId: number, postId: number, taggerId: number) {
    const [post, tagger] = await Promise.all([
      prisma.post.findUnique({
        where: { id: postId },
        select: { title: true }
      }),
      prisma.user.findUnique({
        where: { id: taggerId },
        select: { name: true }
      })
    ]);

    if (!post) return null;

    return await this.createNotification(
      taggedUserId,
      "POST_TAG",
      taggerId,
      postId,
      undefined,
      {
        postTitle: post.title,
        actorName: tagger?.name
      }
    );
  }

  // 사용자 알림 설정 확인
  private static shouldSendNotification(type: NotificationType, preferences: any): boolean {
    if (!preferences || !preferences.notifications) {
      return true; // 기본값: 모든 알림 허용
    }

    const notifSettings = preferences.notifications;
    
    switch (type) {
      case "FOLLOW":
        return notifSettings.newFollowers !== false;
      case "POST_LIKE":
        return notifSettings.artworkLikes !== false;
      case "COMMENT":
        return notifSettings.comments !== false;
      case "MENTION":
        return notifSettings.mentions !== false;
      case "POST_TAG":
        return notifSettings.artworkLikes !== false; // 태그도 좋아요 설정과 연동
      default:
        return true;
    }
  }

  // 알림 목록 조회 (페이지네이션)
  static async getNotifications(userId: number, cursor?: string, limit = 20) {
    const cursorCondition = cursor ? {
      id: { lt: parseInt(cursor) }
    } : {};

    const notifications = await prisma.notification.findMany({
      where: {
        recipientId: userId,
        ...cursorCondition
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            profileImageUrl: true
          }
        }
      },
      orderBy: { id: 'desc' },
      take: limit + 1
    });

    const hasMore = notifications.length > limit;
    const items = notifications.slice(0, limit);
    const nextCursor = hasMore ? items[items.length - 1]?.id.toString() : null;

    return {
      data: items,
      hasMore,
      nextCursor
    };
  }

  // 알림 읽음 처리
  static async markAsRead(userId: number, notificationIds: number[]) {
    return await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
        recipientId: userId
      },
      data: {
        isRead: true
      }
    });
  }

  // 모든 알림 읽음 처리
  static async markAllAsRead(userId: number) {
    return await prisma.notification.updateMany({
      where: {
        recipientId: userId,
        isRead: false
      },
      data: {
        isRead: true
      }
    });
  }

  // 읽지 않은 알림 개수
  static async getUnreadCount(userId: number): Promise<number> {
    return await prisma.notification.count({
      where: {
        recipientId: userId,
        isRead: false
      }
    });
  }

  // 오래된 알림 정리 (30일 이전)
  static async cleanupOldNotifications() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const result = await prisma.notification.deleteMany({
      where: {
        createdAt: { lt: thirtyDaysAgo }
      }
    });

    console.log(`Cleaned up ${result.count} old notifications`);
    return result;
  }
}