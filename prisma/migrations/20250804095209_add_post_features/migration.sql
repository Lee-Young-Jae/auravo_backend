/*
  Warnings:

  - You are about to drop the column `urlBack` on the `Photo` table. All the data in the column will be lost.
  - You are about to drop the column `urlFront` on the `Photo` table. All the data in the column will be lost.
  - You are about to drop the column `urlOriginal` on the `Photo` table. All the data in the column will be lost.
  - You are about to drop the column `caption` on the `Post` table. All the data in the column will be lost.
  - Added the required column `background` to the `Photo` table without a default value. This is not possible if the table is not empty.
  - Added the required column `foreground` to the `Photo` table without a default value. This is not possible if the table is not empty.
  - Added the required column `original` to the `Photo` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Post` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Photo` DROP COLUMN `urlBack`,
    DROP COLUMN `urlFront`,
    DROP COLUMN `urlOriginal`,
    ADD COLUMN `background` VARCHAR(191) NOT NULL,
    ADD COLUMN `foreground` VARCHAR(191) NOT NULL,
    ADD COLUMN `original` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Post` DROP COLUMN `caption`,
    ADD COLUMN `collectionId` INTEGER NULL,
    ADD COLUMN `description` VARCHAR(191) NULL,
    ADD COLUMN `effect` JSON NULL,
    ADD COLUMN `isPrivate` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `title` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `Tag` ADD COLUMN `color` VARCHAR(191) NOT NULL DEFAULT 'blue';

-- AlterTable
ALTER TABLE `User` ADD COLUMN `achievements` JSON NULL,
    ADD COLUMN `location` VARCHAR(191) NULL,
    ADD COLUMN `preferences` JSON NULL,
    ADD COLUMN `socialLinks` JSON NULL,
    ADD COLUMN `website` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Collection` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `ownerId` INTEGER NOT NULL,
    `isPrivate` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PostFriend` (
    `postId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`postId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Post` ADD CONSTRAINT `Post_collectionId_fkey` FOREIGN KEY (`collectionId`) REFERENCES `Collection`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Collection` ADD CONSTRAINT `Collection_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostFriend` ADD CONSTRAINT `PostFriend_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `Post`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostFriend` ADD CONSTRAINT `PostFriend_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
