 // server/src/db.js
import mysql from 'mysql2';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the server root directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

console.log('📊 Database Config:');
console.log(`  Host: ${process.env.DB_HOST}`);
console.log(`  Port: ${process.env.DB_PORT}`);
console.log(`  User: ${process.env.DB_USER}`);
console.log(`  Database: ${process.env.DB_NAME}`);
console.log(`  Password: ${process.env.DB_PASS ? '*****' : 'Not set'}`);

// Create connection pool with correct port
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'exam_portal',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

// Promisify for async/await
const promisePool = pool.promise();

// Export both callback and promise versions
export const db = pool;
export const dbPromise = promisePool;

// Test connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    console.error('Please check your database credentials in .env file');
    console.error('Make sure the .env file is in the server root directory');
  } else {
    console.log('✅ Database connected successfully');
    connection.release();
  }
});