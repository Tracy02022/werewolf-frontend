'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, BoardDefinition, GameRoom, Role, RoleInfo } from '@/lib/api';

const phaseNameMap: Record<string, string> = {
  WAITING: '等待玩家',
  NIGHT: '夜晚阶段',
  DAY_DISCUSSION: '白天发言',
  VOTING: '投票阶段',
  FINISHED: '游戏结束'
};

const defaultCustomRoles: Record<number, Record<Role, number>> = {
  10: { WEREWOLF: 3, VILLAGER: 4, SEER: 1, WITCH: 1, HUNTER: 1 },
  11: { WEREWOLF: 3, VILLAGER: 4, SEER: 1, WITCH: 1, HUNTER: 1, GUARD: 1 },
  12: { WEREWOLF: 4, VILLAGER: 4, SEER: 1, WITCH: 1, HUNTER: 1, GUARD: 1 },
  13: { WEREWOLF: 4, VILLAGER: 5, SEER: 1, WITCH: 1, HUNTER: 1, GUARD: 1 },
  14: { WEREWOLF: 4, VILLAGER: 6, SEER: 1, WITCH: 1, HUNTER: 1, GUARD: 1 },
  15: { WEREWOLF: 5, VILLAGER: 6, SEER: 1, WITCH: 1, HUNTER: 1, GUARD: 1 },
  16: { WEREWOLF: 5, VILLAGER: 7, SEER: 1, WITCH: 1, HUNTER: 1, GUARD: 1 }
};

function totalRoles(roles: Record<Role, number>) {
  return Object.values(roles).reduce((sum, value) => sum + value, 0);
}

export default function HomePage() {
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [boards, setBoards] = useState<BoardDefinition[]>([]);
  const [playerCount, setPlayerCount] = useState(12);
  const [createMode, setCreateMode] = useState<'classic' | 'custom'>('classic');
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [customRoles, setCustomRoles] = useState<Record<Role, number>>(defaultCustomRoles[12]);
  const [hostName, setHostName] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [myPlayerId, setMyPlayerId] = useState('');
  const [myRole, setMyRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const roleNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    roles.forEach((role) => (map[role.id] = role.name));
    return map;
  }, [roles]);

  const roleGroups = useMemo(() => ({
    狼人阵营: roles.filter((r) => r.category === 'WOLF'),
    好人阵营: roles.filter((r) => r.category === 'GOOD'),
    第三方阵营: roles.filter((r) => r.category === 'THIRD_PARTY')
  }), [roles]);

  const availableBoards = useMemo(
    () => boards.filter((board) => board.playerCount === playerCount),
    [boards, playerCount]
  );

  const canUseClassic = availableBoards.length > 0;
  const customTotal = totalRoles(customRoles);
  const roomIsFull = !!room && room.players.length === room.playerCount;
  const isHost = !!room && !!myPlayerId && room.hostPlayerId === myPlayerId;

  useEffect(() => {
    Promise.all([api.getRoles(), api.getBoards()])
      .then(([roleData, boardData]) => {
        setRoles(roleData);
        setBoards(boardData);
        const first12 = boardData.find((b) => b.playerCount === 12);
        setSelectedBoardId(first12?.id || '');
      })
      .catch((err) => setError(`无法连接后端：${err.message}`));

    const savedRoomCode = localStorage.getItem('roomCode') || '';
    const savedPlayerId = localStorage.getItem('playerId') || '';
    if (savedRoomCode && savedPlayerId) {
      setMyPlayerId(savedPlayerId);
      setJoinRoomCode(savedRoomCode);
      api.getRoom(savedRoomCode).then(setRoom).catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const defaults = defaultCustomRoles[playerCount] || { WEREWOLF: 3, VILLAGER: playerCount - 3 };
    setCustomRoles(defaults);

    const firstBoard = boards.find((board) => board.playerCount === playerCount);
    setSelectedBoardId(firstBoard?.id || '');
    setCreateMode(firstBoard ? 'classic' : 'custom');
  }, [playerCount, boards]);

  useEffect(() => {
    if (room && myPlayerId && room.phase !== 'WAITING') {
      api.getMyRole(room.roomCode, myPlayerId)
        .then((player) => setMyRole(player.role || null))
        .catch(() => setMyRole(null));
    } else {
      setMyRole(null);
    }
  }, [room, myPlayerId]);

  const run = async (action: () => Promise<GameRoom>, after?: (updated: GameRoom) => void) => {
    setLoading(true);
    setError('');
    try {
      const updated = await action();
      setRoom(updated);
      setJoinRoomCode(updated.roomCode);
      after?.(updated);
    } catch (err: any) {
      setError(err.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const saveMe = (updated: GameRoom, name: string) => {
    const me = [...updated.players].reverse().find((p) => p.name === name.trim());
    if (me) {
      setMyPlayerId(me.id);
      localStorage.setItem('playerId', me.id);
      localStorage.setItem('roomCode', updated.roomCode);
    }
  };

  const createRoom = () => {
    if (!hostName.trim()) {
      setError('请先输入你的昵称');
      return;
    }
    if (createMode === 'classic' && !selectedBoardId) {
      setError('当前人数没有可选经典板子，请切换到自选角色模式');
      return;
    }
    if (createMode === 'custom' && customTotal !== playerCount) {
      setError(`自选角色数量必须等于玩家人数：当前 ${customTotal}/${playerCount}`);
      return;
    }

    run(
      () => api.createRoom({
        playerCount,
        hostName: hostName.trim(),
        customMode: createMode === 'custom',
        boardId: createMode === 'classic' ? selectedBoardId : undefined,
        customRoles: createMode === 'custom' ? customRoles : undefined
      }),
      (updated) => saveMe(updated, hostName)
    );
  };

  const joinRoom = () => {
    if (!joinRoomCode.trim() || !joinName.trim()) {
      setError('请输入房间号和昵称');
      return;
    }
    run(
      () => api.joinRoom(joinRoomCode.trim(), joinName.trim()),
      (updated) => saveMe(updated, joinName)
    );
  };

  const updateRoleCount = (role: Role, delta: number) => {
    setCustomRoles((prev) => {
      const next = { ...prev };
      const value = Math.max(0, (next[role] || 0) + delta);
      if (value === 0) delete next[role];
      else next[role] = value;
      return next;
    });
  };

  const summary = (roleMap: Record<Role, number>) =>
    Object.entries(roleMap)
      .filter(([, count]) => count > 0)
      .map(([role, count]) => `${roleNameMap[role] || role}×${count}`)
      .join(' / ');

  return (
    <main className="page">
      <div className="container">
        <header className="header">
          <div>
            <span className="badge">狼人杀 MVP · 经典板子 + 自选角色</span>
            <h1>狼人杀 App</h1>
            <p>12人保留经典板子；10-16人支持自选角色。创建房间后分享房间号，其他玩家输入房间号加入。</p>
          </div>
          <div className="card">
            <div className="small">当前房间</div>
            <div className="roomCode">{room?.roomCode || '------'}</div>
            <div className="small">{room?.boardName || '尚未创建 / 加入'}</div>
          </div>
        </header>

        {error && <div className="warning">{error}</div>}

        <div className="grid two">
          <section className="card">
            <h2 className="cardTitle">创建房间</h2>

            <label className="label">你的昵称</label>
            <input className="input" value={hostName} onChange={(e) => setHostName(e.target.value)} placeholder="例如 Tracy" />

            <label className="label">选择人数</label>
            <div className="choiceGrid">
              {[9, 10, 11, 12, 13, 14, 15, 16].map((count) => (
                <button key={count} className={`choice ${playerCount === count ? 'active' : ''}`} onClick={() => setPlayerCount(count)}>
                  {count}人
                </button>
              ))}
            </div>

            <label className="label">选择模式</label>
            <div className="modeTabs">
              <button className={`choice ${createMode === 'classic' ? 'active' : ''}`} disabled={!canUseClassic} onClick={() => setCreateMode('classic')}>
                经典板子
              </button>
              <button className={`choice ${createMode === 'custom' ? 'active' : ''}`} disabled={playerCount < 10 || playerCount > 16} onClick={() => setCreateMode('custom')}>
                自选角色
              </button>
            </div>
            <p className="small">说明：12人可以选经典板子，也可以自选角色；10/11/13/14/15/16 人使用自选角色。</p>

            {createMode === 'classic' && (
              <div className="grid" style={{ marginTop: 14 }}>
                {availableBoards.map((board) => (
                  <button key={board.id} className={`boardBtn ${selectedBoardId === board.id ? 'active' : ''}`} onClick={() => setSelectedBoardId(board.id)}>
                    <strong>{board.name}</strong>
                    <div className="small">{board.description}</div>
                    <div className="summary">{summary(board.roles)}</div>
                  </button>
                ))}
                {!availableBoards.length && <p>当前人数暂时没有经典板子，请使用自选角色。</p>}
              </div>
            )}

            {createMode === 'custom' && (
              <div style={{ marginTop: 14 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>当前角色数量：{customTotal}/{playerCount}</strong>
                  <button className="btn" onClick={() => setCustomRoles(defaultCustomRoles[playerCount] || {})}>一键推荐</button>
                </div>
                {Object.entries(roleGroups).map(([groupName, groupRoles]) => (
                  <div key={groupName} className="roleGroup">
                    <h3>{groupName}</h3>
                    <div className="roleGrid">
                      {groupRoles.map((role) => (
                        <div key={role.id} className="roleItem">
                          <span>{role.name}</span>
                          <div className="counter">
                            <button onClick={() => updateRoleCount(role.id, -1)}>-</button>
                            <span>{customRoles[role.id] || 0}</span>
                            <button onClick={() => updateRoleCount(role.id, 1)}>+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button className="btn primary" disabled={loading} onClick={createRoom}>创建房间</button>
          </section>

          <section className="card">
            <h2 className="cardTitle">加入房间</h2>
            <label className="label">房间号</label>
            <input className="input" value={joinRoomCode} onChange={(e) => setJoinRoomCode(e.target.value)} placeholder="6位房间号" />
            <label className="label">你的昵称</label>
            <input className="input" value={joinName} onChange={(e) => setJoinName(e.target.value)} placeholder="例如 Player2" />
            <button className="btn blue" style={{ width: '100%', marginTop: 16 }} disabled={loading} onClick={joinRoom}>加入房间</button>

            <div className="roleCard">
              <div className="small">我的身份</div>
              <h2>{myRole ? roleNameMap[myRole] || myRole : '游戏开始后可查看'}</h2>
              <p className="small">每个玩家只能通过自己的 playerId 查看自己的身份。</p>
            </div>
          </section>
        </div>

        {room && (
          <section className="card" style={{ marginTop: 18 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <h2 className="cardTitle">房间 {room.roomCode}</h2>
                <p>{room.boardName} · {room.players.length}/{room.playerCount} · {phaseNameMap[room.phase] || room.phase} · 第 {room.round} 轮</p>
                <p className="summary">配置：{summary(room.customRoles)}</p>
              </div>
              <div className="row">
                <button className="btn" onClick={() => run(() => api.getRoom(room.roomCode))}>刷新</button>
                {isHost && <button className="btn" disabled={loading || room.phase !== 'WAITING'} onClick={() => run(() => api.fillBots(room.roomCode))}>Bot补满</button>}
                {isHost && <button className="btn green" disabled={loading || !roomIsFull || room.phase !== 'WAITING'} onClick={() => run(() => api.startGame(room.roomCode, myPlayerId))}>开始游戏</button>}
                {isHost && <button className="btn pink" disabled={loading || room.phase === 'WAITING' || room.phase === 'FINISHED'} onClick={() => run(() => api.nextPhase(room.roomCode, myPlayerId))}>下一阶段</button>}
              </div>
            </div>

            <div className="playerGrid" style={{ marginTop: 16 }}>
              {room.players.map((player) => (
                <div className="playerCard" key={player.id}>
                  <strong>{player.seatNumber}. {player.name}</strong>
                  {player.host && <span className="badge" style={{ marginLeft: 8 }}>房主</span>}
                  <div className="small" style={{ marginTop: 8 }}>{player.alive ? '存活' : '出局'}</div>
                  <div className="summary">身份：{player.id === myPlayerId && myRole ? roleNameMap[myRole] || myRole : '未知'}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
