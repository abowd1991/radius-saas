CREATE TABLE `activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`action` varchar(100) NOT NULL,
	`entityType` varchar(50),
	`entityId` int,
	`details` json,
	`ipAddress` varchar(45),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketId` int NOT NULL,
	`senderId` int NOT NULL,
	`message` text NOT NULL,
	`attachmentUrl` text,
	`isRead` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceNumber` varchar(50) NOT NULL,
	`userId` int NOT NULL,
	`resellerId` int,
	`type` enum('subscription','card_purchase','deposit','other') NOT NULL,
	`subtotal` decimal(12,2) NOT NULL,
	`tax` decimal(12,2) NOT NULL DEFAULT '0.00',
	`discount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`total` decimal(12,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`status` enum('draft','pending','paid','cancelled','refunded') NOT NULL DEFAULT 'pending',
	`dueDate` timestamp,
	`paidAt` timestamp,
	`paymentMethod` varchar(50),
	`paymentReference` varchar(255),
	`notes` text,
	`items` json,
	`pdfUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoices_invoiceNumber_unique` UNIQUE(`invoiceNumber`)
);
--> statement-breakpoint
CREATE TABLE `nas_devices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`ipAddress` varchar(45) NOT NULL,
	`secret` varchar(100) NOT NULL,
	`type` enum('mikrotik','cisco','other') NOT NULL DEFAULT 'mikrotik',
	`description` text,
	`location` varchar(255),
	`ports` int,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`lastSeen` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `nas_devices_id` PRIMARY KEY(`id`),
	CONSTRAINT `nas_devices_ipAddress_unique` UNIQUE(`ipAddress`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('invoice','payment','voucher','support','balance','subscription','system') NOT NULL,
	`title` varchar(255) NOT NULL,
	`titleAr` varchar(255),
	`message` text NOT NULL,
	`messageAr` text,
	`data` json,
	`isRead` boolean DEFAULT false,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_gateways` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`displayName` varchar(100) NOT NULL,
	`displayNameAr` varchar(100),
	`type` enum('paypal','stripe','bank_of_palestine','manual') NOT NULL,
	`config` json,
	`isActive` boolean DEFAULT false,
	`testMode` boolean DEFAULT true,
	`supportedCurrencies` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_gateways_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_gateways_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceId` int NOT NULL,
	`userId` int NOT NULL,
	`gatewayId` int NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`status` enum('pending','processing','completed','failed','refunded') NOT NULL DEFAULT 'pending',
	`gatewayTransactionId` varchar(255),
	`gatewayResponse` json,
	`errorMessage` text,
	`paidAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`nameAr` varchar(100),
	`description` text,
	`descriptionAr` text,
	`downloadSpeed` int NOT NULL,
	`uploadSpeed` int NOT NULL,
	`dataLimit` int,
	`durationDays` int NOT NULL DEFAULT 30,
	`price` decimal(10,2) NOT NULL,
	`resellerPrice` decimal(10,2) NOT NULL,
	`simultaneousUsers` int DEFAULT 1,
	`poolName` varchar(50),
	`radiusAttributes` json,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `radius_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`subscriptionId` int,
	`username` varchar(64) NOT NULL,
	`nasId` int,
	`nasIpAddress` varchar(45),
	`nasPort` int,
	`framedIpAddress` varchar(45),
	`callingStationId` varchar(50),
	`startTime` timestamp NOT NULL,
	`stopTime` timestamp,
	`sessionTime` int DEFAULT 0,
	`inputOctets` int DEFAULT 0,
	`outputOctets` int DEFAULT 0,
	`terminateCause` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `radius_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reseller_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`companyName` varchar(255),
	`companyAddress` text,
	`taxNumber` varchar(50),
	`commissionRate` decimal(5,2) DEFAULT '0.00',
	`creditLimit` decimal(12,2) DEFAULT '0.00',
	`canCreateCards` boolean DEFAULT true,
	`maxClients` int DEFAULT 100,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reseller_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `reseller_profiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`planId` int NOT NULL,
	`nasId` int,
	`username` varchar(64) NOT NULL,
	`password` varchar(64) NOT NULL,
	`status` enum('active','suspended','expired','cancelled') NOT NULL DEFAULT 'active',
	`ipAddress` varchar(45),
	`macAddress` varchar(17),
	`startDate` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`dataUsed` int DEFAULT 0,
	`lastActivity` timestamp,
	`autoRenew` boolean DEFAULT false,
	`voucherId` int,
	`invoiceId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscriptions_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `support_tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketNumber` varchar(20) NOT NULL,
	`userId` int NOT NULL,
	`assignedTo` int,
	`subject` varchar(255) NOT NULL,
	`priority` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
	`status` enum('open','in_progress','waiting','resolved','closed') NOT NULL DEFAULT 'open',
	`category` varchar(50),
	`lastMessageAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `support_tickets_id` PRIMARY KEY(`id`),
	CONSTRAINT `support_tickets_ticketNumber_unique` UNIQUE(`ticketNumber`)
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` text,
	`type` enum('string','number','boolean','json') NOT NULL DEFAULT 'string',
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `system_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`walletId` int NOT NULL,
	`userId` int NOT NULL,
	`type` enum('deposit','withdrawal','card_purchase','subscription','refund','commission') NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`balanceBefore` decimal(12,2) NOT NULL,
	`balanceAfter` decimal(12,2) NOT NULL,
	`description` text,
	`referenceType` varchar(50),
	`referenceId` int,
	`status` enum('pending','completed','failed','cancelled') NOT NULL DEFAULT 'completed',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `voucher_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchId` varchar(50) NOT NULL,
	`name` varchar(100) NOT NULL,
	`planId` int NOT NULL,
	`createdBy` int NOT NULL,
	`quantity` int NOT NULL,
	`templateImageUrl` text,
	`pdfUrl` text,
	`status` enum('generating','completed','failed') NOT NULL DEFAULT 'generating',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `voucher_batches_id` PRIMARY KEY(`id`),
	CONSTRAINT `voucher_batches_batchId_unique` UNIQUE(`batchId`)
);
--> statement-breakpoint
CREATE TABLE `vouchers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(20) NOT NULL,
	`planId` int NOT NULL,
	`createdBy` int NOT NULL,
	`resellerId` int,
	`batchId` varchar(50),
	`value` decimal(10,2),
	`status` enum('unused','used','expired','cancelled') NOT NULL DEFAULT 'unused',
	`usedBy` int,
	`usedAt` timestamp,
	`expiresAt` timestamp,
	`imageUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vouchers_id` PRIMARY KEY(`id`),
	CONSTRAINT `vouchers_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `wallets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`balance` decimal(12,2) NOT NULL DEFAULT '0.00',
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wallets_id` PRIMARY KEY(`id`),
	CONSTRAINT `wallets_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('super_admin','reseller','client') NOT NULL DEFAULT 'client';--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `parentId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `status` enum('active','suspended','inactive') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `language` enum('ar','en') DEFAULT 'ar' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` text;