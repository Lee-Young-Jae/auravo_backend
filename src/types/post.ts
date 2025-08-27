// 게시글 관련 타입 정의

export interface CreatePostRequest {
  title: string;
  description?: string;
  tags: {
    id?: string;
    name: string;
    color: string;
  }[];
  collection?: string;
  taggedFriends: {
    id: string;
    name: string;
    username: string;
    avatar: string;
    isOnline: boolean;
  }[];
  isPrivate: boolean;
  images: {
    original: string;
    background: string;
    foreground: string;
    thumbnail?: string;
  };
  effect: {
    id: string;
    kind: string;
    label: string;
    params: {
      intensity: number;
      holoCard?: {
        scale: number;
        radius: number;
        maxTilt: number;
      };
      perspective?: number;
    };
  };
}

export interface PostResponse {
  id: number;
  title: string;
  description?: string;
  author: {
    id: number;
    name: string;
    profileImageUrl?: string;
  };
  collection?: {
    id: number;
    name: string;
  };
  isPrivate: boolean;
  images: {
    original: string;
    background: string;
    foreground: string;
    thumbnail?: string;
  };
  effect?: any;
  tags: {
    id: number;
    name: string;
    color: string;
  }[];
  taggedFriends: {
    id: number;
    name: string;
    profileImageUrl?: string;
  }[];
  createdAt: string;
  updatedAt: string;
  stats: {
    likeCount: number;
    bookmarkCount: number;
    commentCount: number;
    viewCount: number;
  };
  isLiked: boolean;
  isBookmarked: boolean;
  isMyPost: boolean;
}

export interface TagResponse {
  id: number;
  name: string;
  color: string;
  postCount?: number;
}

export interface CollectionResponse {
  id: number;
  name: string;
  description?: string;
  isPrivate: boolean;
  postCount: number;
  createdAt: string;
}

export interface FriendSearchResponse {
  id: number;
  name: string;
  username: string;
  avatar?: string;
  isOnline: boolean;
  isFollowing: boolean;
}

export interface HomeFeedRequest {
  limit?: number;
  cursor?: string;
  algorithmWeight?: {
    following: number;
    popular: number;
    recent: number;
    personalized: number;
  };
}

export interface FeedPost {
  id: number;
  title: string;
  description?: string;
  author: {
    id: number;
    name: string;
    profileImageUrl?: string;
    isFollowing: boolean;
  };
  collection?: {
    id: number;
    name: string;
  };
  isPrivate: boolean;
  images: {
    original: string;
    background: string;
    foreground: string;
    thumbnail: string;
  };
  effect?: any;
  tags: {
    id: number;
    name: string;
    color: string;
  }[];
  taggedFriends: {
    id: number;
    name: string;
    profileImageUrl?: string;
  }[];
  stats: {
    likes: number;
    comments: number;
    bookmarks: number;
    views?: number;
  };
  isLiked: boolean;
  isBookmarked: boolean;
  isMyPost: boolean;
  algorithmScore?: number;
  feedReason?:
    | "following"
    | "popular"
    | "tag_interest"
    | "recent"
    | "recommended";
  createdAt: string;
  updatedAt: string;
}

export interface CommentResponse {
  id: number;
  postId: number;
  author: { id: number; name: string; profileImageUrl?: string };
  content: string;
  mentions: { id: number; name: string; profileImageUrl?: string }[];
  isMyComment: boolean;
  isEdited?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommentRequest {
  content: string; // 서버에서 멘션 파싱
  mentions?: { id: number }[]; // 선택: 클라이언트가 식별한 멘션 ID 목록
}

export interface HomeFeedResponse {
  posts: FeedPost[];
  pagination: {
    hasMore: boolean;
    nextCursor?: string;
    totalShown: number;
  };
  algorithmInfo: {
    followingCount: number;
    popularCount: number;
    personalizedCount: number;
    recentCount: number;
  };
}

// 검색 관련 타입들
export interface SearchPostRequest {
  q: string; // 검색어
  limit?: number;
  cursor?: string;
  algorithmWeight?: {
    relevance: number;
    popularity: number;
    recent: number;
  };
}

export interface SearchUserRequest {
  q: string;
  limit?: number;
}

export interface SearchTagRequest {
  q: string;
  limit?: number;
}

export interface SearchUserResponse {
  id: number;
  name: string;
  email: string;
  profileImageUrl?: string;
  bio?: string;
  isFollowing?: boolean;
  followerCount: number;
  followingCount: number;
  postCount: number;
}

export interface SearchTagResponse {
  id: number;
  name: string;
  color: string;
  postCount: number;
  isFollowing?: boolean; // 향후 태그 팔로우 기능용
}

export interface TagPostsResponse {
  tag: {
    id: number;
    name: string;
    color: string;
    postCount: number;
  };
  posts: FeedPost[];
  pagination: {
    hasMore: boolean;
    nextCursor?: string;
    totalShown: number;
  };
}
