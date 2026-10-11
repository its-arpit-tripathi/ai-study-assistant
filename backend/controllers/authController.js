import { UserModel } from '../models/UserModel.js';

export const authController = {
  async register(req, res, next) {
    try {
      const user = await UserModel.create(req.body?.email, req.body?.password);
      const token = UserModel.generateToken(user);
      return res.status(201).json({ user, token });
    } catch (error) {
      next(error);
    }
  },

  async login(req, res, next) {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      const userRecord = await UserModel.findByEmail(email);
      if (!userRecord) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const isValid = await UserModel.verifyPassword(password, userRecord.password_hash);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const safeUser = { id: userRecord.id, email: userRecord.email, created_at: userRecord.created_at };
      const token = UserModel.generateToken(safeUser);
      return res.json({ user: safeUser, token });
    } catch (error) {
      next(error);
    }
  },

  getMe(req, res) {
    return res.json({ user: req.user });
  },
};
