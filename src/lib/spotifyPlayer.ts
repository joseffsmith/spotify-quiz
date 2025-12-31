type PlaybackRange = { startMs: number; endMs: number };

type PlaybackState = {
  deviceId?: string;
  isReady: boolean;
  error?: string;
  deviceActive: boolean;
  positionMs?: number;
  currentTrackUri?: string;
};

declare global {
  interface Window {
    Spotify?: typeof Spotify;
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

const PLAYER_NAME = "Quiz Player";

class SpotifyPlayerManager {
  private static instance: SpotifyPlayerManager;
  private state: PlaybackState = { isReady: false, deviceActive: false };
  private token?: string;
  private player: Spotify.Player | null = null;
  private subscribers = new Set<(state: PlaybackState) => void>();
  private stopTimer: number | null = null;
  private currentRange: { uri: string; range: PlaybackRange } | null = null;
  private hasActivated = false;

  static getInstance() {
    if (!SpotifyPlayerManager.instance) {
      SpotifyPlayerManager.instance = new SpotifyPlayerManager();
    }
    return SpotifyPlayerManager.instance;
  }

  subscribe(cb: (state: PlaybackState) => void) {
    this.subscribers.add(cb);
    cb(this.state);
    return () => this.subscribers.delete(cb);
  }

  setToken(token?: string) {
    if (this.token === token) return;
    this.token = token;
    this.teardown();
    if (token) {
      this.init();
    } else {
      this.setState({ isReady: false, deviceActive: false, deviceId: undefined });
    }
  }

  private async init() {
    if (!this.token) return;
    try {
      await this.loadSdk();
      if (!window.Spotify) {
        throw new Error("Spotify SDK not available");
      }
      this.player = new window.Spotify.Player({
        name: PLAYER_NAME,
        getOAuthToken: (cb) => cb(this.token!),
        volume: 0.8
      });

      this.player.addListener("ready", ({ device_id }) => {
        this.hasActivated = false;
        this.setState({ isReady: true, deviceId: device_id, deviceActive: false, error: undefined });
      });

      this.player.addListener("not_ready", () => {
        this.setState({ isReady: false, deviceActive: false });
      });

      this.player.addListener("initialization_error", ({ message }) => this.setState({ isReady: false, deviceActive: false, error: message }));
      this.player.addListener("authentication_error", ({ message }) => this.setState({ isReady: false, deviceActive: false, error: message }));
      this.player.addListener("account_error", ({ message }) => this.setState({ isReady: false, deviceActive: false, error: message }));
      this.player.addListener("player_state_changed", (state) => {
        if (!state) return;
        this.setState({
          positionMs: state.position,
          currentTrackUri: state.track_window?.current_track?.uri
        });
      });

      await this.player.connect();
    } catch (error) {
      this.setState({ isReady: false, deviceActive: false, error: error instanceof Error ? error.message : "Failed to init Spotify player" });
    }
  }

  private async loadSdk() {
    if (window.Spotify) return;
    await new Promise<void>((resolve, reject) => {
      window.onSpotifyWebPlaybackSDKReady = () => resolve();
      const script = document.createElement("script");
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;
      script.onload = () => {
        if (window.Spotify) resolve();
      };
      script.onerror = () => reject(new Error("Failed to load Spotify SDK"));
      document.body.appendChild(script);
    });
  }

  private setState(next: Partial<PlaybackState>) {
    this.state = { ...this.state, ...next };
    this.subscribers.forEach((cb) => cb(this.state));
  }

  private async resolveDeviceId() {
    if (!this.token) return undefined;
    if (this.state.deviceId) return this.state.deviceId;
    const response = await fetch("https://api.spotify.com/v1/me/player/devices", {
      headers: { Authorization: `Bearer ${this.token}` }
    });
    if (!response.ok) return undefined;
    const payload = (await response.json()) as { devices: Array<{ id: string; name: string }> };
    const found = payload.devices.find((device) => device.name === PLAYER_NAME);
    if (found?.id) {
      this.setState({ deviceId: found.id });
      return found.id;
    }
    return undefined;
  }

  private async activateDevice(deviceId?: string) {
    if (!this.token) return false;
    const resolved = deviceId ?? (await this.resolveDeviceId());
    if (!resolved) {
      this.setState({ error: "Spotify player device not found" });
      return false;
    }
    const response = await fetch("https://api.spotify.com/v1/me/player", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ device_ids: [resolved], play: false })
    });
    if (!response.ok) {
      const message =
        response.status === 404
          ? "Spotify player not active. Open Spotify and try again (Premium required)."
          : `Activate failed: ${response.status} ${response.statusText}`;
      this.setState({ deviceActive: false, error: message });
      return false;
    }
    this.setState({ deviceActive: true, error: undefined });
    this.hasActivated = true;
    return true;
  }

  async playTrack(uri: string, range: PlaybackRange) {
    if (!this.token) {
      this.setState({ error: "Player not ready" });
      return false;
    }

    if (this.stopTimer) {
      window.clearTimeout(this.stopTimer);
    }

    const deviceId = await this.resolveDeviceId();
    if (!deviceId) {
      this.setState({ error: "Spotify player device not found" });
      return false;
    }

    if (!this.state.deviceActive) {
      const activated = await this.activateDevice(deviceId);
      if (!activated) {
        this.rangeRefClear();
        return false;
      }
    }

    const safeStart = Math.max(0, Math.min(range.startMs, range.endMs));
    const safeEnd = Math.max(safeStart + 200, range.endMs);

    const doPlay = async () =>
      fetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          uris: [uri],
          position_ms: safeStart
        })
      });

    let response = await doPlay();

    if (response.status === 404 && !this.hasActivated) {
      const activated = await this.activateDevice(deviceId);
      if (activated) {
        response = await doPlay();
      }
    }

    if (!response.ok) {
      const message =
        response.status === 404
          ? "Spotify player not active. Open Spotify and try again (Premium required)."
          : `Play failed: ${response.status} ${response.statusText}`;
      this.setState({ error: message });
      this.rangeRefClear();
      return false;
    }

    this.rangeRefSet(uri, { startMs: safeStart, endMs: safeEnd });
    this.setState({ currentTrackUri: uri });
    const duration = safeEnd - safeStart;
    this.stopTimer = window.setTimeout(async () => {
      await this.playTrack(uri, range);
    }, duration);
    this.setState({ error: undefined });
    return true;
  }

  async pause() {
    if (!this.token || !this.state.deviceId) return;
    await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${encodeURIComponent(this.state.deviceId)}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.token}`
      }
    });
    this.rangeRefClear();
  }

  private rangeRefClear() {
    this.rangeRef = null;
    this.currentRange = null;
    if (this.stopTimer) {
      window.clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
  }

  private rangeRefSet(uri: string, range: PlaybackRange) {
    this.rangeRef = range;
    this.currentRange = { uri, range };
  }

  private teardown() {
    if (this.stopTimer) {
      window.clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    this.player?.disconnect();
    this.player = null;
    this.rangeRef = null;
    this.currentRange = null;
    this.hasActivated = false;
    this.setState({ isReady: false, deviceActive: false, deviceId: undefined, currentTrackUri: undefined, positionMs: undefined });
  }
}

export const spotifyPlayerManager = SpotifyPlayerManager.getInstance();
