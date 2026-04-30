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
  phase: 'WAITING' | 'NIGHT' | 'DAY_DISCUSSION' | 'VOTING' | 'FINISHED' | string;
  round: number;
  hostPlayerId: string;
  players: Player[];
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
  createRoom: (payload: {
    playerCount: number;
    hostName: string;
    boardId?: string;
    customMode: boolean;
    customRoles?: Record<string, number>;
  }) =>
    request<GameRoom>('/api/rooms', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  joinRoom: (roomCode: string, playerName: string) =>
    request<GameRoom>(`/api/rooms/${roomCode}/join`, {
      method: 'POST',
      body: JSON.stringify({ playerName })
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
    request<Player>(`/api/rooms/${roomCode}/players/${playerId}/role`)
};
