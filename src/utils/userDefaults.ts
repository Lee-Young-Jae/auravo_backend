import { UserPreferences, NotificationSettings } from "../types/user";

// 기본 알림 설정
export const defaultNotificationSettings: NotificationSettings = {
  newFollowers: true,
  artworkLikes: true,
  comments: true,
  mentions: true,
  newsletter: false,
  updates: true,
};

// 기본 사용자 설정
export const defaultUserPreferences: UserPreferences = {
  theme: "system",
  notifications: defaultNotificationSettings,
};

// 새 사용자 생성 시 기본값 반환
export function getDefaultUserData() {
  return {
    preferences: defaultUserPreferences,
    achievements: [],
    socialLinks: {},
  };
}
