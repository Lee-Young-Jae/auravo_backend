import { prisma } from "../config/db";
import { Request, Response, NextFunction } from "express";
import {
  CreatePostRequest,
  PostResponse,
  TagResponse,
  CollectionResponse,
  FriendSearchResponse,
  HomeFeedRequest,
  HomeFeedResponse,
  FeedPost,
  CommentResponse,
  CreateCommentRequest,
} from "../types/post";
import { toPrismaJson } from "../utils/jsonHelpers";

// 커서 유틸: "<iso>|<id>" 형식 사용
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

// 게시글 생성
export const createPost = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }

    const {
      title,
      description,
      tags,
      collection,
      taggedFriends,
      isPrivate,
      images,
      effect,
    }: CreatePostRequest = req.body;

    // 필수 필드 검증
    if (
      !title ||
      !images?.original ||
      !images?.background ||
      !images?.foreground
    ) {
      return res.status(400).json({
        message: "제목과 이미지 정보는 필수입니다",
      });
    }

    // 컬렉션 존재 여부 확인 (제공된 경우)
    let collectionId: number | null = null;
    if (collection) {
      const existingCollection = await prisma.collection.findFirst({
        where: {
          id: parseInt(collection),
          ownerId: userId,
        },
      });
      if (!existingCollection) {
        return res.status(400).json({ message: "존재하지 않는 컬렉션입니다" });
      }
      collectionId = existingCollection.id;
    }

    // 트랜잭션으로 게시글 생성
    const result = await prisma.$transaction(async (tx) => {
      // 1. 게시글 생성
      const post = await tx.post.create({
        data: {
          title,
          description,
          authorId: userId,
          collectionId,
          isPrivate: isPrivate || false,
          effect: effect ? toPrismaJson(effect) : null,
        },
      });

      // 2. 이미지 생성
      await tx.photo.create({
        data: {
          postId: post.id,
          original: images.original,
          background: images.background,
          foreground: images.foreground,
          thumbnail: images.thumbnail ?? images.original,
        },
      });

      // 3. 태그 처리
      if (tags && tags.length > 0) {
        for (const tag of tags) {
          // 기존 태그 찾기 또는 새로 생성
          const existingTag = await tx.tag.findUnique({
            where: { name: tag.name },
          });

          let tagId: number;
          if (existingTag) {
            tagId = existingTag.id;
          } else {
            const newTag = await tx.tag.create({
              data: {
                name: tag.name,
                color: tag.color,
              },
            });
            tagId = newTag.id;
          }

          // 게시글-태그 관계 생성
          await tx.postTag.create({
            data: {
              postId: post.id,
              tagId,
            },
          });
        }
      }

      // 4. 태그된 친구들 처리
      if (taggedFriends && taggedFriends.length > 0) {
        for (const friend of taggedFriends) {
          const friendUser = await tx.user.findUnique({
            where: { id: parseInt(friend.id) },
          });

          if (friendUser) {
            await tx.postFriend.create({
              data: {
                postId: post.id,
                userId: friendUser.id,
              },
            });
          }
        }
      }

      return post;
    });

    // 생성된 게시글 조회 (관계 데이터 포함)
    const createdPost = await prisma.post.findUnique({
      where: { id: result.id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            profileImageUrl: true,
          },
        },
        collection: {
          select: {
            id: true,
            name: true,
          },
        },
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
        tags: {
          include: {
            tag: true,
          },
        },
        taggedFriends: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                profileImageUrl: true,
              },
            },
          },
        },
      },
    });

    if (!createdPost) {
      return res.status(500).json({ message: "게시글 생성에 실패했습니다" });
    }

    // 응답 데이터 구성
    const response: PostResponse = {
      id: createdPost.id,
      title: createdPost.title,
      description: createdPost.description || undefined,
      author: {
        id: createdPost.author.id,
        name: createdPost.author.name,
        profileImageUrl: createdPost.author.profileImageUrl || undefined,
      },
      collection: createdPost.collection || undefined,
      isPrivate: createdPost.isPrivate,
      images: {
        original: createdPost.photos[0]?.original || "",
        background: createdPost.photos[0]?.background || "",
        foreground: createdPost.photos[0]?.foreground || "",
        thumbnail: createdPost.photos[0]?.thumbnail || "",
      },
      effect: createdPost.effect,
      tags: createdPost.tags.map((pt) => ({
        id: pt.tag.id,
        name: pt.tag.name,
        color: pt.tag.color,
      })),
      taggedFriends: createdPost.taggedFriends.map((pf) => ({
        id: pf.user.id,
        name: pf.user.name,
        profileImageUrl: pf.user.profileImageUrl || undefined,
      })),
      createdAt: createdPost.createdAt.toISOString(),
      updatedAt: createdPost.updatedAt.toISOString(),
    };

    res.status(201).json({
      message: "게시글이 성공적으로 생성되었습니다",
      post: response,
    });
  } catch (err) {
    next(err);
  }
};

// 게시글 수정
export const updatePost = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { postId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }

    const postIdNum = parseInt(postId);
    if (isNaN(postIdNum)) {
      return res.status(400).json({ message: "유효하지 않은 게시글 ID입니다" });
    }

    // 게시글 확인 및 권한 체크
    const existing = await prisma.post.findUnique({ where: { id: postIdNum } });
    if (!existing || (existing as any).deletedAt) {
      return res.status(404).json({ message: "게시글을 찾을 수 없습니다" });
    }
    if (existing.authorId !== userId) {
      return res.status(403).json({ message: "수정 권한이 없습니다" });
    }

    const { title, description, isPrivate, collection, tags } =
      req.body as Partial<CreatePostRequest> & {
        isPrivate?: boolean;
        collection?: string;
      };

    // 컬렉션 체크
    let collectionId: number | null | undefined = undefined;
    if (collection !== undefined) {
      if (collection === null || collection === "") {
        collectionId = null;
      } else {
        const col = await prisma.collection.findFirst({
          where: { id: parseInt(String(collection)), ownerId: userId },
        });
        if (!col) {
          return res
            .status(400)
            .json({ message: "존재하지 않는 컬렉션입니다" });
        }
        collectionId = col.id;
      }
    }

    await prisma.$transaction(async (tx) => {
      // 게시글 기본 정보 업데이트
      await tx.post.update({
        where: { id: postIdNum },
        data: {
          title: title !== undefined ? title : undefined,
          description: description !== undefined ? description : undefined,
          isPrivate: isPrivate !== undefined ? isPrivate : undefined,
          collectionId: collectionId !== undefined ? collectionId : undefined,
        } as any,
      });

      // 이미지/효과 업데이트는 허용하지 않음

      // 태그 업데이트 (전량 교체)
      if (tags) {
        await tx.postTag.deleteMany({ where: { postId: postIdNum } });
        if (tags.length > 0) {
          for (const tag of tags) {
            const existingTag = await tx.tag.findUnique({
              where: { name: tag.name },
            });
            let tagId: number;
            if (existingTag) {
              tagId = existingTag.id;
            } else {
              const newTag = await tx.tag.create({
                data: { name: tag.name, color: tag.color },
              });
              tagId = newTag.id;
            }
            await tx.postTag.create({
              data: { postId: postIdNum, tagId },
            });
          }
        }
      }
    });

    // 수정된 게시글 조회 및 응답
    const updated = await prisma.post.findUnique({
      where: { id: postIdNum },
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
      },
    });

    if (!updated) {
      return res.status(500).json({ message: "게시글 수정에 실패했습니다" });
    }

    const response: PostResponse = {
      id: updated.id,
      title: updated.title,
      description: updated.description || undefined,
      author: {
        id: updated.author.id,
        name: updated.author.name,
        profileImageUrl: updated.author.profileImageUrl || undefined,
      },
      collection: updated.collection || undefined,
      isPrivate: updated.isPrivate,
      images: {
        original: updated.photos[0]?.original || "",
        background: updated.photos[0]?.background || "",
        foreground: updated.photos[0]?.foreground || "",
        thumbnail: updated.photos[0]?.thumbnail || "",
      },
      effect: updated.effect,
      tags:
        updated.tags?.map((pt: any) => ({
          id: pt.tag.id,
          name: pt.tag.name,
          color: pt.tag.color,
        })) || [],
      taggedFriends:
        updated.taggedFriends?.map((pf: any) => ({
          id: pf.user.id,
          name: pf.user.name,
          profileImageUrl: pf.user.profileImageUrl || undefined,
        })) || [],
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };

    res.json({ message: "게시글이 수정되었습니다", post: response });
  } catch (err) {
    next(err);
  }
};

// 게시글 삭제(소프트 삭제)
export const deletePost = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { postId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }

    const postIdNum = parseInt(postId);
    if (isNaN(postIdNum)) {
      return res.status(400).json({ message: "유효하지 않은 게시글 ID입니다" });
    }

    const post = await prisma.post.findUnique({ where: { id: postIdNum } });
    if (!post || (post as any).deletedAt) {
      return res.status(404).json({ message: "게시글을 찾을 수 없습니다" });
    }
    if (post.authorId !== userId) {
      return res.status(403).json({ message: "삭제 권한이 없습니다" });
    }

    await prisma.post.update({
      where: { id: postIdNum },
      data: { deletedAt: new Date() } as any,
    });

    res.json({ message: "게시글이 삭제되었습니다" });
  } catch (err) {
    next(err);
  }
};
// 팔로워 친구 검색
export const searchFollowingFriends = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }

    const { query = "", limit = 10 } = req.query;
    const searchQuery = query as string;
    const limitNum = Math.min(parseInt(limit as string) || 10, 50); // 최대 50명

    // 팔로잉 중인 사용자들 중에서 검색
    const friends = await prisma.user.findMany({
      where: {
        AND: [
          {
            followers: {
              some: {
                followerId: userId,
              },
            },
          },
          searchQuery
            ? {
                OR: [
                  { name: { contains: searchQuery } },
                  { email: { contains: searchQuery } },
                ],
              }
            : {},
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        profileImageUrl: true,
      },
      take: limitNum,
    });

    const response: FriendSearchResponse[] = friends.map((friend) => ({
      id: friend.id,
      name: friend.name,
      username: `@${friend.email.split("@")[0]}`, // 임시로 이메일에서 username 생성
      avatar: friend.profileImageUrl || undefined,
      isOnline: Math.random() > 0.5, // 임시로 랜덤 온라인 상태
      isFollowing: true, // 팔로잉 중인 사용자들만 검색하므로 항상 true
    }));

    res.json({
      message: "친구 목록을 성공적으로 조회했습니다",
      friends: response,
    });
  } catch (err) {
    next(err);
  }
};

// 내 컬렉션 목록 조회
export const getMyCollections = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }

    const collections = await prisma.collection.findMany({
      where: {
        ownerId: userId,
      },
      include: {
        _count: {
          select: {
            posts: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const response: CollectionResponse[] = collections.map((collection) => ({
      id: collection.id,
      name: collection.name,
      description: collection.description || undefined,
      isPrivate: collection.isPrivate,
      postCount: collection._count.posts,
      createdAt: collection.createdAt.toISOString(),
    }));

    res.json({
      message: "컬렉션 목록을 성공적으로 조회했습니다",
      collections: response,
    });
  } catch (err) {
    next(err);
  }
};

// 인기 태그 목록 조회
export const getPopularTags = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { limit = 20 } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 20, 100); // 최대 100개

    // 태그별 게시글 수를 계산하여 인기 태그 조회
    const popularTags = await prisma.tag.findMany({
      include: {
        _count: {
          select: {
            posts: true,
          },
        },
      },
      orderBy: {
        posts: {
          _count: "desc",
        },
      },
      take: limitNum,
    });

    const response: TagResponse[] = popularTags
      .filter((tag) => tag._count.posts > 0) // 게시글이 있는 태그만
      .map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        postCount: tag._count.posts,
      }));

    res.json({
      message: "인기 태그 목록을 성공적으로 조회했습니다",
      tags: response,
    });
  } catch (err) {
    next(err);
  }
};

// 컬렉션 생성
export const createCollection = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }

    const { name, description, isPrivate = false } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ message: "컬렉션 이름은 필수입니다" });
    }

    // 같은 사용자의 컬렉션 이름 중복 확인
    const existingCollection = await prisma.collection.findFirst({
      where: {
        name: name.trim(),
        ownerId: userId,
      },
    });

    if (existingCollection) {
      return res
        .status(400)
        .json({ message: "이미 같은 이름의 컬렉션이 있습니다" });
    }

    const collection = await prisma.collection.create({
      data: {
        name: name.trim(),
        description: description?.trim(),
        isPrivate,
        ownerId: userId,
      },
      include: {
        _count: {
          select: {
            posts: true,
          },
        },
      },
    });

    const response: CollectionResponse = {
      id: collection.id,
      name: collection.name,
      description: collection.description || undefined,
      isPrivate: collection.isPrivate,
      postCount: collection._count.posts,
      createdAt: collection.createdAt.toISOString(),
    };

    res.status(201).json({
      message: "컬렉션이 성공적으로 생성되었습니다",
      collection: response,
    });
  } catch (err) {
    next(err);
  }
};

// 게시글 좋아요
export const likePost = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { postId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }

    const postIdNum = parseInt(postId);
    if (isNaN(postIdNum)) {
      return res.status(400).json({ message: "유효하지 않은 게시글 ID입니다" });
    }

    // 게시글 존재 확인
    const post = await prisma.post.findUnique({ where: { id: postIdNum } });
    if (!post) {
      return res.status(404).json({ message: "게시글을 찾을 수 없습니다" });
    }

    // 이미 좋아요 여부 확인 (idemponent)
    const existing = await prisma.postLike.findUnique({
      where: { userId_postId: { userId, postId: postIdNum } },
    });
    if (existing) {
      return res
        .status(200)
        .json({ message: "이미 좋아요했습니다", liked: true });
    }

    await prisma.postLike.create({ data: { userId, postId: postIdNum } });

    return res.status(201).json({ message: "좋아요했습니다", liked: true });
  } catch (err) {
    next(err);
  }
};

// 게시글 좋아요 취소
export const unlikePost = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { postId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }

    const postIdNum = parseInt(postId);
    if (isNaN(postIdNum)) {
      return res.status(400).json({ message: "유효하지 않은 게시글 ID입니다" });
    }

    await prisma.postLike.deleteMany({ where: { userId, postId: postIdNum } });

    return res
      .status(200)
      .json({ message: "좋아요를 취소했습니다", liked: false });
  } catch (err) {
    next(err);
  }
};

// 게시글 북마크
export const bookmarkPost = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { postId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }

    const postIdNum = parseInt(postId);
    if (isNaN(postIdNum)) {
      return res.status(400).json({ message: "유효하지 않은 게시글 ID입니다" });
    }

    // 게시글 존재 확인
    const post = await prisma.post.findUnique({ where: { id: postIdNum } });
    if (!post) {
      return res.status(404).json({ message: "게시글을 찾을 수 없습니다" });
    }

    // 이미 북마크 여부 확인 (idempotent)
    const existing = await prisma.bookmark.findUnique({
      where: { userId_postId: { userId, postId: postIdNum } },
    });
    if (existing) {
      return res
        .status(200)
        .json({ message: "이미 북마크했습니다", bookmarked: true });
    }

    await prisma.bookmark.create({ data: { userId, postId: postIdNum } });

    return res
      .status(201)
      .json({ message: "북마크했습니다", bookmarked: true });
  } catch (err) {
    next(err);
  }
};

// 게시글 북마크 취소
export const unbookmarkPost = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { postId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }

    const postIdNum = parseInt(postId);
    if (isNaN(postIdNum)) {
      return res.status(400).json({ message: "유효하지 않은 게시글 ID입니다" });
    }

    await prisma.bookmark.deleteMany({ where: { userId, postId: postIdNum } });

    return res
      .status(200)
      .json({ message: "북마크를 취소했습니다", bookmarked: false });
  } catch (err) {
    next(err);
  }
};

// 특정 유저의 게시글 목록 조회 (프로필 페이지)
export const getUserPosts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const viewerId = req.user?.id; // 비회원 가능
    const { userId } = req.params;
    const { limit = 20, cursor } = req.query as {
      limit?: string;
      cursor?: string;
    };

    const targetUserId = parseInt(userId);
    if (isNaN(targetUserId)) {
      return res.status(400).json({ message: "유효하지 않은 사용자 ID입니다" });
    }

    const parsedLimit = Math.min(parseInt(String(limit)) || 20, 50);
    const cursorCondition = buildCursorCondition(cursor);

    // 본인 여부 판별
    const isSelf = viewerId === targetUserId;

    // 작성자 팔로우 여부 (회원인 경우만)
    let isFollowingAuthor = false;
    if (viewerId) {
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: viewerId,
            followingId: targetUserId,
          },
        },
      });
      isFollowingAuthor = !!follow;
    }

    // 게시글 조회 (작성자 필터 + 공개/비공개 정책)
    const posts = await prisma.post.findMany({
      where: {
        AND: [
          cursorCondition,
          { deletedAt: null },
          { authorId: targetUserId },
          isSelf
            ? {}
            : {
                NOT: { isPrivate: true as const },
              },
        ],
      },
      include: {
        author: {
          select: { id: true, name: true, profileImageUrl: true },
        },
        collection: { select: { id: true, name: true } },
        photos: true,
        tags: { include: { tag: true } },
        taggedFriends: {
          include: {
            user: { select: { id: true, name: true, profileImageUrl: true } },
          },
        },
        _count: { select: { bookmarks: true, likes: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: parsedLimit + 1, // +1로 hasMore 계산
    });

    // 회원이라면 좋아요/북마크 상태 일괄 조회
    let likedIds = new Set<number>();
    let bookmarkedIds = new Set<number>();
    if (viewerId && posts.length > 0) {
      const ids = posts.map((p) => p.id);
      const [likes, bookmarks] = await Promise.all([
        prisma.postLike.findMany({
          where: { userId: viewerId, postId: { in: ids } },
          select: { postId: true },
        }),
        prisma.bookmark.findMany({
          where: { userId: viewerId, postId: { in: ids } },
          select: { postId: true },
        }),
      ]);
      likedIds = new Set(likes.map((l) => l.postId));
      bookmarkedIds = new Set(bookmarks.map((b) => b.postId));
    }

    // 페이지네이션 처리 + 댓글수 병합
    const items = posts.slice(0, parsedLimit);

    const hasMore = posts.length > items.length;
    const nextCursor = hasMore ? String(items[items.length - 1].id) : undefined;

    // 응답 매핑 (FeedPost 재사용)
    const results: FeedPost[] = items.map((post: any) => ({
      id: post.id,
      title: post.title,
      description: post.description || undefined,
      author: {
        id: post.author.id,
        name: post.author.name,
        profileImageUrl: post.author.profileImageUrl || undefined,
        isFollowing: isFollowingAuthor,
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
        comments: post._count?.comments || 0,
        bookmarks: post._count?.bookmarks || 0,
        views: post.viewCount,
      },
      isLiked: viewerId ? likedIds.has(post.id) : false,
      isBookmarked: viewerId ? bookmarkedIds.has(post.id) : false,
      isMyPost: viewerId ? post.authorId === viewerId : false,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    }));

    res.json({
      posts: results,
      pagination: {
        hasMore,
        nextCursor,
        totalShown: results.length,
      },
    });
  } catch (err) {
    next(err);
  }
};

// 특정 유저가 태그된 게시글 목록 조회 (프로필 탭: Tagged)
export const getTaggedPosts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const viewerId = req.user?.id; // 비회원 가능
    const { userId } = req.params;
    const { limit = 20, cursor } = req.query as {
      limit?: string;
      cursor?: string;
    };

    const targetUserId = parseInt(userId);
    if (isNaN(targetUserId)) {
      return res.status(400).json({ message: "유효하지 않은 사용자 ID입니다" });
    }

    const parsedLimit = Math.min(parseInt(String(limit)) || 20, 50);
    const cursorCondition = cursor ? { id: { lt: parseInt(cursor) } } : {};

    // 공개/비공개 정책: 비회원/타인 → 공개글만, viewer가 해당 게시글 작성자이면 비공개 허용
    const privacyFilter = viewerId
      ? {
          OR: [{ isPrivate: false as const }, { authorId: viewerId }],
        }
      : { NOT: { isPrivate: true as const } };

    const posts = await prisma.post.findMany({
      where: {
        AND: [
          cursorCondition,
          { deletedAt: null as any },
          privacyFilter,
          {
            taggedFriends: {
              some: { userId: targetUserId },
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
      orderBy: { createdAt: "desc" },
      take: parsedLimit + 1,
    });

    // 회원이라면 좋아요/북마크 상태 일괄 조회
    let likedIds = new Set<number>();
    let bookmarkedIds = new Set<number>();
    if (viewerId && posts.length > 0) {
      const ids = posts.map((p) => p.id);
      const [likes, bookmarks] = await Promise.all([
        prisma.postLike.findMany({
          where: { userId: viewerId, postId: { in: ids } },
          select: { postId: true },
        }),
        prisma.bookmark.findMany({
          where: { userId: viewerId, postId: { in: ids } },
          select: { postId: true },
        }),
      ]);
      likedIds = new Set(likes.map((l) => l.postId));
      bookmarkedIds = new Set(bookmarks.map((b) => b.postId));
    }

    const items = posts.slice(0, parsedLimit);
    const hasMore = posts.length > items.length;
    const nextCursor = hasMore ? String(items[items.length - 1].id) : undefined;

    const results: FeedPost[] = items.map((post: any) => ({
      id: post.id,
      title: post.title,
      description: post.description || undefined,
      author: {
        id: post.author.id,
        name: post.author.name,
        profileImageUrl: post.author.profileImageUrl || undefined,
        isFollowing: false, // 작성자 팔로우 여부는 탭 중요도 낮아 제외(원하면 조회 가능)
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
        comments: post._count?.comments || 0,
        bookmarks: post._count?.bookmarks || 0,
        views: (post as any).viewCount ?? 0,
      },
      isLiked: viewerId ? likedIds.has(post.id) : false,
      isBookmarked: viewerId ? bookmarkedIds.has(post.id) : false,
      isMyPost: viewerId ? post.authorId === viewerId : false,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    }));

    res.json({
      posts: results,
      pagination: { hasMore, nextCursor, totalShown: results.length },
    });
  } catch (err) {
    next(err);
  }
};

// 특정 유저의 컬렉션 목록 조회 (프로필 탭: Collections)
export const getUserCollections = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const viewerId = req.user?.id; // 비회원 가능
    const { userId } = req.params;
    const { limit = 20, cursor } = req.query as {
      limit?: string;
      cursor?: string;
    };

    const targetUserId = parseInt(userId);
    if (isNaN(targetUserId)) {
      return res.status(400).json({ message: "유효하지 않은 사용자 ID입니다" });
    }

    const parsedLimit = Math.min(parseInt(String(limit)) || 20, 50);
    const cursorCondition = cursor ? { id: { lt: parseInt(cursor) } } : {};
    const isSelf = viewerId === targetUserId;

    const collections = await prisma.collection.findMany({
      where: {
        AND: [
          cursorCondition,
          { ownerId: targetUserId },
          isSelf ? {} : { NOT: { isPrivate: true as const } },
        ],
      },
      include: {
        _count: { select: { posts: true } },
      },
      orderBy: { createdAt: "desc" },
      take: parsedLimit + 1,
    });

    const items = collections.slice(0, parsedLimit);
    const hasMore = collections.length > items.length;
    const nextCursor = hasMore ? String(items[items.length - 1].id) : undefined;

    const results: CollectionResponse[] = items.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description || undefined,
      isPrivate: c.isPrivate,
      postCount: c._count.posts,
      createdAt: c.createdAt.toISOString(),
    }));

    res.json({
      collections: results,
      pagination: { hasMore, nextCursor, totalShown: results.length },
    });
  } catch (err) {
    next(err);
  }
};

// 컬렉션의 게시글 목록 조회
export const getCollectionPosts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const viewerId = req.user?.id; // 비회원 가능
    const { collectionId } = req.params;
    const { limit = 20, cursor } = req.query as {
      limit?: string;
      cursor?: string;
    };

    const colId = parseInt(collectionId);
    if (isNaN(colId)) {
      return res.status(400).json({ message: "유효하지 않은 컬렉션 ID입니다" });
    }

    // 컬렉션 존재/권한 확인
    const collection = await prisma.collection.findUnique({
      where: { id: colId },
      select: { id: true, ownerId: true, isPrivate: true, name: true },
    });
    if (!collection) {
      return res.status(404).json({ message: "컬렉션을 찾을 수 없습니다" });
    }
    if (collection.isPrivate && collection.ownerId !== viewerId) {
      return res.status(403).json({ message: "비공개 컬렉션입니다" });
    }

    const parsedLimit = Math.min(parseInt(String(limit)) || 20, 50);
    const cursorCondition = cursor ? { id: { lt: parseInt(cursor) } } : {};

    // 게시글 공개 정책
    const postPrivacyFilter =
      collection.ownerId === viewerId
        ? {}
        : {
            OR: [
              { isPrivate: false as const },
              viewerId ? { authorId: viewerId } : {},
            ],
          };

    const posts = await prisma.post.findMany({
      where: {
        AND: [
          cursorCondition,
          { deletedAt: null as any },
          { collectionId: colId },
          postPrivacyFilter,
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
      orderBy: { createdAt: "desc" },
      take: parsedLimit + 1,
    });

    // 좋아요/북마크 상태
    let likedIds = new Set<number>();
    let bookmarkedIds = new Set<number>();
    if (viewerId && posts.length > 0) {
      const ids = posts.map((p) => p.id);
      const [likes, bookmarks] = await Promise.all([
        prisma.postLike.findMany({
          where: { userId: viewerId, postId: { in: ids } },
          select: { postId: true },
        }),
        prisma.bookmark.findMany({
          where: { userId: viewerId, postId: { in: ids } },
          select: { postId: true },
        }),
      ]);
      likedIds = new Set(likes.map((l) => l.postId));
      bookmarkedIds = new Set(bookmarks.map((b) => b.postId));
    }

    const items = posts.slice(0, parsedLimit);
    const hasMore = posts.length > items.length;
    const nextCursor = hasMore ? String(items[items.length - 1].id) : undefined;

    const results: FeedPost[] = items.map((post: any) => ({
      id: post.id,
      title: post.title,
      description: post.description || undefined,
      author: {
        id: post.author.id,
        name: post.author.name,
        profileImageUrl: post.author.profileImageUrl || undefined,
        isFollowing: false,
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
        comments: post._count?.comments || 0,
        bookmarks: post._count?.bookmarks || 0,
        views: (post as any).viewCount ?? 0,
      },
      isLiked: viewerId ? likedIds.has(post.id) : false,
      isBookmarked: viewerId ? bookmarkedIds.has(post.id) : false,
      isMyPost: viewerId ? post.authorId === viewerId : false,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    }));

    res.json({
      collection: { id: collection.id, name: collection.name },
      posts: results,
      pagination: { hasMore, nextCursor, totalShown: results.length },
    });
  } catch (err) {
    next(err);
  }
};

// 사용자의 태그 선호도 분석
const getUserTagPreferences = async (userId: number) => {
  // 사용자가 북마크한 게시글들의 태그를 분석하여 선호도 계산
  const bookmarkedTags = await prisma.tag.findMany({
    where: {
      posts: {
        some: {
          post: {
            bookmarks: {
              some: {
                userId,
              },
            },
          },
        },
      },
    },
    include: {
      _count: {
        select: {
          posts: {
            where: {
              post: {
                bookmarks: {
                  some: {
                    userId,
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  // 태그별 선호도 점수 반환 (북마크한 횟수 기반)
  return bookmarkedTags.reduce((acc, tag) => {
    acc[tag.id] = tag._count.posts;
    return acc;
  }, {} as Record<number, number>);
};

// 게시글 알고리즘 점수 계산
const calculatePostScore = (
  post: any,
  userId: number,
  isFollowing: boolean,
  tagPreferences: Record<number, number>,
  weights: {
    following: number;
    popular: number;
    recent: number;
    personalized: number;
  }
) => {
  let score = 0;

  // 팔로잉 가중치
  if (isFollowing) {
    score += weights.following * 100;
  }

  // 인기도 가중치 (북마크 수 기준)
  const bookmarkCount = post._count?.bookmarks || 0;
  const likeCount = post._count?.likes || 0;
  const viewCount = post.viewCount || 0;
  // 좋아요 신호를 인기도에 반영 (좋아요는 북마크보다 즉시성/품질 신호로 2~3배 가중 추천)
  const popularityScore =
    bookmarkCount + likeCount * 3 + Math.min(viewCount / 10, 50);
  score += weights.popular * popularityScore;

  // 시간 가중치 (최신성)
  const hoursAgo =
    (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
  const recencyScore = Math.max(0, 48 - hoursAgo) / 48; // 48시간 내에서 가중치
  score += weights.recent * recencyScore * 50;

  // 개인화 가중치 (태그 선호도)
  const tagScore =
    post.tags?.reduce((sum: number, postTag: any) => {
      return sum + (tagPreferences[postTag.tagId] || 0);
    }, 0) || 0;
  score += weights.personalized * tagScore * 10;

  return score;
};

// 댓글 수 집계(soft delete 제외) 유틸
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

// 팔로잉 사용자들의 게시글 조회
const getFollowingPosts = async (
  userId: number,
  limit: number,
  cursor?: string
) => {
  const cursorCondition = buildCursorCondition(cursor);

  return await prisma.post.findMany({
    where: {
      AND: [
        cursorCondition,
        { deletedAt: null as any },
        {
          NOT: {
            isPrivate: true as const,
          },
        },
        {
          author: {
            followers: {
              some: {
                followerId: userId,
              },
            },
          },
        },
      ],
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          profileImageUrl: true,
        },
      },
      collection: {
        select: {
          id: true,
          name: true,
        },
      },
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
      tags: {
        include: {
          tag: true,
        },
      },
      taggedFriends: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              profileImageUrl: true,
            },
          },
        },
      },
      _count: { select: { bookmarks: true, likes: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
  });
};

// 개인화 추천 게시글 조회
const getPersonalizedPosts = async (
  userId: number,
  limit: number,
  cursor?: string,
  excludeIds: number[] = []
) => {
  const cursorCondition = buildCursorCondition(cursor);

  return await prisma.post.findMany({
    where: {
      AND: [
        cursorCondition,
        { deletedAt: null as any },
        {
          NOT: {
            isPrivate: true as const,
          },
        },
        excludeIds.length > 0
          ? {
              id: {
                notIn: excludeIds,
              },
            }
          : {},
        {
          author: {
            followers: {
              none: {
                followerId: userId,
              },
            },
          },
        },
      ],
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          profileImageUrl: true,
        },
      },
      collection: {
        select: {
          id: true,
          name: true,
        },
      },
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
      tags: {
        include: {
          tag: true,
        },
      },
      taggedFriends: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              profileImageUrl: true,
            },
          },
        },
      },
      _count: { select: { bookmarks: true, likes: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit * 2, // 더 많이 가져와서 알고리즘으로 정렬
  });
};

// 비회원용 공개 게시글 조회
const getPublicPosts = async (limit: number, cursor?: string) => {
  const cursorCondition = buildCursorCondition(cursor);

  return await prisma.post.findMany({
    where: {
      AND: [
        cursorCondition,
        { deletedAt: null as any },
        {
          NOT: {
            isPrivate: true as const,
          },
        },
      ],
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          profileImageUrl: true,
        },
      },
      collection: {
        select: {
          id: true,
          name: true,
        },
      },
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
      tags: {
        include: {
          tag: true,
        },
      },
      taggedFriends: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              profileImageUrl: true,
            },
          },
        },
      },
      _count: {
        select: {
          bookmarks: true,
          likes: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
  });
};

// 홈 피드 조회 (회원/비회원 공용)
export const getHomeFeed = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id; // 비회원의 경우 undefined

    const {
      limit = 10,
      cursor,
      algorithmWeight = {
        following: 1.0,
        popular: 0.3,
        recent: 0.5,
        personalized: 0.7,
      },
    }: HomeFeedRequest = req.query as any;

    // limit 파싱을 견고하게 처리 (문자열/숫자/배열 모두 대응)
    const rawLimit = Array.isArray(limit) ? (limit[0] as any) : (limit as any);
    const parsedLimit =
      typeof rawLimit === "string" ? parseInt(rawLimit, 10) : Number(rawLimit);
    const feedLimit = Math.min(
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10,
      50
    );

    // 비회원과 회원 분기 처리
    if (!userId) {
      // 비회원인 경우: 공개 게시글만 제공 (hasMore 판별을 위해 feedLimit+1로 조회)
      const publicPosts = await getPublicPosts(feedLimit + 1, cursor);
      const commentCountMapPublic = await getCommentCountsForPosts(
        publicPosts.map((p: any) => p.id)
      );
      const feedPosts: FeedPost[] = publicPosts.map((post: any) => ({
        id: post.id,
        title: post.title,
        description: post.description || undefined,
        author: {
          id: post.author.id,
          name: post.author.name,
          profileImageUrl: post.author.profileImageUrl || undefined,
          isFollowing: false, // 비회원은 팔로잉 불가
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
          comments: commentCountMapPublic.get(post.id) || 0,
          bookmarks: post._count?.bookmarks || 0,
          views: post.viewCount,
        },
        isLiked: false,
        isBookmarked: false, // 비회원은 북마크 불가
        isMyPost: false,
        feedReason: post._count?.bookmarks > 10 ? "popular" : "recent",
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
      }));

      const postsOut = feedPosts.slice(0, feedLimit);
      const hasMore = feedPosts.length > postsOut.length;
      const nextCursor = hasMore
        ? makeNextCursor(
            publicPosts[Math.min(publicPosts.length, feedLimit) - 1]
          )
        : undefined;

      const response: HomeFeedResponse = {
        posts: postsOut,
        pagination: {
          hasMore,
          nextCursor,
          totalShown: postsOut.length,
        },
        algorithmInfo: {
          followingCount: 0,
          popularCount: postsOut.filter((p) => p.feedReason === "popular")
            .length,
          personalizedCount: 0,
          recentCount: postsOut.filter((p) => p.feedReason === "recent").length,
        },
      };

      return res.json({
        message: "공개 피드를 성공적으로 조회했습니다",
        ...response,
      });
    }

    // 회원인 경우: 개인화된 피드 제공
    // 사용자 태그 선호도 분석
    const tagPreferences = await getUserTagPreferences(userId);

    // 모든 공개 게시물을 최신순으로 가져오기 (페이지네이션 적용)
    const baseCandidates = await prisma.post.findMany({
      where: {
        AND: [
          buildCursorCondition(cursor),
          { deletedAt: null as any },
          { NOT: { isPrivate: true as const } },
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
      take: feedLimit + 1,
    });

    // 실제 표시할 게시물과 hasMore 판별용 분리
    const candidateSlice = baseCandidates.slice(0, feedLimit);
    const candidateIds = candidateSlice.map((p: any) => p.id);
    const authorIds = Array.from(
      new Set(candidateSlice.map((p: any) => p.authorId))
    );

    // 보조 신호 수집 (해당 페이지 범위에 대해서만)
    const [
      commentCountMapForFeed,
      likesForUser,
      bookmarksForUser,
      followRows,
      myExposures,
      myViews,
      activeAuthors,
    ] = await Promise.all([
      getCommentCountsForPosts(candidateIds),
      prisma.postLike.findMany({
        where: { userId, postId: { in: candidateIds } },
        select: { postId: true },
      }),
      prisma.bookmark.findMany({
        where: { userId, postId: { in: candidateIds } },
        select: { postId: true },
      }),
      prisma.follow.findMany({
        where: { followerId: userId, followingId: { in: authorIds } },
        select: { followingId: true },
      }),
      prisma.postExposure.findMany({
        where: { userId, postId: { in: candidateIds } },
        select: { postId: true },
      }),
      prisma.postView.findMany({
        where: { userId, postId: { in: candidateIds } },
        select: { postId: true },
      }),
      prisma.post.findMany({
        where: {
          authorId: { in: authorIds },
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          deletedAt: null as any,
        } as any,
        select: { authorId: true },
      }),
    ]);

    const likedPostIds = new Set(likesForUser.map((l) => l.postId));
    const bookmarkedPostIds = new Set(bookmarksForUser.map((b) => b.postId));
    const followingUserIds = new Set(followRows.map((f) => f.followingId));
    const exposedSet = new Set(myExposures.map((e) => e.postId));
    const viewedSet = new Set(myViews.map((v) => v.postId));
    const activeAuthorSet = new Set(activeAuthors.map((a) => a.authorId));

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 모든 게시물에 알고리즘 점수 계산 (최신순 유지하면서 점수 추가)
    const postsWithScores = candidateSlice.map((post: any) => {
      const isFollowing = followingUserIds.has(post.authorId);
      let score = calculatePostScore(
        post,
        userId,
        isFollowing,
        tagPreferences,
        algorithmWeight
      );
      // 미확인 팔로잉 + 최근 24h 부스트
      if (
        isFollowing &&
        !exposedSet.has(post.id) &&
        new Date(post.createdAt).getTime() >= twentyFourHoursAgo.getTime()
      ) {
        score += 30;
      }
      // 저활동 작성자 가산점
      if (!activeAuthorSet.has(post.authorId)) score += 10;
      // 스킵 패널티(노출 O, 뷰 X)
      if (exposedSet.has(post.id) && !viewedSet.has(post.id)) score -= 20;
      // 시간대 보정(현재 시각±2h)
      const diffHours = Math.abs(
        new Date().getHours() - new Date(post.createdAt).getHours()
      );
      if (diffHours <= 2) score += 5;

      const feedReason = isFollowing
        ? ("following" as const)
        : post._count?.bookmarks > 10
        ? ("popular" as const)
        : ("recommended" as const);

      return { ...post, algorithmScore: score, feedReason };
    });

    // 최신순 유지 (알고리즘 정렬 제거)
    const finalPosts = postsWithScores;

    // 응답 매핑
    const feedPosts: FeedPost[] = finalPosts.map((post: any) => ({
      id: post.id,
      title: post.title,
      description: post.description || undefined,
      author: {
        id: post.author.id,
        name: post.author.name,
        profileImageUrl: post.author.profileImageUrl || undefined,
        isFollowing: followingUserIds.has(post.author.id),
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
        comments: commentCountMapForFeed.get(post.id) || 0,
        bookmarks: post._count?.bookmarks || 0,
        views: (post as any).viewCount ?? 0,
      },
      isLiked: likedPostIds.has(post.id),
      isBookmarked: bookmarkedPostIds.has(post.id),
      isMyPost: post.authorId === userId,
      algorithmScore: post.algorithmScore,
      feedReason: post.feedReason,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    }));

    // 페이지네이션: 최신순 기준으로 정확하게 계산
    const hasMore = baseCandidates.length > feedLimit;
    const nextCursor = hasMore
      ? makeNextCursor(
          baseCandidates[Math.min(baseCandidates.length, feedLimit) - 1]
        )
      : undefined;

    const algorithmInfo = {
      followingCount: feedPosts.filter((p) => p.feedReason === "following")
        .length,
      popularCount: feedPosts.filter((p) => p.feedReason === "popular").length,
      personalizedCount: feedPosts.filter((p) => p.feedReason === "recommended")
        .length,
      recentCount: feedPosts.filter((p) => {
        const hoursAgo =
          (Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60);
        return hoursAgo < 24;
      }).length,
    };

    const response: HomeFeedResponse = {
      posts: feedPosts,
      pagination: { hasMore, nextCursor, totalShown: feedPosts.length },
      algorithmInfo,
    };

    res.json({
      message: "홈 피드를 성공적으로 조회했습니다",
      ...response,
    });

    // 노출 로그 기록 (회원인 경우만)
    try {
      if (userId) {
        await prisma.postExposure.createMany({
          data: feedPosts.map((p) => ({ userId, postId: p.id })),
          skipDuplicates: true,
        });
      }
    } catch {}
  } catch (err) {
    next(err);
  }
};

// 게시글 상세 조회 (회원/비회원 공용)
export const getPostDetail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id; // 비회원의 경우 undefined
    const { postId } = req.params;

    if (!postId) {
      return res.status(400).json({ message: "게시글 ID가 필요합니다" });
    }

    // 숫자 검증
    const postIdNum = parseInt(postId);
    if (isNaN(postIdNum)) {
      return res.status(400).json({ message: "유효하지 않은 게시글 ID입니다" });
    }

    // 게시글 조회
    const post = await prisma.post.findUnique({
      where: { id: postIdNum },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            profileImageUrl: true,
          },
        },
        collection: {
          select: {
            id: true,
            name: true,
          },
        },
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
        tags: {
          include: {
            tag: true,
          },
        },
        taggedFriends: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                profileImageUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            bookmarks: true,
            likes: true,
          },
        },
      },
    });

    if (!post) {
      return res.status(404).json({ message: "게시글을 찾을 수 없습니다" });
    }

    // 비공개 게시글인 경우 작성자가 아니면 접근 불가
    if (post.isPrivate && post.authorId !== userId) {
      return res.status(403).json({ message: "비공개 게시글입니다" });
    }

    // 사용자별 상호작용 정보 조회 (회원인 경우만)
    let isBookmarked = false;
    let isFollowing = false;
    let isLiked = false;

    if (userId) {
      const [bookmark, follow, like] = await Promise.all([
        prisma.bookmark.findUnique({
          where: {
            userId_postId: {
              userId,
              postId: post.id,
            },
          },
        }),
        prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: userId,
              followingId: post.authorId,
            },
          },
        }),
        prisma.postLike.findUnique({
          where: {
            userId_postId: {
              userId,
              postId: post.id,
            },
          },
        }),
      ]);

      isBookmarked = !!bookmark;
      isFollowing = !!follow;
      isLiked = !!like;
    }

    // 응답 데이터 구성
    // 조회수 증가 (작성자 본인 조회 포함, idempotent 아님)
    await prisma.post.update({
      where: { id: post.id },
      data: { viewCount: { increment: 1 } },
    });
    // 뷰 로그 기록 (회원)
    try {
      if (userId) {
        await prisma.postView.create({ data: { userId, postId: post.id } });
      }
    } catch {}

    // 소프트 삭제 제외한 댓글 수 집계
    const commentCount = await prisma.comment.count({
      where: { postId: post.id, deletedAt: null },
    });

    const response: FeedPost = {
      id: post.id,
      title: post.title,
      description: post.description || undefined,
      author: {
        id: post.author.id,
        name: post.author.name,
        profileImageUrl: post.author.profileImageUrl || undefined,
        isFollowing,
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
        comments: commentCount,
        bookmarks: post._count?.bookmarks || 0,
        views: (post as any).viewCount ?? 0,
      },
      isLiked,
      isBookmarked,
      isMyPost: post.authorId === userId,
      feedReason: post._count?.bookmarks > 10 ? "popular" : "recent",
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };

    res.json({
      message: "게시글을 성공적으로 조회했습니다",
      post: response,
    });
  } catch (err) {
    next(err);
  }
};

// 댓글 목록 조회
export const getComments = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const viewerId = req.user?.id;
    const { postId } = req.params;
    const { cursor, limit = 20 } = req.query as any;

    const postIdNum = parseInt(postId);
    if (isNaN(postIdNum)) {
      return res.status(400).json({ message: "유효하지 않은 게시글 ID입니다" });
    }

    const take = Math.min(parseInt(String(limit)) || 20, 50);
    const cursorCond = cursor ? { id: { lt: parseInt(String(cursor)) } } : {};

    const comments = await (prisma as any).comment.findMany({
      where: {
        AND: [cursorCond, { postId: postIdNum }, { deletedAt: null as any }],
      } as any,
      include: {
        author: { select: { id: true, name: true, profileImageUrl: true } },
        mentions: {
          include: {
            user: { select: { id: true, name: true, profileImageUrl: true } },
          },
        },
      },
      orderBy: { id: "desc" },
      take: take + 1,
    });

    const items = comments.slice(0, take);
    const hasMore = comments.length > items.length;
    const nextCursor = hasMore ? String(items[items.length - 1].id) : undefined;

    const data: CommentResponse[] = items.map((c: any) => ({
      id: c.id,
      postId: c.postId,
      author: {
        id: c.author.id,
        name: c.author.name,
        profileImageUrl: c.author.profileImageUrl || undefined,
      },
      content: c.content,
      mentions: c.mentions.map((m: any) => ({
        id: m.user.id,
        name: m.user.name,
        profileImageUrl: m.user.profileImageUrl || undefined,
      })),
      isMyComment: viewerId ? c.authorId === viewerId : false,
      isEdited: !!c.edited,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));

    res.json({
      comments: data,
      pagination: { hasMore, nextCursor, totalShown: data.length },
    });
  } catch (err) {
    next(err);
  }
};

// 댓글 작성
export const createComment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { postId } = req.params;
    if (!userId)
      return res.status(401).json({ message: "로그인이 필요합니다" });

    const postIdNum = parseInt(postId);
    if (isNaN(postIdNum)) {
      return res.status(400).json({ message: "유효하지 않은 게시글 ID입니다" });
    }

    const { content, mentions } = req.body as CreateCommentRequest;
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: "댓글 내용이 필요합니다" });
    }

    // 게시글 권한 체크 (비공개/삭제 제외)
    const post = await prisma.post.findUnique({ where: { id: postIdNum } });
    if (!post || (post as any).deletedAt) {
      return res.status(404).json({ message: "게시글을 찾을 수 없습니다" });
    }
    if (post.isPrivate && post.authorId !== userId) {
      return res.status(403).json({ message: "비공개 게시글입니다" });
    }

    // 멘션 대상 ID 확보: 우선 mentions 배열, 없으면 @name 파싱과 팔로잉 중 유저 매칭
    let mentionIds: number[] = [];
    if (Array.isArray(mentions) && mentions.length > 0) {
      mentionIds = Array.from(
        new Set(mentions.map((m) => m.id).filter(Boolean))
      ) as number[];
    } else {
      const atNames = Array.from(
        new Set(
          (content.match(/@([A-Za-z0-9_가-힣]+)/g) || []).map((m) => m.slice(1))
        )
      );
      if (atNames.length > 0) {
        const users = await prisma.user.findMany({
          where: {
            AND: [
              { name: { in: atNames } },
              { followers: { some: { followerId: userId } } },
            ],
          },
          select: { id: true, name: true },
        });
        mentionIds = users.map((u) => u.id);
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const c = await (tx as any).comment.create({
        data: {
          postId: postIdNum,
          authorId: userId!,
          content: content.trim(),
          edited: false,
        },
      });

      if (mentionIds.length > 0) {
        const rows = mentionIds.map((uid) => ({
          commentId: c.id,
          userId: uid,
        }));
        await (tx as any).commentMention.createMany({
          data: rows,
          skipDuplicates: true,
        });
      }

      return c.id;
    });

    res
      .status(201)
      .json({ message: "댓글이 등록되었습니다", commentId: created });
  } catch (err) {
    next(err);
  }
};

// 댓글 삭제(소프트 삭제)
export const deleteComment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { commentId } = req.params;
    if (!userId)
      return res.status(401).json({ message: "로그인이 필요합니다" });

    const idNum = parseInt(commentId);
    if (isNaN(idNum)) {
      return res.status(400).json({ message: "유효하지 않은 댓글 ID입니다" });
    }

    const c = await (prisma as any).comment.findUnique({
      where: { id: idNum },
    });
    if (!c || (c as any).deletedAt)
      return res.status(404).json({ message: "댓글을 찾을 수 없습니다" });
    if (c.authorId !== userId)
      return res.status(403).json({ message: "삭제 권한이 없습니다" });

    await (prisma as any).comment.update({
      where: { id: idNum },
      data: { deletedAt: new Date() } as any,
    });
    res.json({ message: "댓글이 삭제되었습니다" });
  } catch (err) {
    next(err);
  }
};

// 댓글 수정
export const updateComment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { commentId } = req.params;
    const { content } = req.body as { content?: string };
    if (!userId)
      return res.status(401).json({ message: "로그인이 필요합니다" });
    const idNum = parseInt(commentId);
    if (isNaN(idNum))
      return res.status(400).json({ message: "유효하지 않은 댓글 ID입니다" });
    if (!content || content.trim().length === 0)
      return res.status(400).json({ message: "댓글 내용이 필요합니다" });

    const c = await (prisma as any).comment.findUnique({
      where: { id: idNum },
    });
    if (!c || (c as any).deletedAt)
      return res.status(404).json({ message: "댓글을 찾을 수 없습니다" });
    if (c.authorId !== userId)
      return res.status(403).json({ message: "수정 권한이 없습니다" });

    await (prisma as any).comment.update({
      where: { id: idNum },
      data: { content: content.trim(), edited: true },
    });

    res.json({ message: "댓글이 수정되었습니다" });
  } catch (err) {
    next(err);
  }
};
