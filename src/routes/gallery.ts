import { Router } from "express";
import {
  getGalleries,
  getGalleryById,
  createGallery,
  updateGallery,
  deleteGallery,
  getGallerySlots,
  occupySlot,
  releaseSlot,
  createArtwork,
  updateArtwork,
  deleteArtwork,
  getArtworkById,
  getUserGalleries,
  getUserArtworks,
  incrementGalleryVisitors,
  incrementArtworkViews,
  toggleArtworkLike,
} from "../controllers/galleryController";
import { authenticate } from "../middlewares/auth";
import { optionalAuthenticate } from "../middlewares/optionalAuth";

export const galleryRouter = Router();

// 갤러리 목록 조회 (인증 선택)
galleryRouter.get("/", optionalAuthenticate, getGalleries);

// 특정 갤러리 상세 조회
galleryRouter.get("/:galleryId", optionalAuthenticate, getGalleryById);

// 갤러리 슬롯 목록 조회
galleryRouter.get("/:galleryId/slots", optionalAuthenticate, getGallerySlots);

// 개인 갤러리 생성 (인증 필수)
galleryRouter.post("/", authenticate, createGallery);

// 갤러리 정보 수정 (소유자만)
galleryRouter.put("/:galleryId", authenticate, updateGallery);

// 갤러리 삭제 (소유자만)
galleryRouter.delete("/:galleryId", authenticate, deleteGallery);

// 슬롯 점유
galleryRouter.post(
  "/:galleryId/slots/:slotNumber/occupy",
  authenticate,
  occupySlot
);

// 슬롯 해제
galleryRouter.post(
  "/:galleryId/slots/:slotNumber/release",
  authenticate,
  releaseSlot
);

// 작품 전시 (슬롯에 작품 추가)
galleryRouter.post("/:galleryId/artworks", authenticate, createArtwork);

// 작품 정보 수정
galleryRouter.put("/artworks/:artworkId", authenticate, updateArtwork);

// 작품 제거
galleryRouter.delete("/artworks/:artworkId", authenticate, deleteArtwork);

// 특정 작품 조회
galleryRouter.get("/artworks/:artworkId", optionalAuthenticate, getArtworkById);

// 사용자의 갤러리 목록 조회
galleryRouter.get(
  "/user/:userId/galleries",
  optionalAuthenticate,
  getUserGalleries
);

// 사용자의 전시 작품 목록 조회
galleryRouter.get(
  "/user/:userId/artworks",
  optionalAuthenticate,
  getUserArtworks
);

// 갤러리 방문자 수 증가
galleryRouter.post("/:galleryId/visit", incrementGalleryVisitors);

// 작품 조회수 증가
galleryRouter.post("/artworks/:artworkId/view", incrementArtworkViews);

// 작품 좋아요 토글
galleryRouter.post(
  "/artworks/:artworkId/like",
  authenticate,
  toggleArtworkLike
);
