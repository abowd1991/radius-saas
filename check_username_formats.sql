-- Check username formats in radiusCards
SELECT 
  'radiusCards' as source,
  username,
  createdBy,
  status,
  createdAt
FROM radius_cards 
WHERE username LIKE '%80174%' OR username LIKE '%mkk9hj7c%' OR username LIKE '%@VPN%'
LIMIT 10;

-- Check username formats in subscribers  
SELECT 
  'subscribers' as source,
  username,
  createdBy,
  status,
  createdAt
FROM subscribers
WHERE username LIKE '%80174%' OR username LIKE '%mkk9hj7c%' OR username LIKE '%@VPN%'
LIMIT 10;

-- Check active session
SELECT 
  'radacct' as source,
  username,
  nasipaddress,
  acctstarttime,
  acctstoptime,
  acctsessiontime
FROM radacct
WHERE username LIKE '%80174%' OR username LIKE '%mkk9hj7c%' OR username LIKE '%@VPN%'
ORDER BY acctstarttime DESC
LIMIT 5;
