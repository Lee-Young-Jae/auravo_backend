import { prisma } from "../config/db";
import { v4 as uuidv4 } from "uuid";

export interface QuestProgress {
  questId: number;
  type: string;
  name: string;
  description: string;
  currentCount: number;
  maxCount: number;
  baseReward: number;
  scaledReward: number;
  rewardsReceived: number; // 받은 보상 횟수
  availableRewards: number; // 받을 수 있는 보상 횟수
  isCompleted: boolean;
  canClaim: boolean;
}

export interface AuraTransferResult {
  success: boolean;
  message: string;
  transferId?: string;
  newBalance?: number;
}

export class AuraService {
  // 사용자의 일일 퀘스트 진행도 조회
  static async getUserDailyProgress(userId: number): Promise<QuestProgress[]> {
    const today = new Date();
    const todayDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())); // UTC 기준 자정

    // 활성 퀘스트 목록
    const activeQuests = await prisma.dailyQuest.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
    });

    // 현재 스케일링 팩터 조회
    const scalingFactor = await this.getCurrentScalingFactor();

    const progressList: QuestProgress[] = [];

    for (const quest of activeQuests) {
      // 오늘 진행도 조회
      const progress = await prisma.userDailyProgress.findUnique({
        where: {
          userId_questId_date: {
            userId,
            questId: quest.id,
            date: todayDate,
          },
        },
      });

      const currentCount = progress?.currentCount || 0;
      const rewardsReceived = progress?.rewardsReceived || 0;
      const availableRewards = Math.min(currentCount, quest.maxCount) - rewardsReceived;
      const scaledReward = Math.round(quest.baseReward * scalingFactor); // 개별 보상 금액

      progressList.push({
        questId: quest.id,
        type: quest.type,
        name: quest.name,
        description: quest.description,
        currentCount: Math.min(currentCount, quest.maxCount),
        maxCount: quest.maxCount,
        baseReward: quest.baseReward,
        scaledReward,
        rewardsReceived,
        availableRewards,
        isCompleted: currentCount >= quest.maxCount,
        canClaim: availableRewards > 0,
      });
    }

    return progressList;
  }

  // 퀘스트 진행도 증가 (활동 시 호출) - 보상 지급하지 않음
  static async incrementQuestProgress(
    userId: number,
    questType: string,
    relatedPostId?: number,
    relatedCommentId?: number
  ): Promise<{
    progressed: boolean;
    currentCount?: number;
    maxCount?: number;
  }> {
    const today = new Date();
    const todayDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())); // UTC 기준 자정

    // 퀘스트 조회
    const quest = await prisma.dailyQuest.findUnique({
      where: { type: questType, isActive: true },
    });

    if (!quest) {
      return { progressed: false };
    }

    // 오늘 진행도 조회 또는 생성
    const progress = await prisma.userDailyProgress.upsert({
      where: {
        userId_questId_date: {
          userId,
          questId: quest.id,
          date: todayDate,
        },
      },
      update: {
        currentCount: { increment: 1 },
        updatedAt: new Date(),
      },
      create: {
        userId,
        questId: quest.id,
        currentCount: 1,
        date: todayDate,
      },
    });

    // 최대 횟수 초과 시에도 진행도는 업데이트하지만 보상은 없음
    return {
      progressed: true,
      currentCount: progress.currentCount,
      maxCount: quest.maxCount,
    };
  }

  // 퀘스트 보상 수령 (퀘스트 페이지에서 "받기" 버튼 클릭 시)
  static async claimQuestReward(
    userId: number,
    questId: number
  ): Promise<{ success: boolean; amount?: number; message?: string }> {
    const today = new Date();
    const todayDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())); // UTC 기준 자정

    const quest = await prisma.dailyQuest.findUnique({
      where: { id: questId, isActive: true },
    });

    if (!quest) {
      return { success: false, message: "존재하지 않는 퀘스트입니다." };
    }

    // 오늘 진행도 확인
    const progress = await prisma.userDailyProgress.findUnique({
      where: {
        userId_questId_date: {
          userId,
          questId,
          date: todayDate,
        },
      },
    });

    if (!progress || progress.currentCount === 0) {
      return { success: false, message: "진행도가 없습니다." };
    }

    // 받을 수 있는 보상 횟수 확인 (진행도에서 이미 받은 보상 횟수를 뺀 값)
    const availableRewards = Math.min(progress.currentCount, quest.maxCount) - (progress.rewardsReceived || 0);
    
    if (availableRewards <= 0) {
      return { success: false, message: "받을 수 있는 보상이 없습니다." };
    }

    // 개별 보상 지급 (1회분만)
    const scalingFactor = await this.getCurrentScalingFactor();
    const rewardAmount = Math.round(quest.baseReward * scalingFactor);

    await prisma.$transaction(async (tx) => {
      // 보상 지급
      await this.addAura(
        userId,
        rewardAmount,
        "QUEST_REWARD",
        `${quest.name} 보상 ${(progress.rewardsReceived || 0) + 1}회차`,
        quest.id
      );

      // 받은 보상 횟수 증가 및 시간 업데이트
      await tx.userDailyProgress.update({
        where: {
          userId_questId_date: {
            userId,
            questId,
            date: todayDate,
          },
        },
        data: {
          rewardsReceived: { increment: 1 },
          lastRewardAt: new Date(),
        },
      });
    });

    return { success: true, amount: rewardAmount };
  }

  // Aura 지급/차감
  static async addAura(
    userId: number,
    amount: number,
    type: string = "ADMIN",
    description?: string,
    questId?: number,
    relatedPostId?: number,
    relatedCommentId?: number
  ): Promise<number> {
    const result = await prisma.$transaction(async (tx) => {
      // 현재 잔액 조회
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { auraBalance: true, totalAuraEarned: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      const newBalance = user.auraBalance + amount;
      if (newBalance < 0) {
        throw new Error("Insufficient aura balance");
      }

      // 사용자 잔액 업데이트
      const updateData: any = { auraBalance: newBalance };
      if (amount > 0) {
        updateData.totalAuraEarned = user.totalAuraEarned + amount;
      }

      await tx.user.update({
        where: { id: userId },
        data: updateData,
      });

      // 거래 내역 기록
      await tx.auraTransaction.create({
        data: {
          userId,
          amount,
          balanceAfter: newBalance,
          type,
          description,
          questId,
          relatedPostId,
          relatedCommentId,
        },
      });

      return newBalance;
    });

    return result;
  }

  // 사용자간 Aura 전송
  static async transferAura(
    fromUserId: number,
    toUserId: number,
    amount: number,
    message?: string
  ): Promise<AuraTransferResult> {
    if (amount <= 0) {
      return { success: false, message: "전송 금액은 0보다 커야 합니다." };
    }

    if (fromUserId === toUserId) {
      return { success: false, message: "자기 자신에게는 전송할 수 없습니다." };
    }

    try {
      const transferId = uuidv4();

      const result = await prisma.$transaction(async (tx) => {
        // 보내는 사용자 확인 및 잔액 차감
        const fromUser = await tx.user.findUnique({
          where: { id: fromUserId },
          select: { auraBalance: true, name: true },
        });

        if (!fromUser) {
          throw new Error("보내는 사용자를 찾을 수 없습니다.");
        }

        if (fromUser.auraBalance < amount) {
          throw new Error("잔액이 부족합니다.");
        }

        // 받는 사용자 확인
        const toUser = await tx.user.findUnique({
          where: { id: toUserId },
          select: { auraBalance: true, name: true },
        });

        if (!toUser) {
          throw new Error("받는 사용자를 찾을 수 없습니다.");
        }

        const fromNewBalance = fromUser.auraBalance - amount;
        const toNewBalance = toUser.auraBalance + amount;

        // 보내는 사용자 잔액 차감
        await tx.user.update({
          where: { id: fromUserId },
          data: { auraBalance: fromNewBalance },
        });

        // 받는 사용자 잔액 증가
        await tx.user.update({
          where: { id: toUserId },
          data: { auraBalance: toNewBalance },
        });

        // 거래 내역 기록 (보내는 측)
        await tx.auraTransaction.create({
          data: {
            userId: fromUserId,
            amount: -amount,
            balanceAfter: fromNewBalance,
            type: "TRANSFER_SEND",
            description: message
              ? `${toUser.name}에게 전송: ${message}`
              : `${toUser.name}에게 전송`,
            fromUserId,
            toUserId,
            transferId,
          },
        });

        // 거래 내역 기록 (받는 측)
        await tx.auraTransaction.create({
          data: {
            userId: toUserId,
            amount: amount,
            balanceAfter: toNewBalance,
            type: "TRANSFER_RECEIVE",
            description: message
              ? `${fromUser.name}으로부터 수신: ${message}`
              : `${fromUser.name}으로부터 수신`,
            fromUserId,
            toUserId,
            transferId,
          },
        });

        return { newBalance: fromNewBalance, transferId };
      });

      return {
        success: true,
        message: "전송이 완료되었습니다.",
        transferId: result.transferId,
        newBalance: result.newBalance,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "전송 중 오류가 발생했습니다.",
      };
    }
  }

  // 사용자 거래 내역 조회
  static async getUserTransactions(
    userId: number,
    page: number = 1,
    limit: number = 20
  ) {
    const offset = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      prisma.auraTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.auraTransaction.count({
        where: { userId },
      }),
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // 현재 스케일링 팩터 조회
  private static async getCurrentScalingFactor(): Promise<number> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const dailyStats = await prisma.auraStats.findUnique({
      where: {
        date_period: {
          date: yesterday,
          period: "DAILY",
        },
      },
    });

    return dailyStats?.scalingFactor || 1.0;
  }

  // 일일 통계 계산 및 스케일링 팩터 업데이트 (크론잡에서 호출)
  static async updateDailyStats(targetDate?: Date): Promise<void> {
    const date = targetDate || new Date();
    date.setHours(0, 0, 0, 0);

    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    // 해당 날짜의 통계 계산
    const stats = await prisma.auraTransaction.aggregate({
      where: {
        createdAt: {
          gte: date,
          lt: nextDay,
        },
        amount: { gt: 0 }, // 적립만 계산
      },
      _sum: { amount: true },
      _count: { userId: true },
    });

    const totalEarned = stats._sum.amount || 0;
    const totalUsers = await prisma.user.count({
      where: {
        auraTransactions: {
          some: {
            createdAt: {
              gte: date,
              lt: nextDay,
            },
            amount: { gt: 0 },
          },
        },
      },
    });

    const avgEarnPerUser = totalUsers > 0 ? totalEarned / totalUsers : 0;

    // 이전 30일 평균과 비교하여 스케일링 팩터 계산
    const thirtyDaysAgo = new Date(date);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentAvg = await prisma.auraStats.aggregate({
      where: {
        date: { gte: thirtyDaysAgo, lt: date },
        period: "DAILY",
      },
      _avg: { avgEarnPerUser: true },
    });

    const recentAvgEarn = recentAvg._avg.avgEarnPerUser || 100;
    let scalingFactor = 1.0;

    if (avgEarnPerUser > 0) {
      // 평균 대비 현재 수준에 따라 스케일링 조정
      const ratio = avgEarnPerUser / recentAvgEarn;
      if (ratio > 1.2) {
        scalingFactor = 0.9; // 너무 많이 벌고 있으면 보상 감소
      } else if (ratio < 0.8) {
        scalingFactor = 1.1; // 적게 벌고 있으면 보상 증가
      }
    }

    // 통계 저장
    await prisma.auraStats.upsert({
      where: {
        date_period: {
          date,
          period: "DAILY",
        },
      },
      update: {
        totalUsers,
        totalEarned,
        avgEarnPerUser,
        scalingFactor,
      },
      create: {
        date,
        period: "DAILY",
        totalUsers,
        totalEarned,
        avgEarnPerUser,
        scalingFactor,
      },
    });
  }

  // 일일 퀘스트 초기화 (매일 자정에 실행)
  static async resetDailyQuests(): Promise<void> {
    // 어제까지의 진행도는 유지하고, 오늘 새로운 진행도는 자동 생성됨
    console.log("Daily quests reset completed at:", new Date().toISOString());
  }

  // 기본 퀘스트 데이터 초기화 (시드 데이터)
  static async initializeDefaultQuests(): Promise<void> {
    const defaultQuests = [
      {
        type: "POST_CREATE",
        name: "글쓰기 달인",
        description: "게시글을 작성해보세요",
        maxCount: 3,
        baseReward: 50,
      },
      {
        type: "COMMENT_CREATE",
        name: "소통 전문가",
        description: "댓글을 작성해보세요",
        maxCount: 5,
        baseReward: 20,
      },
      {
        type: "DAILY_LOGIN",
        name: "일일 출석",
        description: "매일 접속해보세요",
        maxCount: 1,
        baseReward: 30,
      },
      {
        type: "LIKE_GIVE",
        name: "좋아요 나누기",
        description: "다른 사용자의 게시글에 좋아요를 눌러보세요",
        maxCount: 10,
        baseReward: 10,
      },
    ];

    for (const quest of defaultQuests) {
      await prisma.dailyQuest.upsert({
        where: { type: quest.type },
        update: {},
        create: quest,
      });
    }
  }
}
