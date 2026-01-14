import { User, GitHubUser } from '@cx-dam/shared';
import { db } from '../db/client';
import { logger } from '../utils/logger';

export class UserRepository {
  /**
   * Map database row (snake_case) to User type (camelCase)
   */
  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      githubId: row.github_id,
      login: row.login,
      name: row.name,
      email: row.email,
      avatarUrl: row.avatar_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Find user by GitHub ID
   */
  async findByGithubId(githubId: number): Promise<User | null> {
    try {
      const result = await db.query(
        'SELECT * FROM users WHERE github_id = $1',
        [githubId]
      );

      return result.rows[0] ? this.mapRowToUser(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find user by GitHub ID', { githubId, error });
      throw error;
    }
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    try {
      const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
      return result.rows[0] ? this.mapRowToUser(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find user by ID', { id, error });
      throw error;
    }
  }

  /**
   * Create a new user from GitHub data
   */
  async create(githubUser: GitHubUser): Promise<User> {
    try {
      const result = await db.query(
        `INSERT INTO users (github_id, login, name, email, avatar_url)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [githubUser.id, githubUser.login, githubUser.name, githubUser.email, githubUser.avatarUrl]
      );

      const user = this.mapRowToUser(result.rows[0]);
      logger.info('Created new user', { userId: user.id, githubId: githubUser.id });

      return user;
    } catch (error) {
      logger.error('Failed to create user', { githubUser, error });
      throw error;
    }
  }

  /**
   * Update user information
   */
  async update(id: string, data: Partial<GitHubUser>): Promise<User> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.login) {
        fields.push(`login = $${paramIndex++}`);
        values.push(data.login);
      }
      if (data.name !== undefined) {
        fields.push(`name = $${paramIndex++}`);
        values.push(data.name);
      }
      if (data.email !== undefined) {
        fields.push(`email = $${paramIndex++}`);
        values.push(data.email);
      }
      if (data.avatarUrl) {
        fields.push(`avatar_url = $${paramIndex++}`);
        values.push(data.avatarUrl);
      }

      values.push(id);

      const result = await db.query(
        `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      logger.info('Updated user', { userId: id });

      return this.mapRowToUser(result.rows[0]);
    } catch (error) {
      logger.error('Failed to update user', { id, error });
      throw error;
    }
  }

  /**
   * Find or create user
   */
  async findOrCreate(githubUser: GitHubUser): Promise<User> {
    const existingUser = await this.findByGithubId(githubUser.id);

    if (existingUser) {
      // Update user info in case it changed
      return this.update(existingUser.id, githubUser);
    }

    return this.create(githubUser);
  }
}

export const userRepository = new UserRepository();
