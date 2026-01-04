-- FreeRADIUS Core Tables
CREATE TABLE IF NOT EXISTS radcheck (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL DEFAULT '',
  attribute VARCHAR(64) NOT NULL DEFAULT '',
  op CHAR(2) NOT NULL DEFAULT '==',
  value VARCHAR(253) NOT NULL DEFAULT '',
  INDEX idx_radcheck_username (username)
);

CREATE TABLE IF NOT EXISTS radreply (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL DEFAULT '',
  attribute VARCHAR(64) NOT NULL DEFAULT '',
  op CHAR(2) NOT NULL DEFAULT '=',
  value VARCHAR(253) NOT NULL DEFAULT '',
  INDEX idx_radreply_username (username)
);

CREATE TABLE IF NOT EXISTS radgroupcheck (
  id INT AUTO_INCREMENT PRIMARY KEY,
  groupname VARCHAR(64) NOT NULL DEFAULT '',
  attribute VARCHAR(64) NOT NULL DEFAULT '',
  op CHAR(2) NOT NULL DEFAULT '==',
  value VARCHAR(253) NOT NULL DEFAULT '',
  INDEX idx_radgroupcheck_groupname (groupname)
);

CREATE TABLE IF NOT EXISTS radgroupreply (
  id INT AUTO_INCREMENT PRIMARY KEY,
  groupname VARCHAR(64) NOT NULL DEFAULT '',
  attribute VARCHAR(64) NOT NULL DEFAULT '',
  op CHAR(2) NOT NULL DEFAULT '=',
  value VARCHAR(253) NOT NULL DEFAULT '',
  INDEX idx_radgroupreply_groupname (groupname)
);

CREATE TABLE IF NOT EXISTS radusergroup (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL DEFAULT '',
  groupname VARCHAR(64) NOT NULL DEFAULT '',
  priority INT NOT NULL DEFAULT 1,
  INDEX idx_radusergroup_username (username)
);

CREATE TABLE IF NOT EXISTS radacct (
  radacctid BIGINT AUTO_INCREMENT PRIMARY KEY,
  acctsessionid VARCHAR(64) NOT NULL DEFAULT '',
  acctuniqueid VARCHAR(32) NOT NULL DEFAULT '',
  username VARCHAR(64) NOT NULL DEFAULT '',
  realm VARCHAR(64) DEFAULT '',
  nasipaddress VARCHAR(15) NOT NULL DEFAULT '',
  nasportid VARCHAR(32) DEFAULT NULL,
  nasporttype VARCHAR(32) DEFAULT NULL,
  acctstarttime DATETIME DEFAULT NULL,
  acctupdatetime DATETIME DEFAULT NULL,
  acctstoptime DATETIME DEFAULT NULL,
  acctinterval INT DEFAULT NULL,
  acctsessiontime INT UNSIGNED DEFAULT NULL,
  acctauthentic VARCHAR(32) DEFAULT NULL,
  connectinfo_start VARCHAR(128) DEFAULT NULL,
  connectinfo_stop VARCHAR(128) DEFAULT NULL,
  acctinputoctets BIGINT DEFAULT NULL,
  acctoutputoctets BIGINT DEFAULT NULL,
  calledstationid VARCHAR(50) NOT NULL DEFAULT '',
  callingstationid VARCHAR(50) NOT NULL DEFAULT '',
  acctterminatecause VARCHAR(32) NOT NULL DEFAULT '',
  servicetype VARCHAR(32) DEFAULT NULL,
  framedprotocol VARCHAR(32) DEFAULT NULL,
  framedipaddress VARCHAR(15) NOT NULL DEFAULT '',
  framedipv6address VARCHAR(45) DEFAULT NULL,
  framedipv6prefix VARCHAR(45) DEFAULT NULL,
  framedinterfaceid VARCHAR(44) DEFAULT NULL,
  delegatedipv6prefix VARCHAR(45) DEFAULT NULL,
  INDEX idx_radacct_username (username),
  INDEX idx_radacct_acctsessionid (acctsessionid),
  INDEX idx_radacct_acctsessiontime (acctsessiontime),
  INDEX idx_radacct_acctstarttime (acctstarttime),
  INDEX idx_radacct_acctuniqueid (acctuniqueid),
  INDEX idx_radacct_nasipaddress (nasipaddress)
);

CREATE TABLE IF NOT EXISTS radpostauth (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL DEFAULT '',
  pass VARCHAR(64) NOT NULL DEFAULT '',
  reply VARCHAR(32) NOT NULL DEFAULT '',
  authdate TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_radpostauth_username (username),
  INDEX idx_radpostauth_authdate (authdate)
);

-- NAS Table (FreeRADIUS compatible)
CREATE TABLE IF NOT EXISTS nas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nasname VARCHAR(128) NOT NULL UNIQUE,
  shortname VARCHAR(32) DEFAULT NULL,
  type VARCHAR(30) DEFAULT 'other',
  ports INT DEFAULT NULL,
  secret VARCHAR(60) NOT NULL,
  server VARCHAR(64) DEFAULT NULL,
  community VARCHAR(50) DEFAULT NULL,
  description VARCHAR(200) DEFAULT NULL,
  location VARCHAR(255) DEFAULT NULL,
  model VARCHAR(100) DEFAULT NULL,
  apiPort INT DEFAULT 8728,
  apiUsername VARCHAR(100) DEFAULT NULL,
  apiPassword VARCHAR(255) DEFAULT NULL,
  status ENUM('active', 'inactive', 'maintenance') DEFAULT 'active',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_nas_nasname (nasname)
);

-- RADIUS Cards Table
CREATE TABLE IF NOT EXISTS radius_cards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password VARCHAR(64) NOT NULL,
  serialNumber VARCHAR(20) NOT NULL UNIQUE,
  batchId VARCHAR(50) DEFAULT NULL,
  planId INT NOT NULL,
  createdBy INT NOT NULL,
  resellerId INT DEFAULT NULL,
  usedBy INT DEFAULT NULL,
  status ENUM('unused', 'active', 'used', 'expired', 'suspended', 'cancelled') DEFAULT 'unused',
  activatedAt TIMESTAMP NULL DEFAULT NULL,
  firstLoginAt TIMESTAMP NULL DEFAULT NULL,
  expiresAt TIMESTAMP NULL DEFAULT NULL,
  totalSessionTime INT DEFAULT 0,
  totalDataUsed BIGINT DEFAULT 0,
  lastActivity TIMESTAMP NULL DEFAULT NULL,
  purchasePrice DECIMAL(10, 2) DEFAULT NULL,
  salePrice DECIMAL(10, 2) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_radius_cards_username (username),
  INDEX idx_radius_cards_serialNumber (serialNumber),
  INDEX idx_radius_cards_status (status),
  INDEX idx_radius_cards_planId (planId),
  INDEX idx_radius_cards_createdBy (createdBy),
  INDEX idx_radius_cards_resellerId (resellerId)
);

-- Card Batches Table
CREATE TABLE IF NOT EXISTS card_batches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batchId VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  planId INT NOT NULL,
  createdBy INT NOT NULL,
  resellerId INT DEFAULT NULL,
  quantity INT NOT NULL,
  templateImageUrl TEXT DEFAULT NULL,
  cardsPerPage INT DEFAULT 8,
  qrCodeUrl VARCHAR(255) DEFAULT NULL,
  pdfUrl TEXT DEFAULT NULL,
  csvUrl TEXT DEFAULT NULL,
  status ENUM('generating', 'completed', 'failed') DEFAULT 'generating',
  errorMessage TEXT DEFAULT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_card_batches_batchId (batchId),
  INDEX idx_card_batches_planId (planId),
  INDEX idx_card_batches_createdBy (createdBy)
);

-- Card Templates Table
CREATE TABLE IF NOT EXISTS card_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT DEFAULT NULL,
  backgroundImageUrl TEXT DEFAULT NULL,
  width INT DEFAULT 400,
  height INT DEFAULT 250,
  usernamePosition JSON DEFAULT NULL,
  passwordPosition JSON DEFAULT NULL,
  serialPosition JSON DEFAULT NULL,
  qrPosition JSON DEFAULT NULL,
  logoPosition JSON DEFAULT NULL,
  planNamePosition JSON DEFAULT NULL,
  expiryPosition JSON DEFAULT NULL,
  fontFamily VARCHAR(100) DEFAULT 'Arial',
  fontSize INT DEFAULT 12,
  fontColor VARCHAR(20) DEFAULT '#000000',
  isDefault BOOLEAN DEFAULT FALSE,
  createdBy INT DEFAULT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Online Sessions Table
CREATE TABLE IF NOT EXISTS online_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL,
  cardId INT DEFAULT NULL,
  nasId INT DEFAULT NULL,
  nasIpAddress VARCHAR(15) NOT NULL,
  framedIpAddress VARCHAR(15) DEFAULT NULL,
  acctSessionId VARCHAR(64) NOT NULL,
  sessionStartTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  lastUpdateTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  sessionTime INT DEFAULT 0,
  inputOctets BIGINT DEFAULT 0,
  outputOctets BIGINT DEFAULT 0,
  callingStationId VARCHAR(50) DEFAULT NULL,
  calledStationId VARCHAR(50) DEFAULT NULL,
  serviceType VARCHAR(32) DEFAULT NULL,
  framedProtocol VARCHAR(32) DEFAULT NULL,
  INDEX idx_online_sessions_username (username),
  INDEX idx_online_sessions_nasIpAddress (nasIpAddress),
  INDEX idx_online_sessions_acctSessionId (acctSessionId)
);

-- Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  planId INT NOT NULL,
  cardId INT DEFAULT NULL,
  status ENUM('active', 'expired', 'suspended', 'cancelled') DEFAULT 'active',
  startDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  endDate TIMESTAMP NULL DEFAULT NULL,
  autoRenew BOOLEAN DEFAULT FALSE,
  totalDataUsed BIGINT DEFAULT 0,
  totalSessionTime INT DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_subscriptions_userId (userId),
  INDEX idx_subscriptions_planId (planId),
  INDEX idx_subscriptions_status (status)
);
