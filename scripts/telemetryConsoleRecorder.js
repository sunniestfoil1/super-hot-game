/**
 * Script de Telemetria F12 (Caixa Preta - Gravador Standalone Superhot)
 * 
 * COMO USAR:
 * 1. Abra o jogo no navegador.
 * 2. Pressione F12 para abrir as Ferramentas de Desenvolvedor (DevTools) e vá na aba "Console".
 * 3. Cole este código na íntegra e pressione ENTER.
 * 4. O script iniciará a gravação imediatamente e baixará automaticamente o JSON de diagnóstico a cada 30 segundos!
 */

(function startSuperhotTelemetryScript() {
  console.log("%c[SUPERHOT TELEMETRIA F12] Gravador ativado via Console DevTools!", "color: #ff0055; font-weight: bold; font-size: 14px;");

  const telemetry = window.__SUPERHOT_TELEMETRY__;
  if (!telemetry) {
    console.warn("[SUPERHOT TELEMETRIA F12] Objeto window.__SUPERHOT_TELEMETRY__ não encontrado. Certifique-se de que o jogo está carregado.");
    return;
  }

  if (!telemetry.isRecording()) {
    telemetry.startRecording();
    console.log("%c[SUPERHOT TELEMETRIA F12] Gravação iniciada com sucesso (F8 / F12 Auto-Download 30s).", "color: #00ff88; font-weight: bold;");
  } else {
    console.log("%c[SUPERHOT TELEMETRIA F12] Gravação já estava em andamento.", "color: #ffcc00; font-weight: bold;");
  }

  let secondsCounter = 0;
  const timer = setInterval(() => {
    secondsCounter++;
    const frame = telemetry.getLatestFrame();
    if (frame) {
      console.log(`[F12 REC ${secondsCounter}s] FPS: ${frame.fps} | Calls: ${frame.drawCalls} | Tris: ${frame.triangles} | Mem: ${frame.usedHeapMB}MB | Inimigos: ${frame.enemies} (Dissolvendo: ${frame.enemiesDissolving})`);
    }

    if (secondsCounter % 30 === 0) {
      console.log("%c[SUPERHOT TELEMETRIA F12] ⏱️ 30 segundos atingidos! Disparando Auto-Download do Relatório JSON...", "color: #00e5ff; font-weight: bold;");
      telemetry.exportJson();
    }
  }, 1000);

  window.__STOP_SUPERHOT_TELEMETRY__ = function stop() {
    clearInterval(timer);
    const report = telemetry.stopRecording();
    if (report) {
      telemetry.exportJson();
      console.log("%c[SUPERHOT TELEMETRIA F12] Gravação finalizada e arquivo JSON baixado.", "color: #00ff88; font-weight: bold;");
    }
  };

  console.log("%c[DICA] Para parar manualmente antes dos 30s e baixar, digite window.__STOP_SUPERHOT_TELEMETRY__() no console.", "color: #aaa; font-style: italic;");
})();
