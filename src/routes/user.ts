import { Router } from "express";
import {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowings,
  updateProfile,
  getUserProfile,
  getMyProfile,
  getMyAllFollowings,
} from "../controllers/userController";
import { authenticate } from "../middlewares/auth";
import { optionalAuthenticate } from "../middlewares/optionalAuth";
import {
  getUserPosts,
  getTaggedPosts,
  getUserCollections,
} from "../controllers/postController";

export const userRouter = Router();

// 나의 모든 팔로잉 목록 조회
userRouter.get("/me/followings", optionalAuthenticate, getMyAllFollowings);

// 내 프로필 조회 (인증 필요)
userRouter.get("/me", authenticate, getMyProfile);

// 프로필 수정 (인증 필요)
userRouter.put("/profile", authenticate, updateProfile);

// 팔로우/언팔로우 (인증 필요)
userRouter.post("/:userId/follow", authenticate, followUser);
userRouter.delete("/:userId/follow", authenticate, unfollowUser);

// 팔로워/팔로잉 목록
userRouter.get("/:userId/followers", getFollowers);
userRouter.get("/:userId/followings", getFollowings);

// 특정 사용자 게시글 목록 (비회원/타인: 공개글만, 본인: 비공개 포함)
userRouter.get("/:userId/posts", optionalAuthenticate, getUserPosts);

// 특정 사용자 태그된 게시글 목록
userRouter.get("/:userId/tagged", optionalAuthenticate, getTaggedPosts);

// 특정 사용자 컬렉션 목록
userRouter.get(
  "/:userId/collections",
  optionalAuthenticate,
  getUserCollections
);

// 특정 사용자 프로필 조회 (public)
userRouter.get("/:userId", optionalAuthenticate, getUserProfile);
