import { Router } from 'express';
import {
  getDailyQuests,
  getAuraBalance,
  getTransactionHistory,
  transferAura,
  incrementQuest,
  claimQuestReward,
  completeLoginQuest,
  adminAdjustAura,
  adminGetQuests,
  adminUpdateQuest,
  adminGetStats,
  updateDailyStats,
  initializeQuests
} from '../controllers/auraController';
import { authenticate } from '../middlewares/auth';

export const auraRouter = Router();

// 사용자 관련 API
auraRouter.get('/balance', authenticate, getAuraBalance);
auraRouter.get('/quests/daily', authenticate, getDailyQuests);
auraRouter.get('/transactions', authenticate, getTransactionHistory);
auraRouter.post('/transfer', authenticate, transferAura);
auraRouter.post('/quest/increment', authenticate, incrementQuest);
auraRouter.post('/quest/claim', authenticate, claimQuestReward);
auraRouter.post('/quest/login', authenticate, completeLoginQuest);

// 관리자 API
auraRouter.post('/admin/adjust', authenticate, adminAdjustAura);
auraRouter.get('/admin/quests', authenticate, adminGetQuests);
auraRouter.put('/admin/quests/:questId', authenticate, adminUpdateQuest);
auraRouter.get('/admin/stats', authenticate, adminGetStats);
auraRouter.post('/admin/initialize-quests', authenticate, initializeQuests);

// 시스템 API (크론잡용)
auraRouter.post('/system/update-stats', updateDailyStats);