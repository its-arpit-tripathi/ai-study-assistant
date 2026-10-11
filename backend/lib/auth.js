import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { getPool } from '../config/database.js';

export function validateAuthConfig() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set to a random secret of at least 32 characters.');
  }
}

export async function registerUser(emailInput, password) {
  const email = String(emailInput || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    const err = new Error('Enter a valid email address.'); err.status = 400; throw err;
  }
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    const err = new Error('Password must be 12–128 characters long.'); err.status = 400; throw err;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const db = getPool();
  try {
    const result = await db.query('INSERT INTO users(email,password_hash) VALUES($1,$2) RETURNING id,email', [email, passwordHash]);
    const user = result.rows[0];
    await db.query('INSERT INTO notebooks(user_id,name) VALUES($1,$2) ON CONFLICT(user_id,name) DO NOTHING', [user.id, 'My Notebook']);
    return user;
  } catch (error) {
    if (error.code === '23505') { const err = new Error('An account with this email already exists.'); err.status = 409; throw err; }
    throw error;
  }
}

export async function loginUser(emailInput, password) {
  const email = String(emailInput || '').trim().toLowerCase();
  const result = await getPool().query('SELECT id,email,password_hash FROM users WHERE email=$1', [email]);
  const user = result.rows[0];
  const valid = user && typeof password === 'string' && await bcrypt.compare(password, user.password_hash);
  if (!valid) { const err = new Error('Invalid email or password.'); err.status = 401; throw err; }
  return { id: user.id, email: user.email };
}

export function createToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '2h', issuer: 'notebooklm-lite', audience: 'notebooklm-lite-client' });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: 'Sign in to continue.' });
  try {
    const payload = jwt.verify(match[1], process.env.JWT_SECRET, { issuer: 'notebooklm-lite', audience: 'notebooklm-lite-client' });
    if (!payload.sub) throw new Error('Missing subject');
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
}
