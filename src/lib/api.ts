const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

export type RoleCategory = 'WOLF' | 'GOOD' | 'THIRD_PARTY';
export type Role = string;

export type RoleInfo = {
  id: Role;
  name: string;
  category: RoleCategory;
};

export type BoardDefinition = {
  id: string;
  name: string;
  playerCount: number;
  description: string;
  roles: Record<Role, number>;
};

export type Player = {
  id: string;
  name: string;
  role?: Role | null;
  alive: boolean;
  seatNumber: number;
  host: boolean;
};

export type GameRoom = {
  roomCode: string;
  playerCount: number;
  phase: string;
  round: number;
  hostPlayerId: string;
  boardId?: string | null;
  boardName: string;
  customMode: boolean;
  customRoles: Record<Role, number>;
  players: Player[];
};

export type CreateRoomPayload = {
  playerCount: number;
  hostName: string;
  boardId?: string;
  customMode: boolean;
  customRoles?: Record<Role, number>;
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
    throw new Error(message || `请求失败：${res.status}`);
  }

  return res.json();
}

export const api = {
  getRoles: () => request<RoleInfo[]>('/api/roles'),
  getBoards: (playerCount?: number) =>
    request<BoardDefinition[]>(playerCount ? `/api/boards?playerCount=${playerCount}` : '/api/boards'),
  createRoom: (payload: CreateRoomPayload) =>
    request<GameRoom>('/api/rooms', { method: 'POST', body: JSON.stringify(payload) }),
  joinRoom: (roomCode: string, playerName: string) =>
    request<GameRoom>(`/api/rooms/${roomCode}/join`, { method: 'POST', body: JSON.stringify({ playerName }) }),
  getRoom: (roomCode: string) => request<GameRoom>(`/api/rooms/${roomCode}`),
  fillBots: (roomCode: string) => request<GameRoom>(`/api/rooms/${roomCode}/fill-bots`, { method: 'POST' }),
  startGame: (roomCode: string, playerId: string) =>
    request<GameRoom>(`/api/rooms/${roomCode}/start`, { method: 'POST', body: JSON.stringify({ playerId }) }),
  nextPhase: (roomCode: string, playerId: string) =>
    request<GameRoom>(`/api/rooms/${roomCode}/next-phase`, { method: 'POST', body: JSON.stringify({ playerId }) }),
  getMyRole: (roomCode: string, playerId: string) =>
    request<Player>(`/api/rooms/${roomCode}/players/${playerId}/role`)
};
