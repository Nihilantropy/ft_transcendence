import { Database } from 'better-sqlite3';
import {
  Tournament,
  TournamentParticipant,
  TournamentStatus,
  TournamentBracket,
  TournamentMatch,
  CreateTournamentRequest,
  JoinTournamentRequest
} from '../types';

export class TournamentService {
  constructor(private db: Database) {}

  /**
   * Create a new tournament
   * Can be created by authenticated user or anonymously
   */
  createTournament(
    request: CreateTournamentRequest,
    userId?: number
  ): Tournament {
    const { name, maxPlayers } = request;

    // Validate maxPlayers is a power of 2
    if (!this.isPowerOfTwo(maxPlayers) || maxPlayers < 2 || maxPlayers > 32) {
      throw new Error('Max players must be a power of 2 (2, 4, 8, 16, or 32)');
    }

    // Insert tournament into database
    const stmt = this.db.prepare(`
      INSERT INTO tournaments (name, max_participants, status, created_by)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(name, maxPlayers, 'registration', userId || null);
    const tournamentId = result.lastInsertRowid as number;

    return {
      id: tournamentId.toString(),
      name,
      status: 'registering',
      maxPlayers,
      participants: [],
      bracket: { rounds: 0, matches: [] },
      createdAt: Date.now()
    };
  }

  /**
   * Join a tournament (authenticated or anonymous)
   */
  joinTournament(request: JoinTournamentRequest): TournamentParticipant {
    const { tournamentId, userId, alias, sessionId } = request;

    // Validate alias
    if (!alias || alias.trim().length === 0) {
      throw new Error('Alias is required');
    }

    if (alias.length > 50) {
      throw new Error('Alias must be 50 characters or less');
    }

    // Get tournament
    const tournament = this.getTournamentById(tournamentId);
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    // Check if tournament is accepting participants
    if (tournament.status !== 'registering') {
      throw new Error('Tournament is not accepting participants');
    }

    // Check if tournament is full
    if (tournament.participants.length >= tournament.maxPlayers) {
      throw new Error('Tournament is full');
    }

    // Check if user is already in tournament
    if (userId) {
      const existingParticipant = this.db
        .prepare(
          `SELECT id FROM tournament_participants
           WHERE tournament_id = ? AND user_id = ?`
        )
        .get(parseInt(tournamentId), userId);

      if (existingParticipant) {
        throw new Error('User already in tournament');
      }
    }

    // Check if alias is already taken in this tournament
    const aliasExists = this.db
      .prepare(
        `SELECT id FROM tournament_participants
         WHERE tournament_id = ? AND LOWER(alias) = LOWER(?)`
      )
      .get(parseInt(tournamentId), alias);

    if (aliasExists) {
      throw new Error('Alias already taken in this tournament');
    }

    // Insert participant
    const stmt = this.db.prepare(`
      INSERT INTO tournament_participants (tournament_id, user_id, alias, session_id)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(
      parseInt(tournamentId),
      userId || null,
      alias.trim(),
      sessionId || null
    );

    // Get username if authenticated
    let username: string | undefined;
    if (userId) {
      const user = this.db
        .prepare('SELECT username FROM users WHERE id = ?')
        .get(userId) as { username: string } | undefined;
      username = user?.username;
    }

    return {
      userId,
      username,
      alias: alias.trim(),
      sessionId,
      seed: tournament.participants.length + 1,
      eliminated: false,
      participantType: userId ? 'authenticated' : 'anonymous'
    };
  }

  /**
   * Get tournament by ID
   */
  getTournamentById(tournamentId: string): Tournament | null {
    const tournament = this.db
      .prepare(
        `SELECT id, name, max_participants, status, created_by, created_at
         FROM tournaments WHERE id = ?`
      )
      .get(parseInt(tournamentId)) as any;

    if (!tournament) {
      return null;
    }

    // Get participants
    const participants = this.getParticipants(tournamentId);

    // Get bracket if tournament started
    const bracket = this.getBracket(tournamentId);

    return {
      id: tournament.id.toString(),
      name: tournament.name,
      status: this.mapDbStatusToTournamentStatus(tournament.status),
      maxPlayers: tournament.max_participants,
      participants,
      bracket: bracket || { rounds: 0, matches: [] },
      createdAt: new Date(tournament.created_at).getTime()
    };
  }

  /**
   * Get all active tournaments
   */
  getActiveTournaments(): Tournament[] {
    const tournaments = this.db
      .prepare(
        `SELECT id, name, max_participants, status, created_by, created_at
         FROM tournaments
         WHERE status IN ('registration', 'in_progress')
         ORDER BY created_at DESC
         LIMIT 50`
      )
      .all() as any[];

    return tournaments.map((t) => {
      const participants = this.getParticipants(t.id.toString());
      return {
        id: t.id.toString(),
        name: t.name,
        status: this.mapDbStatusToTournamentStatus(t.status),
        maxPlayers: t.max_participants,
        participants,
        bracket: { rounds: 0, matches: [] },
        createdAt: new Date(t.created_at).getTime()
      };
    });
  }

  /**
   * Start tournament and generate bracket
   */
  startTournament(tournamentId: string): Tournament {
    const tournament = this.getTournamentById(tournamentId);
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    if (tournament.status !== 'registering') {
      throw new Error('Tournament has already started');
    }

    // Check minimum participants (at least 2)
    if (tournament.participants.length < 2) {
      throw new Error('Need at least 2 participants to start');
    }

    // Validate participant count is power of 2
    if (!this.isPowerOfTwo(tournament.participants.length)) {
      throw new Error(
        'Number of participants must be a power of 2 (2, 4, 8, 16, 32)'
      );
    }

    // Generate bracket
    const bracket = this.generateBracket(tournament.participants);

    // Update tournament status
    this.db
      .prepare(
        `UPDATE tournaments
         SET status = 'in_progress', start_time = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .run(parseInt(tournamentId));

    // TODO: Store bracket in database (need tournament_matches table)
    // For now, bracket will be generated on-the-fly

    return {
      ...tournament,
      status: 'in_progress',
      bracket,
      startedAt: Date.now()
    };
  }

  /**
   * Generate tournament bracket (single elimination)
   */
  private generateBracket(
    participants: TournamentParticipant[]
  ): TournamentBracket {
    const numParticipants = participants.length;
    const rounds = Math.log2(numParticipants);

    // Shuffle participants for random seeding
    const shuffled = [...participants].sort(() => Math.random() - 0.5);

    // Assign seeds
    shuffled.forEach((p, index) => {
      p.seed = index + 1;
    });

    // Generate first round matches
    const matches: TournamentMatch[] = [];
    let matchNumber = 1;

    for (let i = 0; i < shuffled.length; i += 2) {
      const player1 = shuffled[i];
      const player2 = shuffled[i + 1];

      matches.push({
        id: `match_${matchNumber}`,
        round: 1,
        matchNumber: matchNumber++,
        player1Id: player1.userId,
        player1Alias: player1.alias,
        player2Id: player2?.userId,
        player2Alias: player2?.alias,
        status: 'pending'
      });
    }

    return {
      rounds,
      matches
    };
  }

  /**
   * Get participants for a tournament
   */
  private getParticipants(tournamentId: string): TournamentParticipant[] {
    const participants = this.db
      .prepare(
        `SELECT
           tp.id,
           tp.user_id,
           tp.alias,
           tp.session_id,
           tp.eliminated_at,
           u.username
         FROM tournament_participants tp
         LEFT JOIN users u ON tp.user_id = u.id
         WHERE tp.tournament_id = ?
         ORDER BY tp.joined_at ASC`
      )
      .all(parseInt(tournamentId)) as any[];

    return participants.map((p, index) => ({
      userId: p.user_id,
      username: p.username,
      alias: p.alias,
      sessionId: p.session_id,
      seed: index + 1,
      eliminated: p.eliminated_at !== null,
      participantType: p.user_id ? 'authenticated' : 'anonymous'
    }));
  }

  /**
   * Get bracket for a tournament
   * TODO: Implement bracket storage and retrieval
   */
  private getBracket(_tournamentId: string): TournamentBracket | null {
    // For now, return null - bracket will be generated on-the-fly
    // In future, store matches in database
    return null;
  }

  /**
   * Map database status to TournamentStatus type
   */
  private mapDbStatusToTournamentStatus(dbStatus: string): TournamentStatus {
    switch (dbStatus) {
      case 'registration':
        return 'registering';
      case 'in_progress':
        return 'in_progress';
      case 'finished':
        return 'completed';
      default:
        return 'registering';
    }
  }

  /**
   * Check if a number is a power of 2
   */
  private isPowerOfTwo(n: number): boolean {
    return n > 0 && (n & (n - 1)) === 0;
  }
}
