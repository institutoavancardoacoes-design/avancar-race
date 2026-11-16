// ==========================================
// AVANÇAR RACE 4.1
// INSTITUTO AVANÇAR
// MULTIPLAYER - 12 JOGADORES
// MOVIMENTAÇÃO CORRIGIDA
// ==========================================

// ==========================================
// ANIMAIS
// ==========================================

const animals = [
  { name: "Leão", file: "leao.png", emoji: "🦁" },
  { name: "Tigre", file: "tigre.png", emoji: "🐯" },
  { name: "Coelho", file: "coelho.png", emoji: "🐰" },
  { name: "Raposa", file: "raposa.png", emoji: "🦊" },
  { name: "Panda", file: "panda.png", emoji: "🐼" },
  { name: "Tartaruga", file: "tartaruga.png", emoji: "🐢" },
  { name: "Macaco", file: "macaco.png", emoji: "🐵" },
  { name: "Lobo", file: "lobo.png", emoji: "🐺" },
  { name: "Urso", file: "urso.png", emoji: "🐻" },
  { name: "T-Rex", file: "t-rex.png", emoji: "🦖" },
  { name: "Dragão", file: "dragão.png", emoji: "🐉" },
  { name: "Rinoceronte", file: "rinoceronte.png", emoji: "🦏" }
];

// ==========================================
// ELEMENTOS
// ==========================================

const $ = id => document.getElementById(id);

const dbRace = supabaseClient;

// ==========================================
// VARIÁVEIS
// ==========================================

let selectedAnimalIndex = 0;

let playerName = "";
let playerId = null;

let roomId = null;
let roomCode = "";

let currentText = "";
let typedText = "";

let correctChars = 0;
let errors = 0;
let totalTyped = 0;

let startTime = 0;
let endTime = 0;

let raceActive = false;
let finished = false;

let roomStatus = "aguardando";

let players = [];

let roomChannel = null;

let syncInterval = null;
let timerInterval = null;
let countdownInterval = null;

let lastProgressSent = -1;
let lastSyncTime = 0;

let loadingRoom = false;
let loadingPlayers = false;

let raceStarted = false;
let showingResults = false;

// Controle de sincronização de progresso
let progressSyncTimer = null;
let progressSyncRunning = false;
let progressSyncPending = false;

// ==========================================
// CONTROLE DE TELAS
// ==========================================

function showScreen(id) {

  document.querySelectorAll(".screen").forEach(screen => {

    screen.classList.toggle(
      "active",
      screen.id === id
    );

  });

  window.scrollTo(0, 0);
}

// ==========================================
// MENSAGENS
// ==========================================

function showMessage(id, message = "") {

  const element = $(id);

  if (element) {
    element.textContent = message;
  }
}

// ==========================================
// SPRITES DOS ANIMAIS
// ==========================================

function sprite(element, animal) {

  element.classList.add("animal-sprite");

  const imagePath =
    `assets/animais/${encodeURIComponent(animal.file)}`;

  element.style.backgroundImage =
    `url("${imagePath}")`;

  element.setAttribute("aria-label", animal.name);

  const image = new Image();

  image.onerror = () => {

    element.classList.add("sprite-missing");
    element.textContent = animal.emoji;

  };

  image.src = imagePath;
}

// ==========================================
// CARREGAR PERSONAGENS
// ==========================================

function loadCharacters() {

  const container = $("characters");

  container.replaceChildren();

  animals.forEach((animal, index) => {

    const button = document.createElement("button");

    button.type = "button";
    button.className = "character";

    if (index === selectedAnimalIndex) {
      button.classList.add("selected");
    }

    button.setAttribute(
      "aria-label",
      `Selecionar ${animal.name}`
    );

    const preview = document.createElement("span");

    preview.className = "character-preview";

    sprite(preview, animal);

    const title = document.createElement("small");

    title.textContent = animal.name;

    button.appendChild(preview);
    button.appendChild(title);

    button.addEventListener("click", () => {

      if (roomId) return;

      selectedAnimalIndex = index;

      document.querySelectorAll(".character")
        .forEach(item => {
          item.classList.remove("selected");
        });

      button.classList.add("selected");
    });

    container.appendChild(button);
  });
}

// ==========================================
// AUTENTICAÇÃO DO ALUNO
// ==========================================

async function ensureStudentSession() {

  let {
    data: { session },
    error
  } = await dbRace.auth.getSession();

  if (error) throw error;

  if (!session) {

    const result =
      await dbRace.auth.signInAnonymously();

    if (result.error) {
      throw result.error;
    }

    session = result.data.session;
  }

  if (!session?.user?.is_anonymous) {

    throw new Error(
      "Este navegador está conectado como professor. " +
      "Abra o jogo em uma janela anônima ou outro navegador."
    );
  }

  return session;
}

// ==========================================
// ENTRAR NA SALA
// ==========================================

async function startGame() {

  if (roomId) return;

  const nameInput = $("playerName");
  const codeInput = $("roomCodeInput");
  const joinButton = $("joinBtn");

  playerName = nameInput.value.trim().slice(0, 20);

  roomCode = codeInput.value
    .trim()
    .toUpperCase();

  showMessage("setupMessage");

  if (!playerName) {

    showMessage(
      "setupMessage",
      "Digite seu nome para participar!"
    );

    nameInput.focus();
    return;
  }

  if (roomCode.length !== 6) {

    showMessage(
      "setupMessage",
      "Digite o código de seis caracteres da sala."
    );

    codeInput.focus();
    return;
  }

  joinButton.disabled = true;

  showMessage(
    "setupMessage",
    "Conectando à corrida..."
  );

  try {

    await ensureStudentSession();

    const animal = animals[selectedAnimalIndex];

    const { data, error } =
      await dbRace.rpc("entrar_na_sala", {

        p_codigo: roomCode,
        p_nome: playerName,
        p_animal: animal.name

      });

    if (error) throw error;

    if (!data || !data.length) {
      throw new Error("Não foi possível entrar na sala.");
    }

    playerId = data[0].jogador_id;
    roomId = data[0].sala_id;
    currentText = data[0].texto;

    $("waitingCode").textContent = roomCode;

    showScreen("waiting");

    await loadPlayers();
    await loadRoom();

    subscribeRoom();
    startSynchronization();

  } catch (error) {

    console.error(error);

    showMessage(
      "setupMessage",
      error.message
    );

    joinButton.disabled = false;
  }
}

// ==========================================
// CONSULTAR JOGADORES
// ==========================================

async function loadPlayers() {

  if (!roomId || loadingPlayers) return;

  loadingPlayers = true;

  try {

    const { data, error } = await dbRace
      .from("jogadores")
      .select(
        "id,nome,animal,progresso,precisao," +
        "velocidade,erros,finalizou,tempo_final"
      )
      .eq("sala_id", roomId);

    if (error) throw error;

    players = data || [];

    updateWaitingPlayers();

    // CORREÇÃO PRINCIPAL:
    // Não recriar a pista a cada atualização.

    if ($("race").classList.contains("active")) {

      updateRunnerLabels();

      updateAllRunners();

      updateRanking();
    }

  } catch (error) {

    console.error(
      "Erro ao consultar jogadores:",
      error.message
    );

  } finally {

    loadingPlayers = false;
  }
}

// ==========================================
// SALA DE ESPERA
// ==========================================

function updateWaitingPlayers() {

  const container = $("waitingPlayers");

  container.replaceChildren();

  $("waitingCount").textContent =
    `${players.length}/12`;

  players.forEach(player => {

    const animal = animals.find(
      item => item.name === player.animal
    );

    const item = document.createElement("div");

    item.className = "waiting-person";

    item.textContent =
      `${animal?.emoji || "🏃"} ${player.nome}`;

    if (player.id === playerId) {
      item.textContent += " (VOCÊ)";
    }

    container.appendChild(item);
  });
}

// ==========================================
// CONSULTAR SALA
// ==========================================

async function loadRoom() {

  if (!roomId || loadingRoom) return;

  loadingRoom = true;

  try {

    const { error: syncError } =
      await dbRace.rpc("sincronizar_corrida", {
        p_sala_id: roomId
      });

    if (syncError) throw syncError;

    const { data, error } = await dbRace
      .from("salas")
      .select("id,codigo,status,inicio,texto")
      .eq("id", roomId)
      .single();

    if (error) throw error;

    roomStatus = data.status;
    currentText = data.texto;

    if (roomStatus === "aguardando") {

      showMessage(
        "waitingStatus",
        "⏳ Aguardando o professor iniciar..."
      );
    }

    if (
      roomStatus === "contagem" ||
      roomStatus === "correndo"
    ) {

      if (!raceStarted) {
        prepareRace(data.inicio);
      }
    }

    if (roomStatus === "finalizada") {

      await loadPlayers();
      showFinalResults();
    }

  } catch (error) {

    console.error(
      "Erro ao sincronizar sala:",
      error.message
    );

  } finally {

    loadingRoom = false;
  }
}

// ==========================================
// REALTIME
// ==========================================

function subscribeRoom() {

  if (roomChannel) {
    dbRace.removeChannel(roomChannel);
  }

  roomChannel = dbRace
    .channel(`race-${roomId}`)

    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "jogadores",
        filter: `sala_id=eq.${roomId}`
      },
      () => loadPlayers()
    )

    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "salas",
        filter: `id=eq.${roomId}`
      },
      () => loadRoom()
    )

    .subscribe();
}

// ==========================================
// SINCRONIZAÇÃO PERIÓDICA
// ==========================================

function startSynchronization() {

  if (syncInterval) {
    clearInterval(syncInterval);
  }

  syncInterval = setInterval(async () => {

    if (!roomId) return;

    await loadRoom();
    await loadPlayers();

  }, 2000);
}

// ==========================================
// PREPARAR CORRIDA
// ==========================================

function prepareRace(startTimestamp) {

  if (raceStarted) return;

  const timestamp =
    new Date(startTimestamp).getTime();

  if (!Number.isFinite(timestamp)) {
    console.error("Horário de largada inválido.");
    return;
  }

  raceStarted = true;

  raceActive = false;
  finished = false;

  typedText = "";

  correctChars = 0;
  errors = 0;
  totalTyped = 0;

  endTime = 0;
  startTime = timestamp;

  const input = $("typingInput");

  input.value = "";
  input.disabled = true;
  input.maxLength = currentText.length;

  $("timer").textContent = "00:00";
  $("progress").textContent = "0%";
  $("accuracy").textContent = "100%";
  $("speed").textContent = "0";
  $("correctChars").textContent = "0";
  $("errors").textContent = "0";

  $("typingStatus").textContent =
    "AGUARDANDO LARGADA";

  showScreen("race");

  // Criar a pista somente uma vez.
  createTrack();

  renderText();
  updateRanking();

  countdown();
}

// ==========================================
// CONTAGEM REGRESSIVA
// ==========================================

function countdown() {

  const overlay = $("countdown");
  const number = $("countdownNumber");

  overlay.classList.remove("hidden");

  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  function tick() {

    const remaining = Math.ceil(
      (startTime - Date.now()) / 1000
    );

    if (remaining > 0) {

      number.textContent =
        Math.min(remaining, 3);

    } else {

      clearInterval(countdownInterval);
      countdownInterval = null;

      number.textContent = "🚀 AVANÇAR!";

      setTimeout(() => {
        overlay.classList.add("hidden");
      }, 500);

      beginRace();
    }
  }

  tick();

  if (!raceActive) {
    countdownInterval = setInterval(tick, 100);
  }
}

// ==========================================
// INICIAR DIGITAÇÃO
// ==========================================

function beginRace() {

  if (raceActive || finished) return;

  raceActive = true;

  const input = $("typingInput");

  input.disabled = false;
  input.focus();

  $("typingStatus").textContent =
    "🏁 CORRIDA INICIADA";

  if (timerInterval) {
    clearInterval(timerInterval);
  }

  timerInterval = setInterval(() => {

    updateTimer();
    updateSpeed();

  }, 250);
}

// ==========================================
// CRIAR PISTA
// ==========================================

function createTrack() {

  const track = $("track");

  // Só criar os corredores se ainda não existem.
  if (track.dataset.created === "true") {
    updateRunnerLabels();
    updateAllRunners();
    return;
  }

  track.replaceChildren();

  animals.forEach((animal, index) => {

    const lane = document.createElement("div");

    lane.className = "lane";

    const label = document.createElement("span");

    label.className = "runner-label";

    const runner = document.createElement("div");

    runner.className = "runner";
    runner.id = `runner-${index}`;

    // Transição suave entre posições.
    runner.style.transition =
      "left 450ms linear";

    sprite(runner, animal);

    lane.appendChild(label);
    lane.appendChild(runner);

    track.appendChild(lane);
  });

  track.dataset.created = "true";

  updateRunnerLabels();

  requestAnimationFrame(() => {
    updateAllRunners();
  });
}

// ==========================================
// ATUALIZAR NOMES DOS CORREDORES
// ==========================================

function updateRunnerLabels() {

  animals.forEach((animal, index) => {

    const runner = $(`runner-${index}`);

    if (!runner) return;

    const lane = runner.parentElement;

    const label =
      lane.querySelector(".runner-label");

    const player = players.find(
      item => item.animal === animal.name
    );

    if (player) {

      label.textContent =
        player.id === playerId
          ? `${player.nome} (VOCÊ)`
          : player.nome;

      lane.classList.toggle(
        "player-lane",
        player.id === playerId
      );

    } else {

      label.textContent =
        `${animal.name} · DISPONÍVEL`;

      lane.classList.remove("player-lane");
    }
  });
}

// ==========================================
// MOVIMENTAR UM ANIMAL
// ==========================================

function moveRunner(index, progress, animate = true) {

  const runner = $(`runner-${index}`);

  if (!runner) return;

  const lane = runner.parentElement;

  const start = Math.min(
    180,
    Math.max(95, lane.clientWidth * 0.20)
  );

  const finish = Math.max(
    start,
    lane.clientWidth -
    runner.offsetWidth -
    27
  );

  const safeProgress = Math.max(
    0,
    Math.min(100, Number(progress) || 0)
  );

  const position =
    start +
    (finish - start) *
    safeProgress / 100;

  // Evita animações repetidas quando
  // o progresso não mudou.

  const previousProgress =
    Number(runner.dataset.progress || 0);

  if (
    runner.dataset.initialized !== "true"
  ) {

    // Primeira posição sem transição.
    runner.style.transition = "none";
    runner.style.left = `${position}px`;

    runner.dataset.initialized = "true";
    runner.dataset.progress = safeProgress;

    // Forçar o navegador a aplicar a posição.
    void runner.offsetWidth;

    runner.style.transition =
      "left 450ms linear";

    return;
  }

  if (
    Math.abs(previousProgress - safeProgress) < 0.01
  ) {
    return;
  }

  runner.dataset.progress = safeProgress;

  // Movimento sem recriar o corredor.
  runner.style.left = `${position}px`;

  if (animate && safeProgress > previousProgress) {

    runner.classList.add("running");

    clearTimeout(runner.animationTimer);

    runner.animationTimer = setTimeout(() => {

      runner.classList.remove("running");

    }, 650);
  }
}

// ==========================================
// ATUALIZAR TODOS OS CORREDORES
// ==========================================

function updateAllRunners() {

  animals.forEach((animal, index) => {

    const player = players.find(
      item => item.animal === animal.name
    );

    let progress =
      Number(player?.progresso || 0);

    if (player?.id === playerId) {

      progress = Math.max(
        progress,
        calculateProgress()
      );
    }

    // Animar somente se a posição avançou.
    const runner = $(`runner-${index}`);

    const previous =
      Number(runner?.dataset.progress || 0);

    moveRunner(
      index,
      progress,
      progress > previous
    );
  });
}

// ==========================================
// TEXTO DA CORRIDA
// ==========================================

function renderText() {

  const display = $("textDisplay");

  display.replaceChildren();

  const fragment =
    document.createDocumentFragment();

  for (let i = 0; i < currentText.length; i++) {

    const span = document.createElement("span");

    span.textContent = currentText[i];

    if (i < typedText.length) {

      span.className =
        typedText[i] === currentText[i]
          ? "correct"
          : "incorrect";

    } else if (i === typedText.length) {

      span.className = "current";
    }

    fragment.appendChild(span);
  }

  display.appendChild(fragment);
}

// ==========================================
// CALCULAR PROGRESSO
// ==========================================

function calculateProgress() {

  if (!currentText.length) return 0;

  let validChars = 0;

  for (let i = 0; i < typedText.length; i++) {

    if (typedText[i] !== currentText[i]) {
      break;
    }

    validChars++;
  }

  return Math.min(
    100,
    Math.round(
      validChars / currentText.length * 100
    )
  );
}

// ==========================================
// CRONÔMETRO
// ==========================================

function updateTimer() {

  if (!startTime) return;

  const seconds = Math.max(
    0,
    Math.floor(
      ((endTime || Date.now()) - startTime) / 1000
    )
  );

  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;

  $("timer").textContent =
    `${String(minutes).padStart(2, "0")}:` +
    `${String(remaining).padStart(2, "0")}`;
}

// ==========================================
// VELOCIDADE
// ==========================================

function calculateSpeed() {

  if (!startTime) return 0;

  const elapsed = Math.max(
    1000,
    (endTime || Date.now()) - startTime
  );

  return Math.round(
    (correctChars / 5) / (elapsed / 60000)
  );
}

function updateSpeed() {

  $("speed").textContent =
    calculateSpeed();
}

// ==========================================
// ESTATÍSTICAS
// ==========================================

function updateStats() {

  correctChars = 0;

  for (let i = 0; i < typedText.length; i++) {

    if (typedText[i] === currentText[i]) {
      correctChars++;
    }
  }

  const progress = calculateProgress();

  const accuracy = totalTyped
    ? Math.round(
        Math.max(
          0,
          100 * (totalTyped - errors) / totalTyped
        )
      )
    : 100;

  $("progress").textContent = `${progress}%`;
  $("accuracy").textContent = `${accuracy}%`;

  $("correctChars").textContent = correctChars;
  $("errors").textContent = errors;

  moveRunner(
    selectedAnimalIndex,
    progress,
    true
  );

  updateSpeed();
  renderText();
  updateRanking();

  scheduleProgressSync();
}

// ==========================================
// AGENDAR SINCRONIZAÇÃO
// ==========================================

function scheduleProgressSync() {

  if (progressSyncTimer) {
    clearTimeout(progressSyncTimer);
  }

  const elapsed =
    Date.now() - lastSyncTime;

  const delay = Math.max(
    0,
    400 - elapsed
  );

  progressSyncTimer = setTimeout(() => {

    progressSyncTimer = null;

    sendProgress(false);

  }, delay);
}

// ==========================================
// ENVIAR PROGRESSO AO SUPABASE
// ==========================================

async function sendProgress(completed = false) {

  if (!playerId || !roomId) return;

  if (progressSyncRunning) {

    progressSyncPending = true;
    return;
  }

  const progress = calculateProgress();

  if (
    progress === lastProgressSent &&
    !completed
  ) {
    return;
  }

  progressSyncRunning = true;

  const accuracy = Number(
    $("accuracy").textContent.replace("%", "")
  );

  const payload = {

    progresso: completed ? 100 : progress,
    precisao: accuracy,
    velocidade: calculateSpeed(),
    erros: errors

  };

  if (completed) {

    payload.finalizou = true;

    payload.tempo_final = Number(
      ((endTime - startTime) / 1000).toFixed(2)
    );
  }

  try {

    const { error } = await dbRace
      .from("jogadores")
      .update(payload)
      .eq("id", playerId);

    if (error) throw error;

    lastProgressSent = payload.progresso;
    lastSyncTime = Date.now();

    showMessage("raceMessage", "");

  } catch (error) {

    console.error(
      "Erro ao sincronizar progresso:",
      error.message
    );

    showMessage(
      "raceMessage",
      "⚠️ Falha ao sincronizar. Verifique a conexão."
    );

  } finally {

    progressSyncRunning = false;

    if (progressSyncPending) {

      progressSyncPending = false;

      // Se o aluno terminou enquanto uma
      // atualização estava em andamento,
      // enviar o resultado completo.

      sendProgress(finished);
    }
  }
}

// ==========================================
// DIGITAÇÃO
// ==========================================

$("typingInput").addEventListener("input", event => {

  if (!raceActive || finished) {

    event.target.value = typedText;
    return;
  }

  const next = event.target.value.slice(
    0,
    currentText.length
  );

  if (next.length > typedText.length) {

    for (
      let i = typedText.length;
      i < next.length;
      i++
    ) {

      totalTyped++;

      if (next[i] !== currentText[i]) {
        errors++;
      }
    }
  }

  typedText = next;

  event.target.value = next;

  updateStats();

  if (typedText === currentText) {
    finishRace();
  }
});

// ==========================================
// RANKING
// ==========================================

function sortedPlayers() {

  return [...players].sort((a, b) => {

    if (a.finalizou !== b.finalizou) {
      return a.finalizou ? -1 : 1;
    }

    if (a.finalizou && b.finalizou) {

      return (
        Number(a.tempo_final) -
        Number(b.tempo_final)
      );
    }

    return (
      Number(b.progresso) -
      Number(a.progresso)
    );
  });
}

function updateRanking() {

  const ranking = $("ranking");

  ranking.replaceChildren();

  const ordered = sortedPlayers();

  ordered.forEach((player, index) => {

    const animal = animals.find(
      item => item.name === player.animal
    );

    const item = document.createElement("div");

    item.className = "rank-item";

    const name = document.createElement("span");

    const medal =
      ["🥇", "🥈", "🥉"][index] ||
      `${index + 1}º`;

    name.textContent =
      `${medal} ${animal?.emoji || "🏃"} ` +
      player.nome +
      (player.id === playerId ? " (VOCÊ)" : "");

    const score = document.createElement("strong");

    score.textContent = player.finalizou
      ? `${Number(player.tempo_final).toFixed(1)}s`
      : `${Math.round(player.progresso)}%`;

    item.appendChild(name);
    item.appendChild(score);

    ranking.appendChild(item);
  });
}

// ==========================================
// FINALIZAR DIGITAÇÃO
// ==========================================

async function finishRace() {

  if (finished) return;

  finished = true;
  raceActive = false;

  endTime = Date.now();

  clearInterval(timerInterval);
  clearTimeout(progressSyncTimer);

  progressSyncTimer = null;

  updateTimer();
  updateSpeed();

  $("typingInput").disabled = true;

  $("typingStatus").textContent =
    "✅ VOCÊ TERMINOU!";

  showMessage(
    "raceMessage",
    "🏆 Você concluiu! Aguarde os outros competidores."
  );

  await sendProgress(true);

  await loadPlayers();
  await loadRoom();
}

// ==========================================
// RESULTADO FINAL
// ==========================================

function showFinalResults() {

  if (showingResults) return;

  showingResults = true;
  raceActive = false;

  clearInterval(timerInterval);
  clearInterval(countdownInterval);

  $("countdown").classList.add("hidden");
  $("typingInput").disabled = true;

  const ordered = sortedPlayers();

  const winner = $("winner");

  winner.replaceChildren();

  const title = document.createElement("h3");

  title.textContent =
    "🏆 CLASSIFICAÇÃO FINAL";

  winner.appendChild(title);

  ordered.forEach((player, index) => {

    const animal = animals.find(
      item => item.name === player.animal
    );

    const item = document.createElement("div");

    item.className = "rank-item";

    item.style.margin = "12px 0";
    item.style.padding = "15px";

    const name = document.createElement("span");

    const medal =
      ["🥇", "🥈", "🥉"][index] ||
      `${index + 1}º`;

    name.textContent =
      `${medal} ${animal?.emoji || "🏃"} ` +
      player.nome;

    const score = document.createElement("strong");

    score.textContent = player.finalizou
      ? `${Number(player.tempo_final).toFixed(2)}s`
      : `${Math.round(player.progresso)}%`;

    item.appendChild(name);
    item.appendChild(score);

    winner.appendChild(item);
  });

  showScreen("result");
}

// ==========================================
// REDIMENSIONAMENTO
// ==========================================

window.addEventListener("resize", () => {

  if ($("race").classList.contains("active")) {

    // Recalcular posições sem recriar a pista.
    updateAllRunners();
  }
});

// ==========================================
// INICIALIZAÇÃO
// ==========================================

loadCharacters();

console.log(
  "AVANÇAR RACE 4.1 — Multiplayer corrigido!"
);
// ==========================================
// AVANÇAR RACE 4.2
// SISTEMA DE HABILIDADES ESPECIAIS
// INSTITUTO AVANÇAR
// ==========================================

// HABILIDADES DOS 12 ANIMAIS

const habilidadesAnimais = {
  "Leão": {
    nome: "RUGIDO DO REI",
    efeito: "🦁🔊",
    classe: "habilidade-leao"
  },

  "Tigre": {
    nome: "TURBO ELÉTRICO",
    efeito: "⚡⚡",
    classe: "habilidade-tigre"
  },

  "Coelho": {
    nome: "SUPER SALTO",
    efeito: "✨🐰",
    classe: "habilidade-coelho"
  },

  "Raposa": {
    nome: "VELOCIDADE FANTASMA",
    efeito: "💨💨",
    classe: "habilidade-raposa"
  },

  "Panda": {
    nome: "CAMBALHOTA",
    efeito: "🌟🐼",
    classe: "habilidade-panda"
  },

  "Tartaruga": {
    nome: "GIRO DO CASCO",
    efeito: "🌀🐢",
    classe: "habilidade-tartaruga"
  },

  "Macaco": {
    nome: "SALTO ACROBÁTICO",
    efeito: "🙈✨",
    classe: "habilidade-macaco"
  },

  "Lobo": {
    nome: "UIVO SELVAGEM",
    efeito: "🌙🐺",
    classe: "habilidade-lobo"
  },

  "Urso": {
    nome: "IMPACTO PODEROSO",
    efeito: "💥🐻",
    classe: "habilidade-urso"
  },

  "T-Rex": {
    nome: "RUGIDO JURÁSSICO",
    efeito: "🦖💥",
    classe: "habilidade-trex"
  },

  "Dragão": {
    nome: "FOGO DO DRAGÃO",
    efeito: "🔥🔥🔥",
    classe: "habilidade-dragao"
  },

  "Rinoceronte": {
    nome: "ARRANCADA SELVAGEM",
    efeito: "💨🦏",
    classe: "habilidade-rinoceronte"
  }
};


// ==========================================
// CONFIGURAÇÕES
// ==========================================

let ultimoLiderHabilidade = null;
let ultimaAtivacaoHabilidade = 0;
let temporizadorHabilidade = null;

const TEMPO_HABILIDADE = 1900;
const INTERVALO_HABILIDADE = 6500;

const classesHabilidades = Object.values(
  habilidadesAnimais
).map(habilidade => habilidade.classe);


// ==========================================
// REMOVER HABILIDADE ANTERIOR
// ==========================================

function removerHabilidades() {

  document.querySelectorAll(".runner").forEach(runner => {

    runner.classList.remove(
      "habilidade-ativa",
      ...classesHabilidades
    );

    runner.querySelectorAll(
      ".efeito-habilidade"
    ).forEach(efeito => efeito.remove());

  });

  if (temporizadorHabilidade) {
    clearTimeout(temporizadorHabilidade);
    temporizadorHabilidade = null;
  }

}


// ==========================================
// ATIVAR HABILIDADE
// ==========================================

function ativarHabilidade(jogador) {

  const habilidade = habilidadesAnimais[jogador.animal];

  if (!habilidade) return;

  const indice = animals.findIndex(
    animal => animal.name === jogador.animal
  );

  if (indice === -1) return;

  const corredor = document.getElementById(
    `runner-${indice}`
  );

  if (!corredor) return;

  removerHabilidades();

  corredor.classList.add(
    "habilidade-ativa",
    habilidade.classe
  );

  // EFEITO VISUAL

  const efeito = document.createElement("span");

  efeito.className = "efeito-habilidade";

  efeito.textContent = habilidade.efeito;

  efeito.setAttribute("aria-hidden", "true");

  corredor.appendChild(efeito);

  // NOME DA HABILIDADE

  const mensagem = document.createElement("span");

  mensagem.className = "efeito-habilidade nome-habilidade";

  mensagem.textContent = habilidade.nome;

  mensagem.setAttribute("aria-hidden", "true");

  corredor.appendChild(mensagem);

  // REMOVER EFEITO AUTOMATICAMENTE

  temporizadorHabilidade = setTimeout(() => {

    removerHabilidades();

  }, TEMPO_HABILIDADE);

}


// ==========================================
// IDENTIFICAR O LÍDER
// ==========================================

function verificarLiderHabilidade() {

  if (!raceStarted || !raceActive) return;

  if (
    !document.getElementById("race")
      ?.classList.contains("active")
  ) return;

  if (roomStatus === "finalizada") return;

  const participantes = players.map(jogador => {

    let progresso = Number(jogador.progresso) || 0;

    // Considerar o progresso local do aluno
    // enquanto aguarda a sincronização.

    if (jogador.id === playerId) {

      progresso = Math.max(
        progresso,
        calculateProgress()
      );

    }

    return {
      ...jogador,
      progressoAtual: progresso
    };

  });

  participantes.sort(
    (a, b) => b.progressoAtual - a.progressoAtual
  );

  if (!participantes.length) return;

  const lider = participantes[0];

  if (lider.progressoAtual <= 0) return;

  // Não ativar habilidade durante empate.

  if (
    participantes.length > 1 &&
    participantes[1].progressoAtual ===
    lider.progressoAtual
  ) return;

  const agora = Date.now();

  const mudouLider =
    ultimoLiderHabilidade !== lider.id;

  if (
    !mudouLider &&
    agora - ultimaAtivacaoHabilidade <
    INTERVALO_HABILIDADE
  ) return;

  ultimoLiderHabilidade = lider.id;

  ultimaAtivacaoHabilidade = agora;

  ativarHabilidade(lider);

}


// ==========================================
// INTEGRAR AO SISTEMA EXISTENTE
// ==========================================

// Quando o Supabase atualizar os corredores,
// verificar novamente quem está liderando.

const atualizarCorredoresOriginal = updateAllRunners;

updateAllRunners = function (...args) {

  const resultado = atualizarCorredoresOriginal(...args);

  verificarLiderHabilidade();

  return resultado;

};


// Quando o próprio aluno digitar,
// verificar a liderança imediatamente.

const atualizarEstatisticasOriginal = updateStats;

updateStats = function (...args) {

  const resultado = atualizarEstatisticasOriginal(...args);

  verificarLiderHabilidade();

  return resultado;

};


// Limpar efeitos quando a corrida terminar.

const mostrarResultadosOriginal = showFinalResults;

showFinalResults = function (...args) {

  removerHabilidades();

  return mostrarResultadosOriginal(...args);

};


console.log(
  "AVANÇAR RACE 4.2 — Habilidades especiais carregadas!"
);