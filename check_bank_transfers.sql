SELECT id, userId, referenceNumber, status, createdAt 
FROM bank_transfer_requests 
ORDER BY id DESC 
LIMIT 10;
