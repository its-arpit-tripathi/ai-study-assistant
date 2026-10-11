import { UserModel } from '../models/UserModel.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Sign in first.' });
  }

  const token = header.slice(7).trim();
  try {
    const payload = UserModel.verifyToken(token);
    const user = await UserModel.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ error: 'User account not found or removed.' });
    }
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }
    return res.status(401).json({ error: 'Invalid authentication token.' });
  }
}
