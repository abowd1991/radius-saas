import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: 'gateway01.eu-central-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '3dDFSGvjKN5262s.root',
  password: 'Abowd2004200420042004',
  database: 'radius_saas',
  ssl: { rejectUnauthorized: true }
});

const [rows] = await conn.execute("SELECT id, shortname, vpnUsername, vpnPassword FROM nas WHERE vpnUsername LIKE '%abd%'");
console.log('NAS with abd username:');
console.log(JSON.stringify(rows, null, 2));

await conn.end();
