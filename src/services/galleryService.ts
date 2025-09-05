import { prisma } from "../config/db";
import { Prisma } from "@prisma/client";

export class GalleryService {
  // 갤러리 목록 조회
  static async getGalleries(params: {
    type: string;
    page: number;
    limit: number;
    userId?: number;
  }) {
    const { type, page, limit, userId } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.GalleryWhereInput = {
      isActive: true,
      type: type === "PRIVATE" && userId ? { equals: type } : "PUBLIC",
    };

    // 개인 갤러리는 소유자만 볼 수 있도록
    if (type === "PRIVATE" && userId) {
      where.ownerId = userId;
    }

    const [galleries, total] = await Promise.all([
      prisma.gallery.findMany({
        where,
        skip,
        take: limit,
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              profileImageUrl: true,
            },
          },
          _count: {
            select: {
              slots: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.gallery.count({ where }),
    ]);

    // 점유된 슬롯 수 계산
    const galleriesWithOccupiedCount = await Promise.all(
      galleries.map(async (gallery) => {
        const occupiedSlots = await prisma.gallerySlot.count({
          where: {
            galleryId: gallery.id,
            isOccupied: true,
          },
        });

        return {
          ...gallery,
          occupiedSlots,
        };
      })
    );

    return {
      galleries: galleriesWithOccupiedCount,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 특정 갤러리 상세 조회 (슬롯 및 작품 정보 포함)
  static async getGalleryById(galleryId: number, userId?: number) {
    const gallery = await prisma.gallery.findUnique({
      where: { id: galleryId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            profileImageUrl: true,
          },
        },
        slots: {
          include: {
            occupant: {
              select: {
                id: true,
                name: true,
                profileImageUrl: true,
              },
            },
            artwork: {
              include: {
                post: {
                  include: {
                    photos: {
                      take: 1,
                    },
                    author: {
                      select: {
                        id: true,
                        name: true,
                        profileImageUrl: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: {
            slotNumber: "asc",
          },
        },
      },
    });

    // 개인 갤러리인 경우 권한 확인
    if (gallery?.type === "PRIVATE" && gallery.ownerId !== userId) {
      return null;
    }

    return gallery;
  }

  // 갤러리 슬롯 목록 조회
  static async getGallerySlots(galleryId: number) {
    return prisma.gallerySlot.findMany({
      where: { galleryId },
      include: {
        occupant: {
          select: {
            id: true,
            name: true,
            profileImageUrl: true,
          },
        },
        artwork: {
          include: {
            post: {
              include: {
                photos: {
                  take: 1,
                },
              },
            },
          },
        },
      },
      orderBy: {
        slotNumber: "asc",
      },
    });
  }

  // 갤러리 생성
  static async createGallery(data: {
    name: string;
    description?: string;
    type: string;
    ownerId: number;
    totalSlots: number;
  }) {
    const gallery = await prisma.gallery.create({
      data: {
        name: data.name,
        description: data.description,
        type: data.type,
        ownerId: data.ownerId,
        totalSlots: data.totalSlots,
      },
    });

    // 슬롯 자동 생성
    const slots = [];
    for (let i = 1; i <= data.totalSlots; i++) {
      slots.push({
        galleryId: gallery.id,
        slotNumber: i,
      });
    }

    await prisma.gallerySlot.createMany({
      data: slots,
    });

    return gallery;
  }

  // 갤러리 수정
  static async updateGallery(
    galleryId: number,
    userId: number,
    data: {
      name?: string;
      description?: string;
      isActive?: boolean;
    }
  ) {
    // 소유자 확인
    const gallery = await prisma.gallery.findFirst({
      where: {
        id: galleryId,
        ownerId: userId,
      },
    });

    if (!gallery) {
      return null;
    }

    return prisma.gallery.update({
      where: { id: galleryId },
      data,
    });
  }

  // 갤러리 삭제
  static async deleteGallery(galleryId: number, userId: number) {
    // 소유자 확인
    const gallery = await prisma.gallery.findFirst({
      where: {
        id: galleryId,
        ownerId: userId,
      },
    });

    if (!gallery) {
      return null;
    }

    // 관련 데이터도 cascade로 삭제됨
    await prisma.gallery.delete({
      where: { id: galleryId },
    });

    return true;
  }

  // 슬롯 점유
  static async occupySlot(
    galleryId: number,
    slotNumber: number,
    userId: number
  ) {
    const slot = await prisma.gallerySlot.findUnique({
      where: {
        galleryId_slotNumber: {
          galleryId,
          slotNumber,
        },
      },
    });

    if (!slot) {
      return { success: false, message: "Slot not found" };
    }

    if (slot.isOccupied) {
      return { success: false, message: "Slot is already occupied" };
    }

    await prisma.gallerySlot.update({
      where: { id: slot.id },
      data: {
        isOccupied: true,
        occupantId: userId,
      },
    });

    return { success: true, message: "Slot occupied successfully" };
  }

  // 슬롯 해제
  static async releaseSlot(
    galleryId: number,
    slotNumber: number,
    userId: number
  ) {
    const slot = await prisma.gallerySlot.findUnique({
      where: {
        galleryId_slotNumber: {
          galleryId,
          slotNumber,
        },
      },
      include: {
        artwork: true,
      },
    });

    if (!slot) {
      return { success: false, message: "Slot not found" };
    }

    if (slot.occupantId !== userId) {
      return {
        success: false,
        message: "You are not the occupant of this slot",
      };
    }

    // 작품이 있으면 먼저 제거
    if (slot.artwork) {
      await prisma.artwork.delete({
        where: { id: slot.artwork.id },
      });
    }

    await prisma.gallerySlot.update({
      where: { id: slot.id },
      data: {
        isOccupied: false,
        occupantId: null,
      },
    });

    return { success: true, message: "Slot released successfully" };
  }

  // 작품 전시
  static async createArtwork(data: {
    galleryId: number;
    postId: number;
    slotNumber: number;
    userId: number;
    title?: string;
    description?: string;
  }) {
    // 슬롯 확인
    const slot = await prisma.gallerySlot.findUnique({
      where: {
        galleryId_slotNumber: {
          galleryId: data.galleryId,
          slotNumber: data.slotNumber,
        },
      },
    });

    if (!slot || slot.occupantId !== data.userId) {
      return null;
    }

    // 게시물 확인 및 작가명 가져오기
    const post = await prisma.post.findUnique({
      where: { id: data.postId },
      include: {
        author: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!post || post.authorId !== data.userId) {
      return null;
    }

    // 이미 전시 중인 작품인지 확인
    const existingArtwork = await prisma.artwork.findUnique({
      where: { postId: data.postId },
    });

    if (existingArtwork) {
      return null;
    }

    return prisma.artwork.create({
      data: {
        postId: data.postId,
        slotId: slot.id,
        title: data.title || post.title,
        artist: post.author.name,
        description: data.description || post.description,
      },
      include: {
        post: {
          include: {
            photos: true,
            author: {
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
  }

  // 작품 수정
  static async updateArtwork(
    artworkId: number,
    userId: number,
    data: {
      title?: string;
      description?: string;
    }
  ) {
    // 권한 확인
    const artwork = await prisma.artwork.findUnique({
      where: { id: artworkId },
      include: {
        post: true,
        slot: true,
      },
    });

    if (!artwork || artwork.slot.occupantId !== userId) {
      return null;
    }

    return prisma.artwork.update({
      where: { id: artworkId },
      data,
    });
  }

  // 작품 제거
  static async deleteArtwork(artworkId: number, userId: number) {
    // 권한 확인
    const artwork = await prisma.artwork.findUnique({
      where: { id: artworkId },
      include: {
        slot: true,
      },
    });

    if (!artwork || artwork.slot.occupantId !== userId) {
      return null;
    }

    await prisma.artwork.delete({
      where: { id: artworkId },
    });

    return true;
  }

  // 작품 상세 조회
  static async getArtworkById(artworkId: number) {
    return prisma.artwork.findUnique({
      where: { id: artworkId },
      include: {
        post: {
          include: {
            photos: true,
            author: {
              select: {
                id: true,
                name: true,
                profileImageUrl: true,
              },
            },
            _count: {
              select: {
                likes: true,
                comments: true,
              },
            },
          },
        },
        slot: {
          include: {
            gallery: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
      },
    });
  }

  // 사용자의 갤러리 목록
  static async getUserGalleries(userId: number) {
    return prisma.gallery.findMany({
      where: {
        ownerId: userId,
        isActive: true,
      },
      include: {
        _count: {
          select: {
            slots: true,
          },
        },
      },
    });
  }

  // 사용자의 전시 작품 목록
  static async getUserArtworks(userId: number) {
    const slots = await prisma.gallerySlot.findMany({
      where: {
        occupantId: userId,
        artwork: {
          isNot: null,
        },
      },
      include: {
        artwork: {
          include: {
            post: {
              include: {
                photos: {
                  take: 1,
                },
              },
            },
          },
        },
        gallery: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return slots.map((slot) => ({
      ...slot.artwork,
      gallery: slot.gallery,
      slotNumber: slot.slotNumber,
    }));
  }

  // 갤러리 방문자 수 증가
  static async incrementVisitorCount(galleryId: number) {
    await prisma.gallery.update({
      where: { id: galleryId },
      data: {
        visitorCount: { increment: 1 },
        monthlyVisitors: { increment: 1 },
      },
    });
  }

  // 작품 조회수 증가
  static async incrementArtworkViews(artworkId: number) {
    await prisma.artwork.update({
      where: { id: artworkId },
      data: {
        galleryViews: { increment: 1 },
      },
    });
  }

  // 작품 좋아요 토글
  static async toggleArtworkLike(artworkId: number, userId: number) {
    const artwork = await prisma.artwork.findUnique({
      where: { id: artworkId },
    });

    if (!artwork) {
      return { success: false, message: "Artwork not found" };
    }

    // 여기서는 갤러리 좋아요를 별도로 관리하지 않고
    // 카운트만 증가/감소시킴
    // 실제로는 별도의 ArtworkLike 테이블이 필요할 듯

    // 임시로 좋아요 수 증가
    await prisma.artwork.update({
      where: { id: artworkId },
      data: {
        galleryLikes: { increment: 1 },
      },
    });

    return { success: true, liked: true };
  }

  // 월별 방문자 리셋 (크론잡용)
  static async resetMonthlyVisitors() {
    await prisma.gallery.updateMany({
      data: {
        monthlyVisitors: 0,
      },
    });
  }
}
