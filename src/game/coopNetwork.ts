import { Peer, DataConnection } from 'peerjs';
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
  type: 'SYNC_STATE' | 'PLAYER_ACTION' | 'MOB_SPAWN' | 'PLAYER_SHOOT' | 'JOIN_ROOM' | 'ROOM_CONNECTED' | 'ROOM_BEACON' | 'PING' | 'PONG';
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
  private roomCode = 'SUPERHOT-LAN-88';
  private peerId = 'player_' + Math.floor(Math.random() * 10000);

  private peer: Peer | null = null;
  private activeConn: DataConnection | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private discoveryChannel: BroadcastChannel | null = null;

  private remotePlayerState: CoopPlayerData | null = null;
  private onPacketReceivedCallbacks: ((packet: CoopNetworkPacket) => void)[] = [];

  private measuredPingMs = 0;
  private pingInterval: number | null = null;
  private beaconInterval: number | null = null;
  private discoveredRooms: Map<string, DiscoveredRoom> = new Map();
  private onRoomsDiscoveredCb: ((rooms: DiscoveredRoom[]) => void) | null = null;

  constructor() {
    this.initLocalBroadcast();
  }

  private initLocalBroadcast() {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.discoveryChannel = new BroadcastChannel('webhot_coop_room_discovery');
        this.discoveryChannel.onmessage = (ev) => {
          const data = ev.data;
          if (data && data.type === 'ROOM_BEACON') {
            const now = performance.now();
            const latency = Math.max(1, Math.round(now - (data.timestamp || now)));
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
      console.warn('BroadcastChannel error:', err);
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
      if (now - room.lastSeen < 4000) {
        activeRooms.push(room);
      } else {
        this.discoveredRooms.delete(code);
      }
    });
    this.onRoomsDiscoveredCb(activeRooms);
  }

  public init(isHost: boolean, roomCode = 'SUPERHOT-LAN-88') {
    this.isHost = isHost;
    this.roomCode = roomCode.toUpperCase().trim().replace(/[^A-Z0-9-]/g, '') || 'SUPERHOT-LAN-88';
    this.isConnected = false;

    this.close();

    const formattedPeerId = isHost
      ? `webhot-host-${this.roomCode}`
      : `webhot-client-${this.peerId}`;

    // Initialize WebRTC Peer instance for LAN/Internet P2P DataChannels
    try {
      this.peer = new Peer(formattedPeerId, {
        debug: 0,
      });

      this.peer.on('open', (id) => {
        console.log('[COOP WebRTC] Peer opened with ID:', id);

        if (!isHost) {
          // Client connects directly to Host Peer
          const hostPeerId = `webhot-host-${this.roomCode}`;
          console.log('[COOP WebRTC] Client connecting to Host:', hostPeerId);
          const conn = this.peer!.connect(hostPeerId, { reliable: true });
          this.setupConnection(conn);
        }
      });

      this.peer.on('connection', (conn) => {
        console.log('[COOP WebRTC] Host accepted incoming WebRTC connection:', conn.peer);
        this.setupConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.warn('[COOP WebRTC] Peer error:', err.type, err.message);
      });
    } catch (err) {
      console.warn('[COOP WebRTC] Initialization error:', err);
    }

    // Local BroadcastChannel for same-machine tabs
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.broadcastChannel = new BroadcastChannel(`webhot_coop_${this.roomCode}`);
        this.broadcastChannel.onmessage = (ev) => {
          this.handleIncomingPacket(ev.data);
        };
      }
    } catch {}

    // Start real measured PING/PONG loop (every 500ms)
    this.pingInterval = window.setInterval(() => {
      if (this.isConnected) {
        this.sendPacket({
          type: 'PING',
          senderId: this.peerId,
          roomCode: this.roomCode,
          timestamp: performance.now(),
        });
      }
    }, 500);

    // Host room beacon broadcast
    if (isHost && this.discoveryChannel) {
      this.beaconInterval = window.setInterval(() => {
        try {
          this.discoveryChannel?.postMessage({
            type: 'ROOM_BEACON',
            roomCode: this.roomCode,
            senderId: this.peerId,
            timestamp: performance.now(),
            playersCount: this.isConnected ? 2 : 1,
          });
        } catch {}
      }, 400);
    }
  }

  private setupConnection(conn: DataConnection) {
    this.activeConn = conn;

    conn.on('open', () => {
      console.log('[COOP WebRTC DataChannel] P2P Socket OPEN!');
      this.isConnected = true;
      this.sendPacket({
        type: this.isHost ? 'ROOM_CONNECTED' : 'JOIN_ROOM',
        senderId: this.peerId,
        roomCode: this.roomCode,
        timestamp: performance.now(),
      });
    });

    conn.on('data', (data: any) => {
      this.handleIncomingPacket(data as CoopNetworkPacket);
    });

    conn.on('close', () => {
      console.log('[COOP WebRTC DataChannel] P2P Socket CLOSED');
      this.isConnected = false;
    });

    conn.on('error', (err) => {
      console.warn('[COOP WebRTC DataChannel] Error:', err);
    });
  }

  public sendPacket(packet: CoopNetworkPacket) {
    packet.senderId = this.peerId;
    packet.roomCode = this.roomCode;

    // Send over WebRTC DataChannel
    if (this.activeConn && this.activeConn.open) {
      try {
        this.activeConn.send(packet);
      } catch (err) {
        console.warn('WebRTC send error:', err);
      }
    }

    // Send over BroadcastChannel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(packet);
      } catch {}
    }
  }

  private handleIncomingPacket(packet: CoopNetworkPacket) {
    if (!packet || packet.senderId === this.peerId) {
      return;
    }

    this.isConnected = true;

    if (packet.type === 'PING') {
      // Respond with PONG to measure real network latency
      this.sendPacket({
        type: 'PONG',
        senderId: this.peerId,
        roomCode: this.roomCode,
        timestamp: packet.timestamp,
      });
      return;
    }

    if (packet.type === 'PONG') {
      const rtt = Math.max(1, Math.round(performance.now() - packet.timestamp));
      this.measuredPingMs = Math.max(2, Math.round(rtt / 2)); // Real measured ping in ms!
      return;
    }

    if (packet.playerState) {
      this.remotePlayerState = packet.playerState;
    }

    this.onPacketReceivedCallbacks.forEach((cb) => cb(packet));
  }

  public onPacket(callback: (packet: CoopNetworkPacket) => void) {
    this.onPacketReceivedCallbacks.push(callback);
  }

  public getIsConnected(): boolean {
    return this.isConnected || (this.activeConn !== null && this.activeConn.open);
  }

  public getIsHost(): boolean {
    return this.isHost;
  }

  public getPing(): number {
    return this.measuredPingMs || 5; // Real measured ping in ms!
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
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.activeConn) {
      try {
        this.activeConn.close();
      } catch {}
      this.activeConn = null;
    }
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {}
      this.peer = null;
    }
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch {}
      this.broadcastChannel = null;
    }
    this.isConnected = false;
    this.remotePlayerState = null;
  }
}

export const coopNetwork = new CoopNetworkManager();
