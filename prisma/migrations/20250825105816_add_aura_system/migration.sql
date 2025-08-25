-- AlterTable
ALTER TABLE `User` ADD COLUMN `auraBalance` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `totalAuraEarned` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `DailyQuest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `maxCount` INTEGER NOT NULL,
    `baseReward` INTEGER NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DailyQuest_type_key`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserDailyProgress` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `questId` INTEGER NOT NULL,
    `currentCount` INTEGER NOT NULL DEFAULT 0,
    `rewardsReceived` INTEGER NOT NULL DEFAULT 0,
    `lastRewardAt` DATETIME(3) NULL,
    `date` DATE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `UserDailyProgress_date_idx`(`date`),
    UNIQUE INDEX `UserDailyProgress_userId_questId_date_key`(`userId`, `questId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuraTransaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `amount` INTEGER NOT NULL,
    `balanceAfter` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `questId` INTEGER NULL,
    `fromUserId` INTEGER NULL,
    `toUserId` INTEGER NULL,
    `transferId` VARCHAR(191) NULL,
    `relatedPostId` INTEGER NULL,
    `relatedCommentId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuraTransaction_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `AuraTransaction_transferId_idx`(`transferId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuraStats` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATE NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `totalUsers` INTEGER NOT NULL,
    `totalEarned` INTEGER NOT NULL,
    `avgEarnPerUser` DOUBLE NOT NULL,
    `scalingFactor` DOUBLE NOT NULL DEFAULT 1.0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuraStats_date_period_idx`(`date`, `period`),
    UNIQUE INDEX `AuraStats_date_period_key`(`date`, `period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserDailyProgress` ADD CONSTRAINT `UserDailyProgress_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserDailyProgress` ADD CONSTRAINT `UserDailyProgress_questId_fkey` FOREIGN KEY (`questId`) REFERENCES `DailyQuest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuraTransaction` ADD CONSTRAINT `AuraTransaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
