// ==========================================
// AVANÇAR RACE 6.0
// PAINEL DE DESEMPENHO DOS ALUNOS
// INSTITUTO AVANÇAR
// ==========================================

const db = supabaseClient;

const el = id => document.getElementById(id);

// ==========================================
// VARIÁVEIS
// ==========================================

let professorAtual = null;

let alunos = [];

let desempenhos = [];

let ranking = [];

let carregandoDados = false;

let operacaoAluno = false;

const graficos = {};

// ==========================================
// INICIALIZAÇÃO
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {

    configurarEventos();

    const autorizado = await verificarProfessor();

    if (!autorizado) return;

    await carregarDados();

});

// ==========================================
// AUTENTICAÇÃO DO PROFESSOR
// ==========================================

async function verificarProfessor() {

    try {

        const { data, error } = await db.auth.getUser();

        const usuario = data?.user;

        if (error || !usuario || usuario.is_anonymous) {

            window.location.replace("professor.html");

            return false;

        }

        const { data: professor, error: erroProfessor } = await db
            .from("professores")
            .select("usuario_id, nome")
            .eq("usuario_id", usuario.id)
            .maybeSingle();

        if (erroProfessor || !professor) {

            window.location.replace("professor.html");

            return false;

        }

        professorAtual = professor;

        el("nomeProfessor").textContent = professor.nome;

        return true;

    } catch (error) {

        mostrarMensagem(
            "Não foi possível verificar seu acesso.",
            "erro"
        );

        return false;

    }

}

// ==========================================
// MENSAGENS
// ==========================================

function mostrarMensagem(texto, tipo = "info") {

    const mensagem = el("mensagemGlobal");

    mensagem.textContent = texto;

    mensagem.className = tipo;

}

function limparMensagem() {

    el("mensagemGlobal").textContent = "";

    el("mensagemGlobal").className = "";

}

// ==========================================
// CONSULTAS PAGINADAS
// ==========================================

async function buscarRegistros(tabela, campos, configurar) {

    const registros = [];

    const limite = 500;

    let inicio = 0;

    while (true) {

        let consulta = db
            .from(tabela)
            .select(campos);

        if (configurar) {

            consulta = configurar(consulta);

        }

        const { data, error } = await consulta.range(
            inicio,
            inicio + limite - 1
        );

        if (error) throw error;

        registros.push(...(data || []));

        if (!data || data.length < limite) break;

        inicio += limite;

    }

    return registros;

}

// ==========================================
// CARREGAR DADOS DO SUPABASE
// ==========================================

async function carregarDados() {

    if (!professorAtual || carregandoDados) return;

    carregandoDados = true;

    el("btnAtualizar").disabled = true;

    el("btnAtualizar").textContent = "Carregando...";

    mostrarMensagem("Carregando dados dos alunos...");

    try {

        const [listaAlunos, listaDesempenhos] =
            await Promise.all([

                buscarRegistros(
                    "alunos",
                    "id,nome,matricula,turma_id,status,ativo,criado_em",
                    consulta => consulta
                        .order("nome")
                        .order("id")
                ),

                buscarRegistros(
                    "desempenho_alunos",
                    "*",
                    consulta => consulta
                        .eq("finalizou", true)
                        .order("criado_em", { ascending: false })
                        .order("id")
                )

            ]);

        alunos = listaAlunos;

        desempenhos = listaDesempenhos;

        calcularRanking();

        atualizarDashboard();

        renderizarAlunos();

        renderizarRanking();

        renderizarHistorico();

        limparMensagem();

        if (!alunos.length) {

            mostrarMensagem(
                "Nenhum aluno encontrado até o momento.",
                "info"
            );

        }

    } catch (error) {

        console.error("Erro ao carregar dados:", error);

        mostrarMensagem(
            "Não foi possível carregar os dados. Verifique as permissões do Supabase.",
            "erro"
        );

    } finally {

        carregandoDados = false;

        el("btnAtualizar").disabled = false;

        el("btnAtualizar").textContent = "↻ Atualizar dados";

    }

}

// ==========================================
// FORMATAÇÃO
// ==========================================

function numero(valor) {

    const resultado = Number(valor);

    return Number.isFinite(resultado) ? resultado : 0;

}

function formatarNumero(valor) {

    return numero(valor).toLocaleString("pt-BR");

}

function formatarMedia(valor) {

    return numero(valor).toLocaleString("pt-BR", {

        minimumFractionDigits: 1,

        maximumFractionDigits: 1

    });

}

function formatarData(valor) {

    if (!valor) return "—";

    const data = new Date(valor);

    if (Number.isNaN(data.getTime())) return "—";

    return data.toLocaleString("pt-BR");

}

function formatarTempo(valor) {

    if (valor === null || valor === undefined) return "—";

    return `${formatarMedia(valor)} s`;

}

function formatarModo(modo) {

    const modos = {

        classico: "Clássico",

        competicao: "Competição",

        profissional: "Profissional"

    };

    return modos[modo] || modo || "—";

}

function normalizar(texto) {

    return String(texto || "")

        .normalize("NFD")

        .replace(/[\u0300-\u036f]/g, "")

        .toLowerCase()

        .trim();

}

// ==========================================
// ESTATÍSTICAS
// ==========================================

function calcularEstatisticas(partidas) {

    const total = partidas.length;

    const velocidadeTotal = partidas.reduce(

        (soma, item) => soma + numero(item.velocidade),

        0

    );

    const precisaoTotal = partidas.reduce(

        (soma, item) => soma + numero(item.precisao),

        0

    );

    return {

        partidas: total,

        velocidade: total ? velocidadeTotal / total : 0,

        precisao: total ? precisaoTotal / total : 0,

        recorde: partidas.reduce(

            (maior, item) => Math.max(
                maior,
                numero(item.velocidade)
            ),

            0

        ),

        acertos: partidas.reduce(

            (soma, item) => soma + numero(item.acertos),

            0

        ),

        erros: partidas.reduce(

            (soma, item) => soma + numero(item.erros),

            0

        ),

        vitorias: partidas.filter(

            item => numero(item.posicao) === 1

        ).length,

        pontuacao: partidas.reduce(

            (soma, item) => soma + numero(item.pontuacao),

            0

        )

    };

}

// ==========================================
// RANKING PERMANENTE
// ==========================================

function calcularRanking() {

    ranking = alunos

        .filter(aluno =>

            aluno.ativo && aluno.status === "aprovado"

        )

        .map(aluno => {

            const partidas = desempenhos.filter(

                item => item.aluno_id === aluno.id

            );

            return {

                ...aluno,

                ...calcularEstatisticas(partidas)

            };

        })

        .filter(aluno => aluno.partidas > 0)

        .sort((a, b) =>

            b.velocidade - a.velocidade ||

            b.precisao - a.precisao ||

            b.vitorias - a.vitorias ||

            a.nome.localeCompare(b.nome, "pt-BR")

        );

}

// ==========================================
// DASHBOARD
// ==========================================

function atualizarDashboard() {

    const ativos = alunos.filter(

        aluno => aluno.ativo && aluno.status === "aprovado"

    ).length;

    const pendentes = alunos.filter(

        aluno => aluno.status === "pendente"

    ).length;

    const estatisticas = calcularEstatisticas(desempenhos);

    el("totalAlunos").textContent = formatarNumero(ativos);

    el("totalPendentes").textContent = formatarNumero(pendentes);

    el("badgePendentes").textContent = pendentes;

    el("totalPartidas").textContent =
        formatarNumero(estatisticas.partidas);

    el("velocidadeMedia").textContent =
        `${formatarMedia(estatisticas.velocidade)} PPM`;

    el("precisaoMedia").textContent =
        `${formatarMedia(estatisticas.precisao)}%`;

    el("recordeVelocidade").textContent =
        `${formatarNumero(estatisticas.recorde)} PPM`;

    el("totalAcertos").textContent =
        formatarNumero(estatisticas.acertos);

    el("totalErros").textContent =
        formatarNumero(estatisticas.erros);

    renderizarDestaques();

    atualizarGraficosGerais();

}

// ==========================================
// CRIAÇÃO SEGURA DAS TABELAS
// ==========================================

function criarLinha(tabela, valores) {

    const tr = document.createElement("tr");

    valores.forEach(valor => {

        const td = document.createElement("td");

        if (valor instanceof Node) {

            td.appendChild(valor);

        } else {

            td.textContent = valor ?? "—";

        }

        tr.appendChild(td);

    });

    tabela.appendChild(tr);

    return tr;

}

function tabelaVazia(tabela, colunas, texto) {

    tabela.replaceChildren();

    const tr = document.createElement("tr");

    const td = document.createElement("td");

    td.colSpan = colunas;

    td.className = "empty-state";

    td.textContent = texto;

    tr.appendChild(td);

    tabela.appendChild(tr);

}

function criarPosicao(posicao) {

    const span = document.createElement("span");

    span.className = "posicao";

    if (posicao === 1) {

        span.classList.add("ouro");

        span.textContent = "🥇";

    } else if (posicao === 2) {

        span.classList.add("prata");

        span.textContent = "🥈";

    } else if (posicao === 3) {

        span.classList.add("bronze");

        span.textContent = "🥉";

    } else {

        span.textContent = `${posicao}º`;

    }

    return span;

}

function criarStatus(status) {

    const span = document.createElement("span");

    const statusValidos = {

        aprovado: "Aprovado",

        pendente: "Pendente",

        rejeitado: "Rejeitado"

    };

    span.className = "status";

    if (Object.hasOwn(statusValidos, status)) {

        span.classList.add(status);

    }

    span.textContent = statusValidos[status] || "Desconhecido";

    return span;

}

function criarBotao(texto, classe, acao) {

    const botao = document.createElement("button");

    botao.type = "button";

    botao.className = `btn-acao ${classe}`;

    botao.textContent = texto;

    botao.addEventListener("click", acao);

    return botao;

}

// ==========================================
// DESTAQUES DO RANKING
// ==========================================

function renderizarDestaques() {

    const tabela = el("tabelaDestaques");

    tabela.replaceChildren();

    if (!ranking.length) {

        tabelaVazia(

            tabela,

            5,

            "Nenhum resultado registrado."

        );

        return;

    }

    ranking.slice(0, 5).forEach((aluno, index) => {

        criarLinha(tabela, [

            criarPosicao(index + 1),

            aluno.nome,

            `${formatarMedia(aluno.velocidade)} PPM`,

            `${formatarMedia(aluno.precisao)}%`,

            aluno.partidas

        ]);

    });

}

// ==========================================
// GESTÃO DE ALUNOS
// ==========================================

function renderizarAlunos() {

    const tabela = el("tabelaAlunos");

    const busca = normalizar(el("buscarAluno").value);

    const status = el("filtroStatus").value;

    tabela.replaceChildren();

    const filtrados = alunos.filter(aluno => {

        const correspondeBusca =

            normalizar(aluno.nome).includes(busca) ||

            normalizar(aluno.matricula).includes(busca);

        const correspondeStatus =

            status === "todos" || aluno.status === status;

        return correspondeBusca && correspondeStatus;

    });

    if (!filtrados.length) {

        tabelaVazia(tabela, 6, "Nenhum aluno encontrado.");

        return;

    }

    filtrados.forEach(aluno => {

        const partidas = desempenhos.filter(

            item => item.aluno_id === aluno.id

        ).length;

        const acoes = document.createElement("div");

        acoes.className = "acoes";

        acoes.appendChild(

            criarBotao(

                "Desempenho",

                "btn-visualizar",

                () => abrirAluno(aluno.id)

            )

        );

        if (aluno.status === "pendente") {

            acoes.appendChild(

                criarBotao(

                    "Aprovar",

                    "btn-aprovar",

                    () => alterarStatusAluno(aluno, "aprovar")

                )

            );

            acoes.appendChild(

                criarBotao(

                    "Rejeitar",

                    "btn-rejeitar",

                    () => alterarStatusAluno(aluno, "rejeitar")

                )

            );

        }

        criarLinha(tabela, [

            aluno.nome,

            aluno.matricula,

            formatarData(aluno.criado_em),

            criarStatus(aluno.status),

            partidas,

            acoes

        ]);

    });

}

// ==========================================
// APROVAR E REJEITAR ALUNOS
// ==========================================

async function alterarStatusAluno(aluno, acao) {

    if (operacaoAluno || carregandoDados) return;

    const confirmar = window.confirm(

        `Deseja ${acao} o cadastro de ${aluno.nome}?`

    );

    if (!confirmar) return;

    operacaoAluno = true;

    const funcao = acao === "aprovar"

        ? "aprovar_aluno"

        : "rejeitar_aluno";

    try {

        const { data, error } = await db.rpc(funcao, {

            p_aluno_id: aluno.id

        });

        if (error) throw error;

        if (data !== true) {

            throw new Error("Operação não confirmada.");

        }

        await carregarDados();

        mostrarMensagem(

            acao === "aprovar"

                ? "Aluno aprovado com sucesso!"

                : "Cadastro rejeitado com sucesso.",

            "sucesso"

        );

    } catch (error) {

        console.error(error);

        mostrarMensagem(

            "Não foi possível alterar o cadastro do aluno.",

            "erro"

        );

    } finally {

        operacaoAluno = false;

    }

}

// ==========================================
// RENDERIZAR RANKING
// ==========================================

function renderizarRanking() {

    const tabela = el("tabelaRanking");

    const busca = normalizar(el("buscarRanking").value);

    const ordenar = el("ordenarRanking").value;

    tabela.replaceChildren();

    const campos = {

        velocidade: "velocidade",

        precisao: "precisao",

        recorde: "recorde",

        vitorias: "vitorias",

        pontuacao: "pontuacao"

    };

    const campo = campos[ordenar] || "velocidade";

    const classificados = [...ranking]

        .sort((a, b) =>

            b[campo] - a[campo] ||

            b.velocidade - a.velocidade ||

            b.precisao - a.precisao ||

            b.vitorias - a.vitorias ||

            a.nome.localeCompare(b.nome, "pt-BR")

        )

        .map((aluno, index) => ({

            ...aluno,

            posicaoRanking: index + 1

        }))

        .filter(aluno =>

            normalizar(aluno.nome).includes(busca)

        );

    if (!classificados.length) {

        tabelaVazia(

            tabela,

            10,

            "Nenhum resultado disponível no ranking."

        );

        return;

    }

    classificados.forEach(aluno => {

        criarLinha(tabela, [

            criarPosicao(aluno.posicaoRanking),

            aluno.nome,

            `${formatarMedia(aluno.velocidade)} PPM`,

            `${aluno.recorde} PPM`,

            `${formatarMedia(aluno.precisao)}%`,

            formatarNumero(aluno.acertos),

            formatarNumero(aluno.erros),

            aluno.partidas,

            aluno.vitorias,

            formatarNumero(aluno.pontuacao)

        ]);

    });

}

// ==========================================
// HISTÓRICO DE PARTIDAS
// ==========================================

function renderizarHistorico() {

    const tabela = el("tabelaHistorico");

    const busca = normalizar(el("buscarHistorico").value);

    const modo = el("filtroModo").value;

    const periodo = el("filtroPeriodo").value;

    tabela.replaceChildren();

    const agora = new Date();

    const filtrados = desempenhos.filter(item => {

        const aluno = alunos.find(

            aluno => aluno.id === item.aluno_id

        );

        const correspondeBusca =

            normalizar(aluno?.nome).includes(busca);

        const correspondeModo =

            modo === "todos" || item.modo_jogo === modo;

        let correspondePeriodo = true;

        const data = new Date(item.criado_em);

        if (periodo === "hoje") {

            correspondePeriodo =

                data.toDateString() === agora.toDateString();

        } else if (periodo !== "todos") {

            const limite = new Date();

            limite.setDate(

                limite.getDate() - Number(periodo)

            );

            correspondePeriodo = data >= limite;

        }

        return correspondeBusca &&

            correspondeModo &&

            correspondePeriodo;

    });

    if (!filtrados.length) {

        tabelaVazia(

            tabela,

            10,

            "Nenhuma partida encontrada."

        );

        return;

    }

    filtrados.forEach(item => {

        const aluno = alunos.find(

            aluno => aluno.id === item.aluno_id

        );

        criarLinha(tabela, [

            formatarData(item.criado_em),

            aluno?.nome || "Aluno indisponível",

            formatarModo(item.modo_jogo),

            `${numero(item.velocidade)} PPM`,

            `${formatarMedia(item.precisao)}%`,

            formatarNumero(item.acertos),

            formatarNumero(item.erros),

            formatarTempo(item.tempo_final),

            item.posicao ? `${item.posicao}º` : "—",

            formatarNumero(item.pontuacao)

        ]);

    });

}

// ==========================================
// GRÁFICOS
// ==========================================

function criarGrafico(id, labels, valores, titulo, cor, maximo) {

    if (typeof Chart === "undefined") return;

    const canvas = el(id);

    if (!canvas) return;

    if (graficos[id]) {

        graficos[id].destroy();

    }

    graficos[id] = new Chart(canvas, {

        type: "line",

        data: {

            labels: labels,

            datasets: [{

                label: titulo,

                data: valores,

                borderColor: cor,

                backgroundColor: `${cor}20`,

                borderWidth: 3,

                tension: 0.3,

                fill: true,

                pointRadius: 3,

                pointHoverRadius: 6

            }]

        },

        options: {

            responsive: true,

            maintainAspectRatio: false,

            plugins: {

                legend: {

                    display: false

                }

            },

            scales: {

                y: {

                    beginAtZero: true,

                    ...(maximo ? { max: maximo } : {})

                }

            }

        }

    });

}

// ==========================================
// GRÁFICOS GERAIS POR DIA
// ==========================================

function atualizarGraficosGerais() {

    const grupos = new Map();

    desempenhos.forEach(item => {

        const data = new Date(item.criado_em);

        const chave = [

            data.getFullYear(),

            String(data.getMonth() + 1).padStart(2, "0"),

            String(data.getDate()).padStart(2, "0")

        ].join("-");

        if (!grupos.has(chave)) {

            grupos.set(chave, []);

        }

        grupos.get(chave).push(item);

    });

    const dias = [...grupos.keys()].sort().slice(-30);

    const labels = dias.map(dia => {

        const [ano, mes, data] = dia.split("-");

        return `${data}/${mes}`;

    });

    const velocidades = dias.map(dia =>

        calcularEstatisticas(grupos.get(dia)).velocidade

    );

    const precisoes = dias.map(dia =>

        calcularEstatisticas(grupos.get(dia)).precisao

    );

    criarGrafico(

        "graficoVelocidade",

        labels,

        velocidades,

        "Velocidade média (PPM)",

        "#16a34a"

    );

    criarGrafico(

        "graficoPrecisao",

        labels,

        precisoes,

        "Precisão média (%)",

        "#2563eb",

        100

    );

}

// ==========================================
// DESEMPENHO INDIVIDUAL
// ==========================================

function abrirAluno(alunoId) {

    const aluno = alunos.find(

        item => item.id === alunoId

    );

    if (!aluno) return;

    const partidas = desempenhos.filter(

        item => item.aluno_id === alunoId

    );

    const estatisticas = calcularEstatisticas(partidas);

    el("modalNome").textContent = aluno.nome;

    el("modalMatricula").textContent =
        `Matrícula: ${aluno.matricula}`;

    el("modalPartidas").textContent =
        estatisticas.partidas;

    el("modalVelocidade").textContent =
        `${formatarMedia(estatisticas.velocidade)} PPM`;

    el("modalPrecisao").textContent =
        `${formatarMedia(estatisticas.precisao)}%`;

    el("modalRecorde").textContent =
        `${estatisticas.recorde} PPM`;

    el("modalAcertos").textContent =
        formatarNumero(estatisticas.acertos);

    el("modalErros").textContent =
        formatarNumero(estatisticas.erros);

    const tabela = el("tabelaHistoricoAluno");

    tabela.replaceChildren();

    if (!partidas.length) {

        tabelaVazia(

            tabela,

            7,

            "Este aluno ainda não possui partidas registradas."

        );

    } else {

        partidas.forEach(item => {

            criarLinha(tabela, [

                formatarData(item.criado_em),

                formatarModo(item.modo_jogo),

                `${numero(item.velocidade)} PPM`,

                `${formatarMedia(item.precisao)}%`,

                formatarNumero(item.acertos),

                formatarNumero(item.erros),

                item.posicao ? `${item.posicao}º` : "—"

            ]);

        });

    }

    el("modalAluno").showModal();

    const evolucao = partidas

        .slice(0, 30)

        .reverse();

    const labels = evolucao.map(item =>

        new Date(item.criado_em).toLocaleDateString("pt-BR")

    );

    criarGrafico(

        "graficoAlunoVelocidade",

        labels,

        evolucao.map(item => numero(item.velocidade)),

        "Velocidade (PPM)",

        "#16a34a"

    );

    criarGrafico(

        "graficoAlunoPrecisao",

        labels,

        evolucao.map(item => numero(item.precisao)),

        "Precisão (%)",

        "#2563eb",

        100

    );

}

// ==========================================
// NAVEGAÇÃO
// ==========================================

function abrirSecao(secao) {

    const titulos = {

        dashboard: "Visão geral",

        alunos: "Gestão de alunos",

        ranking: "Ranking geral",

        historico: "Histórico de partidas"

    };

    document.querySelectorAll(".page-section")

        .forEach(item => {

            item.classList.remove("active");

        });

    document.querySelectorAll("[data-section]")

        .forEach(item => {

            item.classList.toggle(

                "active",

                item.dataset.section === secao

            );

        });

    el(secao).classList.add("active");

    el("tituloPagina").textContent = titulos[secao];

    el("sidebar").classList.remove("open");

    if (secao === "dashboard") {

        requestAnimationFrame(() => {

            graficos.graficoVelocidade?.resize();

            graficos.graficoPrecisao?.resize();

        });

    }

}

// ==========================================
// SAIR DA CONTA
// ==========================================

async function sair() {

    const { error } = await db.auth.signOut({

        scope: "local"

    });

    if (error) {

        mostrarMensagem(

            "Não foi possível encerrar a sessão.",

            "erro"

        );

        return;

    }

    window.location.replace("professor.html");

}

// ==========================================
// EVENTOS
// ==========================================

function configurarEventos() {

    document.querySelectorAll("[data-section]")

        .forEach(botao => {

            botao.addEventListener("click", () => {

                abrirSecao(botao.dataset.section);

            });

        });

    el("btnMenu").addEventListener("click", () => {

        el("sidebar").classList.toggle("open");

    });

    el("btnAtualizar").addEventListener(

        "click",

        carregarDados

    );

    el("btnSair").addEventListener(

        "click",

        sair

    );

    el("buscarAluno").addEventListener(

        "input",

        renderizarAlunos

    );

    el("filtroStatus").addEventListener(

        "change",

        renderizarAlunos

    );

    el("buscarRanking").addEventListener(

        "input",

        renderizarRanking

    );

    el("ordenarRanking").addEventListener(

        "change",

        renderizarRanking

    );

    el("buscarHistorico").addEventListener(

        "input",

        renderizarHistorico

    );

    el("filtroModo").addEventListener(

        "change",

        renderizarHistorico

    );

    el("filtroPeriodo").addEventListener(

        "change",

        renderizarHistorico

    );

    el("fecharModal").addEventListener("click", () => {

        el("modalAluno").close();

    });

}