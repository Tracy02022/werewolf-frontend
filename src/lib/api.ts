const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

export type Role = string;

export type RoleInfo = {
    id: string;
    name: string;
    team: 'WOLF' | 'GOOD' | 'THIRD_PARTY' | string;
    description: string;
};

export type Board = {
    id: string;
    name: string;
    playerCount: number;
    description: string;
    roles: Record<string, number>;
};

export type Player = {
    id: string;
    name: string;
    role?: string;
    alive: boolean;
    seatNumber: number;
    host: boolean;
};

export type GameRoom = {
    roomCode: string;
    playerCount: number;
    boardId?: string | null;
    customMode: boolean;
    customRoles?: Record<string, number> | null;
    phase: 'WAITING' | 'NIGHT' | 'SHERIFF_ELECTION' | 'DAY_DISCUSSION' | 'VOTING' | 'FINISHED' | string;
    round: number;
    hostPlayerId: string;
    players: Player[];
    currentNightAction?: 'NONE' | 'WOLF_KILL' | 'WITCH' | 'SEER' | 'MECHANICAL_WOLF' | 'HUNTER_CHECK' | 'FINISHED' | string;
    nightActionEndsAtEpochMs?: number;
    wolfKillTargetSeatNumber?: number | null;
    wolfKillActorPlayerId?: string | null;
    witchSavedWolfKill?: boolean;
    witchPoisonTargetSeatNumber?: number | null;
    witchSaveUsed?: boolean;
    witchPoisonUsed?: boolean;
    nightDeathSeatNumbers?: number[];
    nightDeathMessage?: string;
    firstDayNightReportReleased?: boolean;
    hunterCanShootSeatNumbers?: number[];
    seerCheckedSeatNumber?: number | null;
    seerCheckedTeam?: string | null;
    seerCheckedRole?: string | null;
    seerCheckedRoleName?: string | null;
    mechanicalWolfLearnedSeatNumber?: number | null;
    mechanicalWolfLearnedRole?: string | null;
    mechanicalWolfLearnedRoleName?: string | null;
};

export type RoleLookupResponse = {
    role: string;
    roleInfo: RoleInfo;
};

export type RulesResponse = {
    judgeIntro: string;
    nightOrder: string[];
    winCondition: Record<string, string>;
    roles: RoleInfo[];
    boards: Board[];
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options?.headers || {})
        }
    });

    if (!res.ok) {
        const message = await res.text();
        throw new Error(message || `Request failed: ${res.status}`);
    }

    return res.json();
}

export const api = {
    getRoles: () => request<RoleInfo[]>('/api/roles'),

    getBoards: (playerCount?: number) =>
        request<Board[]>(playerCount ? `/api/boards?playerCount=${playerCount}` : '/api/boards'),

    getRules: () => request<RulesResponse>('/api/rules'),

    createRoom: (payload: {
        playerCount: number;
        hostName: string;
        seatNumber: number;
        boardId?: string;
        customMode: boolean;
        customRoles?: Record<string, number>;
    }) =>
        request<GameRoom>('/api/rooms', {
            method: 'POST',
            body: JSON.stringify(payload)
        }),

    joinRoom: (roomCode: string, playerName: string, seatNumber: number) =>
        request<GameRoom>(`/api/rooms/${roomCode}/join`, {
            method: 'POST',
            body: JSON.stringify({ playerName, seatNumber })
        }),

    moveSeat: (roomCode: string, playerId: string, seatNumber: number) =>
        request<GameRoom>(`/api/rooms/${roomCode}/move-seat`, {
            method: 'POST',
            body: JSON.stringify({ playerId, seatNumber })
        }),

    wolfKill: (roomCode: string, playerId: string, targetSeatNumber: number) =>
        request<GameRoom>(`/api/rooms/${roomCode}/wolf-kill`, {
            method: 'POST',
            body: JSON.stringify({ playerId, targetSeatNumber })
        }),

    witchAction: (roomCode: string, playerId: string, useSave: boolean, poisonTargetSeatNumber?: number | null) =>
        request<GameRoom>(`/api/rooms/${roomCode}/witch-action`, {
            method: 'POST',
            body: JSON.stringify({ playerId, useSave, poisonTargetSeatNumber })
        }),

    seerAction: (roomCode: string, playerId: string, targetSeatNumber: number) =>
        request<GameRoom>(`/api/rooms/${roomCode}/seer-action`, {
            method: 'POST',
            body: JSON.stringify({ playerId, targetSeatNumber })
        }),

    mechanicalWolfLearn: (roomCode: string, playerId: string, targetSeatNumber: number) =>
        request<GameRoom>(`/api/rooms/${roomCode}/mechanical-wolf-learn`, {
            method: 'POST',
            body: JSON.stringify({ playerId, targetSeatNumber })
        }),

    advanceNightAction: (roomCode: string, playerId: string) =>
        request<GameRoom>(`/api/rooms/${roomCode}/advance-night-action`, {
            method: 'POST',
            body: JSON.stringify({ playerId })
        }),

    getRoom: (roomCode: string) => request<GameRoom>(`/api/rooms/${roomCode}`),

    fillBots: (roomCode: string) =>
        request<GameRoom>(`/api/rooms/${roomCode}/fill-bots`, { method: 'POST' }),

    startGame: (roomCode: string, playerId: string) =>
        request<GameRoom>(`/api/rooms/${roomCode}/start`, {
            method: 'POST',
            body: JSON.stringify({ playerId })
        }),

    nextPhase: (roomCode: string, playerId: string) =>
        request<GameRoom>(`/api/rooms/${roomCode}/next-phase`, {
            method: 'POST',
            body: JSON.stringify({ playerId })
        }),

    getMyRole: (roomCode: string, playerId: string) =>
        request<RoleLookupResponse>(`/api/rooms/${roomCode}/players/${playerId}/role`)
};
