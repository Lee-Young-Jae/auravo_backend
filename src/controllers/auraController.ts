import { Request, Response, NextFunction } from 'express';
import { AuraService } from '../services/auraService';
import { prisma } from '../config/db';

// 사용자의 일일 퀘스트 진행도 조회
export const getDailyQuests = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const progress = await AuraService.getUserDailyProgress(userId);
    res.json({ quests: progress });
  } catch (error) {
    next(error);
  }
};

// 사용자 aura 잔액 및 통계 조회
export const getAuraBalance = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        auraBalance: true,
        totalAuraEarned: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      balance: user.auraBalance,
      totalEarned: user.totalAuraEarned
    });
  } catch (error) {
    next(error);
  }
};

// 사용자 거래 내역 조회
export const getTransactionHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await AuraService.getUserTransactions(userId, page, limit);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// 다른 사용자에게 aura 전송
export const transferAura = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const fromUserId = req.user?.id;
    if (!fromUserId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { toUserId, amount, message } = req.body;

    if (!toUserId || !amount) {
      return res.status(400).json({ message: 'toUserId and amount are required' });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ message: 'Amount must be a positive number' });
    }

    const result = await AuraService.transferAura(fromUserId, toUserId, amount, message);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    next(error);
  }
};

// 퀘스트 진행도 수동 증가 (특정 활동 시 호출용)
export const incrementQuest = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { questType, relatedPostId, relatedCommentId } = req.body;

    if (!questType) {
      return res.status(400).json({ message: 'questType is required' });
    }

    const result = await AuraService.incrementQuestProgress(
      userId,
      questType,
      relatedPostId,
      relatedCommentId
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
};

// 퀘스트 보상 수령
export const claimQuestReward = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { questId } = req.body;

    if (!questId) {
      return res.status(400).json({ message: 'questId is required' });
    }

    const result = await AuraService.claimQuestReward(userId, questId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    next(error);
  }
};

// 일일 로그인 퀘스트 완료
export const completeLoginQuest = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const result = await AuraService.incrementQuestProgress(userId, 'DAILY_LOGIN');
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// 관리자용: 사용자에게 aura 지급/차감
export const adminAdjustAura = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 관리자 권한 확인
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { userId, amount, description } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({ message: 'userId and amount are required' });
    }

    const newBalance = await AuraService.addAura(
      userId,
      amount,
      'ADMIN',
      description || 'Admin adjustment'
    );

    res.json({
      success: true,
      newBalance,
      message: `Aura ${amount > 0 ? 'added' : 'deducted'} successfully`
    });
  } catch (error) {
    next(error);
  }
};

// 관리자용: 퀘스트 관리
export const adminGetQuests = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const quests = await prisma.dailyQuest.findMany({
      orderBy: { id: 'asc' }
    });

    res.json({ quests });
  } catch (error) {
    next(error);
  }
};

export const adminUpdateQuest = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { questId } = req.params;
    const updateData = req.body;

    const quest = await prisma.dailyQuest.update({
      where: { id: parseInt(questId) },
      data: updateData
    });

    res.json({ quest });
  } catch (error) {
    next(error);
  }
};

// 관리자용: 일일 통계 확인
export const adminGetStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const days = parseInt(req.query.days as string) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await prisma.auraStats.findMany({
      where: {
        date: { gte: startDate },
        period: 'DAILY'
      },
      orderBy: { date: 'desc' }
    });

    res.json({ stats });
  } catch (error) {
    next(error);
  }
};

// 시스템용: 통계 업데이트 (크론잡에서 호출)
export const updateDailyStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // API 키나 특별한 인증 방식으로 보호 필요
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.CRON_API_KEY) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const targetDate = req.query.date 
      ? new Date(req.query.date as string) 
      : undefined;

    await AuraService.updateDailyStats(targetDate);
    res.json({ success: true, message: 'Daily stats updated' });
  } catch (error) {
    next(error);
  }
};

// 시스템 초기화용: 기본 퀘스트 생성
export const initializeQuests = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    await AuraService.initializeDefaultQuests();
    res.json({ success: true, message: 'Default quests initialized' });
  } catch (error) {
    next(error);
  }
};