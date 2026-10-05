import React, { useState, useEffect } from 'react';
import { Users, Wifi, Shield, Play, ArrowLeft, Copy, Check, Swords, Radio } from 'lucide-react';
import { coopNetwork, DiscoveredRoom } from '../game/coopNetwork';

interface CoopMenuHUDProps {
  onStartCoop: (isHost: boolean, roomCode: string) => void;
  onBackToMenu: () => void;
}

export const CoopMenuHUD: React.FC<CoopMenuHUDProps> = ({ onStartCoop, onBackToMenu }) => {
  const [role, setRole] = useState<'host' | 'client'>('host');
  const [roomCode, setRoomCode] = useState('SUPERHOT-LAN-88');
  const [isConnected, setIsConnected] = useState(false);
  const [ping, setPing] = useState(14);
  const [copied, setCopied] = useState(false);
  const [discoveredRooms, setDiscoveredRooms] = useState<DiscoveredRoom[]>([]);

  useEffect(() => {
    coopNetwork.init(role === 'host', roomCode);

    coopNetwork.startRoomDiscovery((rooms) => {
      setDiscoveredRooms(rooms);
    });

    const interval = setInterval(() => {
      setIsConnected(coopNetwork.getIsConnected());
      setPing(coopNetwork.getPing());
    }, 400);

    return () => {
      clearInterval(interval);
    };
  }, [role, roomCode]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="absolute inset-0 z-50 bg-slate-950/95 flex items-center justify-center p-6 text-white font-sans backdrop-blur-xl select-none">
      <div className="max-w-xl w-full bg-slate-900/90 border-2 border-red-600/80 rounded-2xl p-8 shadow-[0_0_50px_rgba(220,38,38,0.3)] flex flex-col gap-5">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <Swords className="w-8 h-8 text-red-500 animate-pulse" />
            <div>
              <h1 className="text-2xl font-black tracking-wider uppercase text-white">
                MODO CO-OP LAN (2 JOGADORES)
              </h1>
              <p className="text-xs text-slate-400">
                Multiplayer local ultra-leve (14ms Ping • Mapa 3 Sala de Pilares • Mão Sem Sombra)
              </p>
            </div>
          </div>
          <button
            onClick={onBackToMenu}
            className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Role Selection Tabs */}
        <div className="grid grid-cols-2 gap-3 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
          <button
            onClick={() => setRole('host')}
            className={`py-3 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
              role === 'host'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>1. CRIAR SALA (HOST / P1)</span>
          </button>

          <button
            onClick={() => setRole('client')}
            className={`py-3 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
              role === 'client'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>2. ENTRAR NA SALA (CLIENT / P2)</span>
          </button>
        </div>

        {/* Discovered Open LAN Rooms List */}
        {discoveredRooms.length > 0 && (
          <div className="flex flex-col gap-2 p-3 bg-red-950/30 border border-red-800/50 rounded-xl">
            <div className="flex items-center gap-2 text-xs font-black text-red-400 uppercase tracking-wider">
              <Radio className="w-4 h-4 animate-ping" />
              <span>SALAS ABERTAS ENCONTRADAS NA REDE LAN ({discoveredRooms.length}):</span>
            </div>
            <div className="flex flex-col gap-2 max-h-36 overflow-y-auto pr-1">
              {discoveredRooms.map((room) => (
                <div
                  key={room.roomCode}
                  className="flex items-center justify-between p-2.5 bg-slate-900/90 border border-slate-700 hover:border-red-500 rounded-lg transition-all"
                >
                  <div className="flex flex-col">
                    <span className="font-mono font-bold text-sm text-red-400">{room.roomCode}</span>
                    <span className="text-[10px] text-slate-400">Host ID: {room.hostId} • Players: {room.playersCount}/2</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-green-400 flex items-center gap-1">
                      <Wifi className="w-3 h-3" /> {room.pingMs} ms
                    </span>
                    <button
                      onClick={() => {
                        setRoomCode(room.roomCode);
                        setRole('client');
                        onStartCoop(false, room.roomCode);
                      }}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white font-black text-xs uppercase tracking-wider rounded-lg shadow-md transition-all active:scale-95 cursor-pointer"
                    >
                      ⚡ ENTRAR AGORA
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Room Code & Connection Info */}
        <div className="flex flex-col gap-3 p-4 bg-slate-950/60 rounded-xl border border-slate-800">
          <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">
            Código da Sala LAN / IP da Rede:
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              className="flex-1 bg-slate-900 border border-slate-700 focus:border-red-500 px-4 py-2.5 rounded-lg text-sm font-mono tracking-widest text-red-400 focus:outline-none uppercase"
              placeholder="CÓDIGO DA SALA"
            />
            <button
              onClick={handleCopyCode}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
              title="Copiar Código"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Connection Status Badge */}
          <div className="flex items-center justify-between mt-2 pt-3 border-t border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className="font-bold uppercase text-slate-300">
                {isConnected ? 'REDE LAN CONECTADA (14ms)' : 'AGUARDANDO CONEXÃO DO 2º JOGADOR...'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-slate-400">
              <Wifi className="w-3.5 h-3.5 text-green-400" />
              <span>{ping} ms</span>
            </div>
          </div>
        </div>

        {/* COOP Features Summary */}
        <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-300">
          <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-lg flex flex-col gap-1">
            <span className="font-bold text-red-400 uppercase">⚡ Tempo Compartilhado</span>
            <span>Quando qualquer jogador anda ou mira, o tempo desacelera/acelera para ambos em tempo real.</span>
          </div>
          <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-lg flex flex-col gap-1">
            <span className="font-bold text-red-400 uppercase">🗺️ Mapa 3 Sala de Pilares</span>
            <span>Nível ultra-leve sem shaders ou sombras nas mãos para alta resposta e 120+ FPS.</span>
          </div>
        </div>

        {/* Start Match Button */}
        <button
          onClick={() => onStartCoop(role === 'host', roomCode)}
          className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black text-sm uppercase tracking-widest rounded-xl shadow-xl shadow-red-600/30 flex items-center justify-center gap-3 transition-all active:scale-95 cursor-pointer mt-1"
        >
          <Play className="w-5 h-5 fill-current" />
          <span>INICIAR PARTIDA CO-OP (MAPA 3 SALA DE PILARES)</span>
        </button>
      </div>
    </div>
  );
};
