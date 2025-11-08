/**
 * @file Type definitions for User Service
 * @description Centralized TypeScript types and interfaces
 */

import { FastifyRequest } from 'fastify';

// User types (from database schema)
export interface User {
  id: number;
  username: string;
  email: string;
  avatar_base64?: string;
  is_active: boolean;
  is_online: boolean;
  last_seen?: string;
  created_at: string;
  updated_at: string;
}

// User profile update
export interface ProfileUpdateBody {
  username?: string;
  avatar_base64?: string;
}

// Friend request
export interface FriendRequest {
  id: number;
  from_user_id: number;
  to_user_id: number;
  message?: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  responded_at?: string;
}

// Friendship
export interface Friendship {
  id: number;
  user_id: number;
  friend_id: number;
  created_at: string;
}

// User statistics
export interface UserStats {
  id: number;
  user_id: number;
  games_played: number;
  games_won: number;
  games_lost: number;
  win_rate: number;
  total_score: number;
  current_streak: number;
  best_streak: number;
  ranking: number;
  tournaments_played: number;
  tournaments_won: number;
  average_game_duration: number;
  updated_at: string;
}

// JWT payload (from auth-service)
export interface JWTPayload {
  id: number;
  username: string;
  email: string;
}

// Authenticated request
export interface AuthenticatedRequest extends FastifyRequest {
  user: JWTPayload;
}

// Search query
export interface SearchQuery {
  q: string;
}

// Friend request body
export interface FriendRequestBody {
  to_user_id: number;
  message?: string;
}
