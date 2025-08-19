import { prisma } from "../config/db";
import { Request, Response, NextFunction } from "express";
import {
  mapToUserProfile,
  mapToPublicProfile,
  mapToMyProfile,
} from "../utils/userMapper";
import { toPrismaJson } from "../utils/jsonHelpers";

// 팔로우 하기
export const followUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const meId = req.user?.id;
    const { userId } = req.params;

    if (!meId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }

    const targetId = parseInt(userId);
    if (isNaN(targetId)) {
      return res.status(400).json({ message: "유효하지 않은 사용자 ID입니다" });
    }

    if (meId === targetId) {
      return res
        .status(400)
        .json({ message: "자기 자신을 팔로우할 수 없습니다" });
    }

    // 대상 사용자 존재 여부 확인
    const targetUser = await prisma.user.findUnique({
      where: { id: targetId },
    });
    if (!targetUser) {
      return res
        .status(404)
        .json({ message: "대상 사용자를 찾을 수 없습니다" });
    }

    // 이미 팔로우 중인지 확인 (idempotent 동작)
    const existing = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: meId,
          followingId: targetId,
        },
      },
    });

    if (existing) {
      return res
        .status(200)
        .json({ message: "이미 팔로우 중입니다", isFollowing: true });
    }

    await prisma.follow.create({
      data: {
        followerId: meId,
        followingId: targetId,
      },
    });

    return res
      .status(201)
      .json({ message: "팔로우했습니다", isFollowing: true });
  } catch (err) {
    next(err);
  }
};

// 언팔로우 하기
export const unfollowUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const meId = req.user?.id;
    const { userId } = req.params;

    if (!meId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }

    const targetId = parseInt(userId);
    if (isNaN(targetId)) {
      return res.status(400).json({ message: "유효하지 않은 사용자 ID입니다" });
    }

    if (meId === targetId) {
      return res
        .status(400)
        .json({ message: "자기 자신을 언팔로우할 수 없습니다" });
    }

    // 존재하면 삭제 (idempotent)
    await prisma.follow.deleteMany({
      where: { followerId: meId, followingId: targetId },
    });

    return res
      .status(200)
      .json({ message: "언팔로우했습니다", isFollowing: false });
  } catch (err) {
    next(err);
  }
};

// 팔로워 목록 조회 (public)
export const getFollowers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params;
    const targetId = parseInt(userId);
    if (isNaN(targetId)) {
      return res.status(400).json({ message: "유효하지 않은 사용자 ID입니다" });
    }

    const page = Math.max(parseInt(String(req.query.page || 1)), 1);
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit || 20)), 1),
      100
    );
    const skip = (page - 1) * limit;

    // target의 팔로워는 "target을 following 중인 사용자들"
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: {
          followings: {
            some: { followingId: targetId },
          },
        },
        select: {
          id: true,
          name: true,
          bio: true,
          location: true,
          website: true,
          socialLinks: true,
          profileImageUrl: true,
          achievements: true,
          createdAt: true,
          _count: {
            select: { posts: true, followers: true, followings: true },
          },
        },
        orderBy: { id: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count({
        where: {
          followings: {
            some: { followingId: targetId },
          },
        },
      }),
    ]);

    const data = users.map((u) => mapToPublicProfile(u));
    return res.json({
      total,
      page,
      limit,
      users: data,
    });
  } catch (err) {
    next(err);
  }
};

// 팔로잉 목록 조회 (public)
export const getFollowings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params;
    const targetId = parseInt(userId);
    if (isNaN(targetId)) {
      return res.status(400).json({ message: "유효하지 않은 사용자 ID입니다" });
    }

    const page = Math.max(parseInt(String(req.query.page || 1)), 1);
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit || 20)), 1),
      100
    );
    const skip = (page - 1) * limit;

    // target의 팔로잉은 "target을 follower로 가지고 있는 사용자들"
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: {
          followers: {
            some: { followerId: targetId },
          },
        },
        select: {
          id: true,
          name: true,
          bio: true,
          location: true,
          website: true,
          socialLinks: true,
          profileImageUrl: true,
          achievements: true,
          createdAt: true,
          _count: {
            select: { posts: true, followers: true, followings: true },
          },
        },
        orderBy: { id: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count({
        where: {
          followers: {
            some: { followerId: targetId },
          },
        },
      }),
    ]);

    const data = users.map((u) => mapToPublicProfile(u));
    return res.json({
      total,
      page,
      limit,
      users: data,
    });
  } catch (err) {
    next(err);
  }
};

// 프로필 수정
export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // JWT 토큰에서 사용자 ID를 가져옴
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }

    const {
      name,
      bio,
      location,
      website,
      socialLinks,
      profileImageUrl,
      achievements,
      preferences,
    } = req.body;

    // 수정할 데이터 객체 생성
    const updateData: any = {};

    if (name !== undefined) {
      // 이름 중복 체크 (자신의 이름은 제외)
      const existingUser = await prisma.user.findFirst({
        where: {
          name: name.trim(),
          id: { not: userId }, // 본인 제외
        },
      });

      if (existingUser) {
        return res.status(400).json({ message: "이미 사용 중인 이름입니다" });
      }
      updateData.name = name.trim();
    }

    if (bio !== undefined) {
      updateData.bio = bio;
    }

    if (location !== undefined) {
      updateData.location = location;
    }

    if (website !== undefined) {
      updateData.website = website;
    }

    if (socialLinks !== undefined) {
      updateData.socialLinks = toPrismaJson(socialLinks);
    }

    if (profileImageUrl !== undefined) {
      updateData.profileImageUrl = profileImageUrl;
    }

    if (achievements !== undefined) {
      updateData.achievements = toPrismaJson(achievements);
    }

    if (preferences !== undefined) {
      updateData.preferences = toPrismaJson(preferences);
    }

    // 데이터가 없으면 에러
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "수정할 데이터가 없습니다" });
    }

    // 프로필 업데이트
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        bio: true,
        location: true,
        website: true,
        socialLinks: true,
        profileImageUrl: true,
        achievements: true,
        preferences: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      message: "프로필이 성공적으로 수정되었습니다",
      user: mapToUserProfile(updatedUser),
    });
  } catch (err) {
    next(err);
  }
};

// 특정 사용자 프로필 조회
export const getUserProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "사용자 ID가 필요합니다" });
    }

    // 숫자 검증
    const userIdNum = parseInt(userId);
    if (isNaN(userIdNum)) {
      return res.status(400).json({ message: "유효하지 않은 사용자 ID입니다" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userIdNum },
      select: {
        id: true,
        name: true,
        bio: true,
        location: true,
        website: true,
        socialLinks: true,
        profileImageUrl: true,
        achievements: true,
        createdAt: true,
        // 공개 정보만 노출 (이메일, 역할, 개인 설정 등 민감한 정보 제외)
        _count: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
    }

    // 공개 게시글 기준 총 조회수/게시글 수 집계
    const aggregates = await prisma.post.aggregate({
      where: {
        authorId: userIdNum,
        isPrivate: false,
        // @ts-ignore soft delete filter
        deletedAt: null,
      },
      _sum: { viewCount: true },
      _count: { _all: true },
    });

    const totalActivePosts = await prisma.post.count({
      where: {
        authorId: userIdNum,
        // @ts-ignore soft delete filter
        deletedAt: null,
      },
    });

    // 로그인 한 유저라면 팔로우 여부 조회 비로그인 일 경우 false
    let isFollowing = false;
    if (req.user?.id) {
      const follow = await prisma.follow.findFirst({
        where: {
          followerId: req.user?.id,
          followingId: userIdNum,
        },
      });
      isFollowing = !!follow;
    }

    res.json({
      user: mapToPublicProfile(user),
      profileStats: {
        totalViews: (aggregates as any)._sum?.viewCount || 0,
        posts: totalActivePosts,
        publicPosts: (aggregates as any)._count?._all || 0,
        followers: user._count.followers,
        followings: user._count.followings,
      },
      isMe: req.user?.id === userIdNum,
      isFollowing,
    });
  } catch (err) {
    next(err);
  }
};

// 내 프로필 조회
export const getMyProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "로그인이 필요합니다" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true, // 본인 정보이므로 이메일 포함
        name: true,
        bio: true,
        location: true,
        website: true,
        socialLinks: true,
        profileImageUrl: true,
        achievements: true,
        preferences: true, // 본인만 볼 수 있는 개인 설정
        role: true, // 본인 정보이므로 역할 포함
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            posts: true,
            followers: true,
            followings: true,
            bookmarks: true, // 본인만 볼 수 있는 북마크 수
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
    }

    res.json({ user: mapToMyProfile(user) });
  } catch (err) {
    next(err);
  }
};

// 나의 모든 팔로잉 목록 조회 (댓글 멘션용)
export const getMyAllFollowings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.json({ followings: [] });
      return;
    }

    const followings = await prisma.follow.findMany({
      where: { followerId: userId },
      select: {
        following: {
          select: {
            id: true,
            name: true,
            profileImageUrl: true,
            email: true,
          },
        },
      },
      orderBy: {
        following: {
          name: "asc", // 이름 순으로 정렬
        },
      },
    });

    const processedFollowings = followings.map(({ following }) => ({
      id: following.id,
      name: following.name,
      displayName: following.name, // 멘션 표시용 이름
      profileImageUrl: following.profileImageUrl,
      email: following.email,
      // 프론트에서 @ 기호와 함께 표시할 수 있도록 멘션 텍스트 제공
      mentionText: `@${following.name}`,
      // 검색 최적화를 위한 필드 (이름의 소문자 버전)
      searchKey: following.name.toLowerCase(),
    }));

    res.json({
      followings: processedFollowings,
      count: processedFollowings.length,
    });
  } catch (err) {
    next(err);
  }
};
