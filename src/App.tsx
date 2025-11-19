import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient.ts"; // MUST exist
import "./style.css";

// ---- Utility helpers ----
const rand = (n: number) => Math.floor(Math.random() * n);
const sample = <T,>(arr: T[]) => arr[rand(arr.length)];
const codeWords = [
  "MINT", "ORCA", "LAVA", "NOVA", "PIXEL", "QUILL", "ZINC", "EMBER",
  "JUNO", "LYNX", "MARS", "ONYX", "QUARK", "RUNE", "SAGE", "VOLT",
];
function makeRoomCode() {
  return Array.from({ length: 4 }, () => sample(codeWords)).join("-");
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

  // ONLINE flags
  const [isOnline, setIsOnline] = useState(false);
  const [isHost, setIsHost] = useState(false);

  // ---- Local helpers ----
  function applyState(s: SyncedState) {
    setStage(s.stage);
    setRoomCode(s.roomCode);
    setPlayers(s.players);
    setRound(s.round);
    setTurnIndex(s.turnIndex);
    setWordHistory(s.wordHistory);
    setVotes(s.votes);
  }

  // ---- Sync state to Supabase (host only) ----
  useEffect(() => {
    if (!isOnline || !isHost || !roomCode) return;

    const synced: SyncedState = {
      stage,
      roomCode,
      players,
      round,
      turnIndex,
      wordHistory,
      votes,
    };

    supabase.from("rooms").upsert({ code: roomCode, state: synced });
  }, [stage, players, round, turnIndex, wordHistory, votes, isOnline, isHost, roomCode]);

  // ---- Subscribe to Supabase realtime updates ----
  useEffect(() => {
    if (!isOnline || !roomCode) return;

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

          // Only clients update; host uses local state as source of truth
          if (!isHost) applyState(newState);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOnline, roomCode, isHost]);

  // -------------------------------------------------------
  // ---------------------- LOCAL MODE ----------------------
  // -------------------------------------------------------
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

  // -------------------------------------------------------
  // ---------------------- ONLINE MODE ---------------------
  // -------------------------------------------------------

  async function hostOnlineRoom() {
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

    await supabase.from("rooms").upsert({ code, state: newState });
    applyState(newState);
  }

  async function joinOnlineRoom(code: string) {
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
      alert("Room not found");
      setIsOnline(false);
      return;
    }

    const s = data.state as SyncedState;

    // Add self if missing
    if (!s.players.find((p) => p.id === myId)) {
      s.players.push({ id: myId, name: hostName || "Player", ready: false });
      await supabase.from("rooms").upsert({ code, state: s });
    }

    applyState(s);
  }

  // -------------------------------------------------------
  // ---------------------- GAME LOGIC ----------------------
  // -------------------------------------------------------
  const allReady = players.length >= 3 && players.every((p) => p.ready);

  function toggleReady(id: string) {
    setPlayers((ps) => ps.map((p) => (p.id === id ? { ...p, ready: !p.ready } : p)));
  }

  function startGame(categoryId?: string, customWord?: string) {
    const impIndex = rand(players.length);
    const roles = players.map((p, i) => ({ ...p, isImposter: i === impIndex }));
    setPlayers(roles);

    const cat = defaultCategories.find((c) => c.id === categoryId) || defaultCategories[0];
    const secret = customWord?.trim() || sample(cat.words);

    setRound({ categoryId: cat.id, secretWord: secret });
    setTurnIndex(0);
    setWordHistory([]);
    setVotes({});
    setStage("game");
  }

  function submitWord(word: string) {
    const p = players[turnIndex];
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

  // -------------------------------------------------------
  // ---------------------- RENDER --------------------------
  // -------------------------------------------------------
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-zinc-900 text-white p-6">
      <div className="max-w-5xl mx-auto">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-black tracking-tight">Imposter Game</h1>
          <div className="text-sm opacity-60">
            {isOnline ? "Online Multiplayer" : "Local Mode"}
          </div>
        </div>

        {/* LANDING */}
        {stage === "landing" && (
          <Landing
            hostName={hostName}
            setHostName={setHostName}
            onCreateLocal={createLocalRoom}
            onHostOnline={hostOnlineRoom}
            onJoinOnline={joinOnlineRoom}
          />
        )}

        {/* LOBBY */}
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
          />
        )}

        {/* GAME */}
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

        {/* REVEAL */}
        {stage === "reveal" && round && (
          <Reveal
            players={players}
            round={round}
            votes={votes}
            onNextRound={nextRound}
          />
        )}

      </div>
    </div>
  );
}

/* ---------- EXISTING COMPONENTS (paste yours here) ---------- */
/* KEEP ALL OF YOUR Landing, Lobby, Game, Reveal, Footer components */
/* DO NOT remove them – your UI stays EXACTLY the same. */
