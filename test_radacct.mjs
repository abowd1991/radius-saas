import { drizzle } from "drizzle-orm/mysql2";
import { isNull } from "drizzle-orm";
import mysql from "mysql2/promise";

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

try {
  // Test raw SQL query
  const [rows] = await connection.execute("SELECT * FROM radacct WHERE acctstoptime IS NULL LIMIT 1");
  console.log("Raw SQL works:", rows.length, "rows");
  
  // Check column names
  const [cols] = await connection.execute("SHOW COLUMNS FROM radacct");
  console.log("Columns:", cols.map(c => c.Field).join(", "));
} catch (error) {
  console.error("Error:", error.message);
}

await connection.end();
