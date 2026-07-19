const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const startButton = document.getElementById('startButton');
const scoreP1El = document.getElementById('scoreP1');
const scoreP2El = document.getElementById('scoreP2');
const bestEl = document.getElementById('best');
const leaderboardList = document.getElementById('leaderboardList');

const tileSize = 24;
const widthInTiles = Math.floor(canvas.width / tileSize);
const heightInTiles = Math.floor(canvas.height / tileSize);

let players = [];
let food = [];
let particles = [];
let stars = [];
let gameLoop;
let bestScore = Number(localStorage.getItem('snakeio-best') || 0);
let running = false;
let lastTime = 0;
let accumulator = 0;
let flash = 0;

function resetGame() {
  players = [
    {
      id: 1,
      name: 'Player 1',
      dx: 1,
      dy: 0,
      body: [{ x: Math.floor(widthInTiles / 3), y: Math.floor(heightInTiles / 2) }],
      color: '#67f4ff',
      size: 1,
      score: 0,
      alive: true,
    },
    {
      id: 2,
      name: 'Player 2',
      dx: -1,
      dy: 0,
      body: [{ x: Math.floor((widthInTiles * 2) / 3), y: Math.floor(heightInTiles / 2) }],
      color: '#ff8f5f',
      size: 1,
      score: 0,
      alive: true,
    },
  ];

  food = [];
  for (let i = 0; i < 24; i += 1) {
    spawnFood();
  }

  particles = [];
  flash = 0;
  updateScoreboard();
  updateLeaderboard();
}

function spawnFood() {
  const x = Math.floor(Math.random() * widthInTiles);
  const y = Math.floor(Math.random() * heightInTiles);
  if (isOccupied(x, y)) return;
  food.push({ x, y, pulse: Math.random() * Math.PI * 2 });
}

function isOccupied(x, y) {
  if (players.some(player => player.body.some(segment => segment.x === x && segment.y === y))) return true;
  if (food.some(item => item.x === x && item.y === y)) return true;
  return false;
}

function wrapPosition(x, y) {
  let nx = x;
  let ny = y;
  if (nx < 0) nx = widthInTiles - 1;
  if (nx >= widthInTiles) nx = 0;
  if (ny < 0) ny = heightInTiles - 1;
  if (ny >= heightInTiles) ny = 0;
  return { x: nx, y: ny };
}

function startGame() {
  resetGame();
  running = true;
  overlay.classList.add('hidden');
  if (gameLoop) cancelAnimationFrame(gameLoop);
  lastTime = performance.now();
  accumulator = 0;
  gameLoop = requestAnimationFrame(loop);
}

function loop(time) {
  if (!running) return;
  const delta = Math.min(0.032, (time - lastTime) / 1000);
  lastTime = time;
  accumulator += delta;
  update(delta);
  draw();
  gameLoop = requestAnimationFrame(loop);
}

function update(delta) {
  const step = 0.14;
  while (accumulator >= step) {
    movePlayers();
    resolveCollisions();
    accumulator -= step;
  }
  updateParticles(delta);
  flash = Math.max(0, flash - delta * 1.2);
}

function movePlayers() {
  players.forEach(player => {
    if (!player.alive) return;
    const next = wrapPosition(player.body[0].x + player.dx, player.body[0].y + player.dy);
    player.body.unshift(next);
    if (player.body.length > player.size) {
      player.body.pop();
    }

    const foodIndex = food.findIndex(item => item.x === next.x && item.y === next.y);
    if (foodIndex >= 0) {
      food.splice(foodIndex, 1);
      player.size += 1;
      player.score += 12;
      bestScore = Math.max(bestScore, player.score);
      localStorage.setItem('snakeio-best', String(bestScore));
      flash = 0.2;
      spawnBurst(next.x * tileSize + tileSize / 2, next.y * tileSize + tileSize / 2, player.color, 16);
      spawnFood();
      updateScoreboard();
    }
  });
}

function resolveCollisions() {
  for (let i = 0; i < players.length; i += 1) {
    const player = players[i];
    if (!player.alive) continue;

    const head = player.body[0];
    const selfHit = player.body.slice(1).some(segment => segment.x === head.x && segment.y === head.y);
    if (selfHit) {
      player.alive = false;
      continue;
    }

    for (let j = 0; j < players.length; j += 1) {
      if (i === j) continue;
      const other = players[j];
      if (!other.alive) continue;

      const otherHead = other.body[0];
      const bodyHit = other.body.some(segment => segment.x === head.x && segment.y === head.y);
      if (head.x === otherHead.x && head.y === otherHead.y || bodyHit) {
        if (player.size > other.size) {
          other.alive = false;
          player.size += 1;
          player.score += 24;
          flash = 0.2;
          spawnBurst(head.x * tileSize + tileSize / 2, head.y * tileSize + tileSize / 2, '#fff09b', 18);
        } else if (player.size < other.size) {
          player.alive = false;
        } else {
          player.alive = false;
          other.alive = false;
        }
        updateScoreboard();
        break;
      }
    }
  }

  const survivors = players.filter(player => player.alive);
  if (survivors.length === 1) {
    endGame(survivors[0]);
  } else if (survivors.length === 0) {
    endGame(null);
  }
}

function endGame(winner) {
  if (!running) return;
  running = false;
  overlay.querySelector('h2').textContent = winner ? `${winner.name} wins!` : 'Round over';
  overlay.querySelector('p').textContent = winner
    ? `${winner.name} took the arena with ${winner.score} points.`
    : 'Both snakes were eliminated. Start another round and try again.';
  overlay.classList.remove('hidden');
  updateScoreboard();
  updateLeaderboard();
}

function updateScoreboard() {
  scoreP1El.textContent = String(players[0]?.score || 0);
  scoreP2El.textContent = String(players[1]?.score || 0);
  bestEl.textContent = String(bestScore);
}

function updateLeaderboard() {
  const entries = JSON.parse(localStorage.getItem('snakeio-ranks') || '[]');
  if (players.length) {
    entries.push({ name: 'P1', score: players[0].score });
    entries.push({ name: 'P2', score: players[1].score });
  }
  entries.sort((a, b) => b.score - a.score);
  const top = entries.slice(0, 5);
  localStorage.setItem('snakeio-ranks', JSON.stringify(top));
  leaderboardList.innerHTML = '';
  top.forEach((entry, index) => {
    const li = document.createElement('li');
    li.textContent = `${index + 1}. ${entry.name} — ${entry.score}`;
    leaderboardList.appendChild(li);
  });
}

function spawnBurst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count;
    const speed = 40 + Math.random() * 80;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.7 + Math.random() * 0.35,
      size: 2 + Math.random() * 4,
      color,
    });
  }
}

function updateParticles(delta) {
  particles = particles.filter(particle => particle.life > 0);
  for (const particle of particles) {
    particle.life -= delta;
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vx *= 0.96;
    particle.vy *= 0.96;
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#0e2d4f');
  gradient.addColorStop(0.5, '#081226');
  gradient.addColorStop(1, '#02050b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawStars();
  drawEnergyOrb();
  drawArena();
  drawFood();
  players.forEach(player => drawSnake(player));
  drawParticles();

  if (flash > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(255,255,255,${flash * 0.25})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
}

function drawStars() {
  if (!stars.length) {
    stars = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.6 + 0.4,
      alpha: Math.random() * 0.7 + 0.3,
    }));
  }

  stars.forEach(star => {
    ctx.save();
    ctx.globalAlpha = star.alpha;
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawEnergyOrb() {
  const time = performance.now() / 1000;
  const x = canvas.width * 0.78;
  const y = canvas.height * 0.24;
  const pulse = 1 + Math.sin(time * 1.8) * 0.12;

  const glow = ctx.createRadialGradient(x, y, 10, x, y, 120 * pulse);
  glow.addColorStop(0, 'rgba(103,244,255,0.9)');
  glow.addColorStop(1, 'rgba(103,244,255,0)');
  ctx.save();
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 120 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawArena() {
  const boardX = 18;
  const boardY = 18;
  const boardW = canvas.width - 36;
  const boardH = canvas.height - 36;

  ctx.save();
  ctx.shadowBlur = 40;
  ctx.shadowColor = 'rgba(61, 184, 255, 0.25)';
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  ctx.strokeRect(boardX, boardY, boardW, boardH);
  ctx.restore();

  ctx.save();
  ctx.translate(20, 20);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= widthInTiles * tileSize; x += tileSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, heightInTiles * tileSize);
    ctx.stroke();
  }
  for (let y = 0; y <= heightInTiles * tileSize; y += tileSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(widthInTiles * tileSize, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSnake(snake) {
  snake.body.forEach((segment, index) => {
    const x = segment.x * tileSize + 4;
    const y = segment.y * tileSize + 4;
    const size = tileSize - 8;

    ctx.save();
    ctx.translate(x + size / 2, y + size / 2);
    const gradient = ctx.createLinearGradient(-size / 2, -size / 2, size / 2, size / 2);
    gradient.addColorStop(0, snake.id === 1 ? '#ffffff' : '#ffe3d1');
    gradient.addColorStop(1, snake.color);
    ctx.fillStyle = gradient;
    ctx.shadowBlur = 24;
    ctx.shadowColor = snake.color;
    ctx.beginPath();
    ctx.roundRect(-size / 2, -size / 2, size, size, 8);
    ctx.fill();
    ctx.restore();

    if (index === 0 && snake.id === 1) {
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x + size * 0.3, y + size * 0.3, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });
}

function drawFood() {
  food.forEach(item => {
    const pulse = 1 + Math.sin(Date.now() / 280 + item.pulse) * 0.12;
    const x = item.x * tileSize + tileSize / 2;
    const y = item.y * tileSize + tileSize / 2;
    const r = (tileSize / 2 - 5) * pulse;

    ctx.save();
    const glow = ctx.createRadialGradient(x, y, 2, x, y, r + 6);
    glow.addColorStop(0, 'rgba(255,223,109,0.95)');
    glow.addColorStop(1, 'rgba(255,109,109,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r + 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#ffd166';
    ctx.shadowBlur = 18;
    ctx.shadowColor = '#ffe066';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawParticles() {
  particles.forEach(particle => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, particle.life / 0.8);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

window.addEventListener('keydown', event => {
  const key = event.key.toLowerCase();
  const controlMap = {
    arrowup: { player: 0, direction: { dx: 0, dy: -1 } },
    arrowdown: { player: 0, direction: { dx: 0, dy: 1 } },
    arrowleft: { player: 0, direction: { dx: -1, dy: 0 } },
    arrowright: { player: 0, direction: { dx: 1, dy: 0 } },
    w: { player: 1, direction: { dx: 0, dy: -1 } },
    s: { player: 1, direction: { dx: 0, dy: 1 } },
    a: { player: 1, direction: { dx: -1, dy: 0 } },
    d: { player: 1, direction: { dx: 1, dy: 0 } },
  };
  const control = controlMap[key];
  if (!control) return;
  event.preventDefault();
  const player = players[control.player];
  if (!player || !player.alive) return;
  const opposite = player.dx === -control.direction.dx && player.dy === -control.direction.dy;
  if (!opposite) {
    player.dx = control.direction.dx;
    player.dy = control.direction.dy;
  }
});

startButton.addEventListener('click', startGame);
overlay.addEventListener('click', event => {
  if (event.target === overlay) startGame();
});

resetGame();
draw();
