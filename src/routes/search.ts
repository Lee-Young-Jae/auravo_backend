import { Router } from "express";
import {
  searchPosts,
  searchUsers,
  searchTags,
  getTagPosts,
} from "../controllers/searchController";
import { optionalAuthenticate } from "../middlewares/optionalAuth";

export const searchRouter = Router();

// 게시물 검색 (회원/비회원 공용)
searchRouter.get("/posts", optionalAuthenticate, searchPosts);

// 사용자 검색 (회원/비회원 공용)
searchRouter.get("/users", optionalAuthenticate, searchUsers);

// 태그 검색 (public)
searchRouter.get("/tags", searchTags);

// 특정 태그의 게시물 조회 (회원/비회원 공용)
searchRouter.get("/tags/:tagId(\\d+)/posts", optionalAuthenticate, getTagPosts);