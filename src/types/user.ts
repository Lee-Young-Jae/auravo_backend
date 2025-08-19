// 사용자 소셜 링크 타입
export interface SocialLinks {
  instagram?: string;
  twitter?: string;
}

// 알림 설정 타입
export interface NotificationSettings {
  newFollowers: boolean;
  artworkLikes: boolean;
  comments: boolean;
  mentions: boolean;
  newsletter: boolean;
  updates: boolean;
}

// 사용자 설정 타입
export interface UserPreferences {
  theme?: "light" | "dark" | "system";
  notifications?: NotificationSettings;
}

// 완전한 사용자 프로필 타입
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  bio?: string;
  location?: string;
  website?: string;
  socialLinks?: SocialLinks;
  profileImage?: string; // DB에서는 profileImageUrl
  achievements?: string[];
  preferences?: UserPreferences;
}

// 공개 사용자 프로필 타입 (다른 사용자가 볼 수 있는 정보)
export interface PublicUserProfile {
  id: string;
  name: string;
  bio?: string;
  location?: string;
  website?: string;
  socialLinks?: SocialLinks;
  profileImage?: string;
  achievements?: string[];
  createdAt: Date;
  _count: {
    posts: number;
    followers: number;
    followings: number;
  };
}

// 내 프로필 타입 (본인만 볼 수 있는 모든 정보)
export interface MyProfile extends UserProfile {
  email: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    posts: number;
    followers: number;
    followings: number;
    bookmarks: number;
  };
}
