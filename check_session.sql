SELECT 
  radacctid,
  username,
  nasipaddress,
  acctstarttime,
  acctstoptime,
  acctsessiontime,
  acctinputoctets,
  acctoutputoctets,
  calledstationid,
  callingstationid,
  framedipaddress
FROM radacct 
WHERE username LIKE '%80174%' OR username LIKE '%mkk9hj7c%'
ORDER BY acctstarttime DESC 
LIMIT 5;
