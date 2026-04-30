'use client';

import { useEffect, useMemo, useState } from 'react';
import { Crown, DoorOpen, Eye, Moon, Play, RefreshCcw, Sparkles, Users, X } from 'lucide-react';
import { api, Board, GameRoom, RoleInfo } from '@/lib/api';

const phaseNameMap: Record<string, string> = {
  WAITING: '等待玩家',
  NIGHT: '🌙 夜晚阶段',
  DAY_DISCUSSION: '☀️ 白天发言',
  VOTING: '🗳️ 投票阶段',
  FINISHED: '🏁 游戏结束'
};

const phaseDescriptionMap: Record<string, string> = {
  WAITING: '等待玩家加入，房主可在人数满后开始游戏。',
  NIGHT: '天黑请闭眼，按身份进行夜晚行动。',
  DAY_DISCUSSION: '白天请依次发言，分析场上身份。',
  VOTING: '开始投票，放逐一名玩家。',
  FINISHED: '游戏结束，请查看胜负结果。'
};

const phaseStyleMap: Record<string, string> = {
  WAITING: 'from-slate-500 to-slate-700',
  NIGHT: 'from-indigo-900 to-black',
  DAY_DISCUSSION: 'from-yellow-300 to-orange-400 text-black',
  VOTING: 'from-red-500 to-pink-600',
  FINISHED: 'from-emerald-500 to-teal-600'
};

const playerCounts = [9, 10, 11, 12, 13, 14, 15, 16];
const customCounts = [10, 11, 12, 13, 14, 15, 16];

function teamName(team: string) {
  if (team === 'WOLF') return '狼人阵营';
  if (team === 'GOOD') return '好人阵营';
  if (team === 'THIRD_PARTY') return '第三方阵营';
  return '其他角色';
}

function teamOrder(team: string) {
  if (team === 'WOLF') return 1;
  if (team === 'GOOD') return 2;
  if (team === 'THIRD_PARTY') return 3;
  return 4;
}

function buildDefaultCustomRoles(playerCount: number): Record<string, number> {
  const wolfCount = playerCount >= 15 ? 5 : playerCount >= 12 ? 4 : 3;
  const result: Record<string, number> = {
    WEREWOLF: wolfCount,
    VILLAGER: Math.max(1, playerCount - wolfCount - 3),
    SEER: 1,
    WITCH: 1,
    HUNTER: 1
  };
  if (playerCount >= 11) result.GUARD = 1;
  result.VILLAGER = playerCount - Object.entries(result).filter(([key]) => key !== 'VILLAGER').reduce((sum, [, count]) => sum + count, 0);
  return result;
}

export default function HomePage() {
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [playerCount, setPlayerCount] = useState(12);
  const [mode, setMode] = useState<'BOARD' | 'CUSTOM'>('BOARD');
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [customRoles, setCustomRoles] = useState<Record<string, number>>(buildDefaultCustomRoles(12));
  const [hostName, setHostName] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<RoleInfo | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null);
  const [expandedMyRole, setExpandedMyRole] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmCreate, setConfirmCreate] = useState(false);
  const [confirmNextPhase, setConfirmNextPhase] = useState(false);

  const roleMap = useMemo(() => new Map(roles.map((role) => [role.id, role])), [roles]);

  const groupedRoles = useMemo(() => {
    const groups = roles.reduce<Record<string, RoleInfo[]>>((acc, role) => {
      const group = teamName(role.team);
      acc[group] = acc[group] || [];
      acc[group].push(role);
      return acc;
    }, {});

    return Object.entries(groups).sort(([a], [b]) => {
      const teamA = roles.find((role) => teamName(role.team) === a)?.team || '';
      const teamB = roles.find((role) => teamName(role.team) === b)?.team || '';
      return teamOrder(teamA) - teamOrder(teamB);
    });
  }, [roles]);

  const selectedBoard = boards.find((board) => board.id === selectedBoardId);
  const customTotal = Object.values(customRoles).reduce((sum, count) => sum + count, 0);
  const isHost = Boolean(room && myPlayerId && room.hostPlayerId === myPlayerId);
  const canStart = Boolean(room && isHost && room.phase === 'WAITING' && room.players.length === room.playerCount);
  const canUseCustom = customCounts.includes(playerCount);
  const showRoomSetup = !room;

  useEffect(() => {
    api.getRoles().then(setRoles).catch((err) => setError(`无法加载角色：${err.message}`));
    const savedRoomCode = localStorage.getItem('roomCode');
    const savedPlayerId = localStorage.getItem('playerId');
    if (savedRoomCode) setRoomCodeInput(savedRoomCode);
    if (savedPlayerId) setMyPlayerId(savedPlayerId);
  }, []);

  useEffect(() => {
    api
      .getBoards(playerCount)
      .then((data) => {
        setBoards(data);
        setSelectedBoardId(data[0]?.id || '');
        if (playerCount !== 12 && mode === 'BOARD') setMode('CUSTOM');
        if (!customCounts.includes(playerCount)) setMode('BOARD');
        setCustomRoles(buildDefaultCustomRoles(playerCount));
      })
      .catch((err) => setError(`无法加载板子：${err.message}`));
  }, [playerCount]);

  useEffect(() => {
    if (!room?.roomCode) return;
    const interval = setInterval(() => {
      api.getRoom(room.roomCode).then(setRoom).catch(() => undefined);
    }, 2500);
    return () => clearInterval(interval);
  }, [room?.roomCode]);

  useEffect(() => {
    if (!room || !myPlayerId || room.phase === 'WAITING') {
      setMyRole(null);
      return;
    }

    api
      .getMyRole(room.roomCode, myPlayerId)
      .then((player) => {
        if (player.role) setMyRole(roleMap.get(player.role) || null);
      })
      .catch(() => undefined);
  }, [room?.phase, room?.roomCode, myPlayerId, roleMap]);

  const run = async (action: () => Promise<GameRoom>) => {
    setLoading(true);
    setError('');
    try {
      const updatedRoom = await action();
      setRoom(updatedRoom);
      localStorage.setItem('roomCode', updatedRoom.roomCode);
      setRoomCodeInput(updatedRoom.roomCode);
      return updatedRoom;
    } catch (err: any) {
      setError(err.message || '操作失败');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateRoleCount = (roleId: string, delta: number) => {
    setCustomRoles((prev) => {
      const next = { ...prev };
      const current = next[roleId] || 0;
      const value = Math.max(0, current + delta);
      if (value === 0) delete next[roleId];
      else next[roleId] = value;
      return next;
    });
  };

  const handleJoinRoom = async () => {
    if (!roomCodeInput.trim() || !playerName.trim()) return;
    const joinedRoom = await run(() => api.joinRoom(roomCodeInput.trim(), playerName.trim()));
    if (!joinedRoom) return;
    const joinedPlayer = [...joinedRoom.players].reverse().find((player) => player.name === playerName.trim());
    if (joinedPlayer) {
      setMyPlayerId(joinedPlayer.id);
      localStorage.setItem('playerId', joinedPlayer.id);
    }
    setPlayerName('');
  };

  const handleCreateRoom = async () => {
    setConfirmCreate(false);
    if (!hostName.trim()) {
      setError('请输入你的昵称');
      return;
    }
    if (mode === 'CUSTOM' && customTotal !== playerCount) {
      setError(`当前角色总数为 ${customTotal}，必须等于 ${playerCount}`);
      return;
    }
    if (mode === 'BOARD' && !selectedBoardId) {
      setError('请选择一个经典板子');
      return;
    }

    const createdRoom = await run(() =>
      api.createRoom({
        playerCount,
        hostName: hostName.trim(),
        customMode: mode === 'CUSTOM',
        boardId: mode === 'BOARD' ? selectedBoardId : undefined,
        customRoles: mode === 'CUSTOM' ? customRoles : undefined
      })
    );

    if (createdRoom?.hostPlayerId) {
      setMyPlayerId(createdRoom.hostPlayerId);
      localStorage.setItem('playerId', createdRoom.hostPlayerId);
    }
  };

  const leaveRoom = () => {
    setRoom(null);
    setMyRole(null);
    setShowRoleModal(false);
  };

  const rejoinLastGame = async () => {
    const savedRoomCode = localStorage.getItem('roomCode');
    const savedPlayerId = localStorage.getItem('playerId');
    if (!savedRoomCode || !savedPlayerId) {
      setError('没有找到上一局游戏记录');
      return;
    }
    setMyPlayerId(savedPlayerId);
    await run(() => api.getRoom(savedRoomCode));
  };

  const formatRoles = (rolesRecord: Record<string, number>) =>
    Object.entries(rolesRecord)
      .map(([roleId, count]) => `${roleMap.get(roleId)?.name || roleId}×${count}`)
      .join(' / ');

  return (
    <main className="safe-top safe-bottom min-h-screen bg-[radial-gradient(circle_at_top,#3a2458_0%,#150d24_48%,#08040f_100%)] px-4 text-white md:px-10">
      <section className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 pt-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-purple-100">
              <Sparkles size={16} /> 小胖狼人杀
            </div>
            <h1 className="text-4xl font-black tracking-tight md:text-6xl">小胖狼人杀</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-purple-100/80 md:text-base">
              创建房间、输入房间号加入、自动发牌并推进夜晚 / 白天 / 投票流程。
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur">
            <div className="text-sm text-purple-100/70">当前房间</div>
            <div className="mt-1 max-w-[280px] truncate text-lg font-bold">{room?.roomCode || '尚未进入'}</div>
          </div>
        </header>

        {error && <div className="mb-6 rounded-2xl border border-red-300/20 bg-red-500/20 p-4 text-sm text-red-100">{error}</div>}

        {!room && (
          <div className="mb-6 flex gap-3">
            <button onClick={rejoinLastGame} className="flex-1 rounded-2xl bg-white/15 px-4 py-3 font-bold hover:bg-white/20">
              返回上局游戏
            </button>
          </div>
        )}

        {showRoomSetup && (
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur">
              <div className="mb-4 flex items-center gap-2">
                <DoorOpen className="text-blue-200" />
                <h2 className="text-2xl font-bold">加入房间</h2>
              </div>
              <label className="text-sm text-purple-100/80">房间号</label>
              <input
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value)}
                placeholder="输入 6 位房间号"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
              />
              <label className="mt-4 block text-sm text-purple-100/80">你的昵称</label>
              <input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="例如 Tracy"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
              />
              <button
                disabled={!roomCodeInput.trim() || !playerName.trim() || loading}
                onClick={handleJoinRoom}
                className="mt-5 w-full rounded-2xl bg-blue-500 px-5 py-4 font-bold shadow-lg disabled:bg-gray-600"
              >
                加入房间
              </button>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur">
              <div className="mb-4 flex items-center gap-2">
                <Crown className="text-yellow-200" />
                <h2 className="text-2xl font-bold">创建房间</h2>
              </div>

              <label className="text-sm text-purple-100/80">你的昵称</label>
              <input
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                placeholder="例如 Tracy"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
              />

              <div className="mt-5">
                <div className="mb-2 text-sm text-purple-100/80">选择人数</div>
                <div className="grid grid-cols-4 gap-2">
                  {playerCounts.map((count) => (
                    <button
                      key={count}
                      onClick={() => setPlayerCount(count)}
                      className={`rounded-2xl px-3 py-3 font-bold ${playerCount === count ? 'bg-purple-500' : 'bg-black/30'}`}
                    >
                      {count}人
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  disabled={playerCount !== 12}
                  onClick={() => setMode('BOARD')}
                  className={`rounded-2xl px-4 py-3 font-bold ${mode === 'BOARD' ? 'bg-purple-500' : 'bg-black/30'} disabled:opacity-40`}
                >
                  经典板子
                </button>
                <button
                  disabled={!canUseCustom}
                  onClick={() => setMode('CUSTOM')}
                  className={`rounded-2xl px-4 py-3 font-bold ${mode === 'CUSTOM' ? 'bg-pink-500' : 'bg-black/30'} disabled:opacity-40`}
                >
                  自选角色
                </button>
              </div>

              {mode === 'BOARD' && (
                <div className="mt-5 grid gap-3">
                  {boards.map((board) => (
                    <button
                      key={board.id}
                      onClick={() => setSelectedBoardId(board.id)}
                      className={`rounded-3xl border p-4 text-left ${selectedBoardId === board.id ? 'border-purple-300 bg-purple-500/20' : 'border-white/10 bg-black/20'}`}
                    >
                      <div className="font-bold">{board.name}</div>
                      <div className="mt-1 text-sm text-purple-100/70">{board.description}</div>
                      <div className="mt-2 text-xs text-purple-200">{formatRoles(board.roles)}</div>
                    </button>
                  ))}
                </div>
              )}

              {mode === 'CUSTOM' && (
                <div className="mt-5">
                  <div className={`mb-4 rounded-2xl p-3 text-center font-bold ${customTotal === playerCount ? 'bg-green-500/20 text-green-100' : 'bg-red-500/20 text-red-100'}`}>
                    当前角色总数：{customTotal}/{playerCount}
                  </div>

                  <div className="grid gap-4">
                    {groupedRoles.map(([groupName, groupRoles]) => (
                      <div key={groupName}>
                        <h3 className="mb-2 text-lg font-black">{groupName}</h3>
                        <div className="grid gap-3 md:grid-cols-2">
                          {groupRoles.map((role) => {
                            const expanded = expandedRoleId === role.id;
                            return (
                              <div key={role.id} className="rounded-3xl border border-white/10 bg-black/25 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedRoleId(expanded ? null : role.id)}
                                    onMouseEnter={() => setExpandedRoleId(role.id)}
                                    className="min-w-0 flex-1 text-left"
                                  >
                                    <div className="text-lg font-bold">{role.name}</div>
                                    <p
                                      className={`mt-2 text-sm leading-6 text-purple-100/80 ${
                                        expanded ? 'whitespace-normal break-words' : 'line-clamp-2'
                                      }`}
                                    >
                                      {role.description}
                                    </p>
                                    <div className="mt-2 text-xs text-purple-200/70">
                                      {expanded ? '技能说明已展开' : '点击查看完整技能说明'}
                                    </div>
                                  </button>

                                  <div className="flex shrink-0 items-center gap-3">
                                    <button
                                      onClick={() => updateRoleCount(role.id, -1)}
                                      className="h-10 w-10 rounded-full bg-white/15 text-xl font-black"
                                    >
                                      -
                                    </button>
                                    <div className="w-6 text-center text-xl font-bold">{customRoles[role.id] || 0}</div>
                                    <button
                                      onClick={() => updateRoleCount(role.id, 1)}
                                      className="h-10 w-10 rounded-full bg-purple-500 text-xl font-black"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                disabled={loading || !hostName.trim()}
                onClick={() => setConfirmCreate(true)}
                className="mt-5 w-full rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 px-5 py-4 font-bold shadow-lg disabled:bg-gray-600"
              >
                创建新房间
              </button>
            </section>
          </div>
        )}

        {room && (
          <>
            <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur">
              <div className="mb-4 flex items-center gap-2">
                <Users className="text-purple-200" />
                <h2 className="text-2xl font-bold">房间控制台</h2>
              </div>

              <div className={`rounded-3xl bg-gradient-to-r ${phaseStyleMap[room.phase] || phaseStyleMap.WAITING} p-6 text-center shadow-xl`}>
                <div className="text-sm opacity-80">当前阶段</div>
                <div className="mt-2 text-3xl font-black">{phaseNameMap[room.phase] || room.phase}</div>
                <div className="mt-2 text-sm opacity-80">{phaseDescriptionMap[room.phase] || ''}</div>
                <div className="mt-3 text-sm font-bold">第 {room.round || 0} 轮</div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <button onClick={leaveRoom} className="rounded-2xl bg-white/15 px-4 py-3 font-bold hover:bg-white/20">
                  退出房间
                </button>
                <button disabled={loading} onClick={() => run(() => api.fillBots(room.roomCode))} className="rounded-2xl bg-indigo-500 px-4 py-3 font-bold disabled:bg-gray-600">
                  Bot 补满
                </button>
                <button disabled={!canStart || loading} onClick={() => run(() => api.startGame(room.roomCode, myPlayerId!))} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-500 px-4 py-3 font-bold disabled:bg-gray-600">
                  <Play size={18} /> 开始游戏
                </button>
                <button
                  disabled={!isHost || loading || room.phase === 'WAITING' || room.phase === 'FINISHED'}
                  onClick={() => setConfirmNextPhase(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-pink-500 px-4 py-3 font-bold disabled:bg-gray-600"
                >
                  <RefreshCcw size={18} /> 下一阶段
                </button>
              </div>

              {room.phase !== 'WAITING' && (
                <div className="mt-5 rounded-3xl bg-black/25 p-5 text-center">
                  <div className="text-sm text-purple-100/70">身份已发放</div>
                  <button
                    onClick={() => {
                      setExpandedMyRole(false);
                      setShowRoleModal(true);
                    }}
                    className="mt-3 inline-flex items-center justify-center gap-2 rounded-2xl bg-purple-500 px-6 py-3 font-black"
                  >
                    <Eye size={18} /> 查看身份（请遮挡屏幕）
                  </button>
                </div>
              )}
            </section>

            <section className="mt-6 rounded-3xl border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur">
              <div className="mb-4 flex items-center gap-2">
                <Moon className="text-purple-200" />
                <h2 className="text-2xl font-bold">玩家列表</h2>
                <span className="ml-auto rounded-full bg-white/10 px-3 py-1 text-sm">
                  {room.players.length}/{room.playerCount}
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {room.players.map((player) => (
                  <div key={player.id} className="rounded-3xl border border-white/10 bg-black/25 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-bold">
                        {player.seatNumber}. {player.name}
                      </div>
                      <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs text-green-100">
                        {player.alive ? '存活' : '出局'}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-purple-100/60">{player.host ? '房主' : '玩家'}</div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </section>

      {confirmCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center text-black shadow-2xl">
            <h2 className="text-xl font-black">确认创建房间？</h2>
            <p className="mt-2 text-sm text-gray-600">
              创建后会生成房间号，其他玩家可输入房间号加入。
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button onClick={() => setConfirmCreate(false)} className="rounded-2xl bg-gray-200 px-4 py-3 font-bold">
                取消
              </button>
              <button onClick={handleCreateRoom} className="rounded-2xl bg-purple-600 px-4 py-3 font-bold text-white">
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmNextPhase && room && myPlayerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center text-black shadow-2xl">
            <h2 className="text-xl font-black">进入下一阶段？</h2>
            <p className="mt-2 text-sm text-gray-600">请确认所有玩家已经完成当前阶段操作。</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button onClick={() => setConfirmNextPhase(false)} className="rounded-2xl bg-gray-200 px-4 py-3 font-bold">
                取消
              </button>
              <button
                onClick={async () => {
                  setConfirmNextPhase(false);
                  await run(() => api.nextPhase(room.roomCode, myPlayerId));
                }}
                className="rounded-2xl bg-pink-600 px-4 py-3 font-bold text-white"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {showRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4">
          <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 text-center text-black shadow-2xl">
            <button onClick={() => setShowRoleModal(false)} className="absolute right-4 top-4 rounded-full bg-gray-100 p-2">
              <X size={18} />
            </button>
            <div className="text-sm text-gray-500">请确认无人偷看</div>
            <h2 className="mt-3 text-xl font-black">你的身份</h2>
            <div className="mt-5 rounded-3xl bg-purple-100 p-5">
              <div className="text-3xl font-black text-purple-700">{myRole?.name || '身份加载中'}</div>
              {myRole?.description && (
                <button
                  type="button"
                  onClick={() => setExpandedMyRole(!expandedMyRole)}
                  onMouseEnter={() => setExpandedMyRole(true)}
                  className="mt-3 w-full text-left"
                >
                  <p className={`text-sm leading-6 text-gray-700 ${expandedMyRole ? 'whitespace-normal break-words' : 'line-clamp-2'}`}>
                    {myRole.description}
                  </p>
                  <div className="mt-2 text-center text-xs text-purple-600">
                    {expandedMyRole ? '技能说明已展开' : '点击查看完整技能说明'}
                  </div>
                </button>
              )}
            </div>
            <button onClick={() => setShowRoleModal(false)} className="mt-6 w-full rounded-2xl bg-purple-600 px-4 py-3 font-bold text-white">
              我已查看
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
