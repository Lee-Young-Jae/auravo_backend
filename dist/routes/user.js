"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRouter = void 0;
const express_1 = require("express");
const userController_1 = require("../controllers/userController");
const auth_1 = require("../middlewares/auth");
const optionalAuth_1 = require("../middlewares/optionalAuth");
const postController_1 = require("../controllers/postController");
exports.userRouter = (0, express_1.Router)();
// 내 프로필 조회 (인증 필요)
exports.userRouter.get("/me", auth_1.authenticate, userController_1.getMyProfile);
// 프로필 수정 (인증 필요)
exports.userRouter.put("/profile", auth_1.authenticate, userController_1.updateProfile);
// 팔로우/언팔로우 (인증 필요)
exports.userRouter.post("/:userId/follow", auth_1.authenticate, userController_1.followUser);
exports.userRouter.delete("/:userId/follow", auth_1.authenticate, userController_1.unfollowUser);
// 팔로워/팔로잉 목록
exports.userRouter.get("/:userId/followers", userController_1.getFollowers);
exports.userRouter.get("/:userId/followings", userController_1.getFollowings);
// 특정 사용자 게시글 목록 (비회원/타인: 공개글만, 본인: 비공개 포함)
exports.userRouter.get("/:userId/posts", optionalAuth_1.optionalAuthenticate, postController_1.getUserPosts);
// 특정 사용자 태그된 게시글 목록
exports.userRouter.get("/:userId/tagged", optionalAuth_1.optionalAuthenticate, postController_1.getTaggedPosts);
// 특정 사용자 컬렉션 목록
exports.userRouter.get("/:userId/collections", optionalAuth_1.optionalAuthenticate, postController_1.getUserCollections);
// 특정 사용자 프로필 조회 (public)
exports.userRouter.get("/:userId", optionalAuth_1.optionalAuthenticate, userController_1.getUserProfile);
