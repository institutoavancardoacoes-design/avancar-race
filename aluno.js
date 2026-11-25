// ==========================================
// AVANÇAR RACE 6.0
// PORTAL DO ALUNO
// INSTITUTO AVANÇAR
// ==========================================

const db = supabaseClient;

const el = id => document.getElementById(id);

// ==========================================
// VARIÁVEIS
// ==========================================

let alunoAtual = null;
let turmaAtual = null;
let historico = [];

let graficoVelocidade = null;
let graficoPrecisao = null;

// ==========================================
// INICIALIZAÇÃO
// ==========================================

document.addEventListener("DOMContentLoaded", iniciarPortal);

async function iniciarPortal() {

    configurarEventos();
    configurarData();

    try {

        const { data, error } = await db.auth.getUser();

        if (
            error ||
            !data.user ||
            data.user.is_anonymous
        ) {

            window.location.replace("login.html");
            return;

        }

        const autorizado = await carregarAluno(data.user.id);

        if (!autorizado) {

            await db.auth.signOut({ scope: "local" });

            window.location.replace("login.html");
            return;

        }

        preencherPerfil();

        await carregarHistorico();

        atualizarIndicadores();
        renderizarHistorico();

        await carregarRanking();

        el("loadingScreen").hidden = true;
        el("app").hidden = false;

        atualizarGraficos();

    } catch (error) {

        console.error("Erro ao iniciar portal:", error);

        el("loadingScreen").querySelector("p").textContent =
            "Não foi possível carregar o portal. Atualize a página.";

    }

}

// ==========================================
// DATA E FORMATAÇÃO
// ==========================================

function configurarData() {

    el("anoAtual").textContent = new Date().getFullYear();

    el("dataAtual").textContent =
        new Date().toLocaleDateString("pt-BR", {

            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"

        });

}

function numero(valor, casas = 0) {

    return Number(valor || 0).toLocaleString("pt-BR", {

        minimumFractionDigits: casas,
        maximumFractionDigits: casas

    });

}

function formatarData(valor) {

    if (!valor) return "—";

    return new Date(valor).toLocaleDateString("pt-BR");

}

function nomeModo(modo) {

    const modos = {

        classico: "Clássico",
        competicao: "Competição",
        profissional: "Profissional"

    };

    return modos[modo] || "Outro";

}

// ==========================================
// CARREGAR ALUNO
// ==========================================

async function carregarAluno(usuarioId) {

    const { data, error } = await db

        .from("alunos")

        .select(`
            id,
            usuario_id,
            nome,
            matricula,
            turma_id,
            ativo
        `)

        .eq("usuario_id", usuarioId)

        .eq("ativo", true)

        .maybeSingle();

    if (error) throw error;

    if (!data) return false;

    alunoAtual = data;

    if (alunoAtual.turma_id) {

        const { data: turma, error: erroTurma } = await db

            .from("turmas")

            .select("id, nome, ativa")

            .eq("id", alunoAtual.turma_id)

            .maybeSingle();

        if (erroTurma) throw erroTurma;

        turmaAtual = turma;

    }

    return true;

}

// ==========================================
// PREENCHER PERFIL
// ==========================================

function preencherPerfil() {

    const nome = alunoAtual.nome;

    const primeiroNome = nome.trim().split(/\s+/)[0];

    const inicial = nome.trim().charAt(0).toUpperCase();

    const turma = turmaAtual?.nome || "Sem turma";

    el("nomeAluno").textContent = primeiroNome;

    el("nomeHeader").textContent = nome;

    el("turmaHeader").textContent = turma;

    el("avatarAluno").textContent = inicial;

    el("avatarPerfil").textContent = inicial;

    el("perfilNome").textContent = nome;

    el("perfilMatricula").textContent =
        alunoAtual.matricula;

    el("perfilTurma").textContent = turma;

    el("perfilStatus").textContent =
        alunoAtual.ativo ? "Ativo" : "Inativo";

}

// ==========================================
// CARREGAR HISTÓRICO
// ==========================================

async function carregarHistorico() {

    historico = [];

    const tamanhoPagina = 500;

    let inicio = 0;

    while (true) {

        const { data, error } = await db

            .from("desempenho_alunos")

            .select("*")

            .eq("aluno_id", alunoAtual.id)

            .eq("finalizou", true)

            .order("criado_em", { ascending: false })

            .order("id", { ascending: false })

            .range(inicio, inicio + tamanhoPagina - 1);

        if (error) throw error;

        historico.push(...(data || []));

        if (!data || data.length < tamanhoPagina) {

            break;

        }

        inicio += tamanhoPagina;

    }

}

// ==========================================
// INDICADORES
// ==========================================

function atualizarIndicadores() {

    const total = historico.length;

    let somaVelocidade = 0;
    let somaPrecisao = 0;
    let recorde = 0;
    let vitorias = 0;
    let acertos = 0;
    let erros = 0;
    let pontos = 0;

    historico.forEach(partida => {

        const velocidade = Number(partida.velocidade || 0);

        somaVelocidade += velocidade;

        somaPrecisao += Number(partida.precisao || 0);

        acertos += Number(partida.acertos || 0);

        erros += Number(partida.erros || 0);

        pontos += Number(partida.pontuacao || 0);

        recorde = Math.max(recorde, velocidade);

        if (Number(partida.posicao) === 1) {

            vitorias++;

        }

    });

    const velocidadeMedia =
        total ? somaVelocidade / total : 0;

    const precisaoMedia =
        total ? somaPrecisao / total : 0;

    el("velocidadeMedia").textContent =
        numero(velocidadeMedia, 1);

    el("recordeVelocidade").textContent =
        numero(recorde);

    el("precisaoMedia").textContent =
        `${numero(precisaoMedia, 1)}%`;

    el("totalPartidas").textContent = numero(total);

    el("totalVitorias").textContent = numero(vitorias);

    el("totalAcertos").textContent = numero(acertos);

    el("totalErros").textContent = numero(erros);

    el("pontuacaoTotal").textContent = numero(pontos);

}

// ==========================================
// CRIAR CÉLULAS COM SEGURANÇA
// ==========================================

function criarCelula(linha, valor) {

    const td = document.createElement("td");

    td.textContent = valor ?? "—";

    linha.appendChild(td);

    return td;

}

function estadoVazio(tbody, colunas, mensagem) {

    tbody.replaceChildren();

    const linha = document.createElement("tr");

    const td = document.createElement("td");

    td.colSpan = colunas;

    td.className = "empty-state";

    td.textContent = mensagem;

    linha.appendChild(td);

    tbody.appendChild(linha);

}

// ==========================================
// HISTÓRICO DE PARTIDAS
// ==========================================

function renderizarHistorico() {

    const tbody = el("historicoBody");

    const modo = el("filtroModo").value;

    const partidas = historico.filter(partida => {

        return modo === "todos" ||
            partida.modo_jogo === modo;

    });

    tbody.replaceChildren();

    if (!partidas.length) {

        estadoVazio(
            tbody,
            9,
            "Nenhuma partida registrada neste modo."
        );

        return;

    }

    const fragmento = document.createDocumentFragment();

    partidas.forEach(partida => {

        const linha = document.createElement("tr");

        criarCelula(
            linha,
            formatarData(partida.criado_em)
        );

        const tdModo = document.createElement("td");

        const badge = document.createElement("span");

        badge.className = "badge-modo";

        if (
            ["classico", "competicao", "profissional"]
                .includes(partida.modo_jogo)
        ) {

            badge.classList.add(partida.modo_jogo);

        }

        badge.textContent = nomeModo(partida.modo_jogo);

        tdModo.appendChild(badge);

        linha.appendChild(tdModo);

        criarCelula(
            linha,
            partida.posicao ? `${partida.posicao}º` : "—"
        );

        criarCelula(linha, numero(partida.velocidade));

        criarCelula(
            linha,
            numero(partida.caracteres_por_minuto)
        );

        criarCelula(
            linha,
            `${numero(partida.precisao, 1)}%`
        );

        criarCelula(linha, numero(partida.acertos));

        criarCelula(linha, numero(partida.erros));

        criarCelula(linha, numero(partida.pontuacao));

        fragmento.appendChild(linha);

    });

    tbody.appendChild(fragmento);

}

// ==========================================
// RANKING
// ==========================================

async function carregarRanking() {

    const tbody = el("rankingBody");

    el("posicaoGeral").textContent = "—";
    el("posicaoTurma").textContent = "—";

    estadoVazio(
        tbody,
        6,
        "Carregando ranking..."
    );

    try {

        const { data, error } = await db.rpc(
            "consultar_ranking_alunos"
        );

        if (error) throw error;

        const ranking = data || [];

        if (!ranking.length) {

            estadoVazio(
                tbody,
                6,
                "Nenhuma partida registrada no ranking."
            );

            return;

        }

        const minhaPosicao = ranking.find(
            aluno => aluno.meu_perfil === true
        );

        if (minhaPosicao) {

            el("posicaoGeral").textContent =
                `${minhaPosicao.posicao}º`;

            el("posicaoTurma").textContent =
                `${minhaPosicao.posicao}º`;

        }

        tbody.replaceChildren();

        const fragmento =
            document.createDocumentFragment();

        ranking.forEach(aluno => {

            const linha = document.createElement("tr");

            let medalha = "";

            if (Number(aluno.posicao) === 1) {
                medalha = "🥇 ";
            }

            if (Number(aluno.posicao) === 2) {
                medalha = "🥈 ";
            }

            if (Number(aluno.posicao) === 3) {
                medalha = "🥉 ";
            }

            if (aluno.meu_perfil) {

                linha.classList.add("meu-ranking");

                linha.style.backgroundColor = "#dcfce7";

                linha.style.fontWeight = "700";

            }

            criarCelula(
                linha,
                `${medalha}${aluno.posicao}º`
            );

            criarCelula(
                linha,
                aluno.nome +
                (aluno.meu_perfil ? " (Você)" : "")
            );

            criarCelula(
                linha,
                `${numero(aluno.velocidade_media, 1)} PPM`
            );

            criarCelula(
                linha,
                `${numero(aluno.precisao_media, 1)}%`
            );

            criarCelula(
                linha,
                numero(aluno.total_partidas)
            );

            criarCelula(
                linha,
                numero(aluno.vitorias)
            );

            fragmento.appendChild(linha);

        });

        tbody.appendChild(fragmento);

    } catch (error) {

        console.error("Erro ao carregar ranking:", error);

        estadoVazio(
            tbody,
            6,
            "Não foi possível carregar o ranking."
        );

    }

}

// ==========================================
// FILTRAR PERÍODO DOS GRÁFICOS
// ==========================================

function filtrarPeriodo() {

    const periodo = el("filtroPeriodo").value;

    if (periodo === "todos") {

        return [...historico];

    }

    const limite = new Date();

    limite.setDate(
        limite.getDate() - Number(periodo)
    );

    return historico.filter(partida => {

        return new Date(partida.criado_em) >= limite;

    });

}

// ==========================================
// GRÁFICOS DE EVOLUÇÃO
// ==========================================

function atualizarGraficos() {

    if (typeof Chart === "undefined") {

        console.warn("Chart.js não foi carregado.");

        return;

    }

    const partidas = filtrarPeriodo().sort((a, b) => {

        return new Date(a.criado_em) -
            new Date(b.criado_em);

    });

    const labels = partidas.map(partida => {

        return formatarData(partida.criado_em);

    });

    const velocidades = partidas.map(partida => {

        return Number(partida.velocidade || 0);

    });

    const precisoes = partidas.map(partida => {

        return Number(partida.precisao || 0);

    });

    if (graficoVelocidade) {

        graficoVelocidade.destroy();

    }

    if (graficoPrecisao) {

        graficoPrecisao.destroy();

    }

    graficoVelocidade = criarGrafico(

        "graficoVelocidade",

        labels,

        velocidades,

        "Velocidade (PPM)",

        "#16a34a",

        "rgba(22, 163, 74, 0.12)"

    );

    graficoPrecisao = criarGrafico(

        "graficoPrecisao",

        labels,

        precisoes,

        "Precisão (%)",

        "#2563eb",

        "rgba(37, 99, 235, 0.12)",

        100

    );

}

// ==========================================
// CONFIGURAÇÃO DOS GRÁFICOS
// ==========================================

function criarGrafico(
    id,
    labels,
    valores,
    titulo,
    cor,
    fundo,
    maximo = undefined
) {

    return new Chart(el(id), {

        type: "line",

        data: {

            labels,

            datasets: [{

                label: titulo,

                data: valores,

                borderColor: cor,

                backgroundColor: fundo,

                borderWidth: 3,

                tension: 0.35,

                fill: true,

                pointRadius: 4,

                pointHoverRadius: 7

            }]

        },

        options: {

            responsive: true,

            maintainAspectRatio: false,

            interaction: {

                intersect: false,

                mode: "index"

            },

            plugins: {

                legend: {

                    display: false

                }

            },

            scales: {

                y: {

                    beginAtZero: true,

                    max: maximo

                },

                x: {

                    grid: {

                        display: false

                    },

                    ticks: {

                        maxTicksLimit: 10

                    }

                }

            }

        }

    });

}

// ==========================================
// MENU RESPONSIVO
// ==========================================

function fecharMenu() {

    el("sidebar").classList.remove("open");

    el("btnMenu").setAttribute(
        "aria-expanded",
        "false"
    );

}

function configurarEventos() {

    el("btnMenu").addEventListener("click", () => {

        const aberto = el("sidebar")
            .classList.toggle("open");

        el("btnMenu").setAttribute(
            "aria-expanded",
            String(aberto)
        );

    });

    document.querySelectorAll(".menu-item")
        .forEach(item => {

            item.addEventListener("click", () => {

                document.querySelectorAll(".menu-item")
                    .forEach(link => {

                        link.classList.remove("active");

                    });

                item.classList.add("active");

                fecharMenu();

            });

        });

    document.addEventListener("click", event => {

        if (

            window.innerWidth <= 900 &&

            !el("sidebar").contains(event.target) &&

            !el("btnMenu").contains(event.target)

        ) {

            fecharMenu();

        }

    });

    document.addEventListener("keydown", event => {

        if (event.key === "Escape") {

            fecharMenu();

        }

    });

    el("filtroModo").addEventListener(

        "change",

        renderizarHistorico

    );

    el("filtroPeriodo").addEventListener(

        "change",

        atualizarGraficos

    );

    el("btnSair").addEventListener(

        "click",

        sairDaConta

    );

}

// ==========================================
// ENCERRAR SESSÃO
// ==========================================

async function sairDaConta() {

    const confirmar = window.confirm(

        "Deseja sair da sua conta?"

    );

    if (!confirmar) return;

    el("btnSair").disabled = true;

    try {

        const { error } = await db.auth.signOut({

            scope: "local"

        });

        if (error) throw error;

        window.location.replace("login.html");

    } catch (error) {

        console.error("Erro ao sair:", error);

        alert("Não foi possível sair. Tente novamente.");

        el("btnSair").disabled = false;

    }

}