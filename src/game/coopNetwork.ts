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

export interface DiscoveredRoom {
  roomCode: string;
  hostId: string;
  pingMs: number;
  playersCount: number;
  lastSeen: number;
}

export interface CoopNetworkPacket {
  type: 'SYNC_STATE' | 'PLAYER_ACTION' | 'MOB_SPAWN' | 'PLAYER_SHOOT' | 'JOIN_ROOM' | 'ROOM_CONNECTED' | 'ROOM_BEACON';
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
  private discoveryChannel: BroadcastChannel | null = null;
  private beaconInterval: number | null = null;
  private remotePlayerState: CoopPlayerData | null = null;
  private onPacketReceivedCallbacks: ((packet: CoopNetworkPacket) => void)[] = [];
  private pingMs = 14;
  private discoveredRooms: Map<string, DiscoveredRoom> = new Map();
  private onRoomsDiscoveredCb: ((rooms: DiscoveredRoom[]) => void) | null = null;

  constructor() {
    this.initDiscoveryChannel();
  }

  private initDiscoveryChannel() {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.discoveryChannel = new BroadcastChannel('webhot_coop_room_discovery');
        this.discoveryChannel.onmessage = (ev) => {
          const data = ev.data;
          if (data && data.type === 'ROOM_BEACON') {
            const now = performance.now();
            const latency = Math.max(4, Math.round(now - (data.timestamp || now)));
            this.discoveredRooms.set(data.roomCode, {
              roomCode: data.roomCode,
              hostId: data.senderId,
              pingMs: latency,
              playersCount: data.playersCount || 1,
              lastSeen: Date.now(),
            });
            this.notifyDiscoveredRooms();
          }
        };
      }
    } catch (err) {
      console.warn('Room discovery channel error:', err);
    }
  }

  public startRoomDiscovery(onRoomsUpdated: (rooms: DiscoveredRoom[]) => void) {
    this.onRoomsDiscoveredCb = onRoomsUpdated;
    this.notifyDiscoveredRooms();
  }

  private notifyDiscoveredRooms() {
    if (!this.onRoomsDiscoveredCb) return;
    const now = Date.now();
    const activeRooms: DiscoveredRoom[] = [];
    this.discoveredRooms.forEach((room, code) => {
      if (now - room.lastSeen < 3500) {
        activeRooms.push(room);
      } else {
        this.discoveredRooms.delete(code);
      }
    });
    this.onRoomsDiscoveredCb(activeRooms);
  }

  public init(isHost: boolean, roomCode = 'SUPERHOT-COOP-LAN') {
    this.isHost = isHost;
    this.roomCode = roomCode.toUpperCase().trim() || 'SUPERHOT-COOP-LAN';
    this.isConnected = false;

    if (this.beaconInterval) {
      clearInterval(this.beaconInterval);
      this.beaconInterval = null;
    }

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

    // Host continuously broadcasts room availability beacon across LAN
    if (isHost && this.discoveryChannel) {
      this.beaconInterval = window.setInterval(() => {
        try {
          this.discoveryChannel?.postMessage({
            type: 'ROOM_BEACON',
            roomCode: this.roomCode,
            senderId: this.peerId,
            timestamp: performance.now(),
            playersCount: this.isConnected && this.remotePlayerState ? 2 : 1,
          });
        } catch {}
      }, 350);
    }

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

    this.pingMs = Math.max(4, Math.round(performance.now() - (packet.timestamp || performance.now())));
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
        dtFactor: data.dtFactor,
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
    if (this.beaconInterval) {
      clearInterval(this.beaconInterval);
      this.beaconInterval = null;
    }
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
    this.isConnected = false;
    this.remotePlayerState = null;
  }
}

export const coopNetwork = new CoopNetworkManager();
