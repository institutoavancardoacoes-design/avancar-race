// ==========================================
// AVANÇAR RACE 4.3
// PAINEL DO PROFESSOR
// INSTITUTO AVANÇAR
// ==========================================

// SUPABASE

const db = supabaseClient;

// ELEMENTOS

const el = id => document.getElementById(id);

// ==========================================
// VARIÁVEIS
// ==========================================

let salaAtual = null;

let canalSala = null;

let atualizacaoIntervalo = null;

let carregandoSala = false;

let professorAtualId = null;

// ==========================================
// ANIMAIS
// ==========================================

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

// ==========================================
// MENSAGENS
// ==========================================

function mostrarErro(id, mensagem = "") {
  const elemento = el(id);

  if (elemento) {
    elemento.textContent = mensagem;
  }
}

function mostrarMensagem(mensagem = "") {
  mostrarErro("copyMessage", mensagem);
}

// ==========================================
// ARMAZENAMENTO DA SALA
// ==========================================

function chaveSalaProfessor() {
  return `avancar_sala_${professorAtualId}`;
}

function salvarSala(id) {

  if (!professorAtualId) return;

  sessionStorage.setItem(
    chaveSalaProfessor(),
    id
  );
}

function recuperarSala() {

  if (!professorAtualId) return null;

  return sessionStorage.getItem(
    chaveSalaProfessor()
  );
}

function limparSalaSalva() {

  if (!professorAtualId) return;

  sessionStorage.removeItem(
    chaveSalaProfessor()
  );
}

// ==========================================
// CONTROLE DAS TELAS
// ==========================================

function mostrarLogin() {

  el("teacherLogin").classList.remove("hidden");

  el("teacherDashboard").classList.add("hidden");
}

function mostrarPainel() {

  el("teacherLogin").classList.add("hidden");

  el("teacherDashboard").classList.remove("hidden");
}

// ==========================================
// VERIFICAR PROFESSOR
// ==========================================

async function verificarProfessor() {

  const {
    data: { user },
    error
  } = await db.auth.getUser();

  if (error || !user || user.is_anonymous) {

    mostrarLogin();

    return false;
  }

  const {
    data,
    error: erroProfessor
  } = await db.rpc("eh_professor");

  if (erroProfessor || data !== true) {

    mostrarLogin();

    mostrarErro(
      "loginError",
      "Esta conta não possui autorização de professor."
    );

    return false;
  }

  professorAtualId = user.id;

  mostrarErro("loginError");

  mostrarPainel();

  return true;
}

// ==========================================
// LOGIN
// ==========================================

el("loginForm").addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    mostrarErro("loginError");

    const email = el("teacherEmail")
      .value.trim();

    const password = el("teacherPassword").value;

    const botao = el("loginBtn");

    botao.disabled = true;

    try {

      const { error } =
        await db.auth.signInWithPassword({
          email,
          password
        });

      if (error) throw error;

      const autorizado =
        await verificarProfessor();

      if (!autorizado) {

        await db.auth.signOut();

        throw new Error(
          "Sua conta não está autorizada como professor."
        );
      }

      await recuperarSalaExistente();

    } catch (error) {

      mostrarErro(
        "loginError",
        error.message
      );

    } finally {

      botao.disabled = false;
    }
  }
);

// ==========================================
// CRIAR SALA
// ==========================================

el("createRoomBtn").addEventListener(
  "click",
  async () => {

    mostrarErro("createError");

    const texto = el("raceText")
      .value.trim();

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

      const autorizado =
        await verificarProfessor();

      if (!autorizado) {
        throw new Error(
          "Sessão de professor não autorizada."
        );
      }

     // Identificar o modo escolhido pelo professor
const modoSelecionado = document.querySelector(
  'input[name="modoJogo"]:checked'
)?.value || "classico";

// Criar a sala com o modo selecionado
const { data, error } =
  await db.rpc("criar_sala", {
    p_texto: texto,
    p_modo_jogo: modoSelecionado
  });

      if (error) throw error;

      if (!data || !data.length) {

        throw new Error(
          "A sala não foi criada."
        );
      }

      await pararAcompanhamento();

      salaAtual = data[0].sala_id;

      salvarSala(salaAtual);

      el("roomCode").textContent =
        data[0].codigo_sala;

      el("roomPanel")
        .classList.remove("hidden");

      el("teacherRanking")
        .classList.add("hidden");

      atualizarLinkAlunos();

      await acompanharSala();

      el("roomPanel").scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

    } catch (error) {

      mostrarErro(
        "createError",
        error.message
      );

    } finally {

      botao.disabled = false;
    }
  }
);

// ==========================================
// LINK DOS ALUNOS
// ==========================================

function obterLinkAlunos() {

  return new URL(
    "index.html",
    window.location.href
  ).href;
}

function atualizarLinkAlunos() {

  el("studentLink").textContent =
    obterLinkAlunos();
}

// ==========================================
// COPIAR TEXTO
// ==========================================

async function copiarTexto(texto) {

  if (
    navigator.clipboard &&
    window.isSecureContext
  ) {

    await navigator.clipboard.writeText(texto);

    return;
  }

  // Alternativa para ambientes locais
  // sem acesso à API de clipboard.

  const campo = document.createElement("textarea");

  campo.value = texto;

  campo.style.position = "fixed";

  campo.style.opacity = "0";

  document.body.appendChild(campo);

  campo.select();

  const copiou = document.execCommand("copy");

  campo.remove();

  if (!copiou) {
    throw new Error(
      "Não foi possível copiar automaticamente."
    );
  }
}

// ==========================================
// COPIAR CÓDIGO
// ==========================================

el("copyCodeBtn").addEventListener(
  "click",
  async () => {

    try {

      const codigo =
        el("roomCode").textContent.trim();

      await copiarTexto(codigo);

      mostrarMensagem(
        "✅ Código copiado!"
      );

    } catch (error) {

      mostrarMensagem(error.message);
    }
  }
);

// ==========================================
// COPIAR LINK
// ==========================================

el("copyLinkBtn").addEventListener(
  "click",
  async () => {

    try {

      await copiarTexto(
        obterLinkAlunos()
      );

      mostrarMensagem(
        "✅ Link dos alunos copiado!"
      );

    } catch (error) {

      mostrarMensagem(error.message);
    }
  }
);

// ==========================================
// CARREGAR SALA
// ==========================================

async function carregarSala() {

  if (!salaAtual || carregandoSala) return;

  carregandoSala = true;

  const idConsultado = salaAtual;

  try {

    const { data: sala, error } =
      await db
        .from("salas")
        .select("id,codigo,status,inicio")
        .eq("id", idConsultado)
        .single();

    if (error) throw error;

    const {
      data: jogadores,
      error: erroJogadores
    } = await db
      .from("jogadores")
      .select(
        "id,nome,animal,progresso,precisao," +
        "velocidade,finalizou,tempo_final"
      )
      .eq("sala_id", idConsultado);

    if (erroJogadores) {
      throw erroJogadores;
    }

    // Evita atualizar o painel de uma sala
    // que já foi substituída por outra.

    if (salaAtual !== idConsultado) return;

    const participantes = jogadores || [];

    el("roomCode").textContent =
      sala.codigo;

    el("studentCount").textContent =
      `${participantes.length}/12`;

    // LISTA DE ALUNOS

    const lista = el("studentList");

    lista.replaceChildren();

    participantes
      .sort(
        (a, b) =>
          Number(b.progresso || 0) -
          Number(a.progresso || 0)
      )
      .forEach(jogador => {

        const item =
          document.createElement("div");

        item.className = "student-item";

        const nome =
          document.createElement("span");

        nome.textContent =
          `${animaisEmoji[jogador.animal] || "🏃"} ` +
          jogador.nome;

        const progresso =
          document.createElement("strong");

        progresso.textContent =
          `${Math.round(
            Number(jogador.progresso) || 0
          )}%`;

        item.append(nome, progresso);

        lista.appendChild(item);
      });

    // STATUS

    const statusTexto = {
      aguardando: "⏳ Aguardando participantes",
      contagem: "🚦 Contagem regressiva",
      correndo: "🏁 Corrida em andamento",
      finalizada: "🏆 Corrida finalizada"
    };

    el("roomStatus").textContent =
      statusTexto[sala.status] ||
      sala.status;

    // BOTÃO INICIAR

    el("startRaceBtn").disabled =
      sala.status !== "aguardando" ||
      participantes.length === 0;

    // RANKING

    if (
      sala.status === "contagem" ||
      sala.status === "correndo" ||
      sala.status === "finalizada"
    ) {

      mostrarRanking(participantes);

      el("teacherRanking")
        .classList.remove("hidden");

    } else {

      el("teacherRanking")
        .classList.add("hidden");
    }

    atualizarLinkAlunos();

    mostrarErro("roomError");

  } catch (error) {

    if (salaAtual === idConsultado) {

      mostrarErro(
        "roomError",
        error.message
      );
    }

  } finally {

    carregandoSala = false;
  }
}

// ==========================================
// RANKING
// ==========================================

function mostrarRanking(jogadores) {

  const ranking = [...jogadores].sort(
    (a, b) => {

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
        Number(b.progresso || 0) -
        Number(a.progresso || 0)
      );
    }
  );

  const lista = el("teacherRankingList");

  lista.replaceChildren();

  ranking.forEach((jogador, index) => {

    const item =
      document.createElement("div");

    item.className = "student-item";

    const nome =
      document.createElement("span");

    const medalha =
      ["🥇", "🥈", "🥉"][index] ||
      `${index + 1}º`;

    nome.textContent =
      `${medalha} ` +
      `${animaisEmoji[jogador.animal] || "🏃"} ` +
      jogador.nome;

    const resultado =
      document.createElement("strong");

    resultado.textContent =
      jogador.finalizou
        ? `${Number(
            jogador.tempo_final
          ).toFixed(1)}s`
        : `${Math.round(
            Number(jogador.progresso) || 0
          )}%`;

    item.append(nome, resultado);

    lista.appendChild(item);
  });
}

// ==========================================
// PARAR ACOMPANHAMENTO
// ==========================================

async function pararAcompanhamento() {

  if (atualizacaoIntervalo) {

    clearInterval(atualizacaoIntervalo);

    atualizacaoIntervalo = null;
  }

  if (canalSala) {

    const canalAnterior = canalSala;

    canalSala = null;

    await db.removeChannel(canalAnterior);
  }
}

// ==========================================
// ACOMPANHAR SALA
// ==========================================

async function acompanharSala() {

  await pararAcompanhamento();

  if (!salaAtual) return;

  const idAcompanhado = salaAtual;

  await carregarSala();

  if (salaAtual !== idAcompanhado) return;

  canalSala = db
    .channel(`professor-sala-${idAcompanhado}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "jogadores",
        filter: `sala_id=eq.${idAcompanhado}`
      },
      () => carregarSala()
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "salas",
        filter: `id=eq.${idAcompanhado}`
      },
      () => carregarSala()
    )
    .subscribe();

  // Atualização periódica de segurança

  atualizacaoIntervalo = setInterval(
    carregarSala,
    3000
  );
}

// ==========================================
// RECUPERAR SALA
// ==========================================

async function recuperarSalaExistente() {

  const salaSalva = recuperarSala();

  if (!salaSalva) return;

  try {

    const { data, error } =
      await db
        .from("salas")
        .select("id,codigo")
        .eq("id", salaSalva)
        .single();

    if (error || !data) {

      limparSalaSalva();

      return;
    }

    salaAtual = data.id;

    el("roomCode").textContent =
      data.codigo;

    el("roomPanel")
      .classList.remove("hidden");

    atualizarLinkAlunos();

    await acompanharSala();

  } catch (error) {

    console.error(
      "Erro ao recuperar sala:",
      error.message
    );
  }
}

// ==========================================
// INICIAR CORRIDA
// ==========================================

el("startRaceBtn").addEventListener(
  "click",
  async () => {

    if (!salaAtual) return;

    mostrarErro("roomError");

    const botao = el("startRaceBtn");

    botao.disabled = true;

    try {

      const { error } =
        await db.rpc("iniciar_corrida", {
          p_sala_id: salaAtual
        });

      if (error) throw error;

      await carregarSala();

    } catch (error) {

      mostrarErro(
        "roomError",
        error.message
      );

      await carregarSala();
    }
  }
);

// ==========================================
// ATUALIZAR MANUALMENTE
// ==========================================

el("refreshRoomBtn").addEventListener(
  "click",
  carregarSala
);

// ==========================================
// SAIR DO PAINEL
// ==========================================

el("logoutBtn").addEventListener(
  "click",
  async () => {

    await pararAcompanhamento();

    limparSalaSalva();

    salaAtual = null;

    professorAtualId = null;

    el("roomPanel")
      .classList.add("hidden");

    el("teacherRanking")
      .classList.add("hidden");

    const { error } =
      await db.auth.signOut();

    if (error) {

      mostrarErro(
        "loginError",
        error.message
      );
    }

    mostrarLogin();
  }
);

// ==========================================
// INICIALIZAÇÃO
// ==========================================

async function iniciarPainel() {

  try {

    const autorizado =
      await verificarProfessor();

    if (!autorizado) return;

    await recuperarSalaExistente();

  } catch (error) {

    console.error(
      "Erro ao iniciar painel:",
      error.message
    );

    mostrarLogin();
  }
}

iniciarPainel();

console.log(
  "AVANÇAR RACE 4.3 — Portal do Professor carregado!"
);