import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

const [roles] = await connection.execute('SELECT role, COUNT(*) as count FROM users GROUP BY role');
console.log('Roles:', roles);

const [admins] = await connection.execute("SELECT id, username, email, role FROM users WHERE role = 'super_admin' LIMIT 5");
console.log('Super Admins:', admins);

await connection.end();
