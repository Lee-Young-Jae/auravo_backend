const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function initializeQuests() {
  try {
    const defaultQuests = [
      {
        type: 'POST_CREATE',
        name: '글쓰기 달인',
        description: '게시글을 작성해보세요',
        maxCount: 3,
        baseReward: 50
      },
      {
        type: 'COMMENT_CREATE',
        name: '소통 전문가',
        description: '댓글을 작성해보세요',
        maxCount: 5,
        baseReward: 20
      },
      {
        type: 'DAILY_LOGIN',
        name: '일일 출석',
        description: '매일 접속해보세요',
        maxCount: 1,
        baseReward: 30
      },
      {
        type: 'LIKE_GIVE',
        name: '좋아요 나누기',
        description: '다른 사용자의 게시글에 좋아요를 눌러보세요',
        maxCount: 10,
        baseReward: 10
      }
    ];

    console.log('Initializing default quests...');

    for (const quest of defaultQuests) {
      const result = await prisma.dailyQuest.upsert({
        where: { type: quest.type },
        update: {},
        create: quest
      });
      console.log(`✅ Quest ${quest.type}: ${result.name}`);
    }

    console.log('✨ Default quests initialized successfully!');
  } catch (error) {
    console.error('Failed to initialize quests:', error);
  } finally {
    await prisma.$disconnect();
  }
}

initializeQuests();