import { prisma } from "../config/db";
import { Request, Response, NextFunction } from "express";
import {
  SearchPostRequest,
  SearchUserRequest,
  SearchTagRequest,
  SearchUserResponse,
  SearchTagResponse,
  TagPostsResponse,
  FeedPost,
} from "../types/post";

// 커서 유틸 재사용 (postController.ts와 동일)
const buildCursorCondition = (cursor?: string) => {
  if (!cursor) return {};
  const [iso, idStr] = cursor.split("|");
  const createdAt = new Date(iso);
  const id = parseInt(idStr || "0");
  if (Number.isNaN(createdAt.getTime()) || Number.isNaN(id)) return {};
  return {
    OR: [
      { createdAt: { lt: createdAt } },
      { AND: [{ createdAt: createdAt }, { id: { lt: id } }] },
    ],
  } as any;
};

const makeNextCursor = (post: any) =>
  `${post.createdAt.toISOString()}|${post.id}`;

// 검색어 관련성 점수 계산
const calculateSearchRelevance = (
  post: any,
  searchTerm: string,
  weights: { relevance: number; popularity: number; recent: number }
) => {
  let score = 0;
  const term = searchTerm.toLowerCase();

  // 제목 매칭 (가중치 높음)
  if (post.title.toLowerCase().includes(term)) {
    score += weights.relevance * 100;
    if (post.title.toLowerCase().startsWith(term)) {
      score += weights.relevance * 50; // 시작 매칭 보너스
    }
  }

  // 설명 매칭
  if (post.description?.toLowerCase().includes(term)) {
    score += weights.relevance * 50;
  }

  // 태그 매칭
  const tagMatches =
    post.tags?.filter((tag: any) => tag.tag.name.toLowerCase().includes(term))
      .length || 0;
  score += tagMatches * weights.relevance * 75;

  // 인기도 점수
  const popularityScore =
    (post._count?.likes || 0) * 2 + (post._count?.bookmarks || 0) * 3;
  score += weights.popularity * popularityScore;

  // 최신성 점수
  const hoursAgo =
    (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
  const recencyScore = Math.max(0, 168 - hoursAgo) / 168; // 7일 내에서 가중치
  score += weights.recent * recencyScore * 30;

  return score;
};

// 댓글 수 집계 유틸
const getCommentCountsForPosts = async (postIds: number[]) => {
  if (!postIds || postIds.length === 0) return new Map<number, number>();
  const rows = await (prisma as any).comment.groupBy({
    by: ["postId"],
    where: { postId: { in: postIds }, deletedAt: null as any } as any,
    _count: { _all: true },
  });
  const postIdToCount = new Map<number, number>();
  for (const r of rows as any[])
    postIdToCount.set(r.postId, r._count?._all ?? 0);
  return postIdToCount;
};

// 게시물 검색
export const searchPosts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id; // 비회원 가능
    const {
      q,
      limit = 20,
      cursor,
      algorithmWeight = {
        relevance: 1.0,
        popularity: 0.3,
        recent: 0.5,
      },
    }: SearchPostRequest = req.query as any;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ message: "검색어가 필요합니다" });
    }

    const searchTerm = q.trim();
    const parsedLimit = Math.min(parseInt(String(limit)) || 20, 50);
    const cursorCondition = buildCursorCondition(cursor);

    // 검색 조건: 제목, 설명, 태그명에서 검색
    const searchCondition = {
      OR: [
        { title: { contains: searchTerm } },
        { description: { contains: searchTerm } },
        {
          tags: {
            some: {
              tag: {
                name: { contains: searchTerm },
              },
            },
          },
        },
      ],
    };

    const posts = await prisma.post.findMany({
      where: {
        AND: [
          cursorCondition,
          { deletedAt: null as any },
          { NOT: { isPrivate: true as const } },
          searchCondition,
        ],
      } as any,
      include: {
        author: { select: { id: true, name: true, profileImageUrl: true } },
        collection: { select: { id: true, name: true } },
        photos: {
          select: {
            id: true,
            original: true,
            background: true,
            foreground: true,
            thumbnail: true,
            createdAt: true,
            postId: true,
          },
        },
        tags: { include: { tag: true } },
        taggedFriends: {
          include: {
            user: { select: { id: true, name: true, profileImageUrl: true } },
          },
        },
        _count: { select: { bookmarks: true, likes: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: parsedLimit * 2, // 검색 후 정렬을 위해 많이 가져옴
    });

    // 검색 관련성 점수 계산 및 정렬
    const scoredPosts = posts
      .map((post: any) => ({
        ...post,
        searchScore: calculateSearchRelevance(
          post,
          searchTerm,
          algorithmWeight
        ),
      }))
      .sort((a: any, b: any) => b.searchScore - a.searchScore)
      .slice(0, parsedLimit + 1); // 페이지네이션용

    const items = scoredPosts.slice(0, parsedLimit);
    const hasMore = scoredPosts.length > items.length;

    // 회원인 경우 좋아요/북마크/팔로잉 상태 조회
    let likedIds = new Set<number>();
    let bookmarkedIds = new Set<number>();
    let followingUserIds = new Set<number>();

    if (userId && items.length > 0) {
      const postIds = items.map((p: any) => p.id);
      const authorIds = Array.from(new Set(items.map((p: any) => p.authorId)));

      const [likes, bookmarks, follows] = await Promise.all([
        prisma.postLike.findMany({
          where: { userId, postId: { in: postIds } },
          select: { postId: true },
        }),
        prisma.bookmark.findMany({
          where: { userId, postId: { in: postIds } },
          select: { postId: true },
        }),
        prisma.follow.findMany({
          where: { followerId: userId, followingId: { in: authorIds } },
          select: { followingId: true },
        }),
      ]);

      likedIds = new Set(likes.map((l) => l.postId));
      bookmarkedIds = new Set(bookmarks.map((b) => b.postId));
      followingUserIds = new Set(follows.map((f) => f.followingId));
    }

    // 댓글 수 조회
    const commentCountMap = await getCommentCountsForPosts(
      items.map((p: any) => p.id)
    );

    // 응답 매핑
    const feedPosts: FeedPost[] = items.map((post: any) => ({
      id: post.id,
      title: post.title,
      description: post.description || undefined,
      author: {
        id: post.author.id,
        name: post.author.name,
        profileImageUrl: post.author.profileImageUrl || undefined,
        isFollowing: userId ? followingUserIds.has(post.author.id) : false,
      },
      collection: post.collection || undefined,
      isPrivate: post.isPrivate,
      images: {
        original: post.photos[0]?.original || "",
        background: post.photos[0]?.background || "",
        foreground: post.photos[0]?.foreground || "",
        thumbnail: post.photos[0]?.thumbnail || "",
      },
      effect: post.effect,
      tags:
        post.tags?.map((pt: any) => ({
          id: pt.tag.id,
          name: pt.tag.name,
          color: pt.tag.color,
        })) || [],
      taggedFriends:
        post.taggedFriends?.map((pf: any) => ({
          id: pf.user.id,
          name: pf.user.name,
          profileImageUrl: pf.user.profileImageUrl || undefined,
        })) || [],
      stats: {
        likes: post._count?.likes || 0,
        comments: commentCountMap.get(post.id) || 0,
        bookmarks: post._count?.bookmarks || 0,
        views: (post as any).viewCount ?? 0,
      },
      isLiked: userId ? likedIds.has(post.id) : false,
      isBookmarked: userId ? bookmarkedIds.has(post.id) : false,
      isMyPost: userId ? post.authorId === userId : false,
      algorithmScore: post.searchScore,
      feedReason: "recent",
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    }));

    // 다음 커서는 정렬 전 원본 시간 기준으로 생성
    const nextCursor = hasMore
      ? makeNextCursor(posts[Math.min(posts.length, parsedLimit) - 1])
      : undefined;

    res.json({
      message: "게시물 검색이 완료되었습니다",
      posts: feedPosts,
      pagination: {
        hasMore,
        nextCursor,
        totalShown: feedPosts.length,
      },
      searchTerm,
    });
  } catch (err) {
    next(err);
  }
};

// 사용자 검색
export const searchUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const viewerId = req.user?.id; // 비회원 가능
    const { q, limit = 20 }: SearchUserRequest = req.query as any;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ message: "검색어가 필요합니다" });
    }

    const searchTerm = q.trim();
    const parsedLimit = Math.min(parseInt(String(limit)) || 20, 50);

    // 사용자 검색: 이름, 이메일에서 검색
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: searchTerm } },
          { email: { contains: searchTerm } },
        ],
      },
      include: {
        _count: {
          select: {
            followers: true,
            followings: true,
            posts: { where: { deletedAt: null } },
          },
        },
      },
      take: parsedLimit,
      orderBy: {
        followers: { _count: "desc" }, // 팔로워 수 기준 정렬
      },
    });

    // 팔로잉 상태 확인 (회원인 경우)
    let followingIds = new Set<number>();
    if (viewerId && users.length > 0) {
      const userIds = users.map((u) => u.id);
      const follows = await prisma.follow.findMany({
        where: { followerId: viewerId, followingId: { in: userIds } },
        select: { followingId: true },
      });
      followingIds = new Set(follows.map((f) => f.followingId));
    }

    const response: SearchUserResponse[] = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      profileImageUrl: user.profileImageUrl || undefined,
      bio: user.bio || undefined,
      isFollowing: viewerId ? followingIds.has(user.id) : undefined,
      followerCount: user._count.followers,
      followingCount: user._count.followings,
      postCount: user._count.posts,
    }));

    res.json({
      message: "사용자 검색이 완료되었습니다",
      users: response,
      searchTerm,
      totalShown: response.length,
    });
  } catch (err) {
    next(err);
  }
};

// 태그 검색
export const searchTags = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { q, limit = 20 }: SearchTagRequest = req.query as any;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ message: "검색어가 필요합니다" });
    }

    const searchTerm = q.trim();
    const parsedLimit = Math.min(parseInt(String(limit)) || 20, 50);

    // 태그 검색
    const tags = await prisma.tag.findMany({
      where: {
        name: { contains: searchTerm },
      },
      include: {
        _count: {
          select: {
            posts: {
              where: {
                post: {
                  deletedAt: null,
                  isPrivate: false,
                },
              },
            },
          },
        },
      },
      orderBy: {
        posts: { _count: "desc" }, // 게시물 수 기준 정렬
      },
      take: parsedLimit,
    });

    const response: SearchTagResponse[] = tags
      .filter((tag) => tag._count.posts > 0) // 게시물이 있는 태그만
      .map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        postCount: tag._count.posts,
        isFollowing: false, // 향후 태그 팔로우 기능용
      }));

    res.json({
      message: "태그 검색이 완료되었습니다",
      tags: response,
      searchTerm,
      totalShown: response.length,
    });
  } catch (err) {
    next(err);
  }
};

// 특정 태그의 게시물 조회
export const getTagPosts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id; // 비회원 가능
    const { tagId } = req.params;
    const { limit = 20, cursor } = req.query as any;

    const tagIdNum = parseInt(tagId);
    if (isNaN(tagIdNum)) {
      return res.status(400).json({ message: "유효하지 않은 태그 ID입니다" });
    }

    const parsedLimit = Math.min(parseInt(String(limit)) || 20, 50);
    const cursorCondition = buildCursorCondition(cursor);

    // 태그 정보 조회
    const tag = await prisma.tag.findUnique({
      where: { id: tagIdNum },
      include: {
        _count: {
          select: {
            posts: {
              where: {
                post: {
                  deletedAt: null,
                  isPrivate: false,
                },
              },
            },
          },
        },
      },
    });

    if (!tag) {
      return res.status(404).json({ message: "태그를 찾을 수 없습니다" });
    }

    // 해당 태그의 게시물 조회
    const posts = await prisma.post.findMany({
      where: {
        AND: [
          cursorCondition,
          { deletedAt: null as any },
          { NOT: { isPrivate: true as const } },
          {
            tags: {
              some: {
                tagId: tagIdNum,
              },
            },
          },
        ],
      } as any,
      include: {
        author: { select: { id: true, name: true, profileImageUrl: true } },
        collection: { select: { id: true, name: true } },
        photos: {
          select: {
            id: true,
            original: true,
            background: true,
            foreground: true,
            thumbnail: true,
            createdAt: true,
            postId: true,
          },
        },
        tags: { include: { tag: true } },
        taggedFriends: {
          include: {
            user: { select: { id: true, name: true, profileImageUrl: true } },
          },
        },
        _count: { select: { bookmarks: true, likes: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: parsedLimit + 1,
    });

    const items = posts.slice(0, parsedLimit);
    const hasMore = posts.length > items.length;

    // 회원인 경우 좋아요/북마크/팔로잉 상태 조회
    let likedIds = new Set<number>();
    let bookmarkedIds = new Set<number>();
    let followingUserIds = new Set<number>();

    if (userId && items.length > 0) {
      const postIds = items.map((p: any) => p.id);
      const authorIds = Array.from(new Set(items.map((p: any) => p.authorId)));

      const [likes, bookmarks, follows] = await Promise.all([
        prisma.postLike.findMany({
          where: { userId, postId: { in: postIds } },
          select: { postId: true },
        }),
        prisma.bookmark.findMany({
          where: { userId, postId: { in: postIds } },
          select: { postId: true },
        }),
        prisma.follow.findMany({
          where: { followerId: userId, followingId: { in: authorIds } },
          select: { followingId: true },
        }),
      ]);

      likedIds = new Set(likes.map((l) => l.postId));
      bookmarkedIds = new Set(bookmarks.map((b) => b.postId));
      followingUserIds = new Set(follows.map((f) => f.followingId));
    }

    // 댓글 수 조회
    const commentCountMap = await getCommentCountsForPosts(
      items.map((p: any) => p.id)
    );

    // 응답 매핑
    const feedPosts: FeedPost[] = items.map((post: any) => ({
      id: post.id,
      title: post.title,
      description: post.description || undefined,
      author: {
        id: post.author.id,
        name: post.author.name,
        profileImageUrl: post.author.profileImageUrl || undefined,
        isFollowing: userId ? followingUserIds.has(post.author.id) : false,
      },
      collection: post.collection || undefined,
      isPrivate: post.isPrivate,
      images: {
        original: post.photos[0]?.original || "",
        background: post.photos[0]?.background || "",
        foreground: post.photos[0]?.foreground || "",
        thumbnail: post.photos[0]?.thumbnail || "",
      },
      effect: post.effect,
      tags:
        post.tags?.map((pt: any) => ({
          id: pt.tag.id,
          name: pt.tag.name,
          color: pt.tag.color,
        })) || [],
      taggedFriends:
        post.taggedFriends?.map((pf: any) => ({
          id: pf.user.id,
          name: pf.user.name,
          profileImageUrl: pf.user.profileImageUrl || undefined,
        })) || [],
      stats: {
        likes: post._count?.likes || 0,
        comments: commentCountMap.get(post.id) || 0,
        bookmarks: post._count?.bookmarks || 0,
        views: (post as any).viewCount ?? 0,
      },
      isLiked: userId ? likedIds.has(post.id) : false,
      isBookmarked: userId ? bookmarkedIds.has(post.id) : false,
      isMyPost: userId ? post.authorId === userId : false,
      feedReason: "tag_interest",
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    }));

    const nextCursor = hasMore
      ? makeNextCursor(items[items.length - 1])
      : undefined;

    const response: TagPostsResponse = {
      tag: {
        id: tag.id,
        name: tag.name,
        color: tag.color,
        postCount: tag._count.posts,
      },
      posts: feedPosts,
      pagination: {
        hasMore,
        nextCursor,
        totalShown: feedPosts.length,
      },
    };

    res.json({
      message: "태그 게시물을 성공적으로 조회했습니다",
      ...response,
    });
  } catch (err) {
    next(err);
  }
};
