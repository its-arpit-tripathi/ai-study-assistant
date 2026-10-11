import { getPool } from '../config/database.js';

export class NotebookModel {
  static async findUserNotebooks(userId) {
    const db = getPool();
    const { rows } = await db.query(
      `SELECT n.id, n.name, n.created_at as "createdAt",
              nm.role,
              u.email as "ownerEmail"
       FROM notebooks n
       JOIN notebook_members nm ON nm.notebook_id = n.id AND nm.user_id = $1
       JOIN users u ON u.id = n.user_id
       ORDER BY n.created_at DESC`,
      [userId]
    );
    return rows;
  }

  static async getMembership(notebookId, userId) {
    const db = getPool();
    const { rows } = await db.query(
      `SELECT role
       FROM notebook_members
       WHERE notebook_id = $1 AND user_id = $2`,
      [notebookId, userId]
    );
    return rows[0]?.role || null;
  }

  static async addMember(notebookId, userId, role = 'viewer') {
    const db = getPool();
    const { rows } = await db.query(
      `INSERT INTO notebook_members (notebook_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (notebook_id, user_id)
       DO UPDATE SET role = EXCLUDED.role
       RETURNING notebook_id, user_id, role`,
      [notebookId, userId, role]
    );
    return rows[0];
  }

  static async removeMember(notebookId, userId) {
    const db = getPool();
    const { rows } = await db.query(
      `DELETE FROM notebook_members
       WHERE notebook_id = $1 AND user_id = $2
       RETURNING notebook_id, user_id`,
      [notebookId, userId]
    );
    return rows.length > 0;
  }

  static async listMembers(notebookId) {
    const db = getPool();
    const { rows } = await db.query(
      `SELECT u.id as "userId", u.email, nm.role, nm.created_at as "joinedAt"
       FROM notebook_members nm
       JOIN users u ON u.id = nm.user_id
       WHERE nm.notebook_id = $1
       ORDER BY nm.role ASC, u.email ASC`,
      [notebookId]
    );
    return rows;
  }
}
