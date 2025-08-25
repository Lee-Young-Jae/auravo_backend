const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function initializeQuests() {
  try {
    const defaultQuests = [
      {
        type: "POST_CREATE",
        name: "나만의 이미지 업로드",
        description: "오늘 첫 이미지를 게시하고 AURA를 받아보세요!",
        maxCount: 3,
        baseReward: 50,
      },
      {
        type: "COMMENT_CREATE",
        name: "댓글 달고 AURA 받기",
        description: "댓글을 작성하고 이 페이지로 돌아와서 AURA를 획득하세요.",
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
        name: "다른 사람의 작품에 '좋아요' 누르면",
        description:
          "다른 사용자의 작품에 좋아요를 누르고 이 페이지로 돌아와서 AURA를 획득하세요.",
        maxCount: 10,
        baseReward: 10,
      },
    ];

    console.log("Initializing default quests...");

    for (const quest of defaultQuests) {
      const result = await prisma.dailyQuest.upsert({
        where: { type: quest.type },
        update: {},
        create: quest,
      });
      console.log(`✅ Quest ${quest.type}: ${result.name}`);
    }

    console.log("✨ Default quests initialized successfully!");
  } catch (error) {
    console.error("Failed to initialize quests:", error);
  } finally {
    await prisma.$disconnect();
  }
}

initializeQuests();
