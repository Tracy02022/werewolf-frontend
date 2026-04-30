
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Crown, DoorOpen, Eye, Moon, Play, RefreshCcw, Sparkles, Users } from 'lucide-react';
import { api, Board, GameRoom, Role } from '@/lib/api';

const roleNameMap: Record<string, string> = {
  WEREWOLF: '狼人', WOLF_KING: '狼王', WHITE_WOLF_KING: '白狼王', BEAUTY_WOLF: '狼美人', GARGOYLE: '石像鬼', MECHANICAL_WOLF: '机械狼', HIDDEN_WOLF: '隐狼', DEMON_KNIGHT: '恶灵骑士', SNOW_WOLF: '雪狼', THICK_SKIN_WOLF: '厚皮狼',
  VILLAGER: '平民', SEER: '预言家', WITCH: '女巫', HUNTER: '猎人', GUARD: '守卫', IDIOT: '白痴', KNIGHT: '骑士', GRAVE_KEEPER: '守墓人', MAGICIAN: '魔术师', DREAM_CATCHER: '摄梦人', BEAR_TRAINER: '驯熊师', FOX: '狐狸', PSYCHIC: '通灵师', EXORCIST: '猎魔人', LITTLE_GIRL: '小女孩', BOMB_EXPERT: '炸弹师', ALCHEMIST: '炼金魔女', PRIEST: '祭司', MOON_PRIEST: '月夜祭司', AWAKENED_HUNTER: '觉醒猎人', AWAKENED_SEER: '觉醒预言家', AWAKENED_WITCH: '觉醒女巫',
  CUPID: '丘比特', THIEF: '盗贼', WILD_CHILD: '野孩子', MIXED_BLOOD: '混血儿', LOVERS: '情侣', SHADOW: '影子', PIPER: '吹笛者'
};

const roleGroups: Record<string, string[]> = {
  狼人阵营: ['WEREWOLF','WOLF_KING','WHITE_WOLF_KING','BEAUTY_WOLF','GARGOYLE','MECHANICAL_WOLF','HIDDEN_WOLF','DEMON_KNIGHT','SNOW_WOLF','THICK_SKIN_WOLF'],
  好人阵营: ['VILLAGER','SEER','WITCH','HUNTER','GUARD','IDIOT','KNIGHT','GRAVE_KEEPER','MAGICIAN','DREAM_CATCHER','BEAR_TRAINER','FOX','PSYCHIC','EXORCIST','LITTLE_GIRL','BOMB_EXPERT','ALCHEMIST','PRIEST','MOON_PRIEST','AWAKENED_HUNTER','AWAKENED_SEER','AWAKENED_WITCH'],
  第三方阵营: ['CUPID','THIEF','WILD_CHILD','MIXED_BLOOD','LOVERS','SHADOW','PIPER']
};

const phaseNameMap: Record<string, string> = { WAITING:'等待玩家', NIGHT:'🌙 夜晚阶段', DAY_DISCUSSION:'☀️ 白天发言', VOTING:'🗳️ 投票阶段', FINISHED:'🏁 游戏结束' };
const phaseClass: Record<string, string> = { WAITING:'from-slate-500 to-slate-700', NIGHT:'from-indigo-950 to-purple-900', DAY_DISCUSSION:'from-amber-300 to-orange-500 text-black', VOTING:'from-red-500 to-pink-700', FINISHED:'from-emerald-500 to-teal-700' };

const defaultRoles = (count: number): Record<string, number> => {
  const base: Record<string, number> = { WEREWOLF: count >= 15 ? 5 : count >= 12 ? 4 : 3, VILLAGER: 1, SEER: 1, WITCH: 1, HUNTER: 1 };
  let total = Object.values(base).reduce((a,b)=>a+b,0);
  while (total < count) { base.VILLAGER += 1; total += 1; }
  return base;
};

export default function HomePage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [playerCount, setPlayerCount] = useState(12);
  const [mode, setMode] = useState<'board'|'custom'>('board');
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [customRoles, setCustomRoles] = useState<Record<string, number>>(defaultRoles(12));
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [hostName, setHostName] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<Role | null>(null);
  const [showRole, setShowRole] = useState(false);
  const [showCreateConfirm, setShowCreateConfirm] = useState(false);
  const [showNextConfirm, setShowNextConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const inRoom = !!room;
  const isHost = !!room && !!myPlayerId && room.hostPlayerId === myPlayerId;
  const totalCustom = Object.values(customRoles).reduce((a,b)=>a+b,0);

  useEffect(() => { api.getBoards(playerCount).then((data)=>{ setBoards(data); setSelectedBoardId(data[0]?.id || ''); if(data.length === 0 && mode === 'board') setMode('custom'); }).catch((e)=>setError(e.message)); }, [playerCount]);
  useEffect(() => { setCustomRoles(defaultRoles(playerCount)); }, [playerCount]);
  useEffect(() => { const roomCode = localStorage.getItem('roomCode'); const playerId = localStorage.getItem('playerId'); if(roomCode && playerId){ setRoomCodeInput(roomCode); setMyPlayerId(playerId); } }, []);
  useEffect(() => { if(!room?.roomCode) return; const t=setInterval(()=>api.getRoom(room.roomCode).then(setRoom).catch(()=>{}), 2500); return ()=>clearInterval(t); }, [room?.roomCode]);
  useEffect(() => { if(!showRole) return; const t=setTimeout(()=>setShowRole(false), 8000); return ()=>clearTimeout(t); }, [showRole]);

  const selectedBoard = useMemo(()=> boards.find(b=>b.id===selectedBoardId), [boards, selectedBoardId]);
  const roleSummary = (roles?: Record<string,number>) => Object.entries(roles || {}).map(([r,c])=>`${roleNameMap[r] || r}×${c}`).join(' / ');

  const run = async (action: () => Promise<GameRoom>) => { setLoading(true); setError(''); try { const updated = await action(); setRoom(updated); setRoomCodeInput(updated.roomCode); return updated; } catch(e:any){ setError(e.message || '操作失败'); } finally { setLoading(false); } };

  const createRoom = async () => {
    const created = await run(()=>api.createRoom({ playerCount, hostName: hostName.trim(), boardId: mode==='board' ? selectedBoardId : undefined, customMode: mode==='custom', customRoles: mode==='custom' ? customRoles : undefined }));
    if(created){ const host = created.players.find(p=>p.host); if(host){ setMyPlayerId(host.id); localStorage.setItem('playerId', host.id); localStorage.setItem('roomCode', created.roomCode); } }
    setShowCreateConfirm(false);
  };

  const joinRoom = async () => {
    const joined = await run(()=>api.joinRoom(roomCodeInput.trim(), playerName.trim()));
    if(joined){ const me = joined.players.find(p=>p.name === playerName.trim()) || joined.players[joined.players.length-1]; if(me){ setMyPlayerId(me.id); localStorage.setItem('playerId', me.id); localStorage.setItem('roomCode', joined.roomCode); } setPlayerName(''); }
  };

  const loadLastGame = async () => { const code=localStorage.getItem('roomCode'); const pid=localStorage.getItem('playerId'); if(!code||!pid){ setError('没有找到上一局游戏'); return; } setMyPlayerId(pid); await run(()=>api.getRoom(code)); };
  const leaveRoom = () => { setRoom(null); setMyRole(null); setShowRole(false); };
  const fetchAndShowRole = async () => { if(!room||!myPlayerId) return; const data=await api.getMyRole(room.roomCode, myPlayerId); setMyRole(data.role); setShowRole(true); };

  const startGame = async () => { if(!room||!myPlayerId) return; const updated=await run(()=>api.startGame(room.roomCode,myPlayerId)); if(updated) setMyRole(null); };
  const nextPhase = async () => { if(!room||!myPlayerId) return; await run(()=>api.nextPhase(room.roomCode,myPlayerId)); setShowNextConfirm(false); };

  const updateRole = (role:string, delta:number) => setCustomRoles(prev=>({ ...prev, [role]: Math.max(0, (prev[role] || 0) + delta) }));

  return (
    <main className="safe-top min-h-screen bg-[radial-gradient(circle_at_top,#351d55_0%,#10091c_45%,#07040d_100%)] px-4 pb-10 text-white md:px-10">
      <section className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-purple-100"><Sparkles size={16}/> 小胖狼人杀</div>
            <h1 className="text-4xl font-black tracking-tight md:text-6xl">狼人杀 App</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-purple-100/80 md:text-base">创建房间、加入房间、自动发牌，支持经典板子和自选角色。</p>
          </div>
          {room && <div className="rounded-3xl border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur"><div className="text-sm text-purple-100/70">房间号</div><div className="mt-1 text-3xl font-black tracking-widest">{room.roomCode}</div></div>}
        </header>

        {error && <div className="mb-6 rounded-2xl border border-red-300/20 bg-red-500/20 p-4 text-sm text-red-100">{error}</div>}

        {!inRoom && (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur">
              <div className="mb-4 flex items-center gap-2"><Crown className="text-yellow-200"/><h2 className="text-2xl font-bold">创建房间</h2></div>
              <label className="text-sm text-purple-100/80">你的昵称</label>
              <input value={hostName} onChange={e=>setHostName(e.target.value)} placeholder="例如 Tracy" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none" />
              <label className="mt-4 block text-sm text-purple-100/80">选择人数</label>
              <select value={playerCount} onChange={e=>setPlayerCount(Number(e.target.value))} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none">
                {[9,10,11,12,13,14,15,16].map(n=><option key={n} value={n}>{n} 人</option>)}
              </select>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button onClick={()=>setMode('board')} disabled={boards.length===0} className={`rounded-2xl px-4 py-3 font-bold ${mode==='board'?'bg-purple-500':'bg-white/10'}`}>经典板子</button>
                <button onClick={()=>setMode('custom')} className={`rounded-2xl px-4 py-3 font-bold ${mode==='custom'?'bg-purple-500':'bg-white/10'}`}>自选角色</button>
              </div>
              {mode==='board' && <div className="mt-4 grid gap-3">{boards.map(b=><button key={b.id} onClick={()=>setSelectedBoardId(b.id)} className={`rounded-2xl border p-4 text-left ${selectedBoardId===b.id?'border-purple-300 bg-purple-500/20':'border-white/10 bg-black/20'}`}><div className="font-bold">{b.name}</div><p className="mt-1 text-sm text-purple-100/70">{b.description}</p><p className="mt-2 text-xs text-purple-200">{roleSummary(b.roles)}</p></button>)}</div>}
              {mode==='custom' && <div className="mt-4 rounded-3xl bg-black/20 p-4"><div className={`mb-3 rounded-2xl p-3 text-center font-bold ${totalCustom===playerCount?'bg-green-500/20 text-green-100':'bg-red-500/20 text-red-100'}`}>当前角色数量：{totalCustom}/{playerCount}</div>{Object.entries(roleGroups).map(([group, roles])=><div key={group} className="mb-4"><h3 className="mb-2 font-bold text-purple-200">{group}</h3><div className="grid gap-2">{roles.map(role=><div key={role} className="flex items-center justify-between rounded-2xl bg-white/10 px-3 py-2"><span>{roleNameMap[role]}</span><div className="flex items-center gap-2"><button onClick={()=>updateRole(role,-1)} className="h-8 w-8 rounded-full bg-white/15">-</button><span className="w-6 text-center">{customRoles[role] || 0}</span><button onClick={()=>updateRole(role,1)} className="h-8 w-8 rounded-full bg-purple-500">+</button></div></div>)}</div></div>)}</div>}
              <button disabled={!hostName.trim() || loading || (mode==='board' && !selectedBoardId) || (mode==='custom' && totalCustom!==playerCount)} onClick={()=>setShowCreateConfirm(true)} className="mt-5 w-full rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 px-5 py-4 font-bold shadow-lg">创建新房间</button>
              {selectedBoard && mode==='board' && <p className="mt-3 text-center text-xs text-purple-100/70">已选择：{selectedBoard.name}</p>}
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur">
              <div className="mb-4 flex items-center gap-2"><Users className="text-purple-200"/><h2 className="text-2xl font-bold">加入房间</h2></div>
              <label className="text-sm text-purple-100/80">房间号</label>
              <input value={roomCodeInput} onChange={e=>setRoomCodeInput(e.target.value)} placeholder="输入 6 位房间号" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none" />
              <label className="mt-4 block text-sm text-purple-100/80">你的昵称</label>
              <input value={playerName} onChange={e=>setPlayerName(e.target.value)} placeholder="例如 Alice" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none" />
              <button disabled={!roomCodeInput.trim() || !playerName.trim() || loading} onClick={joinRoom} className="mt-5 w-full rounded-2xl bg-blue-500 px-5 py-4 font-bold">加入房间</button>
              <button onClick={loadLastGame} className="mt-3 w-full rounded-2xl bg-white/10 px-5 py-4 font-bold">返回上局游戏</button>
            </section>
          </div>
        )}

        {room && (
          <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur">
            <div className={`rounded-3xl bg-gradient-to-r ${phaseClass[room.phase] || phaseClass.WAITING} p-6 text-center shadow-xl`}>
              <div className="text-sm opacity-80">当前阶段</div>
              <div className="mt-1 text-3xl font-black">{phaseNameMap[room.phase] || room.phase}</div>
              <div className="mt-1 text-sm opacity-80">第 {room.round} 轮</div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <button onClick={fetchAndShowRole} disabled={room.phase==='WAITING'} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-purple-600 px-4 py-3 font-bold"><Eye size={18}/> 查看身份</button>
              <button disabled={!isHost || room.players.length !== room.playerCount || room.phase !== 'WAITING' || loading} onClick={startGame} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-500 px-4 py-3 font-bold"><Play size={18}/> 开始游戏</button>
              <button disabled={!isHost || loading || room.phase === 'WAITING' || room.phase === 'FINISHED'} onClick={()=>setShowNextConfirm(true)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-pink-500 px-4 py-3 font-bold"><RefreshCcw size={18}/> 下一阶段</button>
              <button onClick={leaveRoom} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3 font-bold"><DoorOpen size={18}/> 退出房间</button>
            </div>
            {isHost && room.phase === 'WAITING' && <button onClick={()=>run(()=>api.fillBots(room.roomCode))} className="mt-3 w-full rounded-2xl bg-white/15 px-4 py-3 font-bold">Bot 补满玩家</button>}
            <div className="mt-6 flex items-center gap-2"><Moon className="text-purple-200"/><h2 className="text-2xl font-bold">玩家列表</h2><span className="ml-auto rounded-full bg-white/10 px-3 py-1 text-sm">{room.players.length}/{room.playerCount}</span></div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{room.players.map(p=><div key={p.id} className="rounded-3xl border border-white/10 bg-black/25 p-4"><div className="flex items-center justify-between"><div className="text-lg font-bold">{p.seatNumber}. {p.name}</div><span className="rounded-full bg-green-500/20 px-3 py-1 text-xs text-green-100">{p.host?'房主':'玩家'}</span></div><div className="mt-3 rounded-2xl bg-white/10 p-3 text-sm text-purple-100">身份：{p.id===myPlayerId ? '点击“查看身份”' : '隐藏'}</div></div>)}</div>
          </section>
        )}
      </section>

      {showCreateConfirm && <ConfirmModal title="创建房间" message={`确认创建 ${playerCount} 人${mode==='board'?'经典板子':'自选角色'}房间吗？`} onCancel={()=>setShowCreateConfirm(false)} onConfirm={createRoom} confirmText="确定创建" />}
      {showNextConfirm && <ConfirmModal title="进入下一阶段" message="确定要进入下一阶段吗？所有玩家都将看到阶段变化。" onCancel={()=>setShowNextConfirm(false)} onConfirm={nextPhase} confirmText="确定进入" />}
      {showRole && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-6"><div className="w-full max-w-sm rounded-3xl bg-white p-7 text-center text-black shadow-2xl"><p className="text-sm text-gray-500">请确认无人偷看</p><h2 className="mt-2 text-xl font-black">你的身份</h2><div className="mt-5 rounded-3xl bg-gradient-to-r from-purple-500 to-pink-500 p-6 text-3xl font-black text-white">{myRole ? roleNameMap[myRole] || myRole : '未获取到身份'}</div><button onClick={()=>setShowRole(false)} className="mt-6 w-full rounded-2xl bg-gray-900 px-4 py-3 font-bold text-white">我已查看</button></div></div>}
    </main>
  );
}

function ConfirmModal({ title, message, onCancel, onConfirm, confirmText }: { title:string; message:string; onCancel:()=>void; onConfirm:()=>void; confirmText:string }) {
  return <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-6"><div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center text-black shadow-2xl"><h2 className="text-xl font-black">{title}</h2><p className="mt-3 text-sm leading-6 text-gray-600">{message}</p><div className="mt-6 grid grid-cols-2 gap-3"><button onClick={onCancel} className="rounded-2xl bg-gray-200 px-4 py-3 font-bold">取消</button><button onClick={onConfirm} className="rounded-2xl bg-purple-600 px-4 py-3 font-bold text-white">{confirmText}</button></div></div></div>;
}
