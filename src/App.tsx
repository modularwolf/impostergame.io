import React, { useMemo, useState } from "react";

// ---- Utility helpers ----
const rand = (n: number) => Math.floor(Math.random() * n);
function sample<T>(arr: T[]) { return arr[rand(arr.length)]; }

const makeId = () =>
  typeof crypto !== "undefined" && (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2);

const codeWords = [
  "MINT", "ORCA", "LAVA", "NOVA", "PIXEL", "QUILL", "ZINC", "EMBER",
  "JUNO", "LYNX", "MARS", "ONYX", "QUARK", "RUNE", "SAGE", "VOLT",
];
function makeRoomCode() {
  return Array.from({ length: 4 }, () => sample(codeWords)).join("-");
}

// ---- Mock data ----
const defaultCategories = [
  { id: "animals", label: "Animals", words: ["giraffe", "lion", "otter", "falcon", "horse"] },
  { id: "foods", label: "Foods", words: ["pizza", "sushi", "taco", "ramen", "donut"] },
  { id: "heroes", label: "Heroes", words: ["Spiderman", "Iron Man", "Black Widow", "Thor", "Loki"] },
  { id: "random", label: "Random", words: ["rainbow", "volcano", "spaceship", "headphones", "keyboard"] },
];

// ---- Types ----
interface Player { id: string; name: string; ready: boolean; isImposter?: boolean }
interface RoundConfig { categoryId: string; secretWord: string }

// ---- Root App ----
export default function App() {
  const [stage, setStage] = useState<"landing" | "lobby" | "deal" | "game" | "reveal">("landing");
  const [mode, setMode] = useState<"party" | "onlineSoon">("party");

  const [roomCode, setRoomCode] = useState<string>("");
  const [hostName, setHostName] = useState<string>("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [round, setRound] = useState<RoundConfig | null>(null);
  const [turnIndex, setTurnIndex] = useState(0);
  const [wordHistory, setWordHistory] = useState<{ name: string; word: string }[]>([]);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [myPlayerId, setMyPlayerId] = useState<string>("");
  const [seenRoles, setSeenRoles] = useState<Record<string, boolean>>({});

  function createRoom() {
    const code = makeRoomCode();
    setRoomCode(code);
    const id = makeId();
    const host: Player = { id, name: hostName || "Host", ready: false };
    setPlayers([host]);
    setMyPlayerId(id);
    setStage("lobby");
  }

  function addMockPlayer() {
    const names = ["Alex", "Bee", "Cass", "Dex", "Eli", "Finn", "Gia", "Hale"];
    const name = names[(players.length - 1) % names.length] + (players.length > names.length ? players.length : "");
    setPlayers(p => [...p, { id: makeId(), name, ready: false }]);
  }

  function toggleReady(pid: string) {
    setPlayers(ps => ps.map(p => (p.id === pid ? { ...p, ready: !p.ready } : p)));
  }

  const allReady = players.length >= 3 && players.every(p => p.ready);

  function startGame(categoryId?: string, customWord?: string) {
    // assign imposter
    const impIndex = rand(players.length);
    const withRoles = players.map((p, i) => ({ ...p, isImposter: i === impIndex }));
    setPlayers(withRoles);

    // pick category & word
    const cat = defaultCategories.find(c => c.id === (categoryId || "random")) || defaultCategories[0];
    const secret = customWord?.trim() || sample(cat.words);

    setRound({ categoryId: cat.id, secretWord: secret });
    setTurnIndex(0);
    setWordHistory([]);
    setVotes({});
    setSeenRoles({});
    setStage(mode === "party" ? "deal" : "game"); // onlineSoon would go straight to game later
  }

  function submitWord(word: string) {
    const p = players[turnIndex];
    if (!p) return;
    setWordHistory(h => [...h, { name: p.name, word }]);
    setTurnIndex(i => (i + 1) % players.length);
  }

  function castVote(targetName: string) {
    setVotes(v => ({ ...v, [targetName]: (v[targetName] || 0) + 1 }));
  }

  function endRound() {
    setStage("reveal");
  }

  function nextRound() {
    // Reset readies but keep players
    setPlayers(ps => ps.map(p => ({ ...p, ready: false, isImposter: undefined })));
    setRound(null);
    setWordHistory([]);
    setVotes({});
    setTurnIndex(0);
    setSeenRoles({});
    setStage("lobby");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-zinc-900 text-zinc-100 p-6 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-5xl mx-auto">
        <Header />
        {stage === "landing" && (
          <Landing hostName={hostName} setHostName={setHostName} onCreate={createRoom} />
        )}
        {stage === "lobby" && (
          <Lobby
            roomCode={roomCode}
            players={players}
            myPlayerId={myPlayerId}
            onAddMock={addMockPlayer}
            onToggleReady={toggleReady}
            onStart={startGame}
            allReady={allReady}
            mode={mode}
            setMode={setMode}
          />
        )}
        {stage === "deal" && round && (
          <Deal
            players={players}
            round={round}
            seenRoles={seenRoles}
            setSeenRoles={setSeenRoles}
            onAllSeen={() => setStage("game")}
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
          <Reveal
            players={players}
            round={round}
            votes={votes}
            onNextRound={nextRound}
          />
        )}
        <Footer />
      </div>
    </div>
  );
}

// ---- UI components ----

function Header() {
  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-3xl md:text-4xl font-black tracking-tight">Imposter Game</h1>
      <div className="text-sm opacity-70">Party mode · MVP</div>
    </div>
  );
}

function Landing({
  hostName,
  setHostName,
  onCreate,
}: {
  hostName: string;
  setHostName: (v: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="rounded-3xl p-6 bg-zinc-800/50 border border-zinc-700 shadow-xl">
        <h2 className="text-2xl font-bold mb-2">Play with friends in seconds</h2>
        <p className="opacity-80 mb-4">
          One phone, one secret word. Pass your device, reveal your role, say one word, and
          vote out the imposter.
        </p>
        <label className="text-sm opacity-80">Your name</label>
        <input
          className="w-full mt-1 mb-4 px-3 py-2 bg-zinc-900/60 border border-zinc-700 rounded-xl text-base"
          placeholder="Host name"
          value={hostName}
          onChange={e => setHostName(e.target.value)}
        />
        <button
          onClick={onCreate}
          className="w-full py-3 rounded-2xl bg-white text-black font-semibold hover:opacity-90 transition min-h-[44px]"
        >
          Host a game
        </button>
        <ul className="mt-6 text-sm list-disc pl-5 space-y-1 opacity-80">
          <li>Perfect for patios, parties, and pregame lobbies.</li>
          <li>Best with 3–8 players.</li>
          <li>Everyone can see the screen clearly on an iPhone.</li>
        </ul>
      </div>
      <div className="rounded-3xl p-6 bg-zinc-800/30 border border-zinc-700">
        <h3 className="text-xl font-semibold mb-2">How it works</h3>
        <ol className="space-y-3 text-sm opacity-90">
          <li><b>Host adds players.</b> Give each friend a name tile.</li>
          <li><b>Deal roles.</b> Pass your phone; each player taps and secretly sees their role.</li>
          <li><b>Say one word.</b> Go in a circle giving a single clue about the secret word.</li>
          <li><b>Vote.</b> Tap who you think is the imposter.</li>
          <li><b>Reveal & repeat.</b> New category, new imposter.</li>
        </ol>
      </div>
    </div>
  );
}

function Lobby({
  roomCode,
  players,
  myPlayerId,
  onAddMock,
  onToggleReady,
  onStart,
  allReady,
  mode,
  setMode,
}: {
  roomCode: string;
  players: Player[];
  myPlayerId: string;
  onAddMock: () => void;
  onToggleReady: (pid: string) => void;
  onStart: (categoryId?: string, customWord?: string) => void;
  allReady: boolean;
  mode: "party" | "onlineSoon";
  setMode: (m: "party" | "onlineSoon") => void;
}) {
  const [categoryId, setCategoryId] = useState("random");
  const [customWord, setCustomWord] = useState("");

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
            {players.map(p => (
              <div
                key={p.id}
                className={`rounded-2xl border ${
                  p.ready ? "border-emerald-500/70" : "border-zinc-700"
                } bg-zinc-900/50 p-3`}
              >
                <div className="font-semibold truncate">{p.name}</div>
                <div className="text-xs opacity-70">
                  {p.ready ? "Ready" : "Not ready"}
                </div>
                <button
                  onClick={() => onToggleReady(p.id)}
                  className="mt-2 text-xs px-2 py-1 rounded-lg bg-zinc-200 text-zinc-900 min-h-[32px]"
                >
                  {p.ready ? "Unready" : "Ready"}
                </button>
              </div>
            ))}
            <button
              onClick={onAddMock}
              className="rounded-2xl border border-dashed border-zinc-600 p-3 text-left opacity-80 hover:opacity-100 min-h-[72px]"
            >
              + Add mock player
            </button>
          </div>

          <div className="mt-6">
            <h4 className="font-semibold mb-2">Mode</h4>
            <div className="flex flex-wrap gap-3 text-sm">
              <button
                onClick={() => setMode("party")}
                className={`px-3 py-1.5 rounded-xl border min-h-[36px] ${
                  mode === "party"
                    ? "border-white bg-zinc-900"
                    : "border-zinc-700 bg-zinc-900/40"
                }`}
              >
                🎉 Party (one phone)
              </button>
              <button
                onClick={() => setMode("onlineSoon")}
                className={`px-3 py-1.5 rounded-xl border min-h-[36px] ${
                  mode === "onlineSoon"
                    ? "border-zinc-500 bg-zinc-900"
                    : "border-zinc-700 bg-zinc-900/40"
                } opacity-60`}
                disabled
                title="Online rooms coming soon"
              >
                🌐 Online (coming soon)
              </button>
            </div>
            <div className="text-xs opacity-70 mt-2">
              Party mode: pass one iPhone around to reveal roles and play.
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Round setup</h3>
          <label className="text-sm opacity-80">Category</label>
          <select
            className="w-full mt-1 mb-3 px-3 py-2 bg-zinc-900/60 border border-zinc-700 rounded-xl"
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
          >
            {defaultCategories.map(c => (
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
            onChange={e => setCustomWord(e.target.value)}
          />
          <button
            onClick={() => onStart(categoryId, customWord)}
            disabled={!allReady}
            className={`w-full py-3 rounded-2xl font-semibold transition min-h-[44px] ${
              allReady ? "bg-white text-black" : "bg-zinc-700 text-zinc-400 cursor-not-allowed"
            }`}
          >
            Deal roles
          </button>
          <div className="text-xs opacity-70 mt-2">
            Need at least 3 players and everyone ready.
          </div>
        </div>
      </div>
    </div>
  );
}

function Deal({
  players,
  round,
  seenRoles,
  setSeenRoles,
  onAllSeen,
}: {
  players: Player[];
  round: RoundConfig;
  seenRoles: Record<string, boolean>;
  setSeenRoles: (r: Record<string, boolean>) => void;
  onAllSeen: () => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activePlayer = players.find(p => p.id === activeId) || null;
  const allSeen = players.every(p => seenRoles[p.id]);

  return (
    <div className="rounded-3xl p-6 bg-zinc-800/50 border border-zinc-700 relative">
      <h3 className="text-2xl font-bold mb-2">Pass & reveal</h3>
      <p className="opacity-80 mb-4 text-sm">
        Hand your phone to each player. They tap their name, peek at their role, then hit
        “Hide” before passing it on.
      </p>

      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
        {players.map(p => (
          <button
            key={p.id}
            onClick={() => setActiveId(p.id)}
            className={`rounded-2xl p-3 text-left bg-zinc-900/60 border ${
              seenRoles[p.id] ? "border-emerald-500/70" : "border-zinc-700"
            } min-h-[72px]`}
          >
            <div className="font-semibold text-lg">{p.name}</div>
            <div className="text-xs opacity-70">
              {seenRoles[p.id] ? "Role seen ✅" : "Tap to see role"}
            </div>
          </button>
        ))}
      </div>

      <button
        disabled={!allSeen}
        onClick={onAllSeen}
        className={`mt-6 w-full py-3 rounded-2xl font-semibold min-h-[44px] ${
          allSeen ? "bg-white text-black" : "bg-zinc-700 text-zinc-400"
        }`}
      >
        Begin round
      </button>
      <div className="text-xs opacity-60 mt-2">
        All players must see their role before you start.
      </div>

      {/* Full-screen mobile-friendly role overlay */}
      {activePlayer && (
        <div className="fixed inset-0 z-20 bg-black/80 backdrop-blur flex items-center justify-center px-4">
          <div className="w-full max-w-sm rounded-3xl border border-zinc-700 bg-zinc-900 p-6 text-center shadow-2xl">
            <div className="text-xs uppercase tracking-wide opacity-70 mb-1">
              Your role
            </div>
            <div className="text-3xl font-black mb-2">
              {activePlayer.isImposter ? "IMPOSTER" : "KNOWER"}
            </div>
            <div className="h-px bg-zinc-700/70 my-4" />
            <div className="text-xs opacity-70 mb-1">
              Secret word
            </div>
            <div className="text-3xl font-black tracking-tight mb-4">
              {activePlayer.isImposter ? "???" : round.secretWord}
            </div>
            <p className="text-xs opacity-70 mb-4">
              {activePlayer.isImposter
                ? "Blend in. Say one word that sounds right, even though you don’t know the secret."
                : "Give one-word clues that help the group, without making it too obvious."}
            </p>
            <button
              onClick={() => {
                setSeenRoles({ ...seenRoles, [activePlayer.id]: true });
                setActiveId(null);
              }}
              className="w-full py-3 rounded-2xl bg-white text-black font-semibold min-h-[44px]"
            >
              Hide & pass phone
            </button>
          </div>
        </div>
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
  const me = players.find(p => p.id === myPlayerId) || players[0];
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
              className="flex-1 px-3 py-2 bg-zinc-900/60 border border-zinc-700 rounded-xl text-base"
              placeholder={isMyTurn ? "Your one-word clue" : "Wait for your turn…"}
              value={word}
              onChange={e => setWord(e.target.value)}
            />
            <button
              disabled={!isMyTurn || !word.trim()}
              onClick={() => {
                onSubmitWord(word.trim());
                setWord("");
              }}
              className={`px-4 py-2 rounded-xl font-semibold min-h-[44px] ${
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
          {players.map(p => (
            <button
              key={p.id}
              onClick={() => onVote(p.name)}
              className="rounded-xl bg-zinc-900/60 border border-zinc-700 p-2 text-left hover:bg-zinc-900 min-h-[44px]"
            >
              <div className="text-sm font-semibold">{p.name}</div>
              <div className="text-xs opacity-70">
                Votes: {votes[p.name] || 0}
              </div>
            </button>
          ))}
        </div>
        <button
          onClick={onReveal}
          className="mt-4 w-full py-3 rounded-2xl bg-white text-black font-semibold min-h-[44px]"
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

  const imp = players.find(p => p.isImposter);
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
            {players.map(p => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl bg-zinc-950/50 border border-zinc-800 p-2"
              >
                <div className="text-sm">{p.name}</div>
                <div className="text-xs opacity-70">
                  {votes[p.name] || 0}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={onNextRound}
            className="mt-4 w-full py-3 rounded-2xl bg-white text-black font-semibold min-h-[44px]"
          >
            Next round
          </button>
        </div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div className="text-xs opacity-60 mt-8 text-center">
      Party mode only · Online rooms coming soon.
    </div>
  );
}
