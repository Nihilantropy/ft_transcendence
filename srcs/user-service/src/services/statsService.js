/**
 * @file Stats Service
 * @description Business logic for user statistics and rankings
 */

import { logger } from '../logger.js'
import db from '../database.js'

const statsServiceLogger = logger.child({ module: 'services/stats' })

export class StatsService {
  /**
   * Get user statistics
   */
  getUserStats(userId) {
    try {
      const stats = db.prepare(`
        SELECT
          user_id,
          games_played,
          games_won,
          games_lost,
          win_rate,
          total_score,
          current_streak,
          best_streak,
          ranking,
          tournaments_played,
          tournaments_won,
          average_game_duration,
          updated_at
        FROM user_stats
        WHERE user_id = ?
      `).get(userId)

      return stats || null
    } catch (error) {
      statsServiceLogger.error('Failed to get user stats', { userId, error: error.message })
      throw error
    }
  }

  /**
   * Get leaderboard (top players by ranking)
   */
  getLeaderboard(limit = 10, offset = 0) {
    try {
      const leaderboard = db.prepare(`
        SELECT
          s.user_id,
          u.username,
          u.avatar_base64,
          s.games_played,
          s.games_won,
          s.win_rate,
          s.ranking,
          s.tournaments_won
        FROM user_stats s
        JOIN users u ON s.user_id = u.id
        WHERE u.is_active = 1
        ORDER BY s.ranking DESC, s.games_won DESC
        LIMIT ? OFFSET ?
      `).all(limit, offset)

      return leaderboard
    } catch (error) {
      statsServiceLogger.error('Failed to get leaderboard', { error: error.message })
      throw error
    }
  }

  /**
   * Get user rank position
   */
  getUserRank(userId) {
    try {
      // Get user's ranking score
      const userStats = this.getUserStats(userId)
      if (!userStats) {
        return null
      }

      // Count how many users have better ranking
      const result = db.prepare(`
        SELECT COUNT(*) as rank
        FROM user_stats s
        JOIN users u ON s.user_id = u.id
        WHERE u.is_active = 1 AND (
          s.ranking > ? OR
          (s.ranking = ? AND s.games_won > ?)
        )
      `).get(userStats.ranking, userStats.ranking, userStats.games_won)

      return {
        rank: result.rank + 1, // Add 1 because rank starts at 1, not 0
        ranking: userStats.ranking,
        gamesWon: userStats.games_won
      }
    } catch (error) {
      statsServiceLogger.error('Failed to get user rank', { userId, error: error.message })
      throw error
    }
  }

  /**
   * Update user statistics after game
   * Note: This would typically be called by the Game Service
   */
  updateStatsAfterGame(userId, won, score, duration) {
    try {
      return db.transaction(() => {
        const stats = this.getUserStats(userId)

        if (!stats) {
          // Initialize stats if doesn't exist
          db.prepare(`
            INSERT INTO user_stats (
              user_id, games_played, games_won, games_lost,
              total_score, ranking, updated_at
            ) VALUES (?, 0, 0, 0, 0, 1000, CURRENT_TIMESTAMP)
          `).run(userId)
        }

        // Calculate new values
        const gamesPlayed = (stats?.games_played || 0) + 1
        const gamesWon = (stats?.games_won || 0) + (won ? 1 : 0)
        const gamesLost = (stats?.games_lost || 0) + (won ? 0 : 1)
        const winRate = (gamesWon / gamesPlayed) * 100
        const totalScore = (stats?.total_score || 0) + score

        // Update streak
        let currentStreak = stats?.current_streak || 0
        let bestStreak = stats?.best_streak || 0

        if (won) {
          currentStreak = currentStreak >= 0 ? currentStreak + 1 : 1
        } else {
          currentStreak = currentStreak <= 0 ? currentStreak - 1 : -1
        }

        if (Math.abs(currentStreak) > Math.abs(bestStreak)) {
          bestStreak = currentStreak
        }

        // Calculate new ranking (simple ELO-like system)
        const oldRanking = stats?.ranking || 1000
        const K = 32 // K-factor for ranking adjustment
        const rankingChange = won ? K : -K
        const newRanking = Math.max(0, oldRanking + rankingChange)

        // Update average game duration
        const oldAvg = stats?.average_game_duration || 0
        const newAvg = Math.round((oldAvg * (gamesPlayed - 1) + duration) / gamesPlayed)

        // Update database
        db.prepare(`
          UPDATE user_stats
          SET
            games_played = ?,
            games_won = ?,
            games_lost = ?,
            win_rate = ?,
            total_score = ?,
            current_streak = ?,
            best_streak = ?,
            ranking = ?,
            average_game_duration = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `).run(
          gamesPlayed,
          gamesWon,
          gamesLost,
          winRate,
          totalScore,
          currentStreak,
          bestStreak,
          newRanking,
          newAvg,
          userId
        )

        statsServiceLogger.info('✅ Stats updated after game', {
          userId,
          won,
          newRanking,
          gamesPlayed
        })

        return this.getUserStats(userId)
      })()
    } catch (error) {
      statsServiceLogger.error('Failed to update stats', { userId, error: error.message })
      throw error
    }
  }

  /**
   * Get match history for user
   */
  getMatchHistory(userId, limit = 10, offset = 0) {
    try {
      const matches = db.prepare(`
        SELECT
          g.id,
          g.type,
          g.status,
          g.player1_id,
          g.player2_id,
          g.player1_score,
          g.player2_score,
          g.winner_id,
          g.finished_at,
          u1.username as player1_username,
          u1.avatar_base64 as player1_avatar,
          u2.username as player2_username,
          u2.avatar_base64 as player2_avatar
        FROM games g
        LEFT JOIN users u1 ON g.player1_id = u1.id
        LEFT JOIN users u2 ON g.player2_id = u2.id
        WHERE (g.player1_id = ? OR g.player2_id = ?) AND g.status = 'finished'
        ORDER BY g.finished_at DESC
        LIMIT ? OFFSET ?
      `).all(userId, userId, limit, offset)

      return matches
    } catch (error) {
      statsServiceLogger.error('Failed to get match history', { userId, error: error.message })
      throw error
    }
  }
}

export const statsService = new StatsService()
export default statsService
