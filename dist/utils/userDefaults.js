"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultUserPreferences = exports.defaultNotificationSettings = void 0;
exports.getDefaultUserData = getDefaultUserData;
// 기본 알림 설정
exports.defaultNotificationSettings = {
    newFollowers: true,
    artworkLikes: true,
    comments: true,
    mentions: true,
    newsletter: false,
    updates: true,
};
// 기본 사용자 설정
exports.defaultUserPreferences = {
    theme: "system",
    notifications: exports.defaultNotificationSettings,
};
// 새 사용자 생성 시 기본값 반환
function getDefaultUserData() {
    return {
        preferences: exports.defaultUserPreferences,
        achievements: [],
        socialLinks: {},
    };
}
