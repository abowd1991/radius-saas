import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Keep only the real admin account (id: 3)
const [result] = await connection.execute('DELETE FROM users WHERE id != 3');
console.log('Deleted users:', result.affectedRows);

// Verify remaining users
const [remaining] = await connection.execute('SELECT id, username, email, role FROM users');
console.log('Remaining users:', remaining);

await connection.end();
