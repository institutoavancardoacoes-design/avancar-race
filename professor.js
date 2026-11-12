// ==========================================
// AVANÇAR RACE
// PAINEL DO PROFESSOR
// ==========================================

const db = supabaseClient;

const el = id => document.getElementById(id);

let salaAtual = null;
let canalSala = null;
let atualizacaoIntervalo = null;

const animaisEmoji = {
  "Leão": "🦁",
  "Tigre": "🐯",
  "Coelho": "🐰",
  "Raposa": "🦊",
  "Panda": "🐼",
  "Tartaruga": "🐢",
  "Macaco": "🐵",
  "Lobo": "🐺",
  "Urso": "🐻",
  "T-Rex": "🦖",
  "Dragão": "🐉",
  "Rinoceronte": "🦏"
};

function mostrarErro(id, mensagem = "") {
  el(id).textContent = mensagem;
}

async function verificarProfessor() {
  const { data: { user }, error } =
    await db.auth.getUser();

  if (error || !user || user.is_anonymous) {
    mostrarLogin();
    return false;
  }

  const { data, error: erroProfessor } =
    await db.rpc("eh_professor");

  if (erroProfessor || data !== true) {
    mostrarLogin();
    mostrarErro(
      "loginError",
      "Esta conta não possui autorização de professor."
    );
    return false;
  }

  el("teacherLogin").classList.add("hidden");
  el("teacherDashboard").classList.remove("hidden");

  return true;
}

function mostrarLogin() {
  el("teacherLogin").classList.remove("hidden");
  el("teacherDashboard").classList.add("hidden");
}

el("loginForm").addEventListener("submit", async event => {
  event.preventDefault();

  mostrarErro("loginError");

  const email = el("teacherEmail").value.trim();
  const password = el("teacherPassword").value;

  const botao = event.submitter;
  botao.disabled = true;

  try {
    const { error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    const autorizado = await verificarProfessor();

    if (!autorizado) {
      await db.auth.signOut();
    }

  } catch (error) {
    mostrarErro("loginError", error.message);
  } finally {
    botao.disabled = false;
  }
});

el("createRoomBtn").addEventListener("click", async () => {
  mostrarErro("createError");

  const texto = el("raceText").value.trim();

  if (texto.length < 20) {
    mostrarErro(
      "createError",
      "Digite um texto com pelo menos 20 caracteres."
    );
    return;
  }

  const botao = el("createRoomBtn");
  botao.disabled = true;

  try {
    const { data, error } = await db.rpc("criar_sala", {
      p_texto: texto
    });

    if (error) throw error;

    if (!data || !data.length) {
      throw new Error("A sala não foi criada.");
    }

    salaAtual = data[0].sala_id;

    el("roomCode").textContent = data[0].codigo_sala;
    el("roomPanel").classList.remove("hidden");

    await acompanharSala();

  } catch (error) {
    mostrarErro("createError", error.message);
  } finally {
    botao.disabled = false;
  }
});

async function carregarSala() {
  if (!salaAtual) return;

  const { data: sala, error } = await db
    .from("salas")
    .select("id, codigo, status, inicio")
    .eq("id", salaAtual)
    .single();

  if (error) {
    mostrarErro("roomError", error.message);
    return;
  }

  const { data: jogadores, error: erroJogadores } = await db
    .from("jogadores")
    .select(
      "id, nome, animal, progresso, precisao, velocidade, finalizou, tempo_final"
    )
    .eq("sala_id", salaAtual);

  if (erroJogadores) {
    mostrarErro("roomError", erroJogadores.message);
    return;
  }

  const participantes = jogadores || [];

  el("studentCount").textContent =
    `${participantes.length}/12`;

  const lista = el("studentList");
  lista.replaceChildren();

  participantes
    .sort((a, b) => b.progresso - a.progresso)
    .forEach(jogador => {
      const item = document.createElement("div");
      item.className = "student-item";

      const nome = document.createElement("span");
      nome.textContent =
        `${animaisEmoji[jogador.animal] || "🏃"} ${jogador.nome}`;

      const progresso = document.createElement("strong");
      progresso.textContent =
        `${Math.round(jogador.progresso)}%`;

      item.append(nome, progresso);
      lista.appendChild(item);
    });

  const statusTexto = {
    aguardando: "⏳ Aguardando participantes",
    contagem: "🚦 Contagem regressiva",
    correndo: "🏁 Corrida em andamento",
    finalizada: "🏆 Corrida finalizada"
  };

  el("roomStatus").textContent =
    statusTexto[sala.status] || sala.status;

  el("startRaceBtn").disabled =
    sala.status !== "aguardando" ||
    participantes.length === 0;

  if (sala.status === "correndo" ||
      sala.status === "finalizada") {
    mostrarRanking(participantes);
  }

  if (sala.status === "finalizada") {
    el("teacherRanking")
      .classList.remove("hidden");
  }
}

function mostrarRanking(jogadores) {
  const ranking = [...jogadores].sort((a, b) => {
    if (a.finalizou !== b.finalizou) {
      return a.finalizou ? -1 : 1;
    }

    if (a.finalizou && b.finalizou) {
      return Number(a.tempo_final) -
             Number(b.tempo_final);
    }

    return Number(b.progresso) -
           Number(a.progresso);
  });

  const lista = el("teacherRankingList");
  lista.replaceChildren();

  ranking.forEach((jogador, index) => {
    const item = document.createElement("div");
    item.className = "student-item";

    const nome = document.createElement("span");

    const medalha =
      ["🥇", "🥈", "🥉"][index] ||
      `${index + 1}º`;

    nome.textContent =
      `${medalha} ${animaisEmoji[jogador.animal] || "🏃"} ${jogador.nome}`;

    const resultado = document.createElement("strong");

    resultado.textContent = jogador.finalizou
      ? `${Number(jogador.tempo_final).toFixed(1)}s`
      : `${Math.round(jogador.progresso)}%`;

    item.append(nome, resultado);
    lista.appendChild(item);
  });
}

async function acompanharSala() {
  if (canalSala) {
    await db.removeChannel(canalSala);
  }

  if (atualizacaoIntervalo) {
    clearInterval(atualizacaoIntervalo);
  }

  await carregarSala();

  canalSala = db
    .channel(`professor-sala-${salaAtual}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "jogadores",
        filter: `sala_id=eq.${salaAtual}`
      },
      () => carregarSala()
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "salas",
        filter: `id=eq.${salaAtual}`
      },
      () => carregarSala()
    )
    .subscribe();

  // Atualização de segurança caso um evento
  // Realtime não seja recebido.
  atualizacaoIntervalo = setInterval(carregarSala, 3000);
}

el("startRaceBtn").addEventListener("click", async () => {
  if (!salaAtual) return;

  mostrarErro("roomError");

  const botao = el("startRaceBtn");
  botao.disabled = true;

  const { error } = await db.rpc("iniciar_corrida", {
    p_sala_id: salaAtual
  });

  if (error) {
    mostrarErro("roomError", error.message);
    botao.disabled = false;
    return;
  }

  await carregarSala();
});

el("refreshRoomBtn").addEventListener("click", carregarSala);

el("logoutBtn").addEventListener("click", async () => {
  if (atualizacaoIntervalo) {
    clearInterval(atualizacaoIntervalo);
  }

  if (canalSala) {
    await db.removeChannel(canalSala);
  }

  salaAtual = null;

  await db.auth.signOut();

  mostrarLogin();
});

async function iniciarPainel() {
  await verificarProfessor();
}

iniciarPainel();