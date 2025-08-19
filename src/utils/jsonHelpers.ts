// Prisma JSON 타입으로 안전하게 변환
export function toPrismaJson<T>(data: T): any {
  return JSON.parse(JSON.stringify(data));
}

// Prisma JSON에서 타입 안전하게 추출
export function fromPrismaJson<T>(data: any): T | null {
  if (data === null || data === undefined) {
    return null;
  }
  return data as T;
}

// 부분 업데이트를 위한 JSON 병합
export function mergeJsonField<T>(
  existing: T | null,
  updates: Partial<T>
): any {
  const current = existing || ({} as T);
  const merged = { ...current, ...updates };
  return toPrismaJson(merged);
}
