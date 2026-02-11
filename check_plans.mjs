import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

console.log("Checking saas_plans table...");
const result = await connection.execute('SELECT * FROM saas_plans LIMIT 10');
console.log("Plans found:", result[0].length);
console.log(JSON.stringify(result[0], null, 2));

await connection.end();
