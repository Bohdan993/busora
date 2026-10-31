/** @format */

'use strict';

// Baseline schema for Busora. Generated once from the inherited Busreisen
// migration chain (59 migrations, applied to an empty MySQL 8 database), minus
// the deprecated tickets.children JSON column. Tables are listed in
// foreign-key dependency order. Change the schema with new migrations — never
// by editing this file.

const TABLES = [
  {
    name: 'agents',
    sql: `CREATE TABLE \`agents\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`id\` (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'countries',
    sql: `CREATE TABLE \`countries\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`id\` (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'currencies',
    sql: `CREATE TABLE \`currencies\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`name\` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`abbr\` varchar(4) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`symbol\` varchar(3) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`isBaseCurrency\` tinyint(1) NOT NULL DEFAULT '0',
  \`coef\` float(8,4) NOT NULL DEFAULT '1.0000',
  \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`id\` (\`id\`),
  UNIQUE KEY \`abbr\` (\`abbr\`),
  UNIQUE KEY \`symbol\` (\`symbol\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'languages',
    sql: `CREATE TABLE \`languages\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`name\` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`code\` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`id\` (\`id\`),
  UNIQUE KEY \`name\` (\`name\`),
  UNIQUE KEY \`code\` (\`code\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'passengers',
    sql: `CREATE TABLE \`passengers\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`name\` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`lastName\` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`phone\` varchar(14) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`additionalPhone\` varchar(14) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`dateOfBirth\` date DEFAULT NULL,
  \`email\` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`type\` enum('adult','child') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'adult',
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'routecityorders',
    sql: `CREATE TABLE \`routecityorders\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`lineGroup\` int NOT NULL,
  \`routeKey\` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`cityId\` int NOT NULL,
  \`position\` int NOT NULL,
  \`createdAt\` datetime NOT NULL,
  \`updatedAt\` datetime NOT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'sessions',
    sql: `CREATE TABLE \`sessions\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`sessionInfo\` json NOT NULL,
  \`expires\` datetime NOT NULL,
  \`signature\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`id\` (\`id\`),
  UNIQUE KEY \`signature\` (\`signature\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'ticketmeta',
    sql: `CREATE TABLE \`ticketmeta\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`meta_key\` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Unique identifier for the meta type (e.g., ''ticket_status_paid'')',
  \`meta_type\` enum('ticket_status','ticket_type','confirmation_type') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Category of the metadata (status, type, confirmation)',
  \`is_active\` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Whether this meta option is currently active',
  \`sort_order\` int NOT NULL DEFAULT '0' COMMENT 'For ordering options in UI',
  \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`meta_key\` (\`meta_key\`),
  KEY \`idx_ticketmeta_type\` (\`meta_type\`),
  KEY \`idx_ticketmeta_key_type\` (\`meta_key\`,\`meta_type\`),
  KEY \`idx_ticketmeta_active\` (\`is_active\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Flexible metadata system for tickets and passenger tickets'`
  },
  {
    name: 'users',
    sql: `CREATE TABLE \`users\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`name\` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`phone\` varchar(14) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`dateOfBirth\` date DEFAULT NULL,
  \`email\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`password\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`role\` enum('admin','manager','user') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'user',
  \`isActivated\` tinyint(1) DEFAULT '0',
  \`activationLink\` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`isBlocked\` tinyint(1) DEFAULT '0',
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`email\` (\`email\`),
  UNIQUE KEY \`phone\` (\`phone\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'agentattributes',
    sql: `CREATE TABLE \`agentattributes\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`name\` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`agentId\` int NOT NULL,
  \`languageId\` int NOT NULL,
  \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`agentId\` (\`agentId\`),
  KEY \`languageId\` (\`languageId\`),
  CONSTRAINT \`agentattributes_ibfk_1\` FOREIGN KEY (\`agentId\`) REFERENCES \`agents\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT \`agentattributes_ibfk_2\` FOREIGN KEY (\`languageId\`) REFERENCES \`languages\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'cities',
    sql: `CREATE TABLE \`cities\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`countryId\` int NOT NULL,
  \`currencyId\` int NOT NULL,
  \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`id\` (\`id\`),
  KEY \`countryId\` (\`countryId\`),
  KEY \`currencyId\` (\`currencyId\`),
  CONSTRAINT \`cities_ibfk_1\` FOREIGN KEY (\`countryId\`) REFERENCES \`countries\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT \`cities_ibfk_2\` FOREIGN KEY (\`currencyId\`) REFERENCES \`currencies\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'countryattributes',
    sql: `CREATE TABLE \`countryattributes\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`name\` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`countryId\` int NOT NULL,
  \`languageId\` int NOT NULL,
  \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`countryId\` (\`countryId\`),
  KEY \`languageId\` (\`languageId\`),
  CONSTRAINT \`countryattributes_ibfk_1\` FOREIGN KEY (\`countryId\`) REFERENCES \`countries\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT \`countryattributes_ibfk_2\` FOREIGN KEY (\`languageId\`) REFERENCES \`languages\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'routes',
    sql: `CREATE TABLE \`routes\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`routePath\` json NOT NULL,
  \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`countryId\` int NOT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`routes_countryId_foreign_idx\` (\`countryId\`),
  CONSTRAINT \`routes_countryId_foreign_idx\` FOREIGN KEY (\`countryId\`) REFERENCES \`countries\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'ticketmetaattributes',
    sql: `CREATE TABLE \`ticketmetaattributes\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`metaId\` int NOT NULL,
  \`languageId\` int NOT NULL,
  \`name\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Localized display name for the meta value',
  \`description\` text COLLATE utf8mb4_unicode_ci COMMENT 'Optional detailed description in the specified language',
  \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uk_ticketmetaattributes_meta_lang\` (\`metaId\`,\`languageId\`),
  KEY \`idx_ticketmetaattributes_meta\` (\`metaId\`),
  KEY \`idx_ticketmetaattributes_lang\` (\`languageId\`),
  CONSTRAINT \`ticketmetaattributes_ibfk_1\` FOREIGN KEY (\`metaId\`) REFERENCES \`ticketmeta\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT \`ticketmetaattributes_ibfk_2\` FOREIGN KEY (\`languageId\`) REFERENCES \`languages\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Localized attributes for ticket metadata'`
  },
  {
    name: 'tokens',
    sql: `CREATE TABLE \`tokens\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`refreshToken\` varchar(1024) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`deviceFingerprint\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`userId\` int NOT NULL,
  \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`userId\` (\`userId\`),
  CONSTRAINT \`tokens_ibfk_1\` FOREIGN KEY (\`userId\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'busflightprices',
    sql: `CREATE TABLE \`busflightprices\` (
  \`priceOneWay\` int NOT NULL,
  \`priceRoundTrip\` int NOT NULL,
  \`firstCityId\` int NOT NULL,
  \`secondCityId\` int NOT NULL,
  \`currencyId\` int NOT NULL,
  \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`firstCityId\`,\`secondCityId\`,\`currencyId\`),
  KEY \`secondCityId\` (\`secondCityId\`),
  KEY \`currencyId\` (\`currencyId\`),
  CONSTRAINT \`busflightprices_ibfk_1\` FOREIGN KEY (\`firstCityId\`) REFERENCES \`cities\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT \`busflightprices_ibfk_2\` FOREIGN KEY (\`secondCityId\`) REFERENCES \`cities\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT \`busflightprices_ibfk_3\` FOREIGN KEY (\`currencyId\`) REFERENCES \`currencies\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'busflights',
    sql: `CREATE TABLE \`busflights\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`allSeats\` int unsigned NOT NULL,
  \`freeSeats\` int unsigned NOT NULL,
  \`routeId\` int NOT NULL,
  \`dateOfDeparture\` date NOT NULL,
  \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`routeId\` (\`routeId\`),
  CONSTRAINT \`busflights_ibfk_1\` FOREIGN KEY (\`routeId\`) REFERENCES \`routes\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'cityattributes',
    sql: `CREATE TABLE \`cityattributes\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`name\` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`cityId\` int NOT NULL,
  \`languageId\` int NOT NULL,
  \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`cityId\` (\`cityId\`),
  KEY \`languageId\` (\`languageId\`),
  CONSTRAINT \`cityattributes_ibfk_1\` FOREIGN KEY (\`cityId\`) REFERENCES \`cities\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT \`cityattributes_ibfk_2\` FOREIGN KEY (\`languageId\`) REFERENCES \`languages\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'places',
    sql: `CREATE TABLE \`places\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`cityId\` int NOT NULL,
  \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`cityId\` (\`cityId\`),
  CONSTRAINT \`places_ibfk_1\` FOREIGN KEY (\`cityId\`) REFERENCES \`cities\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'routeattributes',
    sql: `CREATE TABLE \`routeattributes\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`name\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`routeId\` int NOT NULL,
  \`languageId\` int NOT NULL,
  \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`routeId\` (\`routeId\`),
  KEY \`languageId\` (\`languageId\`),
  CONSTRAINT \`routeattributes_ibfk_1\` FOREIGN KEY (\`routeId\`) REFERENCES \`routes\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT \`routeattributes_ibfk_2\` FOREIGN KEY (\`languageId\`) REFERENCES \`languages\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'discounts',
    sql: `CREATE TABLE \`discounts\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`coef\` float(3,2) NOT NULL,
  \`group\` enum('adults','children','both','bus-flights','discount-card') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'adults',
  \`inactivePeriod\` varchar(11) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`maxAge\` int DEFAULT NULL,
  \`minAge\` int DEFAULT NULL,
  \`order\` int NOT NULL DEFAULT '500',
  \`busFlightId\` int DEFAULT NULL,
  \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`id\` (\`id\`),
  KEY \`busFlightId\` (\`busFlightId\`),
  CONSTRAINT \`discounts_ibfk_1\` FOREIGN KEY (\`busFlightId\`) REFERENCES \`busflights\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'placeattributes',
    sql: `CREATE TABLE \`placeattributes\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`name\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`placeId\` int NOT NULL,
  \`languageId\` int NOT NULL,
  \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`placeId\` (\`placeId\`),
  KEY \`languageId\` (\`languageId\`),
  CONSTRAINT \`placeattributes_ibfk_1\` FOREIGN KEY (\`placeId\`) REFERENCES \`places\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT \`placeattributes_ibfk_2\` FOREIGN KEY (\`languageId\`) REFERENCES \`languages\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'tickets',
    sql: `CREATE TABLE \`tickets\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`dateOfDeparture\` date NOT NULL,
  \`dateOfReturn\` date DEFAULT NULL,
  \`busFlightFromId\` int NOT NULL,
  \`busFlightToId\` int DEFAULT NULL,
  \`price\` int NOT NULL,
  \`currencyAbbr\` varchar(4) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`signature\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`uuid\` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  \`dateOfFirstUsage\` date DEFAULT NULL,
  \`hasDiscount\` tinyint(1) NOT NULL DEFAULT '0',
  \`discountPercentage\` float(3,1) NOT NULL,
  \`originId\` int NOT NULL,
  \`destinationId\` int NOT NULL,
  \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`prevPDFFileName\` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`PDFFileName\` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`transactionId\` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`dateOfCreature\` date NOT NULL,
  \`ticketNumber\` varchar(6) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`statusId\` int DEFAULT NULL COMMENT 'Reference to ticket status in ticketmeta table',
  \`typeId\` int DEFAULT NULL COMMENT 'Reference to ticket type in ticketmeta table',
  \`passengerRowCount\` int unsigned NOT NULL DEFAULT '0' COMMENT 'Cached count of all passengers (adults + children); kept in sync by DB triggers',
  \`exchangeRate\` decimal(10,4) DEFAULT NULL COMMENT 'UAH per 1 unit of currencyAbbr at booking time; 1 for UAH.',
  \`priceUAH\` int DEFAULT NULL COMMENT 'Ticket total normalized to UAH (price × exchangeRate), locked at booking.',
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`signature\` (\`signature\`),
  UNIQUE KEY \`transactionId\` (\`transactionId\`),
  UNIQUE KEY \`prevPDFFileName\` (\`prevPDFFileName\`),
  UNIQUE KEY \`PDFFileName\` (\`PDFFileName\`),
  KEY \`busFlightFromId\` (\`busFlightFromId\`),
  KEY \`busFlightToId\` (\`busFlightToId\`),
  KEY \`originId\` (\`originId\`),
  KEY \`destinationId\` (\`destinationId\`),
  KEY \`idx_tickets_status_id\` (\`statusId\`),
  KEY \`idx_tickets_type_id\` (\`typeId\`),
  CONSTRAINT \`tickets_ibfk_1\` FOREIGN KEY (\`busFlightFromId\`) REFERENCES \`busflights\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT \`tickets_ibfk_2\` FOREIGN KEY (\`busFlightToId\`) REFERENCES \`busflights\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT \`tickets_ibfk_3\` FOREIGN KEY (\`originId\`) REFERENCES \`cities\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT \`tickets_ibfk_4\` FOREIGN KEY (\`destinationId\`) REFERENCES \`cities\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT \`tickets_ibfk_5\` FOREIGN KEY (\`statusId\`) REFERENCES \`ticketmeta\` (\`id\`),
  CONSTRAINT \`tickets_ibfk_6\` FOREIGN KEY (\`typeId\`) REFERENCES \`ticketmeta\` (\`id\`),
  CONSTRAINT \`tickets_statusId_foreign_idx\` FOREIGN KEY (\`statusId\`) REFERENCES \`ticketmeta\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT \`tickets_typeId_foreign_idx\` FOREIGN KEY (\`typeId\`) REFERENCES \`ticketmeta\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'discountattributes',
    sql: `CREATE TABLE \`discountattributes\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`name\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`discountId\` int NOT NULL,
  \`languageId\` int NOT NULL,
  \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`discountId\` (\`discountId\`),
  KEY \`languageId\` (\`languageId\`),
  CONSTRAINT \`discountattributes_ibfk_1\` FOREIGN KEY (\`discountId\`) REFERENCES \`discounts\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT \`discountattributes_ibfk_2\` FOREIGN KEY (\`languageId\`) REFERENCES \`languages\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  },
  {
    name: 'passengertickets',
    sql: `CREATE TABLE \`passengertickets\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`passengerDiscountId\` int DEFAULT NULL,
  \`discountCardNumber\` int DEFAULT NULL,
  \`ticketId\` int NOT NULL,
  \`passengerId\` int NOT NULL,
  \`createdAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updatedAt\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`paymentAtOffice\` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`paymentOnBus\` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`busSeat\` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`note\` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`agentId\` int DEFAULT NULL,
  \`confirmationId\` int DEFAULT NULL COMMENT 'Reference to confirmation status in ticketmeta table',
  \`PDFFileName\` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Filename (without .pdf extension) of the PDF generated for this individual passenger',
  \`discountPercentage\` decimal(5,2) DEFAULT NULL COMMENT 'Explicit discount percentage override; used for child passengers',
  \`price\` int DEFAULT NULL COMMENT 'Per-passenger calculated price; tickets.price is the sum of these.',
  \`priceUAH\` int DEFAULT NULL COMMENT 'Per-passenger price normalized to UAH; SUM == tickets.priceUAH.',
  \`paymentAtOfficeUAH\` int DEFAULT NULL COMMENT 'Amount paid at office, in UAH (admin truth); paymentAtOffice = round(this / exchangeRate).',
  \`paymentOnBusUAH\` int DEFAULT NULL COMMENT 'Amount paid on bus, in UAH (admin truth); paymentOnBus = round(this / exchangeRate).',
  PRIMARY KEY (\`id\`,\`ticketId\`,\`passengerId\`),
  UNIQUE KEY \`id\` (\`id\`),
  KEY \`passengerDiscountId\` (\`passengerDiscountId\`),
  KEY \`ticketId\` (\`ticketId\`),
  KEY \`passengerId\` (\`passengerId\`),
  KEY \`passengertickets_agentId_foreign_idx\` (\`agentId\`),
  KEY \`idx_passengertickets_confirmation_id\` (\`confirmationId\`),
  CONSTRAINT \`passengertickets_agentId_foreign_idx\` FOREIGN KEY (\`agentId\`) REFERENCES \`agents\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT \`passengertickets_confirmationId_foreign_idx\` FOREIGN KEY (\`confirmationId\`) REFERENCES \`ticketmeta\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT \`passengertickets_ibfk_1\` FOREIGN KEY (\`passengerDiscountId\`) REFERENCES \`discounts\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT \`passengertickets_ibfk_2\` FOREIGN KEY (\`ticketId\`) REFERENCES \`tickets\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT \`passengertickets_ibfk_3\` FOREIGN KEY (\`passengerId\`) REFERENCES \`passengers\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  }
];

// Keep tickets.passengerRowCount in sync with its passengertickets rows.
const TRIGGERS = [
  {
    name: 'pt_after_insert',
    sql: `CREATE TRIGGER pt_after_insert AFTER INSERT ON passengertickets FOR EACH ROW UPDATE tickets SET passengerRowCount = passengerRowCount + 1 WHERE id = NEW.ticketId`
  },
  {
    name: 'pt_after_delete',
    sql: `CREATE TRIGGER pt_after_delete AFTER DELETE ON passengertickets FOR EACH ROW UPDATE tickets SET passengerRowCount = passengerRowCount - 1 WHERE id = OLD.ticketId`
  }
];

module.exports = {
  async up(queryInterface) {
    for (const table of TABLES) {
      await queryInterface.sequelize.query(table.sql);
    }
    for (const trigger of TRIGGERS) {
      await queryInterface.sequelize.query(trigger.sql);
    }
  },

  async down(queryInterface) {
    for (const trigger of TRIGGERS) {
      await queryInterface.sequelize.query(
        `DROP TRIGGER IF EXISTS ${trigger.name}`
      );
    }
    for (const table of [...TABLES].reverse()) {
      await queryInterface.dropTable(table.name);
    }
  }
};
