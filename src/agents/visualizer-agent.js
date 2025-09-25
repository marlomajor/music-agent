function ensureCanvas(state) {
  if (state.waveCanvas && state.waveCtx) {
    return;
  }
  const canvas = document.getElementById("wave");
  if (!canvas) {
    return;
  }
  const ctx = canvas.getContext("2d");
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const cssWidth = canvas.clientWidth || canvas.width;
  const cssHeight = canvas.clientHeight || canvas.height;
  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(cssHeight * dpr);
  if (ctx) {
    ctx.scale(dpr, dpr);
  }
  state.waveCanvas = canvas;
  state.waveCtx = ctx;
}

export function startVisualizer(state, analyser) {
  ensureCanvas(state);
  const canvas = state.waveCanvas;
  const ctx = state.waveCtx;
  if (!canvas || !ctx) {
    return;
  }
  const data = new Uint8Array(analyser.fftSize);
  const width = canvas.width;
  const height = canvas.height;
  const barWidth = 6;
  const gap = 4;
  const step = barWidth + gap;
  const centerY = height / 2;
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, "#ff3b30");
  gradient.addColorStop(0.3, "#ff2d92");
  gradient.addColorStop(0.5, "#7f52ff");
  gradient.addColorStop(0.7, "#ff2d92");
  gradient.addColorStop(1, "#ff3b30");
  const draw = () => {
    state.waveAnimation = requestAnimationFrame(draw);
    analyser.getByteTimeDomainData(data);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = gradient;
    const bars = Math.floor(width / step);
    const slice = Math.max(1, Math.floor(data.length / bars));
    for (let i = 0; i < bars; i++) {
      const value = data[i * slice] / 128 - 1;
      const amplitude = Math.abs(value);
      const barHeight = Math.max(6, amplitude * (height * 0.9));
      const x = i * step + gap / 2;
      ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
    }
  };
  draw();
}

export function stopVisualizer(state) {
  if (state.waveAnimation) {
    cancelAnimationFrame(state.waveAnimation);
    state.waveAnimation = null;
  }
  if (state.waveCtx && state.waveCanvas) {
    state.waveCtx.clearRect(0, 0, state.waveCanvas.width, state.waveCanvas.height);
  }
}
