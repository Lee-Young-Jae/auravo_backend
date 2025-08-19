"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapToUserProfile = mapToUserProfile;
exports.mapToPublicProfile = mapToPublicProfile;
exports.mapToMyProfile = mapToMyProfile;
// 데이터베이스 User를 프론트엔드 UserProfile로 변환
function mapToUserProfile(user) {
    return {
        id: String(user.id),
        name: user.name,
        email: user.email,
        bio: user.bio ?? "",
        location: user.location ?? "",
        website: user.website ?? "",
        socialLinks: user.socialLinks ?? {},
        profileImage: user.profileImageUrl || undefined,
        achievements: user.achievements ?? [],
        preferences: user.preferences || undefined,
    };
}
// 데이터베이스 User를 공개 프로필로 변환
function mapToPublicProfile(user) {
    return {
        id: String(user.id),
        name: user.name,
        bio: user.bio ?? "",
        location: user.location ?? "",
        website: user.website ?? "",
        socialLinks: user.socialLinks ?? {},
        profileImage: user.profileImageUrl || undefined,
        achievements: user.achievements ?? [],
        createdAt: user.createdAt,
        _count: user._count,
    };
}
// 데이터베이스 User를 내 프로필로 변환
function mapToMyProfile(user) {
    return {
        id: String(user.id),
        name: user.name,
        email: user.email,
        bio: user.bio ?? "",
        location: user.location ?? "",
        website: user.website ?? "",
        socialLinks: user.socialLinks ?? {},
        profileImage: user.profileImageUrl || undefined,
        achievements: user.achievements ?? [],
        preferences: user.preferences || undefined,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        _count: user._count,
    };
}
