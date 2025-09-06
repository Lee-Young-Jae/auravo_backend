import { Request, Response, NextFunction } from "express";
import { GalleryService } from "../services/galleryService";
import { prisma } from "../config/db";

// 갤러리 목록 조회
export const getGalleries = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { type = "PUBLIC", page = 1, limit = 10 } = req.query;
    const userId = req.user?.id;

    const galleries = await GalleryService.getGalleries({
      type: type as string,
      page: Number(page),
      limit: Number(limit),
      userId,
    });

    res.json(galleries);
  } catch (error) {
    next(error);
  }
};

// 특정 갤러리 상세 조회
export const getGalleryById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { galleryId } = req.params;
    const userId = req.user?.id;

    if (!galleryId || isNaN(Number(galleryId))) {
      return res.status(400).json({ message: "Valid gallery ID is required" });
    }

    const gallery = await GalleryService.getGalleryById(
      Number(galleryId),
      userId
    );

    if (!gallery) {
      return res.status(404).json({ message: "Gallery not found" });
    }

    res.json(gallery);
  } catch (error) {
    next(error);
  }
};

// 갤러리 슬롯 목록 조회
export const getGallerySlots = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { galleryId } = req.params;

    if (!galleryId || isNaN(Number(galleryId))) {
      return res.status(400).json({ message: "Valid gallery ID is required" });
    }

    const slots = await GalleryService.getGallerySlots(Number(galleryId));
    res.json({ slots });
  } catch (error) {
    next(error);
  }
};

// 개인 갤러리 생성
export const createGallery = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { name, description, totalSlots = 10 } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Gallery name is required" });
    }

    const gallery = await GalleryService.createGallery({
      name,
      description,
      type: "PUBLIC",
      ownerId: userId,
      totalSlots,
    });

    res.status(201).json(gallery);
  } catch (error) {
    next(error);
  }
};

// 갤러리 정보 수정
export const updateGallery = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { galleryId } = req.params;
    const { name, description, isActive } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const gallery = await GalleryService.updateGallery(
      Number(galleryId),
      userId,
      { name, description, isActive }
    );

    if (!gallery) {
      return res
        .status(404)
        .json({ message: "Gallery not found or not authorized" });
    }

    res.json(gallery);
  } catch (error) {
    next(error);
  }
};

// 갤러리 삭제
export const deleteGallery = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { galleryId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const result = await GalleryService.deleteGallery(
      Number(galleryId),
      userId
    );

    if (!result) {
      return res
        .status(404)
        .json({ message: "Gallery not found or not authorized" });
    }

    res.json({ message: "Gallery deleted successfully" });
  } catch (error) {
    next(error);
  }
};

// 슬롯 점유
export const occupySlot = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { galleryId, slotNumber } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!galleryId || isNaN(Number(galleryId))) {
      return res.status(400).json({ message: "Valid gallery ID is required" });
    }

    if (!slotNumber || isNaN(Number(slotNumber))) {
      return res.status(400).json({ message: "Valid slot number is required" });
    }

    const result = await GalleryService.occupySlot(
      Number(galleryId),
      Number(slotNumber),
      userId
    );

    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
};

// 슬롯 해제
export const releaseSlot = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { galleryId, slotNumber } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const result = await GalleryService.releaseSlot(
      Number(galleryId),
      Number(slotNumber),
      userId
    );

    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
};

// 작품 전시
export const createArtwork = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { galleryId } = req.params;
    const { postId, slotNumber, title, description } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!postId || !slotNumber) {
      return res
        .status(400)
        .json({ message: "postId and slotNumber are required" });
    }

    const artwork = await GalleryService.createArtwork({
      galleryId: Number(galleryId),
      postId,
      slotNumber,
      userId,
      title,
      description,
    });

    if (!artwork) {
      return res.status(400).json({
        message:
          "Failed to create artwork. Check if slot is available and post exists.",
      });
    }

    res.status(201).json(artwork);
  } catch (error) {
    next(error);
  }
};

// 작품 정보 수정
export const updateArtwork = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { artworkId } = req.params;
    const { title, description } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const artwork = await GalleryService.updateArtwork(
      Number(artworkId),
      userId,
      { title, description }
    );

    if (!artwork) {
      return res
        .status(404)
        .json({ message: "Artwork not found or not authorized" });
    }

    res.json(artwork);
  } catch (error) {
    next(error);
  }
};

// 작품 제거
export const deleteArtwork = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { artworkId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const result = await GalleryService.deleteArtwork(
      Number(artworkId),
      userId
    );

    if (!result) {
      return res
        .status(404)
        .json({ message: "Artwork not found or not authorized" });
    }

    res.json({ message: "Artwork removed successfully" });
  } catch (error) {
    next(error);
  }
};

// 특정 작품 조회
export const getArtworkById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { artworkId } = req.params;

    const artwork = await GalleryService.getArtworkById(Number(artworkId));

    if (!artwork) {
      return res.status(404).json({ message: "Artwork not found" });
    }

    res.json(artwork);
  } catch (error) {
    next(error);
  }
};

// 사용자의 갤러리 목록 조회
export const getUserGalleries = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params;

    const galleries = await GalleryService.getUserGalleries(Number(userId));
    res.json({ galleries });
  } catch (error) {
    next(error);
  }
};

// 사용자의 전시 작품 목록 조회
export const getUserArtworks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params;

    const artworks = await GalleryService.getUserArtworks(Number(userId));
    res.json({ artworks });
  } catch (error) {
    next(error);
  }
};

// 갤러리 방문자 수 증가
export const incrementGalleryVisitors = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { galleryId } = req.params;

    await GalleryService.incrementVisitorCount(Number(galleryId));
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// 작품 조회수 증가
export const incrementArtworkViews = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { artworkId } = req.params;

    await GalleryService.incrementArtworkViews(Number(artworkId));
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// 작품 좋아요 토글
export const toggleArtworkLike = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { artworkId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const result = await GalleryService.toggleArtworkLike(
      Number(artworkId),
      userId
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// 특정 갤러리에서 전시 가능한 사용자 게시글 조회
export const getUserAvailablePosts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { galleryId } = req.params;
    const { limit = 20, cursor } = req.query as {
      limit?: string;
      cursor?: string;
    };

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!galleryId || isNaN(Number(galleryId))) {
      return res.status(400).json({ message: "Valid gallery ID is required" });
    }

    const parsedLimit = Math.min(parseInt(String(limit)) || 20, 50);

    const result = await GalleryService.getUserAvailablePosts(
      Number(galleryId),
      userId,
      parsedLimit,
      cursor
    );

    res.json({
      message: "갤러리 전시 가능한 게시글을 성공적으로 조회했습니다",
      posts: result.posts,
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
    });
  } catch (error) {
    next(error);
  }
};
