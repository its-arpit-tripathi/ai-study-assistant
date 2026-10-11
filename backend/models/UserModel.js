import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getPool } from '../config/database.js';

const SALT_ROUNDS = 12;

export class UserModel {
  static validateConfig() {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must be set to a random secret of at least 32 characters.');
    }
  }

  static async create(email, password) {
    if (!email || typeof email !== 'string') throw Object.assign(new Error('A valid email address is required.'), { status: 400 });
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
      throw Object.assign(new Error('A valid email address is required.'), { status: 400 });
    }
    if (!password || typeof password !== 'string' || password.length < 12 || password.length > 128) {
      throw Object.assign(new Error('Password must be between 12 and 128 characters.'), { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const db = getPool();
    const client = await db.connect();

    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
        [normalizedEmail, passwordHash]
      );
      const user = rows[0];
      await client.query(
        'INSERT INTO notebooks (user_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [user.id, 'My Notebook']
      );
      await client.query('COMMIT');
      return user;
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23505') throw Object.assign(new Error('An account with this email already exists.'), { status: 409 });
      throw err;
    } finally {
      client.release();
    }
  }

  static async findByEmail(email) {
    if (!email) return null;
    const db = getPool();
    const { rows } = await db.query(
      'SELECT id, email, password_hash, created_at FROM users WHERE email = $1',
      [email.trim().toLowerCase()]
    );
    return rows[0] || null;
  }

  static async findById(id) {
    if (!id) return null;
    const db = getPool();
    const { rows } = await db.query(
      'SELECT id, email, created_at FROM users WHERE id = $1',
      [id]
    );
    return rows[0] || null;
  }

  static async verifyPassword(plainPassword, passwordHash) {
    return bcrypt.compare(plainPassword, passwordHash);
  }

  static generateToken(user) {
    this.validateConfig();
    return jwt.sign(
      { sub: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d', issuer: 'notebooklm-lite', audience: 'notebooklm-lite-client' }
    );
  }

  static verifyToken(token) {
    this.validateConfig();
    return jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'notebooklm-lite',
      audience: 'notebooklm-lite-client',
    });
  }
}
