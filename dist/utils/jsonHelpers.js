"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toPrismaJson = toPrismaJson;
exports.fromPrismaJson = fromPrismaJson;
exports.mergeJsonField = mergeJsonField;
// Prisma JSON 타입으로 안전하게 변환
function toPrismaJson(data) {
    return JSON.parse(JSON.stringify(data));
}
// Prisma JSON에서 타입 안전하게 추출
function fromPrismaJson(data) {
    if (data === null || data === undefined) {
        return null;
    }
    return data;
}
// 부분 업데이트를 위한 JSON 병합
function mergeJsonField(existing, updates) {
    const current = existing || {};
    const merged = { ...current, ...updates };
    return toPrismaJson(merged);
}
