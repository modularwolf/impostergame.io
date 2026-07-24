import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
// style
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react"


// ---- Utility helpers ----
const rand = (n: number) => Math.floor(Math.random() * n);

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/1 to avoid confusion
function makeRoomCode() {
  return Array.from({ length: 4 }, () => CODE_CHARS[rand(CODE_CHARS.length)]).join("");
}

const defaultCategories = [
  { id: "animals", label: "Animals", words: ["giraffe", "lion", "otter", "falcon", "horse", "elephant", "tiger", "penguin", "dolphin", "shark", "koala", "kangaroo", "zebra", "rhinoceros", "hippopotamus", "cheetah", "wolf", "fox", "bear", "panda", "eagle", "owl", "parrot", "crocodile", "turtle", "octopus", "jellyfish", "seahorse", "butterfly", "bee", "gorilla", "camel", "sloth", "rabbit", "squirrel", "peacock", "flamingo", "moose", "deer", "raccoon"] },
  { id: "foods", label: "Foods", words: ["pizza", "sushi", "taco", "ramen", "donut", "burger", "pasta", "steak", "pancake", "waffle", "burrito", "quesadilla", "lasagna", "salad", "sandwich", "hot dog", "fried chicken", "macaroni", "ice cream", "brownie", "cupcake", "cheesecake", "popcorn", "pretzel", "nachos", "cereal", "omelet", "bacon", "meatball", "dumpling", "curry", "soup", "lobster", "shrimp", "watermelon", "pineapple", "strawberry", "avocado", "cookie", "chocolate"] },
  { id: "heroes", label: "Heroes & Villains", words: ["Spider-Man", "Iron Man", "Black Widow", "Thor", "Loki", "Batman", "Superman", "Wonder Woman", "Hulk", "Captain America", "Black Panther", "Doctor Strange", "Deadpool", "Wolverine", "Aquaman", "The Flash", "Green Lantern", "Joker", "Harley Quinn", "Thanos", "Venom", "Darth Vader", "Luke Skywalker", "Yoda", "Princess Leia", "Mandalorian", "Shrek", "Elsa", "Buzz Lightyear", "Woody", "Mr. Incredible", "Katniss", "Harry Potter", "Hermione", "Gandalf"] },
  { id: "movies", label: "Movies & TV", words: ["Titanic", "Jaws", "Frozen", "Avatar", "Jurassic Park", "Toy Story", "The Lion King", "Home Alone", "The Matrix", "Rocky", "Ghostbusters", "Finding Nemo", "The Avengers", "Star Wars", "Harry Potter", "Shrek", "Moana", "Coco", "Encanto", "The Office", "Friends", "Stranger Things", "Wednesday", "Bluey", "SpongeBob", "Scooby-Doo", "The Simpsons", "Game of Thrones", "Breaking Bad", "Top Gun", "Barbie", "Oppenheimer", "Inside Out", "Cars", "The Incredibles"] },
  { id: "sports", label: "Sports", words: ["football", "basketball", "baseball", "soccer", "golf", "tennis", "volleyball", "hockey", "boxing", "wrestling", "swimming", "surfing", "skiing", "snowboarding", "skateboarding", "gymnastics", "bowling", "fishing", "archery", "karate", "cycling", "running", "rowing", "cricket", "rugby", "lacrosse", "pickleball", "dodgeball", "cheerleading", "weightlifting", "fencing", "horse racing", "table tennis", "billiards", "cornhole"] },
  { id: "places", label: "Places", words: ["beach", "airport", "school", "hospital", "zoo", "museum", "library", "restaurant", "stadium", "amusement park", "grocery store", "movie theater", "hotel", "campground", "mountain", "desert", "jungle", "island", "farm", "castle", "playground", "aquarium", "mall", "bank", "fire station", "police station", "coffee shop", "gym", "church", "office", "subway", "train station", "water park", "carnival", "barbershop"] },
  { id: "objects", label: "Household Objects", words: ["toaster", "refrigerator", "microwave", "television", "couch", "lamp", "vacuum", "blender", "coffee maker", "dishwasher", "washing machine", "dryer", "mirror", "pillow", "blanket", "toothbrush", "hairbrush", "shower", "bathtub", "remote control", "clock", "fan", "iron", "mop", "broom", "trash can", "doorbell", "bookshelf", "curtain", "rug", "fork", "spoon", "frying pan", "kettle", "flashlight"] },
  { id: "jobs", label: "Jobs", words: ["teacher", "doctor", "nurse", "firefighter", "police officer", "chef", "pilot", "soldier", "lawyer", "dentist", "mechanic", "farmer", "photographer", "barber", "cashier", "mail carrier", "lifeguard", "scientist", "engineer", "plumber", "electrician", "veterinarian", "artist", "musician", "actor", "coach", "judge", "astronaut", "detective", "construction worker"] },
  { id: "games", label: "Video Games", words: ["Minecraft", "Fortnite", "Mario", "Zelda", "Pokémon", "Roblox", "Call of Duty", "Grand Theft Auto", "Among Us", "Sonic", "Halo", "Animal Crossing", "The Sims", "Madden", "FIFA", "NBA 2K", "Rocket League", "Apex Legends", "Overwatch", "Fall Guys", "Pac-Man", "Tetris", "Donkey Kong", "Kirby", "Luigi", "Bowser", "Master Chief", "Kratos", "Link", "Pikachu", "Lara Croft", "Street Fighter", "Mortal Kombat", "Skyrim", "Destiny"] },
  { id: "music", label: "Music", words: ["guitar", "piano", "drums", "violin", "trumpet", "saxophone", "microphone", "concert", "DJ", "rapper", "singer", "band", "orchestra", "karaoke", "headphones", "playlist", "album", "chorus", "melody", "rhythm", "country", "rock", "hip-hop", "jazz", "classical", "pop", "reggae", "dance", "festival", "record player", "harmonica", "flute", "cello", "banjo", "tambourine"] },
  { id: "kids", label: "Kids", words: ["playground", "birthday cake", "dinosaur", "unicorn", "pirate", "princess", "robot", "monster", "superhero", "treasure", "balloon", "trampoline", "water slide", "treehouse", "sleepover", "school bus", "lunchbox", "crayon", "building blocks", "teddy bear", "kite", "bubble", "snowman", "tooth fairy", "Santa Claus", "Easter Bunny", "hide-and-seek", "tag", "hopscotch", "roller coaster", "circus", "magic wand", "spaceship", "dragon", "mermaid"] },
  { id: "random", label: "Random", words: ["rainbow", "volcano", "spaceship", "headphones", "keyboard", "umbrella", "backpack", "elevator", "traffic light", "roller coaster", "campfire", "snowman", "lighthouse", "treasure chest", "robot", "pirate", "ninja", "wizard", "dragon", "unicorn", "tornado", "earthquake", "fireworks", "moon", "satellite", "submarine", "helicopter", "motorcycle", "tractor", "skyscraper", "bridge", "fountain", "maze", "telescope", "compass", "magnet", "battery", "camera", "passport", "suitcase", "crown", "diamond", "ghost", "zombie", "vampire", "snow globe", "time machine", "hot air balloon", "waterfall", "cactus"] },
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
  hostPlayerId?: string;
  players: Player[];
  round: RoundConfig | null;
  turnIndex: number;
  wordHistory: { name: string; word: string }[];
  votes: VotesMap;
  usedWords?: string[];
  roomNotice?: string;
  roundEndReason?: "imposterLeft";
}

interface OnlineSession {
  roomCode: string;
  playerId: string;
  playerName: string;
}

const SESSION_KEY = "impostergame.onlineSession.v2";

function saveOnlineSession(session: OnlineSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearOnlineSession() {
  localStorage.removeItem(SESSION_KEY);
}

function readOnlineSession(): OnlineSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as OnlineSession) : null;
  } catch {
    clearOnlineSession();
    return null;
  }
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
  const [hostPlayerId, setHostPlayerId] = useState("");
  const [usedWords, setUsedWords] = useState<string[]>([]);
  const [hostName, setHostName] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [round, setRound] = useState<RoundConfig | null>(null);
  const [turnIndex, setTurnIndex] = useState(0);
  const [wordHistory, setWordHistory] = useState<{ name: string; word: string }[]>([]);
  const [votes, setVotes] = useState<VotesMap>({});
  const [myPlayerId, setMyPlayerId] = useState("");

  const [isOnline, setIsOnline] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [restoringSession, setRestoringSession] = useState(true);
  const [votePending, setVotePending] = useState(false);
  const [startPending, setStartPending] = useState(false);
  const [cluePending, setCluePending] = useState(false);
  const [roomSyncPending, setRoomSyncPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [roomNotice, setRoomNotice] = useState("");
  const [roundEndReason, setRoundEndReason] = useState<"imposterLeft" | "">("");
  const [activeSession, setActiveSession] = useState<OnlineSession | null>(() => readOnlineSession());

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
      hostPlayerId,
      players,
      round,
      turnIndex,
      wordHistory,
      votes,
      usedWords,
      roomNotice: roomNotice || undefined,
      ...overrides,
    };
  }

  function applyState(s: SyncedState) {
    setStage(s.stage);
    setRoomCode(s.roomCode);
    setHostPlayerId(s.hostPlayerId || "");
    setUsedWords(s.usedWords || []);
    setPlayers(s.players);
    setRound(s.round);
    setTurnIndex(s.turnIndex);
    setWordHistory(s.wordHistory || []);
    setVotes(s.votes || {});
    // Only raise the banner when the room notice actually changes, so a
    // dismissed notice doesn't pop back up on the next unrelated update.
    if (s.roomNotice && s.roomNotice !== roomNotice) setNotice(s.roomNotice);
    setRoomNotice(s.roomNotice || "");
    setRoundEndReason(s.roundEndReason || "");
    if (myPlayerId) setIsHost(s.hostPlayerId === myPlayerId);
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

  async function resumeOnlineSession(session?: OnlineSession | null) {
    if (!onlineAvailable || !supabase) return false;
    const saved = session || readOnlineSession();
    if (!saved) return false;

    const { data, error } = await supabase
      .from("rooms")
      .select("state")
      .eq("code", saved.roomCode)
      .maybeSingle();

    if (error || !data?.state) {
      clearOnlineSession();
      setActiveSession(null);
      setNotice("That room is no longer available.");
      return false;
    }

    const restored = data.state as SyncedState;
    const player = restored.players?.find((p) => p.id === saved.playerId);
    if (!player) {
      clearOnlineSession();
      setActiveSession(null);
      setNotice("That player is no longer in the room.");
      return false;
    }

    setMyPlayerId(saved.playerId);
    setHostName(saved.playerName);
    setIsOnline(true);
    setIsHost(restored.hostPlayerId === saved.playerId);
    setActiveSession(saved);
    applyState(restored);
    return true;
  }

  // Restore an online player after refresh or a temporary browser hiccup.
  useEffect(() => {
    async function restoreSession() {
      await resumeOnlineSession();
      setRestoringSession(false);
    }
    restoreSession();
  }, []);

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
          if (myPlayerId && !newState.players?.some((p) => p.id === myPlayerId)) {
            clearOnlineSession();
            setNotice("You were removed from the room by the host.");
            setIsOnline(false);
            setIsHost(false);
            setMyPlayerId("");
            setStage("landing");
            return;
          }
          applyState(newState);
          if (myPlayerId) setIsHost(newState.hostPlayerId === myPlayerId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOnline, roomCode, myPlayerId]);

  // --------- NAV / RESET ----------
  function goHome() {
    // Going home is not the same as leaving an online room. Keep the saved
    // session so the player can resume after an accidental tap or refresh.
    if (isOnline) {
      setActiveSession(readOnlineSession());
      setStage("landing");
      setIsOnline(false);
      setIsHost(false);
      return;
    }

    setStage("landing");
    setRoomCode("");
    setHostPlayerId("");
    setUsedWords([]);
    setPlayers([]);
    setRound(null);
    setWordHistory([]);
    setVotes({});
    setTurnIndex(0);
    setIsOnline(false);
    setIsHost(false);
    setMyPlayerId("");
    setLocalRoleIndex(0);
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
      hostPlayerId: id,
      players: [host],
      round: null,
      turnIndex: 0,
      wordHistory: [],
      votes: {},
      usedWords: [],
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
    const id = crypto.randomUUID();
    const playerName = hostName.trim() || "Host";
    const host: Player = { id, name: playerName, ready: false };

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = makeRoomCode();
      const next: SyncedState = {
        stage: "lobby",
        roomCode: code,
        hostPlayerId: id,
        players: [host],
        round: null,
        turnIndex: 0,
        wordHistory: [],
        votes: {},
        usedWords: [],
      };
      const { error } = await supabase.from("rooms").insert({ code, state: next });
      if (!error) {
        setIsOnline(true);
        setIsHost(true);
        setMyPlayerId(id);
        const session = { roomCode: code, playerId: id, playerName };
        saveOnlineSession(session);
        setActiveSession(session);
        applyState(next);
        bumpRoomsHosted();
        return;
      }
      if (error.code !== "23505") {
        console.error(error);
        alert("Could not create the room. Please try again.");
        return;
      }
    }
    alert("Could not generate a unique room code. Please try again.");
  }

  async function joinOnlineRoom(code: string, name: string) {
    if (!onlineAvailable || !supabase) {
      alert("Online play isn’t configured yet.");
      return;
    }
    const joinCode = code.trim().toUpperCase();
    if (!joinCode) return;
    const saved = readOnlineSession();
    const myId = saved?.roomCode === joinCode ? saved.playerId : crypto.randomUUID();
    const playerName = name.trim() || saved?.playerName || "Player";

    const { data, error } = await supabase.rpc("join_room", {
      p_room_code: joinCode,
      p_player_id: myId,
      p_player_name: playerName,
    });
    if (error || !data) {
      console.error(error);
      alert(error?.message || "Room not found.");
      return;
    }
    const next = data as SyncedState;
    setMyPlayerId(myId);
    setIsOnline(true);
    setIsHost(next.hostPlayerId === myId);
    const session = { roomCode: joinCode, playerId: myId, playerName };
    saveOnlineSession(session);
    setActiveSession(session);
    applyState(next);
  }

  async function syncRoom() {
    if (!isOnline || !supabase || !roomCode || roomSyncPending) return;
    setRoomSyncPending(true);
    const { data, error } = await supabase
      .from("rooms")
      .select("state")
      .eq("code", roomCode)
      .maybeSingle();
    setRoomSyncPending(false);

    if (error || !data?.state) {
      console.error(error);
      alert("Could not sync the room. Check your connection and try again.");
      return;
    }

    const synced = data.state as SyncedState;
    if (myPlayerId && !synced.players?.some((p) => p.id === myPlayerId)) {
      clearOnlineSession();
      setNotice("You are no longer in this room.");
      setIsOnline(false);
      setIsHost(false);
      setMyPlayerId("");
      setStage("landing");
      return;
    }

    applyState(synced);
    setIsHost(synced.hostPlayerId === myPlayerId);
    setNotice("Room synced.");
  }


  async function leaveOnlineRoom() {
    const saved = readOnlineSession();
    if (!saved) {
      clearOnlineSession();
      setActiveSession(null);
      goHome();
      return;
    }

    const leavingAsHost = hostPlayerId === saved.playerId;
    const message = leavingAsHost
      ? "Leave this room? Another player will become host and everyone will return to the lobby."
      : "Leave this room? You will be removed from the player list.";

    if (!window.confirm(message)) return;

    if (supabase) {
      const { error } = await supabase.rpc("leave_room", {
        p_room_code: saved.roomCode,
        p_player_id: saved.playerId,
      });
      if (error) {
        console.error(error);
        alert("Could not leave the room. Please check your connection and try again.");
        return;
      }
    }

    clearOnlineSession();
    setActiveSession(null);
    setStage("landing");
    setRoomCode("");
    setHostPlayerId("");
    setUsedWords([]);
    setPlayers([]);
    setRound(null);
    setWordHistory([]);
    setVotes({});
    setTurnIndex(0);
    setIsOnline(false);
    setIsHost(false);
    setMyPlayerId("");
    setNotice("You left the room.");
  }

  // --------- GAME LOGIC ----------
  const allReady = isOnline
    ? players.length >= 3 && players.every((p) => p.ready)
    : players.length >= 3; // local: only require 3+ players

  async function toggleReady(id: string) {
    if (!isOnline) {
      setPlayers((current) => current.map((p) => p.id === id ? { ...p, ready: !p.ready } : p));
      return;
    }
    if (!supabase || id !== myPlayerId) return;
    const { data, error } = await supabase.rpc("toggle_player_ready", {
      p_room_code: roomCode,
      p_player_id: id,
    });
    if (error) {
      console.error(error);
      alert("Could not update ready status. Please try again.");
      return;
    }
    if (data) applyState(data as SyncedState);
  }

  async function startGame(categoryId?: string, customWord?: string) {
    const impIndex = rand(players.length);
    const roles = players.map((p, i) => ({ ...p, isImposter: i === impIndex }));

    const cat =
      defaultCategories.find((c) => c.id === (categoryId || "random")) ||
      defaultCategories[0];
    const previousWords = usedWords;
    const availableWords = cat.words.filter((word) => !previousWords.includes(word.toLowerCase()));
    const pool = availableWords.length > 0 ? availableWords : cat.words;
    const secret = customWord?.trim() || pool[rand(pool.length)];
    const nextUsedWords = [...previousWords, secret.toLowerCase()].slice(-100);

    // random starting player index
    const startingIndex = rand(players.length);

    bumpRoundStarted(players.length);

    if (isOnline) {
      // Server-authoritative start: the server applies the imposter role and
      // secret onto its freshest player list, so a last-instant join/ready
      // can't erase anyone. We send index positions; the server clamps them.
      if (!supabase || startPending) return;
      setStartPending(true);
      const { data, error } = await supabase.rpc("start_round", {
        p_room_code: roomCode,
        p_host_id: myPlayerId,
        p_imposter_index: impIndex,
        p_secret_word: secret,
        p_category_id: cat.id,
        p_starting_index: startingIndex,
        p_used_words: nextUsedWords,
      });
      setStartPending(false);
      if (error) {
        console.error(error);
        alert(error.message || "Could not start the round. Please try again.");
        return;
      }
      if (data) applyState(data as SyncedState);
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

  async function submitWord(word: string) {
    const p = players[turnIndex];
    if (!p) return;

    if (isOnline) {
      // Server appends the clue and advances the turn under a row lock, so two
      // fast submissions can't overwrite each other and the turn pointer stays
      // valid even if the player list changed.
      if (!supabase || cluePending) return;
      setCluePending(true);
      const { data, error } = await supabase.rpc("submit_clue", {
        p_room_code: roomCode,
        p_player_id: myPlayerId,
        p_word: word,
      });
      setCluePending(false);
      if (error) {
        console.error(error);
        alert(error.message || "Your clue did not save. Please try again.");
        return;
      }
      if (data) applyState(data as SyncedState);
    } else {
      const newHistory = [...wordHistory, { name: p.name, word }];
      const newTurn = (turnIndex + 1) % players.length;
      setWordHistory(newHistory);
      setTurnIndex(newTurn);
    }
  }

  async function castVote(targetId: string) {
    if (!isOnline) {
      setVotes({ group: targetId });
      return;
    }
    if (!myPlayerId || !supabase || votePending) return;
    setVotePending(true);
    const { data, error } = await supabase.rpc("cast_room_vote", {
      p_room_code: roomCode,
      p_voter_id: myPlayerId,
      p_target_id: targetId,
    });
    setVotePending(false);
    if (error) {
      console.error(error);
      alert("Your vote did not save. Please tap again.");
      return;
    }
    if (data) applyState(data as SyncedState);
  }

  async function kickPlayer(playerId: string) {
    if (!isOnline || !isHost || !supabase || playerId === myPlayerId) return;
    const player = players.find((p) => p.id === playerId);
    if (!player || !window.confirm(`Remove ${player.name} from the room?`)) return;
    const { data, error } = await supabase.rpc("kick_room_player", {
      p_room_code: roomCode,
      p_host_id: myPlayerId,
      p_player_id: playerId,
    });
    if (error) {
      console.error(error);
      alert("Could not remove that player.");
      return;
    }
    if (data) applyState(data as SyncedState);
  }

  async function restartToLobby() {
    if (!isHost) return;
    if (!window.confirm("Return everyone to the lobby? Current round and votes will be cleared.")) return;
    if (!isOnline) {
      nextRound();
      return;
    }
    if (!supabase) return;
    const { data, error } = await supabase.rpc("restart_room_to_lobby", {
      p_room_code: roomCode,
      p_host_id: myPlayerId,
    });
    if (error) {
      console.error(error);
      alert("Could not restart the room.");
      return;
    }
    if (data) applyState(data as SyncedState);
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
      hostPlayerId,
      usedWords,
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
        <Header isOnline={isOnline} onHome={goHome} onLeaveRoom={leaveOnlineRoom} onShowHowTo={() => setShowHowTo(true)} />

        {notice && (
          <div className="mb-4 rounded-2xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm flex items-center justify-between gap-3">
            <span>{notice}</span>
            <button onClick={() => setNotice("")} className="text-xs underline">Dismiss</button>
          </div>
        )}

        {restoringSession ? (
          <div className="rounded-3xl p-6 bg-zinc-800/50 border border-zinc-700 text-center">Restoring your room…</div>
        ) : stage === "landing" && (
          <Landing
            hostName={hostName}
            setHostName={setHostName}
            onCreateLocal={createLocalRoom}
            onHostOnline={hostOnlineRoom}
            onJoinOnline={joinOnlineRoom}
            onlineAvailable={onlineAvailable}
            activeSession={activeSession}
            onResumeSession={() => resumeOnlineSession(activeSession)}
            onLeaveSession={leaveOnlineRoom}
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
            onKickPlayer={kickPlayer}
            onSyncRoom={syncRoom}
            roomSyncPending={roomSyncPending}
            startPending={startPending}
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
            isHost={isHost}
            onRestartToLobby={restartToLobby}
            votePending={votePending}
            cluePending={cluePending}
          />
        )}

        {stage === "reveal" && round && (
          <Reveal players={players} round={round} votes={votes} onNextRound={nextRound} isHost={isHost} onRestartToLobby={restartToLobby} roundEndReason={roundEndReason} />
        )}

        <Footer
          onlineAvailable={onlineAvailable}
          stats={stats}
          avgPlayersPerRound={avgPlayersPerRound}
        />
        <Analytics/>
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
  onLeaveRoom,
  onShowHowTo,
}: {
  isOnline: boolean;
  onHome: () => void;
  onLeaveRoom: () => void;
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
          One-word clue party game · Play with friends in seconds!
        </p>
      </button>
      <div className="flex items-center gap-3">
        {isOnline && (
          <button
            onClick={onLeaveRoom}
            className="text-xs md:text-sm px-3 py-1 rounded-full border border-rose-500/50 bg-rose-500/10 hover:bg-rose-500/20 transition"
          >
            Leave room
          </button>
        )}
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
  activeSession,
  onResumeSession,
  onLeaveSession,
}: {
  hostName: string;
  setHostName: (v: string) => void;
  onCreateLocal: () => void;
  onHostOnline: () => void;
  onJoinOnline: (code: string, name: string) => void;
  onlineAvailable: boolean;
  activeSession: OnlineSession | null;
  onResumeSession: () => void;
  onLeaveSession: () => void;
}) {
  const [joinCode, setJoinCode] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("room")?.toUpperCase() || "";
  });
  const [joinName, setJoinName] = useState("");

  return (
    <>
      {activeSession && (
        <div className="mb-6 rounded-3xl p-5 bg-emerald-500/10 border border-emerald-500/40 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="text-sm text-emerald-200">You still have an active room</div>
              <div className="text-xl font-bold">Room {activeSession.roomCode} · {activeSession.playerName}</div>
              <div className="text-xs opacity-70 mt-1">Closing the browser or tapping the title does not remove you.</div>
            </div>
            <div className="flex gap-2">
              <button onClick={onResumeSession} className="px-4 py-2 rounded-2xl bg-emerald-400 text-black font-semibold">
                Resume room
              </button>
              <button onClick={onLeaveSession} className="px-4 py-2 rounded-2xl border border-rose-500/50 bg-rose-500/10 text-rose-100">
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-[1.4fr,1fr]">
      {/* Hero / host card */}
      <div className="rounded-3xl p-6 bg-zinc-900/70 border border-zinc-700 shadow-xl">
        <h2 className="text-2xl md:text-3xl font-bold mb-2">
          Play the imposter game with your friends
        </h2>
        <p className="opacity-80 mb-4 text-sm md:text-base">
          Everyone gets a secret word… except the imposter. Go around with one-word clues,
          call out sus answers, and vote to catch the fake.
        </p>
        <ul className="text-xs md:text-sm opacity-80 mb-4 list-disc pl-5 space-y-1">
          <li>Perfect for living rooms, game nights, and pre-game hangs</li>
          <li>Works on one phone (pass-and-play) or online with room codes</li>
          <li>No login, apps, or ads, just vibes</li>
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
    </>
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
  onKickPlayer,
  onSyncRoom,
  roomSyncPending,
  startPending,
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
  onKickPlayer: (playerId: string) => void;
  onSyncRoom: () => void;
  roomSyncPending: boolean;
  startPending?: boolean;
}) {
  const setupStorageKey = `imposter-game:round-setup:${roomCode}`;
  const [categoryId, setCategoryId] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(setupStorageKey) || "{}");
      return saved.categoryId || "random";
    } catch {
      return "random";
    }
  });
  const [customWord, setCustomWord] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(setupStorageKey) || "{}");
      return saved.customWord || "";
    } catch {
      return "";
    }
  });
  const [newPlayerName, setNewPlayerName] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(setupStorageKey, JSON.stringify({ categoryId, customWord }));
    } catch {
      // Storage can be unavailable in private/restricted browser modes.
    }
  }, [setupStorageKey, categoryId, customWord]);

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
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onSyncRoom}
              disabled={roomSyncPending}
              className="text-xs md:text-sm px-3 py-1 rounded-full border border-zinc-600 bg-zinc-800 hover:bg-zinc-700 transition disabled:opacity-50"
            >
              {roomSyncPending ? "Syncing…" : "Sync room"}
            </button>
            <button
              onClick={() => onShareRoom(roomCode)}
              className="text-xs md:text-sm px-3 py-1 rounded-full border border-emerald-500/70 bg-emerald-500/10 hover:bg-emerald-500/20 transition"
            >
              Share invite link
            </button>
          </div>
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
                {isOnline && isHost && p.id !== myPlayerId && (
                  <button
                    onClick={() => onKickPlayer(p.id)}
                    className="mt-2 ml-2 text-xs px-2 py-1 rounded-lg border border-rose-500/60 bg-rose-500/10 text-rose-200"
                  >
                    Remove
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
            <p className="text-xs opacity-70 mb-3">
              Players can ready up at any time. Your category and custom word stay selected.
            </p>
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
              disabled={!allReady || startPending}
              className={`w-full py-3 rounded-2xl font-semibold transition ${
                allReady && !startPending
                  ? "bg-white text-black"
                  : "bg-zinc-700 text-zinc-400 cursor-not-allowed"
              }`}
            >
              {startPending ? "Starting…" : "Start game"}
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
  isHost,
  onRestartToLobby,
  votePending,
  cluePending,
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
  isHost: boolean;
  onRestartToLobby: () => void;
  votePending: boolean;
  cluePending?: boolean;
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
    const validPlayerIds = new Set(players.map((p) => p.id));
    const totalVotes = Object.entries(votes).filter(
      ([voterId, targetId]) => validPlayerIds.has(voterId) && validPlayerIds.has(targetId)
    ).length;
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
                if (!word.trim() || cluePending) return;
                onSubmitWord(word.trim());
                setWord("");
              }}
              disabled={cluePending}
              className={`px-4 py-2 rounded-xl font-semibold ${
                cluePending ? "bg-zinc-700 text-zinc-400 cursor-not-allowed" : "bg-white text-black"
              }`}
            >
              {cluePending ? "…" : "Say it"}
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
              disabled={votePending}
              className={`rounded-xl p-2 text-left transition ${
                votes[myPlayerId] === p.id
                  ? "bg-emerald-500/20 border border-emerald-500/70"
                  : "bg-zinc-900/60 border border-zinc-700 hover:bg-zinc-900"
              } ${votePending ? "opacity-60 cursor-wait" : ""}`}
            >
              <div className="text-sm font-semibold">{p.name}</div>
              <div className="text-xs opacity-70">Votes: {voteCounts[p.id] || 0}</div>
              {votes[myPlayerId] === p.id && <div className="text-xs text-emerald-300">Your vote</div>}
            </button>
          ))}
        </div>
        {isHost && (
          <button
            onClick={onRestartToLobby}
            className="mt-4 w-full py-2 rounded-2xl border border-amber-500/60 bg-amber-500/10 text-amber-100 font-semibold"
          >
            Return everyone to lobby
          </button>
        )}
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
  isHost,
  onRestartToLobby,
  roundEndReason,
}: {
  players: Player[];
  round: RoundConfig;
  votes: VotesMap;
  onNextRound: () => void;
  isHost: boolean;
  onRestartToLobby: () => void;
  roundEndReason?: "imposterLeft" | "";
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
  const imposterLeft = roundEndReason === "imposterLeft";

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
          <div className="text-xl font-bold mb-4">
            {imposterLeft ? "Left the room" : imp?.name}
          </div>
          <div
            className={`inline-block px-3 py-1 rounded-xl text-sm ${
              imposterLeft
                ? "bg-amber-500/20 border border-amber-500/60"
                : success
                ? "bg-emerald-500/20 border border-emerald-500/60"
                : "bg-rose-500/20 border border-rose-500/60"
            }`}
          >
            {imposterLeft
              ? "The imposter left — round ended"
              : success
              ? "Crew wins!"
              : "Imposter survives!"}
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
          {isHost ? (
            <>
              <button
                onClick={onNextRound}
                className="mt-4 w-full py-2 rounded-2xl bg-white text-black font-semibold"
              >
                Next round
              </button>
              <button
                onClick={onRestartToLobby}
                className="mt-2 w-full py-2 rounded-2xl border border-amber-500/60 bg-amber-500/10 text-amber-100 font-semibold"
              >
                Return everyone to lobby
              </button>
            </>
          ) : (
            <div className="mt-4 text-xs opacity-70 text-center">Waiting for the host to start the next round.</div>
          )}
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
      <div>Built as a fun party game. No accounts, no chat, just vibes.</div>
      {!onlineAvailable && (
        <div>Online rooms will unlock after Supabase is configured.</div>
      )}
      {/*}
      <div className="flex justify-center gap-4 mt-2 text-[11px] text-zinc-400">
        <span>Rooms hosted: {stats.roomsHosted}</span>
        <span>Rounds played: {stats.roundsStarted}</span>
        <span>Avg players/round: {avgPlayersPerRound}</span>
      </div>
      */}
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
