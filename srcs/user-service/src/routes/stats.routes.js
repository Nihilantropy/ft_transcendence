/**
 * @file Stats Routes
 * @description Routes for user statistics and leaderboards
 */

import { logger } from '../logger.js'
import { statsService } from '../services/statsService.js'

const statsLogger = logger.child({ module: 'routes/stats' })

function getUserId(request) {
  const userId = request.headers['x-user-id']
  if (!userId) {
    throw new Error('User ID not found in request headers')
  }
  return parseInt(userId)
}

export default async function statsRoutes(fastify, options) {
  /**
   * GET /stats/me - Get own statistics
   */
  fastify.get('/me', async (request, reply) => {
    try {
      const userId = getUserId(request)

      const stats = statsService.getUserStats(userId)

      if (!stats) {
        return reply.code(404).send({
          success: false,
          message: 'Statistics not found'
        })
      }

      return reply.code(200).send({
        success: true,
        stats: {
          userId: stats.user_id,
          gamesPlayed: stats.games_played,
          gamesWon: stats.games_won,
          gamesLost: stats.games_lost,
          winRate: stats.win_rate,
          totalScore: stats.total_score,
          currentStreak: stats.current_streak,
          bestStreak: stats.best_streak,
          ranking: stats.ranking,
          tournamentsPlayed: stats.tournaments_played,
          tournamentsWon: stats.tournaments_won,
          averageGameDuration: stats.average_game_duration,
          updatedAt: stats.updated_at
        }
      })
    } catch (error) {
      statsLogger.error('Failed to get own stats', { error: error.message })
      return reply.code(500).send({
        success: false,
        message: 'Failed to retrieve statistics'
      })
    }
  })

  /**
   * GET /stats/:userId - Get user statistics
   */
  fastify.get('/:userId', async (request, reply) => {
    try {
      const { userId } = request.params
      const targetUserId = parseInt(userId)

      if (isNaN(targetUserId)) {
        return reply.code(400).send({
          success: false,
          message: 'Invalid user ID'
        })
      }

      const stats = statsService.getUserStats(targetUserId)

      if (!stats) {
        return reply.code(404).send({
          success: false,
          message: 'Statistics not found'
        })
      }

      return reply.code(200).send({
        success: true,
        stats: {
          userId: stats.user_id,
          gamesPlayed: stats.games_played,
          gamesWon: stats.games_won,
          gamesLost: stats.games_lost,
          winRate: stats.win_rate,
          totalScore: stats.total_score,
          currentStreak: stats.current_streak,
          bestStreak: stats.best_streak,
          ranking: stats.ranking,
          tournamentsPlayed: stats.tournaments_played,
          tournamentsWon: stats.tournaments_won
        }
      })
    } catch (error) {
      statsLogger.error('Failed to get user stats', { error: error.message })
      return reply.code(500).send({
        success: false,
        message: 'Failed to retrieve statistics'
      })
    }
  })

  /**
   * GET /stats/leaderboard - Get leaderboard
   */
  fastify.get('/leaderboard', async (request, reply) => {
    try {
      const { limit = 10, offset = 0 } = request.query

      const leaderboard = statsService.getLeaderboard(parseInt(limit), parseInt(offset))

      return reply.code(200).send({
        success: true,
        leaderboard: leaderboard.map((entry, index) => ({
          rank: parseInt(offset) + index + 1,
          userId: entry.user_id,
          username: entry.username,
          avatar: entry.avatar_base64,
          gamesPlayed: entry.games_played,
          gamesWon: entry.games_won,
          winRate: entry.win_rate,
          ranking: entry.ranking,
          tournamentsWon: entry.tournaments_won
        })),
        count: leaderboard.length
      })
    } catch (error) {
      statsLogger.error('Failed to get leaderboard', { error: error.message })
      return reply.code(500).send({
        success: false,
        message: 'Failed to retrieve leaderboard'
      })
    }
  })

  /**
   * GET /stats/rank/:userId - Get user rank position
   */
  fastify.get('/rank/:userId', async (request, reply) => {
    try {
      const { userId } = request.params
      const targetUserId = parseInt(userId)

      if (isNaN(targetUserId)) {
        return reply.code(400).send({
          success: false,
          message: 'Invalid user ID'
        })
      }

      const rank = statsService.getUserRank(targetUserId)

      if (!rank) {
        return reply.code(404).send({
          success: false,
          message: 'User rank not found'
        })
      }

      return reply.code(200).send({
        success: true,
        rank: rank.rank,
        ranking: rank.ranking,
        gamesWon: rank.gamesWon
      })
    } catch (error) {
      statsLogger.error('Failed to get user rank', { error: error.message })
      return reply.code(500).send({
        success: false,
        message: 'Failed to retrieve rank'
      })
    }
  })

  /**
   * GET /stats/history/:userId - Get match history
   */
  fastify.get('/history/:userId', async (request, reply) => {
    try {
      const { userId } = request.params
      const { limit = 10, offset = 0 } = request.query
      const targetUserId = parseInt(userId)

      if (isNaN(targetUserId)) {
        return reply.code(400).send({
          success: false,
          message: 'Invalid user ID'
        })
      }

      const matches = statsService.getMatchHistory(targetUserId, parseInt(limit), parseInt(offset))

      return reply.code(200).send({
        success: true,
        matches: matches.map(match => ({
          id: match.id,
          type: match.type,
          status: match.status,
          player1: {
            id: match.player1_id,
            username: match.player1_username,
            avatar: match.player1_avatar,
            score: match.player1_score
          },
          player2: match.player2_id ? {
            id: match.player2_id,
            username: match.player2_username,
            avatar: match.player2_avatar,
            score: match.player2_score
          } : null,
          winnerId: match.winner_id,
          finishedAt: match.finished_at
        })),
        count: matches.length
      })
    } catch (error) {
      statsLogger.error('Failed to get match history', { error: error.message })
      return reply.code(500).send({
        success: false,
        message: 'Failed to retrieve match history'
      })
    }
  })
}
