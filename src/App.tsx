import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient.ts";
import "./style.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react"


// ---- Utility helpers ----
const rand = (n: number) => Math.floor(Math.random() * n);

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/1 to avoid confusion
function makeRoomCode() {
  return Array.from({ length: 4 }, () => CODE_CHARS[rand(CODE_CHARS.length)]).join("");
}

const defaultCategories = [
  { id: "animals", label: "Animals", words: ["giraffe", "lion", "otter", "falcon", "horse"] },
  { id: "foods", label: "Foods", words: ["pizza", "sushi", "taco", "ramen", "donut"] },
  { id: "heroes", label: "Heroes", words: ["Spiderman", "Iron Man", "Black Widow", "Thor", "Loki"] },
  { id: "random", label: "Random", words: ["rainbow", "volcano", "spaceship", "headphones", "keyboard"] },
];

// ---- Types ----
interface Player {
  id: string;
  name: string;
  ready: boolean;
  isImposter?: boolean;
}

interface RoundConfig {
  categoryId: string;
  secretWord: string;
}

// voterId -> targetPlayerId
type VotesMap = Record<string, string>;

interface SyncedState {
  stage: "landing" | "lobby" | "localRoles" | "game" | "reveal";
  roomCode: string;
  players: Player[];
  round: RoundConfig | null;
  turnIndex: number;
  wordHistory: { name: string; word: string }[];
  votes: VotesMap;
}

interface SessionStats {
  roomsHosted: number;
  roundsStarted: number;
  totalPlayersInRounds: number;
}

const onlineAvailable = !!supabase;

export default function App() {
  const [stage, setStage] = useState<SyncedState["stage"]>("landing");
  const [roomCode, setRoomCode] = useState("");
  const [hostName, setHostName] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [round, setRound] = useState<RoundConfig | null>(null);
  const [turnIndex, setTurnIndex] = useState(0);
  const [wordHistory, setWordHistory] = useState<{ name: string; word: string }[]>([]);
  const [votes, setVotes] = useState<VotesMap>({});
  const [myPlayerId, setMyPlayerId] = useState("");

  const [isOnline, setIsOnline] = useState(false);
  const [isHost, setIsHost] = useState(false);

  // Local-only: pass-and-play role reveal index
  const [localRoleIndex, setLocalRoleIndex] = useState(0);

  // How-to-play modal
  const [showHowTo, setShowHowTo] = useState(false);

  // Session analytics
  const [stats, setStats] = useState<SessionStats>({
    roomsHosted: 0,
    roundsStarted: 0,
    totalPlayersInRounds: 0,
  });

  const avgPlayersPerRound =
    stats.roundsStarted > 0
      ? (stats.totalPlayersInRounds / stats.roundsStarted).toFixed(1)
      : "–";

  // --- Helpers to build/apply synced state ---
  function buildState(overrides: Partial<SyncedState> = {}): SyncedState {
    return {
      stage,
      roomCode,
      players,
      round,
      turnIndex,
      wordHistory,
      votes,
      ...overrides,
    };
  }

  function applyState(s: SyncedState) {
    setStage(s.stage);
    setRoomCode(s.roomCode);
    setPlayers(s.players);
    setRound(s.round);
    setTurnIndex(s.turnIndex);
    setWordHistory(s.wordHistory);
    setVotes(s.votes);
  }

  async function pushState(next: SyncedState) {
    // Only for online mode; local never calls this
    if (!onlineAvailable || !supabase) return;
    const { error } = await supabase.from("rooms").upsert({
      code: next.roomCode,
      state: next,
    });
    if (error) {
      console.error("Supabase upsert error:", error);
    }
  }

  // ---- Subscribe to Supabase realtime (everyone online) ----
  useEffect(() => {
    if (!onlineAvailable || !isOnline || !roomCode || !supabase) return;

    const channel = supabase
      .channel(`room:${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rooms",
          filter: `code=eq.${roomCode}`,
        },
        (payload: any) => {
          if (!payload.new?.state) return;
          const newState = payload.new.state as SyncedState;
          applyState(newState);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOnline, roomCode]);

  // --------- NAV / RESET ----------
  function goHome() {
    setStage("landing");
    setRoomCode("");
    setPlayers([]);
    setRound(null);
    setWordHistory([]);
    setVotes({});
    setTurnIndex(0);
    setIsOnline(false);
    setIsHost(false);
    setMyPlayerId("");
    setLocalRoleIndex(0);
    // hostName preserved so host doesn't have to retype
  }

  function bumpRoomsHosted() {
    setStats((s) => ({ ...s, roomsHosted: s.roomsHosted + 1 }));
  }

  function bumpRoundStarted(playerCount: number) {
    setStats((s) => ({
      ...s,
      roundsStarted: s.roundsStarted + 1,
      totalPlayersInRounds: s.totalPlayersInRounds + playerCount,
    }));
  }

  // --------- LOCAL MODE ----------
  function createLocalRoom() {
    const code = makeRoomCode();
    const id = crypto.randomUUID();
    const host: Player = { id, name: hostName || "Host", ready: false };

    setIsOnline(false);
    setIsHost(true);
    setMyPlayerId(id);

    const next = buildState({
      stage: "lobby",
      roomCode: code,
      players: [host],
      round: null,
      turnIndex: 0,
      wordHistory: [],
      votes: {},
    });

    applyState(next);
    bumpRoomsHosted();
  }

  function addLocalPlayer(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newPlayer: Player = {
      id: crypto.randomUUID(),
      name: trimmed,
      ready: false,
    };
    setPlayers((ps) => [...ps, newPlayer]);
  }

  // --------- ONLINE MODE ----------
  async function hostOnlineRoom() {
    if (!onlineAvailable || !supabase) {
      alert("Online play isn’t configured yet.");
      return;
    }

    const code = makeRoomCode();
    const id = crypto.randomUUID();
    const host: Player = { id, name: hostName || "Host", ready: false };

    setIsOnline(true);
    setIsHost(true);
    setMyPlayerId(id);

    const next: SyncedState = {
      stage: "lobby",
      roomCode: code,
      players: [host],
      round: null,
      turnIndex: 0,
      wordHistory: [],
      votes: {},
    };

    applyState(next);
    bumpRoomsHosted();
    await pushState(next);
  }

  async function joinOnlineRoom(code: string, name: string) {
    if (!onlineAvailable || !supabase) {
      alert("Online play isn’t configured yet.");
      return;
    }

    const joinCode = code.trim().toUpperCase();
    if (!joinCode) return;

    const myId = crypto.randomUUID();
    const playerName = name.trim() || "Player";

    const { data, error } = await supabase
      .from("rooms")
      .select("state")
      .eq("code", joinCode)
      .single();

    if (!data || error) {
      console.error(error);
      alert("Room not found.");
      setIsOnline(false);
      return;
    }

    const s = data.state as SyncedState;
    let playersNext = s.players;

    if (!playersNext.find((p) => p.id === myId)) {
      playersNext = [
        ...playersNext,
        { id: myId, name: playerName, ready: false },
      ];
    }

    const next: SyncedState = {
      ...s,
      roomCode: joinCode,
      players: playersNext,
    };

    setMyPlayerId(myId);
    setIsOnline(true);
    setIsHost(false);

    applyState(next);
    await pushState(next);
  }

  // --------- GAME LOGIC ----------
  const allReady = isOnline
    ? players.length >= 3 && players.every((p) => p.ready)
    : players.length >= 3; // local: only require 3+ players

  function toggleReady(id: string) {
    const updatedPlayers = players.map((p) =>
      p.id === id ? { ...p, ready: !p.ready } : p
    );
    setPlayers(updatedPlayers);

    if (isOnline) {
      const next = buildState({ players: updatedPlayers });
      pushState(next);
    }
  }

  function startGame(categoryId?: string, customWord?: string) {
    const impIndex = rand(players.length);
    const roles = players.map((p, i) => ({ ...p, isImposter: i === impIndex }));

    const cat =
      defaultCategories.find((c) => c.id === (categoryId || "random")) ||
      defaultCategories[0];
    const secret = customWord?.trim() || cat.words[rand(cat.words.length)];

    // random starting player index
    const startingIndex = rand(players.length);

    bumpRoundStarted(players.length);

    if (isOnline) {
      const next = buildState({
        stage: "game",
        players: roles,
        round: { categoryId: cat.id, secretWord: secret },
        turnIndex: startingIndex,
        wordHistory: [],
        votes: {},
      });
      applyState(next);
      pushState(next);
    } else {
      // local: go into pass-and-play role reveal flow
      setLocalRoleIndex(0);
      const next = buildState({
        stage: "localRoles",
        players: roles,
        round: { categoryId: cat.id, secretWord: secret },
        turnIndex: startingIndex,
        wordHistory: [],
        votes: {},
      });
      applyState(next);
    }
  }

  function submitWord(word: string) {
    const p = players[turnIndex];
    if (!p) return;

    const newHistory = [...wordHistory, { name: p.name, word }];
    const newTurn = (turnIndex + 1) % players.length;

    setWordHistory(newHistory);
    setTurnIndex(newTurn);

    if (isOnline) {
      const next = buildState({
        wordHistory: newHistory,
        turnIndex: newTurn,
      });
      pushState(next);
    }
  }

  function castVote(targetId: string) {
    if (!isOnline) {
      // local: just store a single "group vote" for visualization
      const newVotes: VotesMap = { group: targetId };
      setVotes(newVotes);
      return;
    }

    if (!myPlayerId) return;

    // 1 vote per player online: overwrite your previous vote
    const newVotes: VotesMap = {
      ...votes,
      [myPlayerId]: targetId,
    };
    setVotes(newVotes);

    if (isOnline) {
      const next = buildState({ votes: newVotes });
      pushState(next);
    }
  }

  function endRound() {
    const next = buildState({ stage: "reveal" });
    applyState(next);
    if (isOnline) pushState(next);
  }

  function nextRound() {
    const resetPlayers = players.map((p) => ({
      ...p,
      ready: false,
      isImposter: undefined,
    }));

    const next = buildState({
      stage: "lobby",
      players: resetPlayers,
      round: null,
      wordHistory: [],
      votes: {},
      turnIndex: 0,
    });

    applyState(next);
    if (isOnline) pushState(next);
  }

  // ---- SHARE: used in Lobby for online rooms ----
  function getShareInfo(currentRoomCode: string) {
    const baseUrl =
      typeof window !== "undefined" && window.location.origin
        ? window.location.origin
        : "https://impostergame.io";
    const url = `${baseUrl}/?room=${currentRoomCode}`;
    return { url, code: currentRoomCode };
  }

  async function shareRoom(roomCode: string) {
    const { url, code } = getShareInfo(roomCode);
    const text = `Join my Imposter Game room: ${code}`;

    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({
          title: "Imposter Game",
          text,
          url,
        });
      } else if (navigator && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        alert("Invite link copied! Paste it into iMessage, WhatsApp, etc.");
      } else {
        alert(`Share this link: ${url}`);
      }
    } catch (err) {
      console.error("Share failed:", err);
      if (navigator && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(url);
          alert("Invite link copied! Paste it into iMessage, WhatsApp, etc.");
        } catch {
          alert(`Share this link: ${url}`);
        }
      } else {
        alert(`Share this link: ${url}`);
      }
    }
  }

  // --------- RENDER ----------
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-zinc-900 text-zinc-100 p-6">
      <div className="max-w-5xl mx-auto">
        <Header isOnline={isOnline} onHome={goHome} onShowHowTo={() => setShowHowTo(true)} />

        {stage === "landing" && (
          <Landing
            hostName={hostName}
            setHostName={setHostName}
            onCreateLocal={createLocalRoom}
            onHostOnline={hostOnlineRoom}
            onJoinOnline={joinOnlineRoom}
            onlineAvailable={onlineAvailable}
          />
        )}

        {stage === "lobby" && (
          <Lobby
            roomCode={roomCode}
            players={players}
            myPlayerId={myPlayerId}
            onToggleReady={toggleReady}
            onStart={startGame}
            allReady={allReady}
            isHost={isHost}
            isOnline={isOnline}
            onAddLocalPlayer={isOnline ? undefined : addLocalPlayer}
            onShareRoom={shareRoom}
          />
        )}

        {stage === "localRoles" && round && (
          <LocalRoleReveal
            players={players}
            round={round}
            localRoleIndex={localRoleIndex}
            setLocalRoleIndex={setLocalRoleIndex}
            onDone={() => setStage("game")}
          />
        )}

        {stage === "game" && round && (
          <Game
            players={players}
            myPlayerId={myPlayerId}
            round={round}
            turnIndex={turnIndex}
            onSubmitWord={submitWord}
            onVote={castVote}
            wordHistory={wordHistory}
            votes={votes}
            onReveal={endRound}
            isOnline={isOnline}
          />
        )}

        {stage === "reveal" && round && (
          <Reveal players={players} round={round} votes={votes} onNextRound={nextRound} />
        )}

        <Footer
          onlineAvailable={onlineAvailable}
          stats={stats}
          avgPlayersPerRound={avgPlayersPerRound}
        />
        <Analytics />
        <SpeedInsights/>
      </div>

      {showHowTo && <HowToPlayModal onClose={() => setShowHowTo(false)} />}
    </div>
  );
}

// ---------- PRESENTATION COMPONENTS ----------

function Header({
  isOnline,
  onHome,
  onShowHowTo,
}: {
  isOnline: boolean;
  onHome: () => void;
  onShowHowTo: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-6">
      <button
        onClick={onHome}
        className="text-left focus:outline-none"
        aria-label="Go to home"
      >
        <h1 className="text-3xl md:text-4xl font-black tracking-tight cursor-pointer hover:text-emerald-300 transition">
          Imposter Game
        </h1>
        <p className="text-xs md:text-sm opacity-70 mt-1">
          One-word clue party game · TikTok-ready
        </p>
      </button>
      <div className="flex items-center gap-3">
        <button
          onClick={onShowHowTo}
          className="text-xs md:text-sm px-3 py-1 rounded-full border border-zinc-600 bg-zinc-900/70 hover:bg-zinc-800 transition"
        >
          How to play
        </button>
        <div className="text-xs md:text-sm opacity-70">
          {isOnline ? "Online mode" : "Local mode"}
        </div>
      </div>
    </div>
  );
}

function Landing({
  hostName,
  setHostName,
  onCreateLocal,
  onHostOnline,
  onJoinOnline,
  onlineAvailable,
}: {
  hostName: string;
  setHostName: (v: string) => void;
  onCreateLocal: () => void;
  onHostOnline: () => void;
  onJoinOnline: (code: string, name: string) => void;
  onlineAvailable: boolean;
}) {
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");

  return (
    <div className="grid gap-6 md:grid-cols-[1.4fr,1fr]">
      {/* Hero / host card */}
      <div className="rounded-3xl p-6 bg-zinc-900/70 border border-zinc-700 shadow-xl">
        <h2 className="text-2xl md:text-3xl font-bold mb-2">
          Play the TikTok imposter game with your friends
        </h2>
        <p className="opacity-80 mb-4 text-sm md:text-base">
          Everyone gets a secret word… except the imposter. Go around with one-word clues,
          call out sus answers, and vote to catch the fake.
        </p>
        <ul className="text-xs md:text-sm opacity-80 mb-4 list-disc pl-5 space-y-1">
          <li>Perfect for living rooms, game nights, and pre-game hangs</li>
          <li>Works on one phone (pass-and-play) or online with room codes</li>
          <li>No login, no ads, just vibes</li>
        </ul>

        <label className="text-sm opacity-80">Your name (host)</label>
        <input
          className="w-full mt-1 mb-4 px-3 py-2 bg-zinc-950/80 border border-zinc-700 rounded-xl"
          placeholder="Your name"
          value={hostName}
          onChange={(e) => setHostName(e.target.value)}
        />
        <button
          onClick={onCreateLocal}
          className="w-full py-3 rounded-2xl bg-white text-black font-semibold hover:opacity-90 transition mb-2"
        >
          Start local game
        </button>
        <button
          onClick={onHostOnline}
          disabled={!onlineAvailable}
          className={`w-full py-3 rounded-2xl font-semibold transition ${
            onlineAvailable
              ? "bg-emerald-400 text-black hover:bg-emerald-300"
              : "bg-zinc-700 text-zinc-400 cursor-not-allowed"
          }`}
        >
          Host online room
        </button>
        {!onlineAvailable && (
          <p className="text-xs opacity-60 mt-2">
            Online play will unlock after Supabase is configured.
          </p>
        )}
      </div>

      {/* Join card */}
      <div className="rounded-3xl p-6 bg-zinc-800/40 border border-zinc-700">
        <h3 className="text-xl font-semibold mb-2">Join a room</h3>
        <p className="text-sm opacity-80 mb-3">
          Your friend hosts, shares a code or link, and you drop in.
        </p>

        <label className="text-sm opacity-80">Your name</label>
        <input
          className="w-full mt-1 mb-3 px-3 py-2 bg-zinc-900/60 border border-zinc-700 rounded-xl"
          placeholder="Your name"
          value={joinName}
          onChange={(e) => setJoinName(e.target.value)}
        />

        <label className="text-sm opacity-80">Room code</label>
        <input
          className="w-full mt-1 mb-4 px-3 py-2 bg-zinc-900/60 border border-zinc-700 rounded-xl font-mono uppercase"
          placeholder="AB3K"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
        />

        <button
          onClick={() => onJoinOnline(joinCode, joinName)}
          disabled={!joinCode.trim() || !onlineAvailable}
          className={`w-full py-3 rounded-2xl font-semibold transition ${
            joinCode.trim() && onlineAvailable
              ? "bg-white text-black"
              : "bg-zinc-700 text-zinc-400 cursor-not-allowed"
          }`}
        >
          Join online game
        </button>
      </div>
    </div>
  );
}

function Lobby({
  roomCode,
  players,
  myPlayerId,
  onToggleReady,
  onStart,
  allReady,
  isHost,
  isOnline,
  onAddLocalPlayer,
  onShareRoom,
}: {
  roomCode: string;
  players: Player[];
  myPlayerId: string;
  onToggleReady: (id: string) => void;
  onStart: (categoryId?: string, customWord?: string) => void;
  allReady: boolean;
  isHost: boolean;
  isOnline: boolean;
  onAddLocalPlayer?: (name: string) => void;
  onShareRoom: (roomCode: string) => void;
}) {
  const [categoryId, setCategoryId] = useState("random");
  const [customWord, setCustomWord] = useState("");
  const [newPlayerName, setNewPlayerName] = useState("");

  return (
    <div className="rounded-3xl p-6 bg-zinc-800/50 border border-zinc-700">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm opacity-80">Room</div>
          <div className="font-mono text-lg bg-zinc-900/60 px-3 py-1 rounded-xl border border-zinc-700 inline-block">
            {roomCode}
          </div>
        </div>
        {isOnline && (
          <button
            onClick={() => onShareRoom(roomCode)}
            className="text-xs md:text-sm px-3 py-1 rounded-full border border-emerald-500/70 bg-emerald-500/10 hover:bg-emerald-500/20 transition"
          >
            Share invite link
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-6 mt-6">
        {/* Players list */}
        <div className="md:col-span-2">
          <h3 className="font-semibold mb-2">Players</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
            {players.map((p) => (
              <div
                key={p.id}
                className={`rounded-2xl border ${
                  p.ready ? "border-emerald-500/70" : "border-zinc-700"
                } bg-zinc-900/50 p-3`}
              >
                <div className="font-semibold truncate">{p.name}</div>
                <div className="text-xs opacity-70">
                  {p.ready ? "Ready" : "Not ready"} {p.id === myPlayerId && isOnline && "(you)"}
                </div>
                {isOnline && p.id === myPlayerId && (
                  <button
                    onClick={() => onToggleReady(p.id)}
                    className="mt-2 text-xs px-2 py-1 rounded-lg bg-zinc-200 text-zinc-900"
                  >
                    {p.ready ? "Unready" : "Ready up"}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Local: add players */}
          {!isOnline && isHost && onAddLocalPlayer && (
            <div className="rounded-2xl bg-zinc-900/40 border border-zinc-700 p-4">
              <h4 className="font-semibold mb-2 text-sm">Add local players</h4>
              <p className="text-xs opacity-70 mb-2">
                Type each friend&apos;s name and tap Add. Best with 3–8 players.
              </p>
              <div className="flex gap-2">
                <input
                  className="flex-1 px-3 py-2 bg-zinc-900/60 border border-zinc-700 rounded-xl text-sm"
                  placeholder="New player name"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                />
                <button
                  onClick={() => {
                    onAddLocalPlayer(newPlayerName);
                    setNewPlayerName("");
                  }}
                  className="px-3 py-2 rounded-xl bg-white text-black text-sm font-semibold"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Round setup – host only */}
        {isHost ? (
          <div>
            <h3 className="font-semibold mb-2">Round setup (host)</h3>
            <label className="text-sm opacity-80">Category</label>
            <select
              className="w-full mt-1 mb-3 px-3 py-2 bg-zinc-900/60 border border-zinc-700 rounded-xl"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {defaultCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>

            <label className="text-sm opacity-80">Or choose a custom secret word</label>
            <input
              className="w-full mt-1 mb-4 px-3 py-2 bg-zinc-900/60 border border-zinc-700 rounded-xl"
              placeholder="(optional) e.g., giraffe"
              value={customWord}
              onChange={(e) => setCustomWord(e.target.value)}
            />
            <button
              onClick={() => onStart(categoryId, customWord)}
              disabled={!allReady}
              className={`w-full py-3 rounded-2xl font-semibold transition ${
                allReady
                  ? "bg-white text-black"
                  : "bg-zinc-700 text-zinc-400 cursor-not-allowed"
              }`}
            >
              Start game
            </button>
            <div className="text-xs opacity-70 mt-2">
              Need at least 3 players{isOnline && " and everyone ready"}.
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-zinc-900/40 border border-zinc-700 p-4 flex items-center justify-center text-sm opacity-80">
            Waiting for the host to pick a category and start the round.
          </div>
        )}
      </div>
    </div>
  );
}

function LocalRoleReveal({
  players,
  round,
  localRoleIndex,
  setLocalRoleIndex,
  onDone,
}: {
  players: Player[];
  round: RoundConfig;
  localRoleIndex: number;
  setLocalRoleIndex: (n: number) => void;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<"pass" | "show">("pass");

  useEffect(() => {
    setPhase("pass");
  }, [localRoleIndex]);

  const player = players[localRoleIndex];
  if (!player) {
    onDone();
    return null;
  }

  const isLast = localRoleIndex === players.length - 1;

  const handleNext = () => {
    if (isLast) {
      onDone();
    } else {
      setLocalRoleIndex(localRoleIndex + 1);
    }
  };

  return (
    <div className="rounded-3xl p-6 bg-zinc-800/60 border border-zinc-700 max-w-xl mx-auto mt-8">
      {phase === "pass" && (
        <>
          <h2 className="text-2xl font-bold mb-3 text-center">Pass the device</h2>
          <p className="text-sm opacity-80 mb-6 text-center">
            Hand the phone to <span className="font-semibold">{player.name}</span> without anyone
            else looking.
          </p>
          <button
            onClick={() => setPhase("show")}
            className="w-full py-3 rounded-2xl bg-white text-black font-semibold"
          >
            Ready? Show {player.name}&apos;s role
          </button>
        </>
      )}

      {phase === "show" && (
        <>
          <h2 className="text-2xl font-bold mb-3 text-center">Your role</h2>
          <p className="text-sm opacity-80 mb-4 text-center">
            Hi <span className="font-semibold">{player.name}</span>, only you should see this.
          </p>
          <div className="rounded-2xl bg-zinc-900/80 border border-zinc-700 p-4 mb-4 text-center">
            {player.isImposter ? (
              <>
                <div className="text-sm uppercase tracking-wide opacity-70 mb-1">
                  You are the
                </div>
                <div className="text-3xl font-black text-rose-300 mb-2">IMPOSTER</div>
                <div className="text-sm opacity-80">
                  You <span className="font-semibold">do NOT</span> know the secret word. Listen
                  carefully and try to blend in.
                </div>
              </>
            ) : (
              <>
                <div className="text-sm uppercase tracking-wide opacity-70 mb-1">
                  You know the secret word
                </div>
                <div className="text-3xl font-black text-emerald-300 mb-2">
                  {round.secretWord}
                </div>
                <div className="text-sm opacity-80">
                  Give one-word clues that are helpful, but not too obvious.
                </div>
              </>
            )}
          </div>
          <p className="text-xs opacity-70 mb-4 text-center">
            Memorize this, then tap below and pass the phone face-down.
          </p>
          <button
            onClick={handleNext}
            className="w-full py-3 rounded-2xl bg-white text-black font-semibold mb-2"
          >
            {isLast ? "Done – go to game" : "Hide and pass to next player"}
          </button>
          {!isLast && (
            <div className="text-xs opacity-60 text-center">
              Next up: <span className="font-semibold">{players[localRoleIndex + 1].name}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Game({
  players,
  myPlayerId,
  round,
  turnIndex,
  onSubmitWord,
  onVote,
  wordHistory,
  votes,
  onReveal,
  isOnline,
}: {
  players: Player[];
  myPlayerId: string;
  round: RoundConfig;
  turnIndex: number;
  onSubmitWord: (w: string) => void;
  onVote: (targetId: string) => void;
  wordHistory: { name: string; word: string }[];
  votes: VotesMap;
  onReveal: () => void;
  isOnline: boolean;
}) {
  const me = isOnline ? players.find((p) => p.id === myPlayerId) : undefined;
  const mySeesSecret = !!(isOnline && me && !me.isImposter);
  const [word, setWord] = useState("");
  const startingPlayer = players[turnIndex];

  const voteCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(votes).forEach((targetId) => {
      counts[targetId] = (counts[targetId] || 0) + 1;
    });
    return counts;
  }, [votes]);

  let canReveal = true;
  let remainingVotes = 0;
  let requiredVotes = 0;

  if (isOnline) {
    const totalVotes = Object.keys(votes).length;
    if (players.length <= 3) {
      requiredVotes = 2;
    } else {
      requiredVotes = Math.ceil(players.length * 0.75);
    }
    canReveal = totalVotes >= requiredVotes;
    remainingVotes = Math.max(requiredVotes - totalVotes, 0);
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {/* Left side */}
      <div className="md:col-span-2 rounded-3xl p-6 bg-zinc-800/50 border border-zinc-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs opacity-70">Category</div>
            <div className="text-lg font-semibold capitalize">{round.categoryId}</div>
          </div>
          <div className="text-right">
            {isOnline ? (
              <>
                <div className="text-xs opacity-70">Your role</div>
                <div className="text-lg font-semibold">
                  {mySeesSecret ? "Knower" : "Imposter"}
                </div>
              </>
            ) : (
              <>
                <div className="text-xs opacity-70">Mode</div>
                <div className="text-lg font-semibold">Pass-and-play</div>
              </>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-700 p-4 mb-4">
          <div className="text-sm opacity-70">Secret word</div>
          <div className="text-2xl font-black tracking-tight">
            {isOnline
              ? mySeesSecret
                ? round.secretWord
                : "???"
              : "Shown privately during role reveal"}
          </div>
        </div>

        {/* First-player banner */}
        {startingPlayer && (
          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/50 p-4 mb-3">
            <div className="text-sm opacity-80">
              <span className="font-semibold">{startingPlayer.name}</span> starts! They give the
              first one-word clue.
            </div>
          </div>
        )}

        {/* IRL instructions */}
        <div className="rounded-2xl bg-zinc-900/40 border border-zinc-700 p-4 mb-3">
          <div className="text-sm opacity-80">
            Say your one-word clue out loud on your turn. No typing needed in this version.
          </div>
          <div className="text-xs opacity-60 mt-1">
            Go around the circle in order. When everyone has shared clues, vote below.
          </div>
        </div>

        {/* Hidden future text-input mode – kept for later */}
        <div className="rounded-2xl bg-zinc-900/40 border border-zinc-700 p-4 hidden">
          <div className="text-sm opacity-70 mb-2">
            Give exactly one word on your turn (online text mode).
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 bg-zinc-900/60 border border-zinc-700 rounded-xl"
              placeholder="Your one-word clue"
              value={word}
              onChange={(e) => setWord(e.target.value)}
            />
            <button
              onClick={() => {
                if (!word.trim()) return;
                onSubmitWord(word.trim());
                setWord("");
              }}
              className="px-4 py-2 rounded-xl font-semibold bg-white text-black"
            >
              Say it
            </button>
          </div>
        </div>
      </div>

      {/* Right side: votes (and clues if present) */}
      <div className="rounded-3xl p-6 bg-zinc-800/30 border border-zinc-700">
        {wordHistory.length > 0 && (
          <>
            <h4 className="font-semibold mb-2">Clues</h4>
            <div className="space-y-2 max-h-40 overflow-auto pr-2 mb-4">
              {wordHistory.map((w, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl bg-zinc-900/60 border border-zinc-700 p-2"
                >
                  <div className="text-sm">
                    <b>{w.name}</b>
                  </div>
                  <div className="font-mono text-sm">{w.word}</div>
                </div>
              ))}
            </div>
          </>
        )}

        <h4 className="font-semibold mb-2">Vote</h4>
        <div className="text-xs opacity-70 mb-2">
          {isOnline
            ? "Tap once to cast your vote. You only get one vote; tapping another player will move your vote."
            : "Tap who you think is the imposter to track your group’s choice, then hit Reveal when you’re ready."}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {players.map((p) => (
            <button
              key={p.id}
              onClick={() => onVote(p.id)}
              className="rounded-xl bg-zinc-900/60 border border-zinc-700 p-2 text-left hover:bg-zinc-900"
            >
              <div className="text-sm font-semibold">{p.name}</div>
              <div className="text-xs opacity-70">Votes: {voteCounts[p.id] || 0}</div>
            </button>
          ))}
        </div>
        <button
          onClick={onReveal}
          disabled={isOnline && !canReveal}
          className={`mt-4 w-full py-2 rounded-2xl font-semibold ${
            !isOnline || canReveal
              ? "bg-white text-black"
              : "bg-zinc-700 text-zinc-400 cursor-not-allowed"
          }`}
        >
          {!isOnline
            ? "Reveal"
            : canReveal
            ? "Reveal"
            : remainingVotes > 0
            ? `Waiting for ${remainingVotes} more vote${remainingVotes === 1 ? "" : "s"}…`
            : "Waiting for votes…"}
        </button>
      </div>
    </div>
  );
}

function Reveal({
  players,
  round,
  votes,
  onNextRound,
}: {
  players: Player[];
  round: RoundConfig;
  votes: VotesMap;
  onNextRound: () => void;
}) {
  const tally = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(votes).forEach((targetId) => {
      counts[targetId] = (counts[targetId] || 0) + 1;
    });

    let topTargetId: string | null = null;
    let topCount = 0;
    for (const [targetId, count] of Object.entries(counts)) {
      if (count > topCount) {
        topTargetId = targetId;
        topCount = count;
      }
    }

    return {
      counts,
      topTargetId,
      topCount,
    };
  }, [votes]);

  const imp = players.find((p) => p.isImposter);
  const votedOut = players.find((p) => p.id === tally.topTargetId);
  const success = imp && votedOut && imp.id === votedOut.id;

  return (
    <div className="rounded-3xl p-6 bg-zinc-800/50 border border-zinc-700">
      <h3 className="text-2xl font-bold mb-2">Reveal</h3>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 rounded-2xl bg-zinc-900/60 border border-zinc-700 p-4">
          <div className="text-sm opacity-70">Secret word</div>
          <div className="text-3xl font-black tracking-tight mb-2">
            {round.secretWord}
          </div>
          <div className="text-sm opacity-70">Imposter</div>
          <div className="text-xl font-bold mb-4">{imp?.name}</div>
          <div
            className={`inline-block px-3 py-1 rounded-xl text-sm ${
              success
                ? "bg-emerald-500/20 border border-emerald-500/60"
                : "bg-rose-500/20 border border-rose-500/60"
            }`}
          >
            {success ? "Crew wins!" : "Imposter survives!"}
          </div>
          {votedOut && (
            <div className="text-sm opacity-80 mt-3">
              Most votes went to <b>{votedOut.name}</b> (
              {tally.topCount} vote{tally.topCount === 1 ? "" : "s"}).
            </div>
          )}
        </div>
        <div className="rounded-2xl bg-zinc-900/40 border border-zinc-700 p-4">
          <h4 className="font-semibold mb-2">Vote tally</h4>
          <div className="space-y-2">
            {players.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl bg-zinc-950/50 border border-zinc-800 p-2"
              >
                <div className="text-sm">{p.name}</div>
                <div className="text-xs opacity-70">
                  {tally.counts[p.id] || 0}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={onNextRound}
            className="mt-4 w-full py-2 rounded-2xl bg-white text-black font-semibold"
          >
            Next round
          </button>
        </div>
      </div>
    </div>
  );
}

function Footer({
  onlineAvailable,
  stats,
  avgPlayersPerRound,
}: {
  onlineAvailable: boolean;
  stats: SessionStats;
  avgPlayersPerRound: string;
}) {
  return (
    <div className="text-xs opacity-60 mt-8 text-center space-y-1">
      <div>Built as a prototype party game. No accounts, no chat, just vibes.</div>
      {!onlineAvailable && (
        <div>Online rooms will unlock after Supabase is configured.</div>
      )}
      <div className="flex justify-center gap-4 mt-2 text-[11px] text-zinc-400">
        <span>Rooms hosted: {stats.roomsHosted}</span>
        <span>Rounds played: {stats.roundsStarted}</span>
        <span>Avg players/round: {avgPlayersPerRound}</span>
      </div>
    </div>
  );
}

function HowToPlayModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
      <div className="max-w-lg w-full rounded-3xl bg-zinc-900 border border-zinc-700 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold">How to play Imposter Game</h2>
          <button
            onClick={onClose}
            className="text-xs px-2 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700"
          >
            Close
          </button>
        </div>
        <ol className="space-y-2 text-sm opacity-90 mb-4">
          <li>
            <b>1. Choose your mode.</b> Host taps <b>Start local game</b> (one phone, pass it
            around) or <b>Host online room</b> (everyone on their own device).
          </li>
          <li>
            <b>2. Add players.</b> Each friend joins the lobby with their name. Online players join
            using a code or invite link.
          </li>
          <li>
            <b>3. Secret word.</b> The host picks a category or custom word. Everyone except the
            imposter sees it.
          </li>
          <li>
            <b>4. Give one-word clues.</b> Go in a circle. Each player says exactly one word out
            loud that relates to the secret.
          </li>
          <li>
            <b>5. Vote the imposter out.</b> After at least one round of clues, everyone votes on
            who they think is faking it.
          </li>
          <li>
            <b>6. Reveal.</b> The app shows the secret word and the true imposter. Then you can
            start a new round with a new imposter.
          </li>
        </ol>
        <p className="text-xs opacity-70">
          Tip: For TikTok, prop the phone up so the secret word and votes are visible, and record
          the chaos as everyone argues about who&apos;s sus.
        </p>
      </div>
    </div>
  );
}
