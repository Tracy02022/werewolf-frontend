'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Crown, DoorOpen, Eye, Moon, Play, RefreshCcw, Sparkles, Users, X, Volume2, BookOpen } from 'lucide-react';
import { api, Board, GameRoom, RoleInfo, RulesResponse } from '@/lib/api';

const phaseNameMap: Record<string, string> = {
  WAITING: '等待玩家',
  NIGHT: '🌙 夜晚阶段',
  SHERIFF_ELECTION: '🎖️ 上警竞选',
  DAY_DISCUSSION: '☀️ 白天发言',
  VOTING: '🗳️ 投票阶段',
  FINISHED: '🏁 游戏结束'
};

const phaseDescriptionMap: Record<string, string> = {
  WAITING: '等待玩家加入，房主可在人数满后开始游戏。',
  NIGHT: '天黑请闭眼，按身份进行夜晚行动。',
  SHERIFF_ELECTION: '第一天先进行上警竞选和警长选择，暂不公布夜间倒牌信息。',
  DAY_DISCUSSION: '白天请依次发言，分析场上身份。',
  VOTING: '开始投票，放逐一名玩家。',
  FINISHED: '游戏结束，请查看胜负结果。'
};

const phaseStyleMap: Record<string, string> = {
  WAITING: 'from-slate-500 to-slate-700',
  NIGHT: 'from-indigo-900 to-black',
  SHERIFF_ELECTION: 'from-amber-400 to-yellow-600 text-black',
  DAY_DISCUSSION: 'from-yellow-300 to-orange-400 text-black',
  VOTING: 'from-red-500 to-pink-600',
  FINISHED: 'from-emerald-500 to-teal-600'
};

const playerCounts = [9, 10, 11, 12, 13, 14, 15, 16];
const customCounts = [9, 10, 11, 12, 13, 14, 15, 16];
const boardCounts = [12];

function teamName(team: string) {
  if (team === 'WOLF') return '狼人阵营';
  if (team === 'GOOD') return '神职阵营';
  if (team === 'THIRD_PARTY') return '第三方阵营';
  return '平民';
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

  result.VILLAGER =
      playerCount -
      Object.entries(result)
          .filter(([key]) => key !== 'VILLAGER')
          .reduce((sum, [, count]) => sum + count, 0);

  return result;
}

export default function HomePage() {
  const [rolesLoading, setRolesLoading] = useState(false);
  const [boardsLoading, setBoardsLoading] = useState(false);
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [playerCount, setPlayerCount] = useState(12);
  const [mode, setMode] = useState<'BOARD' | 'CUSTOM'>('BOARD');
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [customRoles, setCustomRoles] = useState<Record<string, number>>(buildDefaultCustomRoles(12));
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [searchKeyword, setSearchKeyword] = useState('');
  const [teamFilter, setTeamFilter] = useState<'ALL' | 'WOLF' | 'GOOD' | 'THIRD_PARTY' | 'OTHER'>('ALL');
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
  const [hostSeatNumber, setHostSeatNumber] = useState(1);
  const [joinSeatNumber, setJoinSeatNumber] = useState(1);
  const [rules, setRules] = useState<RulesResponse | null>(null);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [movingSeat, setMovingSeat] = useState(false);
  const [wolfActionLoading, setWolfActionLoading] = useState(false);
  const [guardActionLoading, setGuardActionLoading] = useState(false);
  const [witchActionLoading, setWitchActionLoading] = useState(false);
  const [seerActionLoading, setSeerActionLoading] = useState(false);
  const [mechanicalWolfLoading, setMechanicalWolfLoading] = useState(false);
  const [skipNightActionLoading, setSkipNightActionLoading] = useState(false);
  const [voteOutLoading, setVoteOutLoading] = useState(false);
  const [judgeVoiceEnabled, setJudgeVoiceEnabled] = useState(false);
  const lastJudgeSpeakKeyRef = useRef('');
  const judgeAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

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

  const customTotal = Object.values(customRoles).reduce((sum, count) => sum + count, 0);
  const remainingCount = playerCount - customTotal;
  const isRoleFull = customTotal >= playerCount;

  const isHost = Boolean(room && myPlayerId && room.hostPlayerId === myPlayerId);
  const canStart = Boolean(room && isHost && room.phase === 'WAITING' && room.players.length === room.playerCount);
  const canUseCustom = customCounts.includes(playerCount);
  const canUseBoard = boardCounts.includes(playerCount) && boards.length > 0;
  const showRoomSetup = !room;

  const currentRoomRoles = room?.customMode
      ? room.customRoles
      : boards.find((board) => board.id === room?.boardId)?.roles;

  const canWitchSeeWolfKill = Boolean(room && !room.witchSaveUsed);

  const occupiedSeats = useMemo(() => {
    if (!room) return new Set<number>();
    return new Set(room.players.map((player) => player.seatNumber));
  }, [room]);

  const myPlayer = useMemo(() => {
    if (!room || !myPlayerId) return null;
    return room.players.find((player) => player.id === myPlayerId) || null;
  }, [room, myPlayerId]);

  const isLearnedMechanicalWolfRoleWolf = Boolean(
      room?.mechanicalWolfLearnedRole &&
      roleMap.get(room.mechanicalWolfLearnedRole)?.team === 'WOLF'
  );

  const canMechanicalWolfJoinWolfKill = Boolean(
      myRole?.id === 'MECHANICAL_WOLF' && room?.mechanicalWolfCanJoinWolfKill
  );

  const isMyRoleWolf = Boolean(
      myRole?.team === 'WOLF' &&
      (myRole.id !== 'MECHANICAL_WOLF' || canMechanicalWolfJoinWolfKill)
  );
  const isMyRoleWitch = myRole?.id === 'WITCH';
  const isMyRoleGuard = ['GUARD', 'AWAKENED_GUARD'].includes(myRole?.id || '');
  const isMyRoleSeer = ['SEER', 'SKY_EYE', 'AWAKENED_SEER'].includes(myRole?.id || '');
  const isMyRolePsychic = myRole?.id === 'PSYCHIC';
  const isMyRoleHunter = myRole?.id === 'HUNTER';
  const isMyRoleMechanicalWolf = myRole?.id === 'MECHANICAL_WOLF';
  const isMyRoleWhiteGod = ['IDIOT', 'AWAKENED_FOOL'].includes(myRole?.id || '');
  const isMyRoleMixedBlood = ['MIXED_BLOOD', 'SECRET_ADMIRER'].includes(myRole?.id || '');

  // 操作区不再强依赖 myRole，因为身份接口可能比房间轮询慢。
  // 前端负责让当前阶段可点；后端负责严格校验是否真的是狼人/女巫/预言家/机械狼。
  const canWolfAct = Boolean(
      room &&
      myPlayerId &&
      myPlayer?.alive &&
      isMyRoleWolf &&
      room.phase === 'NIGHT' &&
      room.currentNightAction === 'WOLF_KILL' &&
      !room.wolfKillTargetSeatNumber
  );

  useEffect(() => {
    const loadRoles = async () => {
      setRolesLoading(true);
      setError('');

      try {
        const data = await api.getRoles();

        if (!data || data.length === 0) {
          throw new Error('角色列表为空，请稍后重试');
        }

        setRoles(data);
      } catch (err: any) {
        setError(`无法加载角色：${err.message}`);

        setTimeout(async () => {
          try {
            const retryData = await api.getRoles();
            setRoles(retryData);
            setError('');
          } catch {
            // 保留原错误
          }
        }, 1200);
      } finally {
        setRolesLoading(false);
      }
    };

    loadRoles();

    api.getRules()
        .then(setRules)
        .catch(() => undefined);

    const savedRoomCode = localStorage.getItem('roomCode');
    const savedPlayerId = localStorage.getItem('playerId');
    if (savedRoomCode) setRoomCodeInput(savedRoomCode);
    if (savedPlayerId) setMyPlayerId(savedPlayerId);
  }, []);

  useEffect(() => {
    const loadBoards = async () => {
      setBoardsLoading(true);

      try {
        const data = await api.getBoards(playerCount);
        setBoards(data || []);

        const canBoard = boardCounts.includes(playerCount) && data.length > 0;
        const canCustom = customCounts.includes(playerCount);

        if (canBoard) {
          setSelectedBoardId(data[0]?.id || '');
          setMode('BOARD');
        } else if (canCustom) {
          setSelectedBoardId('');
          setMode('CUSTOM');
        }

        setCustomRoles(buildDefaultCustomRoles(playerCount));
        setOpenGroups({});
        setSearchKeyword('');
        setTeamFilter('ALL');
      } catch (err: any) {
        setBoards([]);
        setSelectedBoardId('');
        setMode('CUSTOM');
        setError(`无法加载板子：${err.message}`);
      } finally {
        setBoardsLoading(false);
      }
    };

    loadBoards();
  }, [playerCount]);

  useEffect(() => {
    if (hostSeatNumber > playerCount) setHostSeatNumber(1);
    if (joinSeatNumber > playerCount) setJoinSeatNumber(1);
  }, [playerCount, hostSeatNumber, joinSeatNumber]);

  useEffect(() => {
    if (!room?.roomCode) return;
    const interval = setInterval(() => {
      api.getRoom(room.roomCode).then(setRoom).catch(() => undefined);
    }, 2500);
    return () => clearInterval(interval);
  }, [room?.roomCode]);


  useEffect(() => {
    if (!room) {
      lastJudgeSpeakKeyRef.current = '';
      return;
    }

    // 浏览器和 iOS 会拦截没有用户交互触发的自动声音。
    // 用户点击“开启法官声音”后，这里才会在每个新阶段自动播报。
    if (!judgeVoiceEnabled) return;

    const shouldAutoSpeak =
        room.phase === 'NIGHT' ||
        room.phase === 'SHERIFF_ELECTION' ||
        room.phase === 'DAY_DISCUSSION' ||
        room.phase === 'VOTING' ||
        room.phase === 'FINISHED';

    if (!shouldAutoSpeak) return;

    const speakKey = `${room.roomCode}-${room.phase}-${room.round}-${room.currentNightAction || ''}-${room.firstDayNightReportReleased ? 'reported' : 'hidden'}`;
    if (lastJudgeSpeakKeyRef.current === speakKey) return;

    lastJudgeSpeakKeyRef.current = speakKey;

    const text = getJudgeTextForRoom(room);
    const voiceKey = getVoiceKeyForRoom(room);
    judgeSpeak(text, voiceKey);
  }, [judgeVoiceEnabled, room?.roomCode, room?.phase, room?.round, room?.currentNightAction, room?.firstDayNightReportReleased]);

  useEffect(() => {
    if (!room || !myPlayerId || room.phase === 'WAITING') {
      setMyRole(null);
      return;
    }

    api
        .getMyRole(room.roomCode, myPlayerId)
        .then((roleResponse) => {
          if (roleResponse.roleInfo) {
            setMyRole(roleResponse.roleInfo);
          } else if (roleResponse.role) {
            setMyRole(roleMap.get(roleResponse.role) || null);
          }
        })
        .catch(() => undefined);
  }, [room?.phase, room?.roomCode, room?.currentNightAction, myPlayerId, roleMap]);

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

      if (delta > 0 && customTotal >= playerCount) {
        return next;
      }

      const value = Math.max(0, current + delta);
      if (value === 0) delete next[roleId];
      else next[roleId] = value;
      return next;
    });
  };

  const handleJoinRoom = async () => {
    if (!roomCodeInput.trim() || !playerName.trim()) return;
    const joinedRoom = await run(() => api.joinRoom(roomCodeInput.trim(), playerName.trim(), joinSeatNumber));
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
          seatNumber: hostSeatNumber,
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

  const getNightActionName = (action?: string) => {
    if (action === 'GUARD') return '守卫行动';
    if (action === 'MECHANICAL_WOLF') return '机械狼学习技能';
    if (action === 'WOLF_KILL') return '狼人刀人';
    if (action === 'WITCH') return '女巫行动';
    if (action === 'PSYCHIC') return '通灵师查验';
    if (action === 'SEER') return '预言家查验';
    if (action === 'HUNTER_CHECK') return '猎人状态确认';
    if (action === 'WHITE_GOD_CHECK') return '白神确认';
    if (action === 'MIXED_BLOOD_CHECK') return '混子确认';
    return '夜间流程';
  };

  const getVoiceKeyForRoom = (targetRoom: GameRoom) => {
    if (targetRoom.phase === 'SHERIFF_ELECTION') return 'day_sheriff_election';
    if (targetRoom.phase === 'DAY_DISCUSSION') return 'day_discussion';
    if (targetRoom.phase !== 'NIGHT') return `phase_${targetRoom.phase?.toLowerCase() || 'unknown'}`;

    const action = targetRoom.currentNightAction || 'NONE';
    return `night_${action.toLowerCase()}`;
  };

  const getJudgeTextForRoom = (targetRoom: GameRoom) => {
    const action = targetRoom.currentNightAction;

    if (targetRoom.phase === 'SHERIFF_ELECTION') {
      return '天亮了。第一天先进行上警竞选和警长选择，暂不公布夜间倒牌信息。';
    }

    if (targetRoom.phase === 'DAY_DISCUSSION') {
      if (targetRoom.round === 1 && !targetRoom.firstDayNightReportReleased) {
        return '现在进入白天发言阶段。';
      }
      return `现在公布夜间信息。${targetRoom.nightDeathMessage || '昨夜是平安夜，没有玩家倒牌。'} 现在进入白天发言阶段。`;
    }

    if (targetRoom.phase !== 'NIGHT') {
      return phaseDescriptionMap[targetRoom.phase] || '请继续游戏。';
    }

    if (action === 'GUARD') {
      return '天黑请闭眼。守卫请睁眼，请选择今晚要守护的玩家。';
    }

    if (action === 'MECHANICAL_WOLF') {
      return '守卫请闭眼。机械狼请睁眼，请选择一名玩家学习技能。';
    }

    if (action === 'WOLF_KILL') {
      return '机械狼请闭眼。狼人请睁眼，请选择今晚击杀目标。';
    }

    if (action === 'WITCH') {
      return '狼人请闭眼。女巫请睁眼。请查看你的页面，并选择是否使用解药或毒药。';
    }

    if (action === 'PSYCHIC') {
      return '女巫请闭眼。通灵师请睁眼，请选择一名玩家查验具体身份。';
    }

    if (action === 'SEER') {
      return '通灵师请闭眼。预言家请睁眼，请选择一名玩家查验阵营。';
    }

    if (action === 'HUNTER_CHECK') {
      return '预言家请闭眼。猎人请睁眼，请查看你的页面确认开枪状态。';
    }

    if (action === 'WHITE_GOD_CHECK') {
      return '猎人请闭眼。白神请睁眼，请确认你的身份信息。';
    }

    if (action === 'MIXED_BLOOD_CHECK') {
      return '白神请闭眼。混子请睁眼，请确认你的身份信息。';
    }

    return '夜间行动结束。';
  };

  const judgeSpeak = (text: string, voiceKey?: string) => {
    if (typeof window === 'undefined' || !text) return;

    const key = voiceKey || (room ? getVoiceKeyForRoom(room) : 'judge_default');
    const audioPath = `/voices/judge/zh/${key}.mp3`;
    let fallbackUsed = false;

    const fallbackToAi = () => {
      if (fallbackUsed) return;
      fallbackUsed = true;
      speakWithAi(text);
    };

    try {
      if (judgeAudioRef.current) {
        judgeAudioRef.current.pause();
        judgeAudioRef.current.currentTime = 0;
      }

      const audio = new Audio(audioPath);
      judgeAudioRef.current = audio;
      audio.preload = 'auto';
      audio.onplay = () => {
        window.speechSynthesis?.cancel();
      };
      audio.onerror = fallbackToAi;

      // 如果后续放入真人 mp3，会优先播放真人录音；没有文件或被浏览器拦截时自动降级为 AI 播报。
      audio.play().catch(fallbackToAi);
    } catch {
      fallbackToAi();
    }
  };

  const speakWithAi = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setError('当前浏览器不支持 AI 语音播报');
      return;
    }

    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    const chineseVoice = voices.find((voice) =>
        voice.lang?.toLowerCase().startsWith('zh') ||
        voice.name.includes('Chinese') ||
        voice.name.includes('中文')
    );
    if (chineseVoice) utterance.voice = chineseVoice;

    // 保留引用，避免 React 渲染后 utterance 被回收导致不出声。
    currentUtteranceRef.current = utterance;

    setTimeout(() => {
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);
    }, 150);
  };

  const enableJudgeVoice = () => {
    setJudgeVoiceEnabled(true);
    lastJudgeSpeakKeyRef.current = '';
    speakWithAi('法官声音已开启');
  };

  const handleMoveSeat = async (seatNumber: number) => {
    if (!room || !myPlayerId) return;

    setMovingSeat(true);
    setError('');

    try {
      const updatedRoom = await api.moveSeat(room.roomCode, myPlayerId, seatNumber);
      setRoom(updatedRoom);
    } catch (err: any) {
      setError(err.message || '换座失败');
    } finally {
      setMovingSeat(false);
    }
  };


  const handleGuardAction = async (targetSeatNumber: number) => {
    if (!room || !myPlayerId) return;
    setGuardActionLoading(true);
    setError('');
    try {
      const updatedRoom = await api.guardAction(room.roomCode, myPlayerId, targetSeatNumber);
      setRoom(updatedRoom);
    } catch (err: any) {
      setError(err.message || '守卫行动失败');
    } finally {
      setGuardActionLoading(false);
    }
  };

  const handleWolfKill = async (targetSeatNumber: number) => {
    if (!room || !myPlayerId) return;

    setWolfActionLoading(true);
    setError('');

    try {
      const updatedRoom = await api.wolfKill(room.roomCode, myPlayerId, targetSeatNumber);
      setRoom(updatedRoom);
    } catch (err: any) {
      setError(err.message || '狼人行动失败');
    } finally {
      setWolfActionLoading(false);
    }
  };

  const getJudgeText = () => {
    if (!room) return '请继续游戏。';
    return getJudgeTextForRoom(room);
  };

  const handleAdvanceNightAction = async () => {
    if (!room || !myPlayerId) return;
    setLoading(true);
    setError('');
    try {
      const updatedRoom = await api.advanceNightAction(room.roomCode, myPlayerId);
      setRoom(updatedRoom);
    } catch (err: any) {
      setError(err.message || '进入下一夜间操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleWitchAction = async (useSave: boolean, poisonTargetSeatNumber?: number | null) => {
    if (!room || !myPlayerId) return;
    setWitchActionLoading(true);
    setError('');
    try {
      const updatedRoom = await api.witchAction(room.roomCode, myPlayerId, useSave, poisonTargetSeatNumber || null);
      setRoom(updatedRoom);
    } catch (err: any) {
      setError(err.message || '女巫行动失败');
    } finally {
      setWitchActionLoading(false);
    }
  };

  const handleSeerAction = async (targetSeatNumber: number) => {
    if (!room || !myPlayerId) return;
    setSeerActionLoading(true);
    setError('');
    try {
      const updatedRoom = await api.seerAction(room.roomCode, myPlayerId, targetSeatNumber);
      setRoom(updatedRoom);
    } catch (err: any) {
      setError(err.message || '预言家操作失败');
    } finally {
      setSeerActionLoading(false);
    }
  };

  const handleMechanicalWolfLearn = async (targetSeatNumber: number) => {
    if (!room || !myPlayerId) return;
    setMechanicalWolfLoading(true);
    setError('');
    try {
      const updatedRoom = await api.mechanicalWolfLearn(room.roomCode, myPlayerId, targetSeatNumber);
      setRoom(updatedRoom);
    } catch (err: any) {
      setError(err.message || '机械狼学习失败');
    } finally {
      setMechanicalWolfLoading(false);
    }
  };

  const handleMechanicalWolfSkill = async (skillType: string, targetSeatNumber?: number | null) => {
    if (!room || !myPlayerId) return;
    setMechanicalWolfLoading(true);
    setError('');
    try {
      const updatedRoom = await api.mechanicalWolfSkill(room.roomCode, myPlayerId, skillType, targetSeatNumber || null);
      setRoom(updatedRoom);
    } catch (err: any) {
      setError(err.message || '机械狼技能使用失败');
    } finally {
      setMechanicalWolfLoading(false);
    }
  };

  const getMechanicalWolfSkillLabel = (roleId?: string | null) => {
    if (!roleId) return '学习技能';
    if (roleId === 'WITCH') return '使用女巫毒药';
    if (roleId === 'GUARD' || roleId === 'AWAKENED_GUARD') return '使用守卫护盾';
    if (roleId === 'SEER' || roleId === 'SKY_EYE' || roleId === 'AWAKENED_SEER') return '使用预言家查验';
    if (roleId === 'PSYCHIC') return '使用通灵师查验';
    if (roleMap.get(roleId)?.team === 'WOLF') return '狼人技能将在小狼全死后进入狼人夜使用';
    return '当前学习身份没有主动夜间技能';
  };

  const mechanicalWolfNeedsTarget = (roleId?: string | null) => {
    if (!roleId) return false;
    return roleId === 'WITCH' || roleId === 'GUARD' || roleId === 'AWAKENED_GUARD' || roleId === 'SEER' || roleId === 'SKY_EYE' || roleId === 'AWAKENED_SEER' || roleId === 'PSYCHIC';
  };

  const handleSkipNightAction = async () => {
    if (!room || !myPlayerId) return;
    setSkipNightActionLoading(true);
    setError('');
    try {
      const updatedRoom = await api.skipNightAction(room.roomCode, myPlayerId);
      setRoom(updatedRoom);
    } catch (err: any) {
      setError(err.message || '跳过夜间技能失败');
    } finally {
      setSkipNightActionLoading(false);
    }
  };

  const handleVoteOut = async (targetSeatNumber: number) => {
    if (!room || !myPlayerId) return;
    setVoteOutLoading(true);
    setError('');
    try {
      const updatedRoom = await api.voteOut(room.roomCode, myPlayerId, targetSeatNumber);
      setRoom(updatedRoom);
    } catch (err: any) {
      setError(err.message || '标记放逐玩家失败');
    } finally {
      setVoteOutLoading(false);
    }
  };

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
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                    type="button"
                    onClick={enableJudgeVoice}
                    className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold ${
                        judgeVoiceEnabled ? 'bg-green-500 text-white' : 'bg-yellow-400 text-black hover:bg-yellow-300'
                    }`}
                >
                  <Volume2 size={16} /> {judgeVoiceEnabled ? '法官声音已开启' : '开启法官声音'}
                </button>
                <button
                    type="button"
                    onClick={() => setShowRulesModal(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-4 py-2 text-sm font-bold hover:bg-indigo-400"
                >
                  <BookOpen size={16} /> 游戏规则
                </button>
              </div>
            </div>
          </header>

          {error && (
              <div className="mb-6 rounded-2xl border border-red-300/20 bg-red-500/20 p-4 text-sm text-red-100">
                {error}
              </div>
          )}

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

                  <div className="mt-4">
                    <div className="mb-2 text-sm text-purple-100/80">选择座位</div>
                    <div className="grid grid-cols-4 gap-2">
                      {Array.from({ length: 16 }, (_, i) => i + 1).map((seat) => (
                          <button
                              key={seat}
                              type="button"
                              onClick={() => setJoinSeatNumber(seat)}
                              className={`rounded-2xl px-3 py-3 font-bold ${
                                  joinSeatNumber === seat ? 'bg-blue-500' : 'bg-black/30'
                              }`}
                          >
                            {seat}号
                          </button>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-purple-100/60">
                      加入后如果座位已被占用，系统会提示你重新选择。
                    </div>
                  </div>

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

                  <div className="mt-5">
                    <div className="mb-2 text-sm text-purple-100/80">选择你的座位</div>
                    <div className="grid grid-cols-4 gap-2">
                      {Array.from({ length: playerCount }, (_, i) => i + 1).map((seat) => (
                          <button
                              key={seat}
                              type="button"
                              onClick={() => setHostSeatNumber(seat)}
                              className={`rounded-2xl px-3 py-3 font-bold ${
                                  hostSeatNumber === seat ? 'bg-purple-500' : 'bg-black/30'
                              }`}
                          >
                            {seat}号
                          </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <button
                        disabled={!canUseBoard}
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
                                className={`rounded-3xl border p-4 text-left ${
                                    selectedBoardId === board.id ? 'border-purple-300 bg-purple-500/20' : 'border-white/10 bg-black/20'
                                }`}
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
                        <div
                            className={`mb-4 rounded-2xl p-3 text-center font-bold ${
                                customTotal === playerCount
                                    ? 'bg-green-500/20 text-green-100'
                                    : customTotal > playerCount
                                        ? 'bg-red-500/20 text-red-100'
                                        : 'bg-yellow-500/20 text-yellow-100'
                            }`}
                        >
                          已选择：{customTotal} / {playerCount} 人
                          <br />
                          剩余：{remainingCount} 人
                          {isRoleFull && <div className="mt-2 text-xs text-green-100">人数已满，不能继续增加角色。</div>}
                        </div>

                        <div className="mb-4 grid gap-3">
                          <input
                              value={searchKeyword}
                              onChange={(e) => setSearchKeyword(e.target.value)}
                              placeholder="搜索角色名称（例如：预言家 / 狼 / 女巫）"
                              className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none"
                          />

                          <div className="grid grid-cols-5 gap-2 text-sm">
                            {[
                              { label: '全部', value: 'ALL' },
                              { label: '狼人', value: 'WOLF' },
                              { label: '神职', value: 'GOOD' },
                              { label: '第三方', value: 'THIRD_PARTY' },
                              { label: '平民', value: 'OTHER' }
                            ].map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    onClick={() => setTeamFilter(item.value as 'ALL' | 'WOLF' | 'GOOD' | 'THIRD_PARTY' | 'OTHER')}
                                    className={`rounded-2xl px-2 py-2 font-bold ${
                                        teamFilter === item.value ? 'bg-purple-500' : 'bg-black/30'
                                    }`}
                                >
                                  {item.label}
                                </button>
                            ))}
                          </div>

                          {(searchKeyword || teamFilter !== 'ALL') && (
                              <button
                                  type="button"
                                  onClick={() => {
                                    setSearchKeyword('');
                                    setTeamFilter('ALL');
                                  }}
                                  className="text-left text-xs font-bold text-purple-200"
                              >
                                清空搜索和筛选
                              </button>
                          )}
                        </div>

                        {rolesLoading && (
                            <div className="mb-4 rounded-2xl bg-white/10 p-4 text-center text-sm text-purple-100">
                              正在加载角色列表...
                            </div>
                        )}

                        {!rolesLoading && roles.length === 0 && (
                            <button
                                type="button"
                                onClick={() => window.location.reload()}
                                className="mb-4 w-full rounded-2xl bg-purple-500 px-4 py-3 font-bold"
                            >
                              角色加载失败，点击重新加载
                            </button>
                        )}

                        <div className="grid gap-4">
                          {groupedRoles.map(([groupName, groupRoles]) => {
                            const filteredRoles = groupRoles.filter((role) => {
                              const keyword = searchKeyword.trim();
                              const matchKeyword = !keyword || role.name.includes(keyword);

                              const matchTeam =
                                  teamFilter === 'ALL' ||
                                  role.team === teamFilter ||
                                  (teamFilter === 'OTHER' &&
                                      role.team !== 'WOLF' &&
                                      role.team !== 'GOOD' &&
                                      role.team !== 'THIRD_PARTY');

                              return matchKeyword && matchTeam;
                            });

                            if (filteredRoles.length === 0) return null;

                            const isFiltering = Boolean(searchKeyword.trim()) || teamFilter !== 'ALL';
                            const isOpen = isFiltering ? true : openGroups[groupName] ?? false;
                            const groupCount = filteredRoles.reduce((sum, role) => sum + (customRoles[role.id] || 0), 0);

                            return (
                                <div key={groupName} className="rounded-3xl border border-white/10 bg-black/20">
                                  <button
                                      type="button"
                                      onClick={() =>
                                          setOpenGroups((prev) => ({
                                            ...prev,
                                            [groupName]: !prev[groupName]
                                          }))
                                      }
                                      className="flex w-full items-center justify-between px-4 py-4 text-left"
                                  >
                                    <span className="text-lg font-black">{groupName}</span>
                                    <span className="text-sm text-purple-200">
                              已选 {groupCount} 人 {isOpen ? '▲' : '▼'}
                            </span>
                                  </button>

                                  {isOpen && (
                                      <div className="grid gap-3 px-4 pb-4 md:grid-cols-2">
                                        {filteredRoles.map((role) => {
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
                                                        disabled={isRoleFull}
                                                        onClick={() => updateRoleCount(role.id, 1)}
                                                        className={`h-10 w-10 rounded-full text-xl font-black ${
                                                            isRoleFull ? 'cursor-not-allowed bg-gray-500/50 text-gray-300' : 'bg-purple-500 text-white'
                                                        }`}
                                                    >
                                                      +
                                                    </button>
                                                  </div>
                                                </div>
                                              </div>
                                          );
                                        })}
                                      </div>
                                  )}
                                </div>
                            );
                          })}
                        </div>
                      </div>
                  )}

                  <button
                      disabled={loading}
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
                    {room.phase === 'NIGHT' && (
                        <div className="mt-4 rounded-2xl bg-black/25 px-4 py-3 text-sm font-bold">
                          当前夜间操作：{getNightActionName(room.currentNightAction)}
                          {room.nightActionCompleted && <span> ｜ 已完成，15 秒后自动进入下一环节</span>}
                        </div>
                    )}
                    {room.phase === 'DAY_DISCUSSION' && room.nightDeathMessage && (room.round !== 1 || room.firstDayNightReportReleased) && (
                        <div className="mt-4 rounded-2xl bg-black/25 px-4 py-3 text-sm font-bold">
                          法官公布：{room.nightDeathMessage}
                        </div>
                    )}
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-6">
                    <button onClick={leaveRoom} className="rounded-2xl bg-white/15 px-4 py-3 font-bold hover:bg-white/20">
                      退出房间
                    </button>
                    <button
                        disabled={loading}
                        onClick={() => run(() => api.fillBots(room.roomCode))}
                        className="rounded-2xl bg-indigo-500 px-4 py-3 font-bold disabled:bg-gray-600"
                    >
                      Bot 补满
                    </button>
                    <button
                        disabled={!isHost}
                        onClick={() => judgeSpeak(getJudgeText())}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-4 py-3 font-bold text-black disabled:bg-gray-600 disabled:text-white"
                    >
                      <Volume2 size={18} /> 法官播报
                    </button>
                    <button
                        disabled={!isHost || loading || room.phase !== 'NIGHT'}
                        onClick={handleAdvanceNightAction}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 font-bold disabled:bg-gray-600"
                    >
                      下一夜间操作
                    </button>
                    <button
                        disabled={!canStart || loading}
                        onClick={() => run(() => api.startGame(room.roomCode, myPlayerId!))}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-500 px-4 py-3 font-bold disabled:bg-gray-600"
                    >
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


                  {room.phase === 'SHERIFF_ELECTION' && (
                      <div className="mt-5 rounded-3xl bg-yellow-400/20 p-5 text-center text-yellow-50">
                        <div className="text-xl font-black">第一天上警竞选</div>
                        <div className="mt-2 text-sm leading-6 text-yellow-50/90">
                          请先完成上警发言、警长竞选和警徽归属。完成后由法官点击「下一阶段」，再公布昨夜倒牌信息。
                        </div>
                      </div>
                  )}

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

                {room.phase === 'NIGHT' && room.currentNightAction === 'GUARD' && myPlayer?.alive && isMyRoleGuard && (
                    <section className="mt-6 rounded-3xl border border-emerald-300/20 bg-emerald-500/10 p-5 shadow-2xl backdrop-blur">
                      <div className="mb-3 flex items-center gap-2">
                        <Sparkles className="text-emerald-200" />
                        <h2 className="text-2xl font-bold">守卫夜晚行动</h2>
                      </div>
                      <p className="text-sm leading-6 text-emerald-100/80">
                        请选择今晚要守护的玩家。守卫可以守自己，但不能连续两晚守护同一名玩家。也可以选择不发动技能。
                      </p>
                      {!room.guardTargetSeatNumber && (
                          <button
                              type="button"
                              disabled={skipNightActionLoading}
                              onClick={handleSkipNightAction}
                              className="mt-3 rounded-2xl bg-white/15 px-4 py-3 text-sm font-bold hover:bg-white/20 disabled:bg-gray-600"
                          >
                            不发动技能，等待下一环节
                          </button>
                      )}
                      {room.guardTargetSeatNumber && (
                          <div className="mt-3 rounded-2xl bg-emerald-500/20 p-4 text-sm font-bold text-emerald-100">
                            你今晚守护了 {room.guardTargetSeatNumber} 号。15 秒后自动进入下一环节。
                          </div>
                      )}
                      <div className="mt-4 grid grid-cols-3 gap-3 md:grid-cols-6">
                        {room.players.map((player) => (
                            <button
                                key={player.id}
                                type="button"
                                disabled={guardActionLoading || !player.alive || Boolean(room.guardTargetSeatNumber) || room.previousGuardTargetSeatNumber === player.seatNumber}
                                onClick={() => handleGuardAction(player.seatNumber)}
                                className="rounded-2xl bg-black/30 px-3 py-3 text-sm font-bold hover:bg-emerald-500/40 disabled:bg-gray-600/40 disabled:text-gray-300"
                            >
                              {player.seatNumber}号
                              <div className="truncate text-xs font-normal">{player.name}</div>
                              {room.previousGuardTargetSeatNumber === player.seatNumber && <div className="text-[10px] text-red-200">上晚已守</div>}
                            </button>
                        ))}
                      </div>
                    </section>
                )}

                {room.phase === 'NIGHT' && myPlayer?.alive && isMyRoleMechanicalWolf && (
                    <section className={`mt-6 rounded-3xl border p-5 shadow-2xl backdrop-blur ${
                        room.mechanicalWolfCanJoinWolfKill
                            ? 'border-red-300/20 bg-red-500/10'
                            : 'border-yellow-300/20 bg-yellow-500/10'
                    }`}>
                      <div className="mb-3 flex items-center gap-2">
                        <Moon className={room.mechanicalWolfCanJoinWolfKill ? 'text-red-200' : 'text-yellow-200'} />
                        <h2 className="text-2xl font-bold">机械狼狼人夜提示</h2>
                      </div>

                      {room.mechanicalWolfCanJoinWolfKill ? (
                          <div className="rounded-2xl bg-red-500/20 p-4 text-sm font-bold text-red-100">
                            你可以在狼人夜睁眼刀人。
                          </div>
                      ) : isLearnedMechanicalWolfRoleWolf ? (
                          <div className="rounded-2xl bg-yellow-500/20 p-4 text-sm font-bold text-yellow-100">
                            你学习的是狼人阵营身份。只有所有其他小狼都出局后，进入狼人夜才会看到击杀号码并可以刀人；当前其他小狼未死完时不会显示击杀号码。
                          </div>
                      ) : (
                          <div className="rounded-2xl bg-white/10 p-4 text-sm font-bold text-purple-100">
                            你当前学习的不是狼人刀人身份，请按照机械狼技能环节使用已学习的技能。
                          </div>
                      )}
                    </section>
                )}

                {room.phase === 'NIGHT' && room.currentNightAction === 'WOLF_KILL' && myPlayer?.alive && isMyRoleWolf && (
                    <section className="mt-6 rounded-3xl border border-red-300/20 bg-red-500/10 p-5 shadow-2xl backdrop-blur">
                      <div className="mb-3 flex items-center gap-2">
                        <Moon className="text-red-200" />
                        <h2 className="text-2xl font-bold">狼人夜晚行动</h2>
                      </div>

                      <p className="text-sm leading-6 text-red-100/80">
                        请选择今晚要击杀的玩家座位号。第一个狼人点击的目标生效，后续狼人无法覆盖。灰色代表已出局，红色代表当前已选择的击杀目标。也可以选择空刀。
                      </p>
                      {!room.wolfKillTargetSeatNumber && (
                          <button
                              type="button"
                              disabled={skipNightActionLoading}
                              onClick={handleSkipNightAction}
                              className="mt-3 rounded-2xl bg-white/15 px-4 py-3 text-sm font-bold hover:bg-white/20 disabled:bg-gray-600"
                          >
                            不发动技能 / 空刀，等待下一环节
                          </button>
                      )}

                      {!myPlayer && (
                          <div className="mt-3 rounded-2xl bg-yellow-500/20 p-3 text-sm font-bold text-yellow-100">
                            没有识别到你的玩家身份，请退出房间后用本局昵称重新加入，或点击“返回上局游戏”。
                          </div>
                      )}

                      {myPlayer && !myPlayer.alive && (
                          <div className="mt-3 rounded-2xl bg-gray-500/20 p-3 text-sm font-bold text-gray-100">
                            你已经出局，不能进行狼人行动。
                          </div>
                      )}

                      {room.wolfKillTargetSeatNumber && (
                          <div className="mt-3 rounded-2xl bg-red-500/20 p-3 text-sm font-bold text-red-100">
                            当前狼人击杀目标：{room.wolfKillTargetSeatNumber} 号
                          </div>
                      )}

                      <div className="mt-4 grid grid-cols-3 gap-3 md:grid-cols-6">
                        {room.players.map((player) => {
                          const isSelf = player.id === myPlayerId;
                          const selected = room.wolfKillTargetSeatNumber === player.seatNumber;
                          return (
                              <button
                                  key={player.id}
                                  type="button"
                                  disabled={!canWolfAct || !player.alive || wolfActionLoading}
                                  onClick={() => handleWolfKill(player.seatNumber)}
                                  className={`rounded-2xl px-3 py-4 text-center font-black ${
                                      selected
                                          ? 'bg-red-500 text-white'
                                          : !player.alive
                                              ? 'cursor-not-allowed bg-gray-600/40 text-gray-300'
                                              : isSelf
                                                  ? 'bg-black/30 text-red-100 hover:bg-red-500/40'
                                                  : 'bg-black/30 text-red-100 hover:bg-red-500/40'
                                  }`}
                              >
                                <div>{player.seatNumber}号</div>
                                <div className="mt-1 truncate text-xs font-normal">{player.name}</div>
                              </button>
                          );
                        })}
                      </div>
                    </section>
                )}


                {room.phase === 'NIGHT' && room.currentNightAction === 'WITCH' && myPlayer?.alive && isMyRoleWitch && (
                    <section className="mt-6 rounded-3xl border border-purple-300/20 bg-purple-500/10 p-5 shadow-2xl backdrop-blur">
                      <div className="mb-3 flex items-center gap-2">
                        <Sparkles className="text-purple-200" />
                        <h2 className="text-2xl font-bold">女巫夜晚行动</h2>
                      </div>
                      <div className="rounded-2xl bg-black/25 p-4 text-sm leading-6 text-purple-100">
                        {canWitchSeeWolfKill ? (
                            <>
                              今晚狼人击杀目标：<b>{room.wolfKillTargetSeatNumber || '无'} 号</b>
                              {myPlayer?.seatNumber === room.wolfKillTargetSeatNumber && (
                                  <div className="mt-2 font-bold text-red-200">你今晚中刀，标准规则下女巫不能自救。</div>
                              )}
                            </>
                        ) : (
                            <div className="font-bold text-purple-100">
                              解药已经使用过，女巫从现在开始不再得知狼人刀口。你可以选择使用毒药，或选择不用药。
                            </div>
                        )}
                        <div className="mt-2 text-xs text-purple-100/70">解药：{room.witchSaveUsed ? '已使用' : '未使用'} / 毒药：{room.witchPoisonUsed ? '已使用' : '未使用'}。同一晚只能使用一种药。</div>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <button
                            disabled={witchActionLoading || !canWitchSeeWolfKill || Boolean(room.witchSaveUsed) || !room.wolfKillTargetSeatNumber || myPlayer?.seatNumber === room.wolfKillTargetSeatNumber}
                            onClick={() => handleWitchAction(true, null)}
                            className="rounded-2xl bg-green-500 px-4 py-3 font-bold disabled:bg-gray-600"
                        >
                          {canWitchSeeWolfKill ? `使用解药救 ${room.wolfKillTargetSeatNumber || ''} 号` : '解药已用，不能查看刀口'}
                        </button>
                        <button
                            disabled={witchActionLoading}
                            onClick={() => handleWitchAction(false, null)}
                            className="rounded-2xl bg-white/15 px-4 py-3 font-bold hover:bg-white/20 disabled:bg-gray-600"
                        >
                          不用药，下一位
                        </button>
                      </div>
                      <div className="mt-4 text-sm font-bold text-purple-100/80">毒药目标</div>
                      <div className="mt-2 grid grid-cols-3 gap-3 md:grid-cols-6">
                        {room.players.map((player) => (
                            <button
                                key={player.id}
                                type="button"
                                disabled={witchActionLoading || Boolean(room.witchPoisonUsed) || !player.alive}
                                onClick={() => handleWitchAction(false, player.seatNumber)}
                                className="rounded-2xl bg-black/30 px-3 py-3 text-sm font-bold hover:bg-purple-500/40 disabled:bg-gray-600/40 disabled:text-gray-300"
                            >
                              {player.seatNumber}号
                              <div className="truncate text-xs font-normal">{player.name}</div>
                            </button>
                        ))}
                      </div>
                    </section>
                )}

                {room.phase === 'NIGHT' && myPlayer?.alive && (isMyRoleSeer || isMyRolePsychic) && ((room.currentNightAction === 'SEER' && isMyRoleSeer) || (room.currentNightAction === 'PSYCHIC' && isMyRolePsychic) || Boolean(room.seerCheckedSeatNumber)) && (
                    <section className="mt-6 rounded-3xl border border-blue-300/20 bg-blue-500/10 p-5 shadow-2xl backdrop-blur">
                      <div className="mb-3 flex items-center gap-2">
                        <Eye className="text-blue-200" />
                        <h2 className="text-2xl font-bold">{isMyRolePsychic ? '通灵师夜晚行动' : '预言家夜晚行动'}</h2>
                      </div>
                      <p className="text-sm leading-6 text-blue-100/80">
                        {isMyRolePsychic ? '通灵师会看到具体身份；如果目标是机械狼且已学习身份，会显示机械狼学习到的身份。' : '预言家只会看到阵营结果：好人或狼人，不显示具体身份。'}
                      </p>
                      {!room.seerCheckedSeatNumber && ['SEER', 'PSYCHIC'].includes(room.currentNightAction || '') && (
                          <button
                              type="button"
                              disabled={skipNightActionLoading}
                              onClick={handleSkipNightAction}
                              className="mt-3 rounded-2xl bg-white/15 px-4 py-3 text-sm font-bold hover:bg-white/20 disabled:bg-gray-600"
                          >
                            不发动技能，等待下一环节
                          </button>
                      )}
                      {room.seerCheckedSeatNumber && (
                          <div className="mt-3 rounded-2xl bg-blue-500/20 p-4 text-sm font-bold text-blue-100">
                            {isMyRolePsychic
                                ? <>你查验了 {room.seerCheckedSeatNumber} 号，具体身份是：{room.seerCheckedRoleName || room.seerCheckedRole}</>
                                : <>你查验了 {room.seerCheckedSeatNumber} 号，结果是：{room.seerCheckedTeam}</>}
                          </div>
                      )}
                      <div className="mt-4 grid grid-cols-3 gap-3 md:grid-cols-6">
                        {room.players.map((player) => (
                            <button
                                key={player.id}
                                type="button"
                                disabled={seerActionLoading || !['SEER', 'PSYCHIC'].includes(room.currentNightAction || '') || !player.alive || Boolean(room.seerCheckedSeatNumber)}
                                onClick={() => handleSeerAction(player.seatNumber)}
                                className="rounded-2xl bg-black/30 px-3 py-3 text-sm font-bold hover:bg-blue-500/40 disabled:bg-gray-600/40 disabled:text-gray-300"
                            >
                              {player.seatNumber}号
                              <div className="truncate text-xs font-normal">{player.name}</div>
                            </button>
                        ))}
                      </div>
                    </section>
                )}

                {room.phase === 'NIGHT' && room.currentNightAction === 'MECHANICAL_WOLF' && myPlayer?.alive && isMyRoleMechanicalWolf && (
                    <section className="mt-6 rounded-3xl border border-orange-300/20 bg-orange-500/10 p-5 shadow-2xl backdrop-blur">
                      <div className="mb-3 flex items-center gap-2">
                        <Sparkles className="text-orange-200" />
                        <h2 className="text-2xl font-bold">机械狼夜晚行动</h2>
                      </div>

                      {!room.mechanicalWolfLearnedSeatNumber && (
                          <>
                            <p className="text-sm leading-6 text-orange-100/80">
                              请选择一名玩家学习身份技能。学习后，通灵师验机械狼会看到你学到的身份；预言家会按你学到身份的阵营给出“好人/狼人”。
                            </p>
                            <button
                                type="button"
                                disabled={skipNightActionLoading}
                                onClick={handleSkipNightAction}
                                className="mb-4 mt-3 rounded-2xl bg-white/15 px-4 py-3 text-sm font-bold hover:bg-white/20 disabled:bg-gray-600"
                            >
                              不发动技能，等待下一环节
                            </button>
                            <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
                              {room.players.map((player) => (
                                  <button
                                      key={player.id}
                                      type="button"
                                      disabled={mechanicalWolfLoading || !player.alive || player.id === myPlayerId}
                                      onClick={() => handleMechanicalWolfLearn(player.seatNumber)}
                                      className="rounded-2xl bg-black/30 px-3 py-3 text-sm font-bold hover:bg-orange-500/40 disabled:bg-gray-600/40 disabled:text-gray-300"
                                  >
                                    {player.seatNumber}号
                                    <div className="truncate text-xs font-normal">{player.name}</div>
                                  </button>
                              ))}
                            </div>
                          </>
                      )}

                      {room.mechanicalWolfLearnedSeatNumber && (
                          <>
                            <div className="mb-4 rounded-2xl bg-orange-500/20 p-4 text-sm font-bold text-orange-100">
                              你学习了 {room.mechanicalWolfLearnedSeatNumber} 号玩家，当前学习身份是：{room.mechanicalWolfLearnedRoleName || room.mechanicalWolfLearnedRole}。
                              <div className="mt-2 text-xs text-orange-100/80">{getMechanicalWolfSkillLabel(room.mechanicalWolfLearnedRole)}</div>
                              {room.mechanicalWolfSkillResult && <div className="mt-3 rounded-xl bg-black/25 p-3">{room.mechanicalWolfSkillResult}</div>}
                            </div>

                            {!room.nightActionCompleted && roleMap.get(room.mechanicalWolfLearnedRole || '')?.team === 'WOLF' && (
                                <div className="mb-4 rounded-2xl bg-red-500/20 p-4 text-sm font-bold text-red-100">
                                  你学习的是狼人阵营身份。只有所有其他小狼都出局后，进入狼人夜才会看到击杀号码并可以刀人；当前其他小狼未死完时不会显示击杀号码。
                                  <button
                                      type="button"
                                      disabled={skipNightActionLoading}
                                      onClick={handleSkipNightAction}
                                      className="mt-3 rounded-2xl bg-white/15 px-4 py-3 text-sm font-bold hover:bg-white/20 disabled:bg-gray-600"
                                  >
                                    知道了，等待下一环节
                                  </button>
                                </div>
                            )}

                            {!room.nightActionCompleted && !mechanicalWolfNeedsTarget(room.mechanicalWolfLearnedRole) && roleMap.get(room.mechanicalWolfLearnedRole || '')?.team !== 'WOLF' && (
                                <button
                                    type="button"
                                    disabled={skipNightActionLoading}
                                    onClick={handleSkipNightAction}
                                    className="mb-4 rounded-2xl bg-white/15 px-4 py-3 text-sm font-bold hover:bg-white/20 disabled:bg-gray-600"
                                >
                                  当前学习身份无主动夜间技能，等待下一环节
                                </button>
                            )}

                            {!room.nightActionCompleted && mechanicalWolfNeedsTarget(room.mechanicalWolfLearnedRole) && (
                                <>
                                  <button
                                      type="button"
                                      disabled={skipNightActionLoading}
                                      onClick={handleSkipNightAction}
                                      className="mb-4 rounded-2xl bg-white/15 px-4 py-3 text-sm font-bold hover:bg-white/20 disabled:bg-gray-600"
                                  >
                                    不发动技能，等待下一环节
                                  </button>
                                  <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
                                    {room.players.map((player) => (
                                        <button
                                            key={player.id}
                                            type="button"
                                            disabled={mechanicalWolfLoading || !player.alive || Boolean(room.mechanicalWolfSkillResult) || (room.mechanicalWolfLearnedRole === 'WITCH' && Boolean(room.mechanicalWolfPoisonUsed))}
                                            onClick={() => handleMechanicalWolfSkill(room.mechanicalWolfLearnedRole || 'SKILL', player.seatNumber)}
                                            className="rounded-2xl bg-black/30 px-3 py-3 text-sm font-bold hover:bg-orange-500/40 disabled:bg-gray-600/40 disabled:text-gray-300"
                                        >
                                          {player.seatNumber}号
                                          <div className="truncate text-xs font-normal">{player.name}</div>
                                        </button>
                                    ))}
                                  </div>
                                  {room.mechanicalWolfLearnedRole === 'WITCH' && room.mechanicalWolfPoisonUsed && (
                                      <div className="mt-3 rounded-2xl bg-gray-500/20 p-3 text-sm font-bold text-gray-100">机械狼学习到的毒药已经使用过。</div>
                                  )}
                                </>
                            )}
                          </>
                      )}
                    </section>
                )}

                {room.phase === 'NIGHT' && room.currentNightAction === 'HUNTER_CHECK' && myPlayer?.alive && isMyRoleHunter && (
                    <section className="mt-6 rounded-3xl border border-yellow-300/20 bg-yellow-500/10 p-5 shadow-2xl backdrop-blur">
                      <h2 className="text-2xl font-bold">猎人状态提示</h2>
                      <div className="mt-3 rounded-2xl bg-black/25 p-4 text-sm font-bold text-yellow-100">
                        {myPlayer && room.wolfKillTargetSeatNumber === myPlayer.seatNumber && !room.witchSavedWolfKill && room.witchPoisonTargetSeatNumber !== myPlayer.seatNumber
                            ? '你今晚可能倒牌。若白天公布你死亡，你可以开枪。'
                            : myPlayer && room.witchPoisonTargetSeatNumber === myPlayer.seatNumber
                                ? '你可能被毒死。被女巫毒死不能开枪。'
                                : '当前没有死亡开枪提示；若白天被放逐或被狼刀倒牌，一般可以开枪。'}
                        <div className="mt-2 text-xs text-yellow-100/70">本环节无需操作，15 秒后自动进入下一环节。</div>
                      </div>
                    </section>
                )}

                {room.phase === 'NIGHT' && room.currentNightAction === 'WHITE_GOD_CHECK' && myPlayer?.alive && isMyRoleWhiteGod && (
                    <section className="mt-6 rounded-3xl border border-pink-300/20 bg-pink-500/10 p-5 shadow-2xl backdrop-blur">
                      <h2 className="text-2xl font-bold">白神睁眼确认</h2>
                      <div className="mt-3 rounded-2xl bg-black/25 p-4 text-sm font-bold text-pink-100">
                        请确认你的身份信息。本环节没有技能释放，15 秒后自动进入下一环节。
                      </div>
                    </section>
                )}

                {room.phase === 'NIGHT' && room.currentNightAction === 'MIXED_BLOOD_CHECK' && myPlayer?.alive && isMyRoleMixedBlood && (
                    <section className="mt-6 rounded-3xl border border-fuchsia-300/20 bg-fuchsia-500/10 p-5 shadow-2xl backdrop-blur">
                      <h2 className="text-2xl font-bold">混子睁眼确认</h2>
                      <div className="mt-3 rounded-2xl bg-black/25 p-4 text-sm font-bold text-fuchsia-100">
                        请确认你的身份信息。本环节没有技能释放，15 秒后自动进入下一环节。
                      </div>
                    </section>
                )}


                {currentRoomRoles && (
                    <section className="mt-6 rounded-3xl border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur">
                      <div className="mb-4 flex items-center gap-2">
                        <Sparkles className="text-purple-200" />
                        <h2 className="text-2xl font-bold">本局角色配置</h2>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {Object.entries(currentRoomRoles).map(([roleId, count]) => (
                            <span
                                key={roleId}
                                className="rounded-full bg-purple-500/20 px-3 py-2 text-sm font-bold text-purple-100"
                            >
                      {roleMap.get(roleId)?.name || roleId} × {count}
                    </span>
                        ))}
                      </div>
                    </section>
                )}

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
                        <div key={player.id} className={`rounded-3xl border border-white/10 p-4 ${player.alive ? 'bg-black/25' : 'bg-gray-700/40 opacity-60'}`}>
                          <div className="flex items-center justify-between">
                            <div className="text-lg font-bold">
                              {player.seatNumber}. {player.name}
                            </div>
                            <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs text-green-100">
                        {player.alive ? '存活' : '出局'}
                      </span>
                          </div>
                          <div className="mt-2 text-xs text-purple-100/60">{player.host ? '房主 / 法官' : '玩家'}</div>

                          {isHost && room.phase === 'VOTING' && player.alive && (
                              <button
                                  type="button"
                                  disabled={voteOutLoading}
                                  onClick={() => handleVoteOut(player.seatNumber)}
                                  className="mt-3 w-full rounded-2xl bg-red-500/80 px-3 py-2 text-xs font-bold text-white hover:bg-red-500 disabled:bg-gray-600"
                              >
                                标记 {player.seatNumber} 号被放逐
                              </button>
                          )}

                          {player.id === myPlayerId && room.phase === 'WAITING' && (
                              <div className="mt-4 rounded-2xl bg-white/5 p-3">
                                <div className="mb-2 text-xs font-bold text-purple-100/70">
                                  重新选择座位
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                  {Array.from({ length: room.playerCount }, (_, i) => i + 1).map((seat) => {
                                    const occupiedByOther = room.players.some(
                                        (item) => item.seatNumber === seat && item.id !== myPlayerId
                                    );
                                    const isCurrentSeat = myPlayer?.seatNumber === seat;

                                    return (
                                        <button
                                            key={seat}
                                            type="button"
                                            disabled={occupiedByOther || isCurrentSeat || movingSeat}
                                            onClick={() => handleMoveSeat(seat)}
                                            className={`rounded-xl px-2 py-2 text-xs font-bold ${
                                                isCurrentSeat
                                                    ? 'bg-purple-500 text-white'
                                                    : occupiedByOther
                                                        ? 'cursor-not-allowed bg-gray-600/50 text-gray-300'
                                                        : 'bg-white/10 text-purple-100 hover:bg-white/20'
                                            }`}
                                        >
                                          {seat}
                                        </button>
                                    );
                                  })}
                                </div>
                                <div className="mt-2 text-xs text-purple-100/50">
                                  灰色代表已有玩家，紫色代表你当前座位。
                                </div>
                              </div>
                          )}
                        </div>
                    ))}
                  </div>
                </section>
              </>
          )}
        </section>

        {showRulesModal && rules && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
              <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 text-black shadow-2xl">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-3xl font-black">狼人杀游戏规则</h2>
                  <button
                      onClick={() => setShowRulesModal(false)}
                      className="rounded-full bg-gray-100 p-2 hover:bg-gray-200"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-6 rounded-3xl bg-purple-50 p-5">
                  <h3 className="text-xl font-black text-purple-800">法官说明</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-700">{rules.judgeIntro}</p>
                  <button
                      type="button"
                      onClick={() => judgeSpeak(rules.judgeIntro)}
                      className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-4 py-2 text-sm font-bold text-white"
                  >
                    <Volume2 size={16} /> 播放说明
                  </button>
                </div>

                <div className="mt-6">
                  <h3 className="text-xl font-black">胜利条件</h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    {Object.entries(rules.winCondition || {}).map(([title, value]) => (
                        <div key={title} className="rounded-2xl bg-gray-100 p-4">
                          <div className="font-black">{title}</div>
                          <div className="mt-2 text-sm leading-6 text-gray-700">{value}</div>
                        </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6">
                  <h3 className="text-xl font-black">夜晚顺序</h3>
                  <div className="mt-3 space-y-2">
                    {(rules.nightOrder || []).map((item: string, idx: number) => (
                        <div key={idx} className="rounded-2xl bg-gray-100 p-3 text-sm leading-6">
                          {idx + 1}. {item}
                        </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6">
                  <h3 className="text-xl font-black">角色技能</h3>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {(rules.roles || roles).map((role: RoleInfo) => (
                        <div key={role.id} className="rounded-2xl border border-gray-200 p-4">
                          <div className="text-lg font-black">{role.name}</div>
                          <div className="mt-1 text-xs font-bold text-purple-600">{teamName(role.team)}</div>
                          <div className="mt-2 text-sm leading-6 text-gray-700">{role.description}</div>
                        </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
        )}

        {confirmCreate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
              <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center text-black shadow-2xl">
                <h2 className="text-xl font-black">确认创建房间？</h2>
                <p className="mt-2 text-sm text-gray-600">创建后会生成房间号，其他玩家可输入房间号加入。</p>
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