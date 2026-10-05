import * as THREE from 'three';

export interface CoopPlayerData {
  id: string;
  isHost: boolean;
  pos: [number, number, number];
  yaw: number;
  pitch: number;
  currentWeapon: string | null;
  isShooting: boolean;
  isPunching: boolean;
  isMoving: boolean;
  dtFactor?: number;
}

export interface CoopEnemySyncData {
  id: string;
  pos: [number, number, number];
  rotationY: number;
  alive: boolean;
  state: string;
  hasWeapon: boolean;
  weaponType?: string;
}

export interface CoopNetworkPacket {
  type: 'SYNC_STATE' | 'PLAYER_ACTION' | 'MOB_SPAWN' | 'PLAYER_SHOOT' | 'JOIN_ROOM' | 'ROOM_CONNECTED';
  senderId: string;
  roomCode: string;
  timestamp: number;
  playerState?: CoopPlayerData;
  enemies?: CoopEnemySyncData[];
  dtFactor?: number;
}

class CoopNetworkManager {
  private isConnected = false;
  private isHost = true;
  private roomCode = 'SUPERHOT-COOP-LAN';
  private peerId = 'player_' + Math.floor(Math.random() * 10000);
  private broadcastChannel: BroadcastChannel | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private remotePlayerState: CoopPlayerData | null = null;
  private onPacketReceivedCallbacks: ((packet: CoopNetworkPacket) => void)[] = [];
  private pingMs = 16;
  private lastPingTime = 0;

  public init(isHost: boolean, roomCode = 'SUPERHOT-COOP-LAN') {
    this.isHost = isHost;
    this.roomCode = roomCode.toUpperCase().trim() || 'SUPERHOT-COOP-LAN';
    this.isConnected = false;

    // 1. Local BroadcastChannel for instant PC/LAN tab-to-tab & local P2P sync
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        if (this.broadcastChannel) {
          this.broadcastChannel.close();
        }
        this.broadcastChannel = new BroadcastChannel(`webhot_coop_${this.roomCode}`);
        this.broadcastChannel.onmessage = (event) => {
          this.handleIncomingPacket(event.data);
        };
        this.isConnected = true;
      }
    } catch (err) {
      console.warn('BroadcastChannel fallback error:', err);
    }

    // Send initial join notification
    this.sendPacket({
      type: isHost ? 'ROOM_CONNECTED' : 'JOIN_ROOM',
      senderId: this.peerId,
      roomCode: this.roomCode,
      timestamp: performance.now(),
    });
  }

  public sendPacket(packet: CoopNetworkPacket) {
    packet.senderId = this.peerId;
    packet.roomCode = this.roomCode;
    packet.timestamp = performance.now();

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(packet);
      } catch {}
    }
  }

  private handleIncomingPacket(packet: CoopNetworkPacket) {
    if (!packet || packet.senderId === this.peerId || packet.roomCode !== this.roomCode) {
      return;
    }

    this.pingMs = Math.max(8, Math.round(performance.now() - (packet.timestamp || performance.now())));
    this.isConnected = true;

    if (packet.playerState) {
      this.remotePlayerState = packet.playerState;
    }

    this.onPacketReceivedCallbacks.forEach((cb) => cb(packet));
  }

  public onPacket(callback: (packet: CoopNetworkPacket) => void) {
    this.onPacketReceivedCallbacks.push(callback);
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  public getIsHost(): boolean {
    return this.isHost;
  }

  public getPing(): number {
    return this.pingMs;
  }

  public getPeerId(): string {
    return this.peerId;
  }

  public getRoomCode(): string {
    return this.roomCode;
  }

  public initHost(roomCode?: string) {
    this.init(true, roomCode);
  }

  public initClient(roomCode?: string) {
    this.init(false, roomCode);
  }

  public sendState(data: { pos: THREE.Vector3; yaw: number; pitch: number; isShooting: boolean; dtFactor: number }) {
    this.sendPacket({
      type: 'SYNC_STATE',
      senderId: this.peerId,
      roomCode: this.roomCode,
      timestamp: performance.now(),
      dtFactor: data.dtFactor,
      playerState: {
        id: this.peerId,
        isHost: this.isHost,
        pos: [data.pos.x, data.pos.y, data.pos.z],
        yaw: data.yaw,
        pitch: data.pitch,
        currentWeapon: 'pistol',
        isShooting: data.isShooting,
        isPunching: false,
        isMoving: true,
      },
    });
  }

  public getPartnerState(): CoopPlayerData | null {
    return this.getRemotePlayerState();
  }

  public getRemotePlayerState(): CoopPlayerData | null {
    return this.remotePlayerState;
  }

  public close() {
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
    this.isConnected = false;
    this.remotePlayerState = null;
  }
}

export const coopNetwork = new CoopNetworkManager();
