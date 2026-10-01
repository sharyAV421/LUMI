import "./style.css";

type Source = "local" | "spotify" | "youtube";

type Track = {
  id: string;
  title: string;
  artist: string;
  source: Source;
  externalId: string;
  uri: string;
  url: string;
  file?: File;
  duration: number;
  image: string;
  favorite: boolean;
};

class Node {
  data: Track;
  prev: Node | null = null;
  next: Node | null = null;

  constructor(data: Track) {
    this.data = data;
  }
}

class DoublyLinkedList {
  head: Node | null = null;
  tail: Node | null = null;
  size = 0;

  insertAt(position: number, data: Track): boolean {
    if (
      !Number.isInteger(position) ||
      position < 1 ||
      position > this.size + 1
    ) {
      return false;
    }

    const node = new Node(data);

    if (!this.head) {
      this.head = this.tail = node;
    } else if (position === 1) {
      node.next = this.head;
      this.head.prev = node;
      this.head = node;
    } else if (position === this.size + 1) {
      node.prev = this.tail;
      this.tail!.next = node;
      this.tail = node;
    } else {
      const current = this.getNode(position)!;
      node.prev = current.prev;
      node.next = current;
      current.prev!.next = node;
      current.prev = node;
    }

    this.size++;
    return true;
  }

  append(data: Track): void {
    this.insertAt(this.size + 1, data);
  }

  getNode(position: number): Node | null {
    if (
      !Number.isInteger(position) ||
      position < 1 ||
      position > this.size
    ) {
      return null;
    }

    if (position <= Math.ceil(this.size / 2)) {
      let current = this.head;

      for (let i = 1; i < position; i++) {
        current = current!.next;
      }

      return current;
    }

    let current = this.tail;

    for (let i = this.size; i > position; i--) {
      current = current!.prev;
    }

    return current;
  }

  removeAt(position: number): Track | null {
    const node = this.getNode(position);

    if (!node) return null;

    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }

    node.prev = node.next = null;
    this.size--;

    return node.data;
  }

  findById(id: string): number {
    let current = this.head;
    let position = 1;

    while (current) {
      if (current.data.id === id) return position;

      current = current.next;
      position++;
    }

    return -1;
  }

  toArray(): Track[] {
    const result: Track[] = [];
    let current = this.head;

    while (current) {
      result.push(current.data);
      current = current.next;
    }

    return result;
  }

  reverse(): void {
    let current = this.head;

    while (current) {
      const oldNext = current.next;
      current.next = current.prev;
      current.prev = oldNext;
      current = oldNext;
    }

    const oldHead = this.head;
    this.head = this.tail;
    this.tail = oldHead;
  }

  clear(): Track[] {
    const tracks = this.toArray();
    let current = this.head;

    while (current) {
      const next = current.next;
      current.prev = current.next = null;
      current = next;
    }

    this.head = this.tail = null;
    this.size = 0;

    return tracks;
  }
}

type SpotifyPlayer = {
  connect(): Promise<boolean>;
  disconnect(): void;
  togglePlay(): Promise<void>;
  nextTrack(): Promise<void>;
  previousTrack(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seek(position: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  getCurrentState(): Promise<any>;
  addListener(
    event: string,
    callback: (data: any) => void
  ): boolean;
  activateElement(): Promise<void>;
};

declare global {
  interface Window {
    Spotify?: {
      Player: new (options: any) => SpotifyPlayer;
    };
    onSpotifyWebPlaybackSDKReady?: () => void;
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const SPOTIFY_CLIENT_ID =
  (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined)?.trim() ?? "";

const YOUTUBE_API_KEY =
  (import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined)?.trim() ?? "";

const SPOTIFY_REDIRECT_URI = `${window.location.origin}/`;

const SPOTIFY_SCOPES =
  "streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state";

const playlist = new DoublyLinkedList();

const audio = document.querySelector<HTMLAudioElement>("#audioElement")!;
const picker = document.querySelector<HTMLInputElement>("#audioPicker")!;
const toast = document.querySelector<HTMLDivElement>("#toast")!;
const seekBar = document.querySelector<HTMLInputElement>("#seekBar")!;
const volumeBar = document.querySelector<HTMLInputElement>("#volumeBar")!;
const youtubePanel = document.querySelector<HTMLDivElement>("#youtubePanel")!;

let currentId: string | null = null;
let activeSource: Source | null = null;
let activeSearchSource: "spotify" | "youtube" = "youtube";
let pendingInsertPosition: number | null = null;

let shuffle = false;
let repeat = false;
let toastTimer = 0;

let spotifyPlayer: SpotifyPlayer | null = null;
let spotifyIsPlaying = false;
let spotifyDeviceId: string | null = null;
let spotifyAccessToken: string | null = null;
let spotifyRefreshToken: string | null =
  localStorage.getItem("lumi_spotify_refresh_token");

let youtubePlayer: any = null;
let youtubeReady = false;
let searchBusy = false;

function el<T extends HTMLElement>(selector: string): T {
  return document.querySelector<T>(selector)!;
}

function fmt(seconds: number): string {
  return !Number.isFinite(seconds) || seconds < 0
    ? "0:00"
    : `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function showToast(message: string): void {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);

  toastTimer = window.setTimeout(
    () => toast.classList.remove("show"),
    3200
  );
}

function safeText(value: string): string {
  return value.replace(
    /[&<>"']/g,
    c =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[c]!
  );
}

function currentTrack(): Track | null {
  if (!currentId) return null;

  const pos = playlist.findById(currentId);

  return pos < 1
    ? null
    : playlist.getNode(pos)?.data ?? null;
}

function titleFromFile(name: string): string {
  return (
    name
      .replace(/\.[^/.]+$/, "")
      .replace(/[_-]+/g, " ")
      .trim() || "Untitled track"
  );
}

function sourceLabel(source: Source): string {
  return source === "spotify"
    ? "SPOTIFY"
    : source === "youtube"
      ? "YOUTUBE"
      : "LOCAL FILE";
}

function sourceIcon(source: Source): string {
  return source === "spotify"
    ? "●"
    : source === "youtube"
      ? "▶"
      : "♫";
}

function renderAll(): void {
  renderTracks();
  renderNodes();

  el("#trackCount").textContent =
    `${playlist.size} track${playlist.size === 1 ? "" : "s"}`;

  el("#listFooterText").textContent =
    `${playlist.size} song${playlist.size === 1 ? "" : "s"} in this playlist`;

  el("#libraryHint").textContent = playlist.size
    ? "Select a track to play it. Insert search results at any position."
    : "Search Spotify or YouTube to add tracks.";

  const track = currentTrack();

  el("#nowTitle").textContent = track?.title ?? "Nothing playing yet";

  el("#nowArtist").textContent = track
    ? `${track.artist} · ${sourceLabel(track.source)}`
    : "Search for music to get started";

  const cover = el<HTMLDivElement>("#miniCover");

  cover.classList.toggle(
    "playing",
    Boolean(track && isPlaying())
  );

  cover.innerHTML = track?.image
    ? `<img src="${safeText(track.image)}" alt="" />`
    : `<span>${track ? sourceIcon(track.source) : "♫"}</span>`;

  el("#playPause").textContent =
    track && isPlaying() ? "Ⅱ" : "▶";

  el("#favoriteButton").textContent =
    track?.favorite ? "♥" : "♡";

  el("#favoriteButton").classList.toggle(
    "favorited",
    Boolean(track?.favorite)
  );

  el("#spotifySideStatus").textContent =
    spotifyAccessToken ? "Connected" : "Not connected";
}

function isPlaying(): boolean {
  if (activeSource === "local") {
    return !audio.paused;
  }

  if (
    activeSource === "youtube" &&
    youtubePlayer &&
    youtubeReady
  ) {
    return youtubePlayer.getPlayerState?.() === 1;
  }

  if (activeSource === "spotify") {
    return spotifyIsPlaying;
  }

  return false;
}

function renderTracks(): void {
  const query = el<HTMLInputElement>("#filterInput")
    .value.trim().toLowerCase();

  const all = playlist.toArray();

  const visible = all
    .map((track, index) => ({ track, index }))
    .filter(({ track }) =>
      `${track.title} ${track.artist} ${track.source}`
        .toLowerCase()
        .includes(query)
    );

  if (!all.length) {
    el("#trackList").innerHTML = `
      <div class="empty-library">
        <div class="empty-illustration">
          <span>♫</span><i></i><i></i><i></i>
        </div>
        <h3>Your next favorite starts here.</h3>
        <p>Search Spotify or YouTube above, or add local audio files.</p>
      </div>`;

    return;
  }

  if (!visible.length) {
    el("#trackList").innerHTML = `
      <div class="no-results">
        No tracks match “${safeText(query)}”.
      </div>`;

    return;
  }

  el("#trackList").innerHTML = visible
    .map(({ track, index }) => `
      <div class="track-row ${track.id === currentId ? "selected" : ""}"
           data-id="${track.id}">
        <span class="track-index">
          ${
            track.id === currentId && isPlaying()
              ? '<span class="playing-bars"><i></i><i></i><i></i></span>'
              : String(index + 1).padStart(2, "0")
          }
        </span>

        <div class="track-title-cell">
          <div class="track-thumb">
            ${
              track.image
                ? `<img src="${safeText(track.image)}" alt="" />`
                : sourceIcon(track.source)
            }
          </div>

          <div class="track-name-wrap">
            <strong>${safeText(track.title)}</strong>
            <small>${safeText(track.artist)}</small>
          </div>
        </div>

        <span class="track-source ${track.source}">
          ${sourceLabel(track.source)}
        </span>

        <span class="track-duration">
          ${track.duration ? fmt(track.duration) : "—"}
        </span>

        <button
          class="remove-track"
          data-remove="${track.id}"
          title="Remove track"
          aria-label="Remove ${safeText(track.title)}"
        >×</button>
      </div>
    `)
    .join("");

  el("#trackList")
    .querySelectorAll<HTMLElement>(".track-row")
    .forEach(row =>
      row.addEventListener("click", event => {
        if ((event.target as HTMLElement).closest("[data-remove]")) {
          return;
        }

        void playTrack(row.dataset.id!);
      })
    );

  el("#trackList")
    .querySelectorAll<HTMLButtonElement>("[data-remove]")
    .forEach(button =>
      button.addEventListener("click", event => {
        event.stopPropagation();
        removeTrack(button.dataset.remove!);
      })
    );
}

function renderNodes(): void {
  const tracks = playlist.toArray();

  if (!tracks.length) {
    el("#nodesTrack").innerHTML = `
      <div class="nodes-empty">
        Your linked-list nodes appear here as tracks are added.
      </div>`;

    return;
  }

  el("#nodesTrack").innerHTML = tracks
    .map((track, index) => `
      ${
        index === 0
          ? '<span class="null-label">NULL</span><span class="node-arrow">→</span>'
          : '<span class="node-arrow">⇄</span>'
      }

      <button
        class="list-node ${track.id === currentId ? "active-node" : ""}"
        data-node="${track.id}"
      >
        <span class="node-position">
          NODE ${String(index + 1).padStart(2, "0")}
        </span>

        <strong>
          ${safeText(
            track.title.length > 17
              ? track.title.slice(0, 15) + "…"
              : track.title
          )}
        </strong>

        <span class="node-pointers">
          <i>prev ${index === 0 ? "NULL" : "↶"}</i>
          <i>next ${index === tracks.length - 1 ? "NULL" : "↷"}</i>
        </span>
      </button>

      ${
        index === tracks.length - 1
          ? '<span class="node-arrow">→</span><span class="null-label">NULL</span>'
          : ""
      }
    `)
    .join("");

  el("#nodesTrack")
    .querySelectorAll<HTMLButtonElement>("[data-node]")
    .forEach(button =>
      button.addEventListener("click", () =>
        void playTrack(button.dataset.node!)
      )
    );
}

function addTracks(tracks: Track[]): void {
  let position = pendingInsertPosition ?? playlist.size + 1;

  for (const track of tracks) {
    const actual = Math.max(
      1,
      Math.min(position, playlist.size + 1)
    );

    playlist.insertAt(actual, track);
    position = actual + 1;
  }

  pendingInsertPosition = null;

  el<HTMLInputElement>("#insertPosition").value =
    String(playlist.size + 1);

  renderAll();

  if (!currentId && tracks.length) {
    void playTrack(tracks[0].id);
  }

  showToast(
    `${tracks.length} track${tracks.length === 1 ? "" : "s"} added to your playlist.`
  );
}

function importLocal(files: FileList | File[]): void {
  const valid = Array.from(files).filter(
    file =>
      file.type.startsWith("audio/") ||
      /\.(mp3|wav|m4a|aac|ogg|flac|opus)$/i.test(file.name)
  );

  if (!valid.length) {
    return showToast("Choose a supported audio file.");
  }

  addTracks(
    valid.map(file => ({
      id: crypto.randomUUID(),
      title: titleFromFile(file.name),
      artist: "Local audio",
      source: "local",
      externalId: "",
      uri: "",
      url: URL.createObjectURL(file),
      file,
      duration: 0,
      image: "",
      favorite: false
    }))
  );
}

function insertionPosition(): number {
  const input = el<HTMLInputElement>("#insertPosition");
  const pos = Number(input.value);

  if (
    !Number.isInteger(pos) ||
    pos < 1 ||
    pos > playlist.size + 1
  ) {
    throw new Error(
      `Insertion position must be from 1 to ${playlist.size + 1}.`
    );
  }

  return pos;
}

function trackFromSearch(
  source: "spotify" | "youtube",
  item: any
): Track {
  if (source === "spotify") {
    return {
      id: crypto.randomUUID(),
      title: item.name,
      artist: (item.artists ?? [])
        .map((artist: any) => artist.name)
        .join(", "),
      source,
      externalId: item.id,
      uri: item.uri,
      url: "",
      duration: (item.duration_ms ?? 0) / 1000,
      image:
        item.album?.images?.[2]?.url ??
        item.album?.images?.[0]?.url ??
        "",
      favorite: false
    };
  }

  return {
    id: crypto.randomUUID(),
    title: item.snippet?.title ?? "YouTube track",
    artist: item.snippet?.channelTitle ?? "YouTube",
    source,
    externalId: item.id?.videoId ?? item.id,
    uri: "",
    url: "",
    duration: 0,
    image:
      item.snippet?.thumbnails?.medium?.url ??
      item.snippet?.thumbnails?.default?.url ??
      "",
    favorite: false
  };
}

function renderSearchResults(
  source: "spotify" | "youtube",
  items: any[]
): void {
  const results = el<HTMLDivElement>("#searchResults");

  if (!items.length) {
    results.innerHTML = `
      <div class="results-placeholder">
        <span>⌕</span>
        <p>No results found. Try another search.</p>
      </div>`;

    return;
  }

  results.innerHTML = items
    .map((item, index) => {
      const track = trackFromSearch(source, item);
      const duration = track.duration ? fmt(track.duration) : "";

      return `
        <article class="result-card" data-result="${index}">
          <div class="result-art">
            ${
              track.image
                ? `<img src="${safeText(track.image)}" alt="" />`
                : `<span>${sourceIcon(source)}</span>`
            }
          </div>

          <div class="result-info">
            <strong>${safeText(track.title)}</strong>
            <small>
              ${safeText(track.artist)}${duration ? " · " + duration : ""}
            </small>
            <span class="result-source ${source}">
              ${sourceLabel(source)}
            </span>
          </div>

          <button
            class="add-result"
            data-add-result="${index}"
            title="Add to playlist"
            aria-label="Add ${safeText(track.title)}"
          >＋</button>
        </article>`;
    })
    .join("");

  results
    .querySelectorAll<HTMLButtonElement>("[data-add-result]")
    .forEach(button =>
      button.addEventListener("click", () => {
        try {
          const track = trackFromSearch(
            source,
            items[Number(button.dataset.addResult)]
          );

          pendingInsertPosition = insertionPosition();
          addTracks([track]);

          button.textContent = "✓";
          button.disabled = true;
        } catch (error) {
          showToast(
            error instanceof Error
              ? error.message
              : "Could not add track."
          );
        }
      })
    );

  results
    .querySelectorAll<HTMLElement>(".result-card")
    .forEach(card =>
      card.addEventListener("dblclick", () => {
        try {
          pendingInsertPosition = insertionPosition();

          addTracks([
            trackFromSearch(
              source,
              items[Number(card.dataset.result)]
            )
          ]);
        } catch (error) {
          showToast(
            error instanceof Error
              ? error.message
              : "Could not add track."
          );
        }
      })
    );
}

async function searchMusic(): Promise<void> {
  const query = el<HTMLInputElement>("#sourceSearch").value.trim();

  if (!query || searchBusy) return;

  searchBusy = true;

  const button = el<HTMLButtonElement>("#searchButton");
  button.disabled = true;
  button.textContent = "Searching…";

  el("#searchResults").innerHTML = `
    <div class="results-placeholder">
      <span class="loading-spinner"></span>
      <p>Searching ${activeSearchSource}…</p>
    </div>`;

  try {
    if (activeSearchSource === "youtube") {
      if (
        !YOUTUBE_API_KEY ||
        YOUTUBE_API_KEY === "your_youtube_data_api_key"
      ) {
        throw new Error(
          "YouTube API key missing. Add VITE_YOUTUBE_API_KEY to your .env file, then restart Vite."
        );
      }

      const params = new URLSearchParams({
        part: "snippet",
        type: "video",
        videoCategoryId: "10",
        videoEmbeddable: "true",
        maxResults: "8",
        q: query,
        key: YOUTUBE_API_KEY
      });

      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?${params}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error?.message ??
            "YouTube search failed. Check your API key and quota."
        );
      }

      renderSearchResults("youtube", data.items ?? []);
    } else {
      const token = await getSpotifyToken();

      const response = await fetch(
        `https://api.spotify.com/v1/search?${new URLSearchParams({
          q: query,
          type: "track",
          limit: "8"
        })}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error?.message ??
            "Spotify search failed. Check your developer app and permissions."
        );
      }

      renderSearchResults("spotify", data.tracks?.items ?? []);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Search failed.";

    el("#searchResults").innerHTML = `
      <div class="search-error">
        <strong>Could not search music</strong>
        <p>${safeText(message)}</p>
      </div>`;

    showToast(message);
  } finally {
    searchBusy = false;
    button.disabled = false;
    button.textContent = "Search";
  }
}

function randomString(length: number): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

  const bytes = crypto.getRandomValues(new Uint8Array(length));

  return Array.from(bytes, byte => chars[byte % chars.length]).join("");
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(plain)
  );
}

function base64Url(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function spotifyLogin(): Promise<void> {
  if (
    !SPOTIFY_CLIENT_ID ||
    SPOTIFY_CLIENT_ID === "your_spotify_client_id"
  ) {
    showToast("Add VITE_SPOTIFY_CLIENT_ID to your .env file first.");
    return;
  }

  const verifier = randomString(64);

  sessionStorage.setItem("lumi_pkce_verifier", verifier);

  const challenge = base64Url(await sha256(verifier));
  const state = randomString(20);

  sessionStorage.setItem("lumi_spotify_state", state);

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: "code",
    redirect_uri: SPOTIFY_REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: challenge,
    state,
    scope: SPOTIFY_SCOPES
  });

  window.location.assign(
    `https://accounts.spotify.com/authorize?${params}`
  );
}

async function handleSpotifyCallback(): Promise<void> {
  const params = new URLSearchParams(window.location.search);

  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");

  if (error) {
    window.history.replaceState({}, "", window.location.pathname);
    showToast(`Spotify authorization: ${error}`);
    return;
  }

  if (!code) return;

  const expectedState = sessionStorage.getItem("lumi_spotify_state");
  const verifier = sessionStorage.getItem("lumi_pkce_verifier");

  window.history.replaceState({}, "", window.location.pathname);

  if (!state || state !== expectedState || !verifier) {
    showToast("Spotify login verification failed. Please connect again.");
    return;
  }

  try {
    const response = await fetch(
      "https://accounts.spotify.com/api/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          client_id: SPOTIFY_CLIENT_ID,
          grant_type: "authorization_code",
          code,
          redirect_uri: SPOTIFY_REDIRECT_URI,
          code_verifier: verifier
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error_description ?? "Could not complete Spotify login."
      );
    }

    spotifyAccessToken = data.access_token;

    if (data.refresh_token) {
      spotifyRefreshToken = data.refresh_token;

      localStorage.setItem(
        "lumi_spotify_refresh_token",
        data.refresh_token
      );
    }

    sessionStorage.removeItem("lumi_pkce_verifier");
    sessionStorage.removeItem("lumi_spotify_state");

    showToast("Spotify connected.");
    renderAll();

    await initSpotifyPlayer();
  } catch (error) {
    showToast(
      error instanceof Error ? error.message : "Spotify login failed."
    );
  }
}

async function getSpotifyToken(): Promise<string> {
  if (spotifyAccessToken) return spotifyAccessToken;

  if (spotifyRefreshToken && SPOTIFY_CLIENT_ID) {
    const response = await fetch(
      "https://accounts.spotify.com/api/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          client_id: SPOTIFY_CLIENT_ID,
          grant_type: "refresh_token",
          refresh_token: spotifyRefreshToken
        })
      }
    );

    const data = await response.json();

    if (response.ok && data.access_token) {
      spotifyAccessToken = data.access_token;

      if (data.refresh_token) {
        spotifyRefreshToken = data.refresh_token;

        localStorage.setItem(
          "lumi_spotify_refresh_token",
          data.refresh_token
        );
      }

      return spotifyAccessToken!;
    }

    localStorage.removeItem("lumi_spotify_refresh_token");
    spotifyRefreshToken = null;
  }

  await spotifyLogin();

  throw new Error(
    "Spotify login opened. Finish authorization, then search again."
  );
}

function loadSpotifySdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Spotify) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-spotify-sdk]'
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(), {
        once: true
      });

      existing.addEventListener(
        "error",
        () => reject(new Error("Could not load Spotify player SDK.")),
        { once: true }
      );

      return;
    }

    window.onSpotifyWebPlaybackSDKReady = () => resolve();

    const script = document.createElement("script");

    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    script.dataset.spotifySdk = "true";

    script.onerror = () =>
      reject(new Error("Could not load Spotify player SDK."));

    document.head.appendChild(script);
  });
}

async function initSpotifyPlayer(): Promise<void> {
  try {
    await loadSpotifySdk();

    if (!window.Spotify || spotifyPlayer) return;

    spotifyPlayer = new window.Spotify.Player({
      name: "LÜMI Music Player",
      volume: Number(volumeBar.value),
      getOAuthToken: async (
        callback: (token: string) => void
      ) => callback(await getSpotifyToken()),
      enableMediaSession: true
    });

    spotifyPlayer.addListener(
      "ready",
      ({ device_id }: { device_id: string }) => {
        spotifyDeviceId = device_id;
        showToast("Spotify player ready.");
      }
    );

    spotifyPlayer.addListener("not_ready", () => {
      spotifyDeviceId = null;
      spotifyIsPlaying = false;
      renderAll();
    });

    spotifyPlayer.addListener(
      "initialization_error",
      ({ message }: any) => showToast(`Spotify player: ${message}`)
    );

    spotifyPlayer.addListener(
      "authentication_error",
      ({ message }: any) => showToast(`Spotify authentication: ${message}`)
    );

    spotifyPlayer.addListener(
      "account_error",
      ({ message }: any) =>
        showToast(`Spotify requires a Premium account: ${message}`)
    );

    spotifyPlayer.addListener(
      "playback_error",
      ({ message }: any) => showToast(`Spotify playback: ${message}`)
    );

    spotifyPlayer.addListener(
      "player_state_changed",
      (state: any) => {
        if (!state) {
          spotifyIsPlaying = false;
          renderAll();
          return;
        }

        spotifyIsPlaying = !state.paused;

        el("#currentTime").textContent =
          fmt(state.position / 1000);

        el("#durationTime").textContent =
          fmt(state.duration / 1000);

        seekBar.value = state.duration
          ? String((state.position / state.duration) * 100)
          : "0";

        renderAll();
      }
    );

    const connected = await spotifyPlayer.connect();

    if (!connected) {
      showToast(
        "Spotify player did not connect. Try signing in again."
      );
    }
  } catch (error) {
    showToast(
      error instanceof Error
        ? error.message
        : "Spotify player could not initialize."
    );
  }
}

async function playSpotify(track: Track): Promise<void> {
  if (!spotifyAccessToken) {
    await spotifyLogin();

    showToast("Finish Spotify login, then select the track again.");
    return;
  }

  await initSpotifyPlayer();

  if (!spotifyDeviceId) {
    showToast(
      "Spotify player is connecting. Try Play again in a moment."
    );
    return;
  }

  const token = await getSpotifyToken();

  const response = await fetch(
    `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(spotifyDeviceId)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        uris: [track.uri]
      })
    }
  );

  if (!response.ok && response.status !== 204) {
    const data = await response.json().catch(() => ({}));

    throw new Error(
      data.error?.message ??
        "Spotify could not start playback. Check Premium and device status."
    );
  }
}

function loadYouTubeApi(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.YT?.Player) {
      youtubeReady = true;
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-youtube-api]'
    );

    window.onYouTubeIframeAPIReady = () => {
      youtubeReady = true;
      resolve();
    };

    if (existing) {
      existing.addEventListener(
        "error",
        () => reject(new Error("Could not load YouTube player.")),
        { once: true }
      );

      return;
    }

    const script = document.createElement("script");

    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.dataset.youtubeApi = "true";

    script.onerror = () =>
      reject(new Error("Could not load YouTube player API."));

    document.head.appendChild(script);
  });
}

async function playYouTube(track: Track): Promise<void> {
  await loadYouTubeApi();

  youtubePanel.classList.add("visible");

  if (!youtubePlayer) {
    youtubePlayer = new window.YT.Player("youtubePlayer", {
      width: "100%",
      height: "200",
      videoId: track.externalId,

      playerVars: {
        playsinline: 1,
        origin: window.location.origin,
        enablejsapi: 1
      },

      events: {
        onReady: (event: any) => {
          event.target.setVolume(Number(volumeBar.value) * 100);
          event.target.playVideo();
        },

        onStateChange: (event: any) => {
          if (event.data === window.YT.PlayerState.ENDED) {
            if (repeat) {
              youtubePlayer.seekTo(0, true);
            } else {
              goToTrack(1);
            }
          }

          if (event.data === window.YT.PlayerState.PLAYING) {
            const duration = youtubePlayer.getDuration() || 0;

            el("#durationTime").textContent = fmt(duration);

            renderAll();
          }

          renderAll();
        },

        onError: () => {
          showToast(
            "This video cannot be played here. Try another result."
          );
        }
      }
    });
  } else {
    youtubePlayer.loadVideoById(track.externalId);
  }
}

async function playTrack(id: string): Promise<void> {
  const position = playlist.findById(id);

  const track =
    position > 0
      ? playlist.getNode(position)?.data
      : null;

  if (!track) return;

  currentId = id;

  if (activeSource === "local" && track.source !== "local") {
    audio.pause();
  }

  activeSource = track.source;

  renderAll();

  try {
    if (track.source === "local") {
      youtubePlayer?.pauseVideo?.();

      audio.src = track.url;
      audio.load();

      await audio.play();
    } else if (track.source === "youtube") {
      audio.pause();

      await playYouTube(track);
    } else {
      audio.pause();
      youtubePlayer?.pauseVideo?.();

      await playSpotify(track);
    }
  } catch (error) {
    showToast(
      error instanceof Error
        ? error.message
        : "Could not play this track."
    );
  }

  renderAll();
}

function togglePlayback(): void {
  const track = currentTrack();

  if (!track) {
    showToast(
      "Search for a track and add it to your playlist first."
    );
    return;
  }

  if (activeSource === "local") {
    if (audio.paused) {
      void audio.play().catch(() =>
        showToast("This audio file could not be played.")
      );
    } else {
      audio.pause();
    }
  } else if (activeSource === "youtube" && youtubePlayer) {
    const state = youtubePlayer.getPlayerState();

    if (state === 1) {
      youtubePlayer.pauseVideo();
    } else {
      youtubePlayer.playVideo();
    }
  } else if (activeSource === "spotify" && spotifyPlayer) {
    void spotifyPlayer.togglePlay().catch(() =>
      showToast("Spotify playback control failed.")
    );
  } else {
    void playTrack(track.id);
  }

  renderAll();
}

function goToTrack(direction: -1 | 1): void {
  const tracks = playlist.toArray();

  if (!tracks.length) {
    showToast("Your playlist is empty.");
    return;
  }

  const index = tracks.findIndex(
    track => track.id === currentId
  );

  let nextIndex: number;

  if (shuffle && tracks.length > 1) {
    do {
      nextIndex = Math.floor(Math.random() * tracks.length);
    } while (nextIndex === index);
  } else {
    nextIndex =
      index < 0
        ? direction === 1
          ? 0
          : tracks.length - 1
        : index + direction;

    if (nextIndex < 0) {
      nextIndex = tracks.length - 1;
    }

    if (nextIndex >= tracks.length) {
      nextIndex = 0;
    }
  }

  void playTrack(tracks[nextIndex].id);
}

function removeTrack(id: string): void {
  const position = playlist.findById(id);

  if (position < 1) return;

  const wasCurrent = currentId === id;

  const next =
    playlist.getNode(position)?.next?.data ??
    playlist.getNode(position)?.prev?.data ??
    null;

  const removed = playlist.removeAt(position);

  if (removed?.url) {
    URL.revokeObjectURL(removed.url);
  }

  if (wasCurrent) {
    audio.pause();
    audio.removeAttribute("src");
    youtubePlayer?.pauseVideo?.();

    currentId = null;
    activeSource = null;
    spotifyIsPlaying = false;

    if (next) {
      void playTrack(next.id);
    }
  }

  renderAll();

  showToast("Track removed from playlist.");
}

function setSource(source: "spotify" | "youtube"): void {
  activeSearchSource = source;

  document
    .querySelectorAll<HTMLButtonElement>(".source-tab")
    .forEach(tab =>
      tab.classList.toggle(
        "active",
        tab.dataset.source === source
      )
    );

  el<HTMLInputElement>("#sourceSearch").placeholder =
    source === "spotify"
      ? "Search Spotify tracks and artists..."
      : "Search YouTube music videos...";

  el("#sourceStatus").textContent =
    source === "spotify"
      ? SPOTIFY_CLIENT_ID
        ? "Spotify search and playback require you to connect your Spotify account."
        : "Configure VITE_SPOTIFY_CLIENT_ID to enable Spotify."
      : YOUTUBE_API_KEY
        ? "Search YouTube music videos and add them to your playlist."
        : "Configure VITE_YOUTUBE_API_KEY to enable YouTube search.";

  el("#searchResults").innerHTML = `
    <div class="results-placeholder">
      <span>${source === "spotify" ? "●" : "▶"}</span>
      <p>Search ${source} to find tracks to add.</p>
    </div>`;
}

function reversePlaylist(): void {
  playlist.reverse();
  renderAll();
  showToast("Playlist order reversed.");
}

picker.addEventListener("change", () => {
  if (picker.files?.length) {
    importLocal(picker.files);
  }

  picker.value = "";
});

el("#localImportButton").addEventListener("click", () => {
  try {
    pendingInsertPosition = insertionPosition();
    picker.click();
  } catch (error) {
    showToast(
      error instanceof Error
        ? error.message
        : "Invalid insertion position."
    );
  }
});

el("#heroSearch").addEventListener("click", () => {
  el("#discoverSection").scrollIntoView({
    behavior: "smooth"
  });
});

el("#playAllButton").addEventListener("click", () => {
  const first = playlist.head?.data;

  if (first) {
    void playTrack(first.id);
  } else {
    el("#discoverSection").scrollIntoView({
      behavior: "smooth"
    });
  }
});

el("#searchForm").addEventListener("submit", event => {
  event.preventDefault();
  void searchMusic();
});

document
  .querySelectorAll<HTMLButtonElement>(".source-tab")
  .forEach(button =>
    button.addEventListener("click", () =>
      setSource(button.dataset.source as "spotify" | "youtube")
    )
  );

el("#sideSpotify").addEventListener("click", () => {
  if (!SPOTIFY_CLIENT_ID) {
    showToast("Configure VITE_SPOTIFY_CLIENT_ID first.");
  } else {
    void spotifyLogin();
  }
});

el("#sideYoutube").addEventListener("click", () => {
  setSource("youtube");

  el("#discoverSection").scrollIntoView({
    behavior: "smooth"
  });
});

el("#playPause").addEventListener("click", togglePlayback);

el("#previousTrack").addEventListener("click", () => {
  const track = currentTrack();

  if (!track) return;

  if (track.source === "local" && audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }

  goToTrack(-1);
});

el("#nextTrack").addEventListener("click", () => {
  if (!currentTrack()) return;

  goToTrack(1);
});

el("#shuffleButton").addEventListener("click", () => {
  shuffle = !shuffle;

  el("#shuffleButton").classList.toggle(
    "control-active",
    shuffle
  );

  showToast(
    shuffle ? "Shuffle enabled." : "Shuffle disabled."
  );
});

el("#repeatButton").addEventListener("click", () => {
  repeat = !repeat;

  el("#repeatButton").classList.toggle(
    "control-active",
    repeat
  );

  el("#repeatButton").textContent = repeat ? "↻¹" : "↻";

  showToast(
    repeat
      ? "Repeat current track enabled."
      : "Repeat current track disabled."
  );
});

el("#favoriteButton").addEventListener("click", () => {
  const track = currentTrack();

  if (!track) {
    showToast("Choose a track first.");
    return;
  }

  track.favorite = !track.favorite;

  renderAll();

  showToast(
    track.favorite
      ? "Track marked as favorite."
      : "Favorite removed."
  );
});

el("#reverseButton").addEventListener(
  "click",
  reversePlaylist
);

el("#clearButton").addEventListener("click", () => {
  if (!playlist.size) {
    showToast("The playlist is already empty.");
    return;
  }

  if (!confirm("Clear all tracks from this playlist?")) {
    return;
  }

  audio.pause();
  youtubePlayer?.stopVideo?.();
  spotifyPlayer?.pause().catch(() => undefined);

  playlist.clear().forEach(track => {
    if (track.url) {
      URL.revokeObjectURL(track.url);
    }
  });

  currentId = null;
  activeSource = null;
  spotifyIsPlaying = false;

  renderAll();

  showToast("Playlist cleared.");
});

el("#filterInput").addEventListener("input", renderTracks);

el("#navLibrary").addEventListener("click", () => {
  el("#librarySection").scrollIntoView({
    behavior: "smooth"
  });
});

el("#navNowPlaying").addEventListener("click", () => {
  document.querySelector(".player-bar")?.scrollIntoView({
    behavior: "smooth",
    block: "end"
  });
});

el("#hideYoutube").addEventListener("click", () => {
  youtubePanel.classList.remove("visible");
});

volumeBar.addEventListener("input", () => {
  const value = Number(volumeBar.value);

  audio.volume = value;

  void spotifyPlayer?.setVolume(value).catch(() => undefined);

  youtubePlayer?.setVolume?.(value * 100);
});

seekBar.addEventListener("input", () => {
  const pct = Number(seekBar.value) / 100;

  if (
    activeSource === "local" &&
    Number.isFinite(audio.duration)
  ) {
    audio.currentTime = audio.duration * pct;
  } else if (
    activeSource === "youtube" &&
    youtubePlayer?.getDuration
  ) {
    youtubePlayer.seekTo(
      youtubePlayer.getDuration() * pct,
      true
    );
  } else if (
    activeSource === "spotify" &&
    spotifyPlayer
  ) {
    void spotifyPlayer
      .getCurrentState()
      .then(
        state =>
          state &&
          spotifyPlayer?.seek(state.duration * pct)
      );
  }
});

audio.addEventListener("loadedmetadata", () => {
  const track = currentTrack();

  if (track && Number.isFinite(audio.duration)) {
    track.duration = audio.duration;
  }

  el("#durationTime").textContent = fmt(audio.duration);

  renderAll();
});

audio.addEventListener("timeupdate", () => {
  el("#currentTime").textContent = fmt(audio.currentTime);
  el("#durationTime").textContent = fmt(audio.duration);

  seekBar.value = audio.duration
    ? String((audio.currentTime / audio.duration) * 100)
    : "0";
});

audio.addEventListener("play", renderAll);
audio.addEventListener("pause", renderAll);

audio.addEventListener("ended", () => {
  if (repeat) {
    audio.currentTime = 0;
    void audio.play();
  } else {
    goToTrack(1);
  }
});


window.setInterval(async () => {
  // Update YouTube progress.
  if (
    activeSource === "youtube" &&
    youtubePlayer?.getCurrentTime &&
    youtubePlayer.getPlayerState?.() === 1
  ) {
    const currentTime = youtubePlayer.getCurrentTime();
    const duration = youtubePlayer.getDuration() || 0;

    el("#currentTime").textContent = fmt(currentTime);
    el("#durationTime").textContent = fmt(duration);
    seekBar.value = duration
      ? String((currentTime / duration) * 100)
      : "0";
  }


  if (activeSource === "spotify" && spotifyPlayer) {
    try {
      const state = await spotifyPlayer.getCurrentState();

      if (state && !state.paused) {
        const currentTime = state.position / 1000;
        const duration = state.duration / 1000;

        el("#currentTime").textContent = fmt(currentTime);
        el("#durationTime").textContent = fmt(duration);
        seekBar.value = duration
          ? String((currentTime / duration) * 100)
          : "0";
      }
    } catch (error) {
      console.error("Could not update Spotify progress:", error);
    }
  }
}, 500);

window.addEventListener("beforeunload", () => {
  playlist.toArray().forEach(track => {
    if (track.url) {
      URL.revokeObjectURL(track.url);
    }
  });
});

void handleSpotifyCallback();

setSource("youtube");
renderAll();