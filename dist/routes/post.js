"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postRouter = void 0;
const express_1 = require("express");
const postController_1 = require("../controllers/postController");
const auth_1 = require("../middlewares/auth");
const optionalAuth_1 = require("../middlewares/optionalAuth");
exports.postRouter = (0, express_1.Router)();
// 홈 피드 조회 (회원/비회원 공용)
exports.postRouter.get("/feed", optionalAuth_1.optionalAuthenticate, postController_1.getHomeFeed);
// 게시글 상세 조회 (회원/비회원 공용) - 숫자 ID만 매칭되도록 제한
exports.postRouter.get("/:postId(\\d+)", optionalAuth_1.optionalAuthenticate, postController_1.getPostDetail);
// 게시글 생성 (인증 필요)
exports.postRouter.post("/", auth_1.authenticate, postController_1.createPost);
// 게시글 수정/삭제 (인증 필요)
exports.postRouter.patch("/:postId(\\d+)", auth_1.authenticate, postController_1.updatePost);
exports.postRouter.delete("/:postId(\\d+)", auth_1.authenticate, postController_1.deletePost);
// 팔로워 친구 검색 (인증 필요)
exports.postRouter.get("/friends/search", auth_1.authenticate, postController_1.searchFollowingFriends);
// 내 컬렉션 목록 조회 (인증 필요)
exports.postRouter.get("/collections", auth_1.authenticate, postController_1.getMyCollections);
// 컬렉션 생성 (인증 필요)
exports.postRouter.post("/collections", auth_1.authenticate, postController_1.createCollection);
// 인기 태그 목록 조회 (public)
exports.postRouter.get("/tags/popular", postController_1.getPopularTags);
// 컬렉션의 게시글 목록 (선택적 인증)
exports.postRouter.get("/collections/:collectionId(\\d+)/posts", optionalAuth_1.optionalAuthenticate, postController_1.getCollectionPosts);
// 좋아요/좋아요 취소 (인증 필요)
exports.postRouter.post("/:postId(\\d+)/like", auth_1.authenticate, postController_1.likePost);
exports.postRouter.delete("/:postId(\\d+)/like", auth_1.authenticate, postController_1.unlikePost);
// 북마크/북마크 취소 (인증 필요)
exports.postRouter.post("/:postId(\\d+)/bookmark", auth_1.authenticate, postController_1.bookmarkPost);
exports.postRouter.delete("/:postId(\\d+)/bookmark", auth_1.authenticate, postController_1.unbookmarkPost);
// 댓글
exports.postRouter.get("/:postId(\\d+)/comments", optionalAuth_1.optionalAuthenticate, postController_1.getComments);
exports.postRouter.post("/:postId(\\d+)/comments", auth_1.authenticate, postController_1.createComment);
exports.postRouter.delete("/comments/:commentId(\\d+)", auth_1.authenticate, postController_1.deleteComment);
