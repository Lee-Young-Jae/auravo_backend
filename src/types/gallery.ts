export interface GalleryResponse {
  id: number;
  name: string;
  description: string | null;
  type: string;
  ownerId: number | null;
  owner?: {
    id: number;
    name: string;
    profileImageUrl: string | null;
  } | null;
  totalSlots: number;
  occupiedSlots: number;
  visitorCount: number;
  monthlyVisitors: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GallerySlotResponse {
  id: number;
  galleryId: number;
  slotNumber: number;
  isOccupied: boolean;
  occupantId: number | null;
  occupant?: {
    id: number;
    name: string;
    profileImageUrl: string | null;
  } | null;
  artwork?: ArtworkResponse | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ArtworkResponse {
  id: number;
  postId: number;
  slotId: number;
  title: string;
  artist: string;
  description: string | null;
  galleryViews: number;
  galleryLikes: number;
  displayStartDate: Date;
  post?: {
    id: number;
    title: string;
    description: string | null;
    viewCount: number;
    photos: Array<{
      id: number;
      original: string;
      background: string;
      foreground: string;
      thumbnail: string;
    }>;
    author: {
      id: number;
      name: string;
      profileImageUrl: string | null;
    };
    _count?: {
      likes: number;
      comments: number;
    };
  };
  gallery?: {
    id: number;
    name: string;
    type: string;
  };
  slotNumber?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GalleryDetailResponse extends GalleryResponse {
  slots: GallerySlotResponse[];
}

export interface GalleriesListResponse {
  galleries: GalleryResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateGalleryRequest {
  name: string;
  description?: string;
  totalSlots?: number;
}

export interface UpdateGalleryRequest {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface CreateArtworkRequest {
  postId: number;
  slotNumber: number;
  title?: string;
  description?: string;
}

export interface UpdateArtworkRequest {
  title?: string;
  description?: string;
}

export interface UserArtworkResponse extends ArtworkResponse {
  gallery: {
    id: number;
    name: string;
    type: string;
  };
  slotNumber: number;
}
