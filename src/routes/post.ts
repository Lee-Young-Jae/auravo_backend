import { Router } from "express";
import {
  createPost,
  searchFollowingFriends,
  getMyCollections,
  getPopularTags,
  createCollection,
  getHomeFeed,
  getPostDetail,
  updatePost,
  deletePost,
  likePost,
  unlikePost,
  bookmarkPost,
  unbookmarkPost,
  getCollectionPosts,
  createComment,
  getComments,
  deleteComment,
  updateComment,
} from "../controllers/postController";
import { authenticate } from "../middlewares/auth";
import { optionalAuthenticate } from "../middlewares/optionalAuth";

export const postRouter = Router();

// 홈 피드 조회 (회원/비회원 공용)
postRouter.get("/feed", optionalAuthenticate, getHomeFeed);

// 게시글 상세 조회 (회원/비회원 공용) - 숫자 ID만 매칭되도록 제한
postRouter.get("/:postId(\\d+)", optionalAuthenticate, getPostDetail);

// 게시글 생성 (인증 필요)
postRouter.post("/", authenticate, createPost);

// 게시글 수정/삭제 (인증 필요)
postRouter.patch("/:postId(\\d+)", authenticate, updatePost);
postRouter.delete("/:postId(\\d+)", authenticate, deletePost);

// 팔로워 친구 검색 (인증 필요)
postRouter.get("/friends/search", authenticate, searchFollowingFriends);

// 내 컬렉션 목록 조회 (인증 필요)
postRouter.get("/collections", authenticate, getMyCollections);

// 컬렉션 생성 (인증 필요)
postRouter.post("/collections", authenticate, createCollection);

// 인기 태그 목록 조회 (public)
postRouter.get("/tags/popular", getPopularTags);
// 컬렉션의 게시글 목록 (선택적 인증)
postRouter.get(
  "/collections/:collectionId(\\d+)/posts",
  optionalAuthenticate,
  getCollectionPosts
);

// 좋아요/좋아요 취소 (인증 필요)
postRouter.post("/:postId(\\d+)/like", authenticate, likePost);
postRouter.delete("/:postId(\\d+)/like", authenticate, unlikePost);

// 북마크/북마크 취소 (인증 필요)
postRouter.post("/:postId(\\d+)/bookmark", authenticate, bookmarkPost);
postRouter.delete("/:postId(\\d+)/bookmark", authenticate, unbookmarkPost);

// 댓글
postRouter.get("/:postId(\\d+)/comments", optionalAuthenticate, getComments);
postRouter.post("/:postId(\\d+)/comments", authenticate, createComment);
postRouter.delete("/comments/:commentId(\\d+)", authenticate, deleteComment);
postRouter.patch("/comments/:commentId(\\d+)", authenticate, updateComment);
