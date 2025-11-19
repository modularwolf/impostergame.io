import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient.ts";
import "./style.css";


// ---- Utility helpers ----
const rand = (n: number) => Math.floor(Math.random() * n);
const sample = <T,>(arr: T[]) => arr[rand(arr.length)];
// For short, shareable room codes like "AB3K"
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/1 to avoid confusion

function makeRoomCode() {
  return Array.from({ length: 4 }, () => CODE_CHARS[rand(CODE_CHARS.length)]).join("");
}

// ---- Mock categories ----
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

interface SyncedState {
  stage: "landing" | "lobby" | "game" | "reveal";
  roomCode: string;
  players: Player[];
  round: RoundConfig | null;
  turnIndex: number;
  wordHistory: { name: string; word: string }[];
  votes: Record<string, number>;
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
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [myPlayerId, setMyPlayerId] = useState("");

  const [isOnline, setIsOnline] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const remoteApplyingRef = useRef(false);


  function applyState(s: SyncedState) {
    setStage(s.stage);
    setRoomCode(s.roomCode);
    setPlayers(s.players);
    setRound(s.round);
    setTurnIndex(s.turnIndex);
    setWordHistory(s.wordHistory);
    setVotes(s.votes);
  }

  // ---- Sync to Supabase (host only, only if configured) ----
  useEffect(() => {
    if (!onlineAvailable || !isOnline || !roomCode || !supabase) return;
    if (remoteApplyingRef.current) return; // 👈 don’t write when applying remote state
  
    const synced: SyncedState = {
      stage,
      roomCode,
      players,
      round,
      turnIndex,
      wordHistory,
      votes,
    };
  
    supabase
      .from("rooms")
      .upsert({ code: roomCode, state: synced })
      .then(({ error }) => {
        if (error) console.error("Supabase upsert error:", error);
      });
  }, [
    stage,
    players,
    round,
    turnIndex,
    wordHistory,
    votes,
    isOnline,
    roomCode,
    remoteApplyingRef,
  ]);
  

  // ---- Subscribe to Supabase realtime (clients) ----
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
  
          // Mark that we're applying remote data so the writer effect doesn't echo it back
          remoteApplyingRef.current = true;
          applyState(newState);
          remoteApplyingRef.current = false;
        }
      )
      .subscribe();
  
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOnline, roomCode, remoteApplyingRef]);
  

  // --------- LOCAL MODE ----------
  function createLocalRoom() {
    const code = makeRoomCode();
    setRoomCode(code);

    const id = crypto.randomUUID();
    const host: Player = { id, name: hostName || "Host", ready: false };

    setPlayers([host]);
    setMyPlayerId(id);
    setIsOnline(false);
    setIsHost(true);
    setStage("lobby");
  }

  // --------- ONLINE MODE ----------
  async function hostOnlineRoom() {
    if (!onlineAvailable || !supabase) {
      alert("Online play isn’t configured yet. Use Local Mode for now.");
      return;
    }

    const code = makeRoomCode();
    setRoomCode(code);

    const id = crypto.randomUUID();
    const host: Player = { id, name: hostName || "Host", ready: false };

    setPlayers([host]);
    setMyPlayerId(id);
    setIsOnline(true);
    setIsHost(true);

    const newState: SyncedState = {
      stage: "lobby",
      roomCode: code,
      players: [host],
      round: null,
      turnIndex: 0,
      wordHistory: [],
      votes: {},
    };

    const { error } = await supabase.from("rooms").upsert({ code, state: newState });
    if (error) console.error("Supabase upsert error:", error);
    applyState(newState);
  }

  async function joinOnlineRoom(code: string) {
    if (!onlineAvailable || !supabase) {
      alert("Online play isn’t configured yet. Use Local Mode for now.");
      return;
    }

    setRoomCode(code);
    setIsOnline(true);
    setIsHost(false);

    const myId = crypto.randomUUID();
    setMyPlayerId(myId);

    const { data, error } = await supabase
      .from("rooms")
      .select("state")
      .eq("code", code)
      .single();

    if (!data || error) {
      alert("Room not found.");
      setIsOnline(false);
      return;
    }

    const s = data.state as SyncedState;

    if (!s.players.find((p) => p.id === myId)) {
      s.players.push({ id: myId, name: hostName || "Player", ready: false });
      const { error: upErr } = await supabase.from("rooms").upsert({ code, state: s });
      if (upErr) console.error("Supabase upsert error:", upErr);
    }

    applyState(s);
  }

  // --------- GAME LOGIC ----------
  const allReady = players.length >= 3 && players.every((p) => p.ready);

  function toggleReady(id: string) {
    setPlayers((ps) => ps.map((p) => (p.id === id ? { ...p, ready: !p.ready } : p)));
  }

  function startGame(categoryId?: string, customWord?: string) {
    const impIndex = rand(players.length);
    const roles = players.map((p, i) => ({ ...p, isImposter: i === impIndex }));
    setPlayers(roles);

    const cat = defaultCategories.find((c) => c.id === (categoryId || "random")) || defaultCategories[0];
    const secret = customWord?.trim() || sample(cat.words);

    setRound({ categoryId: cat.id, secretWord: secret });
    setTurnIndex(0);
    setWordHistory([]);
    setVotes({});
    setStage("game");
  }

  function submitWord(word: string) {
    const p = players[turnIndex];
    if (!p) return;
    setWordHistory((h) => [...h, { name: p.name, word }]);
    setTurnIndex((i) => (i + 1) % players.length);
  }

  function castVote(name: string) {
    setVotes((v) => ({ ...v, [name]: (v[name] || 0) + 1 }));
  }

  function endRound() {
    setStage("reveal");
  }

  function nextRound() {
    setPlayers((ps) => ps.map((p) => ({ ...p, ready: false, isImposter: undefined })));
    setRound(null);
    setWordHistory([]);
    setVotes({});
    setTurnIndex(0);
    setStage("lobby");
  }

  // --------- RENDER ----------
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-zinc-900 text-zinc-100 p-6">
      <div className="max-w-5xl mx-auto">
        <Header isOnline={isOnline} />

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
          />
        )}

        {stage === "reveal" && round && (
          <Reveal players={players} round={round} votes={votes} onNextRound={nextRound} />
        )}

        <Footer onlineAvailable={onlineAvailable} />
      </div>
    </div>
  );
}

// ---------- PRESENTATION COMPONENTS ----------

function Header({ isOnline }: { isOnline: boolean }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-3xl md:text-4xl font-black tracking-tight">Imposter Game</h1>
      <div className="text-xs md:text-sm opacity-70">
        {isOnline ? "Online mode" : "Local mode"}
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
  onJoinOnline: (code: string) => void;
  onlineAvailable: boolean;
}) {
  const [joinCode, setJoinCode] = useState("");

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="rounded-3xl p-6 bg-zinc-800/50 border border-zinc-700 shadow-xl">
        <h2 className="text-2xl font-bold mb-2">Play with friends in seconds</h2>
        <p className="opacity-80 mb-4">
          Create a room, pick a secret word, and try to spot the one friend who has no idea what you're talking about.
        </p>
        <label className="text-sm opacity-80">Your name</label>
        <input
          className="w-full mt-1 mb-4 px-3 py-2 bg-zinc-900/60 border border-zinc-700 rounded-xl"
          placeholder="Your name"
          value={hostName}
          onChange={(e) => setHostName(e.target.value)}
        />
        <button
          onClick={onCreateLocal}
          className="w-full py-3 rounded-2xl bg-white text-black font-semibold hover:opacity-90 transition mb-2"
        >
          Local pass-and-play
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
      <div className="rounded-3xl p-6 bg-zinc-800/30 border border-zinc-700">
        <h3 className="text-xl font-semibold mb-2">Join a room</h3>
        <p className="text-sm opacity-80 mb-3">
          Enter the room code shared by your friend to join their game.
        </p>
        <input
          className="w-full mt-1 mb-4 px-3 py-2 bg-zinc-900/60 border border-zinc-700 rounded-xl font-mono uppercase"
          placeholder="AB3K"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
        />
        <button
          onClick={() => onJoinOnline(joinCode.trim())}
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
}: {
  roomCode: string;
  players: Player[];
  myPlayerId: string;
  onToggleReady: (id: string) => void;
  onStart: (categoryId?: string, customWord?: string) => void;
  allReady: boolean;
  isHost: boolean;
}) {
  const [categoryId, setCategoryId] = useState("random");
  const [customWord, setCustomWord] = useState("");

  const me = players.find((p) => p.id === myPlayerId);
  const canToggleMe = !!me;

  return (
    <div className="rounded-3xl p-6 bg-zinc-800/50 border border-zinc-700">
      <div className="flex items-center justify-between">
        <div className="text-sm opacity-80">Room</div>
        <div className="font-mono text-lg bg-zinc-900/60 px-3 py-1 rounded-xl border border-zinc-700">
          {roomCode}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mt-6">
        <div className="md:col-span-2">
          <h3 className="font-semibold mb-2">Players</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {players.map((p) => (
              <div
                key={p.id}
                className={`rounded-2xl border ${
                  p.ready ? "border-emerald-500/70" : "border-zinc-700"
                } bg-zinc-900/50 p-3`}
              >
                <div className="font-semibold truncate">{p.name}</div>
                <div className="text-xs opacity-70">
                  {p.ready ? "Ready" : "Not ready"}
                  {p.id === myPlayerId && " (you)"}
                </div>
                {p.id === myPlayerId && (
                  <button
                    onClick={() => onToggleReady(p.id)}
                    className="mt-2 text-xs px-2 py-1 rounded-lg bg-zinc-200 text-zinc-900"
                  >
                    {p.ready ? "Unready" : "Ready up"}
                  </button>
                )}
              </div>
            ))}
            {!canToggleMe && (
              <div className="text-xs opacity-60">
                Waiting for you to be added to players…
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Round setup</h3>
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
            disabled={!allReady || !isHost}
            className={`w-full py-3 rounded-2xl font-semibold transition ${
              allReady && isHost
                ? "bg-white text-black"
                : "bg-zinc-700 text-zinc-400 cursor-not-allowed"
            }`}
          >
            Start game
          </button>
          <div className="text-xs opacity-70 mt-2">
            Need at least 3 players and everyone ready. Only the host can start.
          </div>
        </div>
      </div>
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
}: {
  players: Player[];
  myPlayerId: string;
  round: RoundConfig;
  turnIndex: number;
  onSubmitWord: (w: string) => void;
  onVote: (name: string) => void;
  wordHistory: { name: string; word: string }[];
  votes: Record<string, number>;
  onReveal: () => void;
}) {
  const me = players.find((p) => p.id === myPlayerId)!;
  const mySeesSecret = !me.isImposter;
  const [word, setWord] = useState("");
  const currentPlayer = players[turnIndex];
  const isMyTurn = currentPlayer?.id === myPlayerId;

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2 rounded-3xl p-6 bg-zinc-800/50 border border-zinc-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs opacity-70">Category</div>
            <div className="text-lg font-semibold capitalize">{round.categoryId}</div>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-70">Your role</div>
            <div className="text-lg font-semibold">
              {mySeesSecret ? "Knower" : "Imposter"}
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-700 p-4 mb-4">
          <div className="text-sm opacity-70">Secret word</div>
          <div className="text-2xl font-black tracking-tight">
            {mySeesSecret ? round.secretWord : "???"}
          </div>
        </div>
        <div className="rounded-2xl bg-zinc-900/40 border border-zinc-700 p-4">
          <div className="text-sm opacity-70 mb-2">Give exactly one word on your turn</div>
          <div className="text-xs opacity-70 mb-2">
            Current turn: <b>{currentPlayer?.name}</b>
          </div>
          <div className="flex gap-2">
            <input
              disabled={!isMyTurn}
              className="flex-1 px-3 py-2 bg-zinc-900/60 border border-zinc-700 rounded-xl"
              placeholder={isMyTurn ? "Your one-word clue" : "Wait for your turn…"}
              value={word}
              onChange={(e) => setWord(e.target.value)}
            />
            <button
              disabled={!isMyTurn || !word.trim()}
              onClick={() => {
                onSubmitWord(word.trim());
                setWord("");
              }}
              className={`px-4 py-2 rounded-xl font-semibold ${
                isMyTurn && word.trim()
                  ? "bg-white text-black"
                  : "bg-zinc-700 text-zinc-400"
              }`}
            >
              Say it
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-3xl p-6 bg-zinc-800/30 border border-zinc-700">
        <h4 className="font-semibold mb-2">Clues</h4>
        <div className="space-y-2 max-h-72 overflow-auto pr-2">
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
          {wordHistory.length === 0 && (
            <div className="text-sm opacity-60">No clues yet.</div>
          )}
        </div>
        <h4 className="font-semibold mt-4 mb-2">Vote</h4>
        <div className="grid grid-cols-2 gap-2">
          {players.map((p) => (
            <button
              key={p.id}
              onClick={() => onVote(p.name)}
              className="rounded-xl bg-zinc-900/60 border border-zinc-700 p-2 text-left hover:bg-zinc-900"
            >
              <div className="text-sm font-semibold">{p.name}</div>
              <div className="text-xs opacity-70">Votes: {votes[p.name] || 0}</div>
            </button>
          ))}
        </div>
        <button
          onClick={onReveal}
          className="mt-4 w-full py-2 rounded-2xl bg-white text-black font-semibold"
        >
          Reveal
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
  votes: Record<string, number>;
  onNextRound: () => void;
}) {
  const tally = useMemo(() => {
    const entries = Object.entries(votes);
    if (entries.length === 0) return null;
    entries.sort((a, b) => b[1] - a[1]);
    const [name, count] = entries[0];
    return { name, count };
  }, [votes]);

  const imp = players.find((p) => p.isImposter);
  const votedOut = tally?.name;
  const success = imp && votedOut && imp.name === votedOut;

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
                <div className="text-xs opacity-70">{votes[p.name] || 0}</div>
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

function Footer({ onlineAvailable }: { onlineAvailable: boolean }) {
  return (
    <div className="text-xs opacity-60 mt-8 text-center space-y-1">
      <div>Built as a prototype party game. No accounts, no chat, just vibes.</div>
      {!onlineAvailable && (
        <div>Online rooms will unlock after Supabase is configured.</div>
      )}
    </div>
  );
}
