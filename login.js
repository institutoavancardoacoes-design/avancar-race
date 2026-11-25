// ==========================================
// AVANÇAR RACE 6.0
// AUTENTICAÇÃO DO ALUNO
// INSTITUTO AVANÇAR
// ==========================================

const db = supabaseClient;

// ==========================================
// ELEMENTOS
// ==========================================

const el = id => document.getElementById(id);

const loginForm = el("loginForm");
const usuarioInput = el("usuario");
const senhaInput = el("senha");
const btnLogin = el("btnLogin");
const toggleSenha = el("toggleSenha");
const mensagem = el("mensagem");

let processando = false;
let acessoAutorizado = false;

// ==========================================
// ANO AUTOMÁTICO
// ==========================================

el("anoAtual").textContent = new Date().getFullYear();

// ==========================================
// MOSTRAR E OCULTAR SENHA
// ==========================================

toggleSenha.addEventListener("click", () => {

    const visivel = senhaInput.type === "password";

    senhaInput.type = visivel ? "text" : "password";

    toggleSenha.textContent = visivel ? "🙈" : "👁";

    toggleSenha.setAttribute(
        "aria-label",
        visivel ? "Ocultar senha" : "Mostrar senha"
    );

});

// ==========================================
// MENSAGENS
// ==========================================

function mostrarMensagem(texto, tipo = "info") {

    mensagem.textContent = texto;

    mensagem.className = `mensagem ${tipo}`;

}

function limparMensagem() {

    mensagem.textContent = "";

    mensagem.className = "mensagem";

}

// ==========================================
// ESTADO DO BOTÃO
// ==========================================

function carregando(estado) {

    processando = estado;

    btnLogin.disabled = estado || acessoAutorizado;

    btnLogin.textContent = estado
        ? "AUTENTICANDO..."
        : acessoAutorizado
            ? "ACESSO AUTORIZADO ✓"
            : "ENTRAR NA MINHA CONTA";

}

// ==========================================
// NORMALIZAR NOME DE USUÁRIO
// ==========================================

function normalizarUsuario(valor) {

    return valor.trim().toLowerCase();

}

// ==========================================
// GERAR IDENTIFICADOR INTERNO
// ==========================================

function gerarMatriculaInterna(usuario) {

    return usuario
        .replace(/\./g, "_")
        .toUpperCase();

}

// ==========================================
// GERAR E-MAIL INTERNO
// ==========================================

function gerarEmailAluno(usuario) {

    const matricula = gerarMatriculaInterna(usuario);

    return `${matricula.toLowerCase()}@alunos.avancarrace.invalid`;

}

// ==========================================
// ENCERRAR SESSÃO
// ==========================================

async function encerrarSessao() {

    const { error } = await db.auth.signOut({
        scope: "local"
    });

    if (error) {

        console.error("Erro ao encerrar sessão:", error);

    }

}

// ==========================================
// CONSULTAR CADASTRO DO ALUNO
// ==========================================

async function consultarAluno(usuarioId) {

    const { data, error } = await db

        .from("alunos")

        .select(`
            id,
            nome,
            matricula,
            turma_id,
            ativo,
            status
        `)

        .eq("usuario_id", usuarioId)

        .maybeSingle();

    if (error) {

        throw error;

    }

    return data;

}

// ==========================================
// REALIZAR LOGIN
// ==========================================

loginForm.addEventListener("submit", async event => {

    event.preventDefault();

    if (processando || acessoAutorizado) return;

    limparMensagem();

    const usuario = normalizarUsuario(
        usuarioInput.value
    );

    const senha = senhaInput.value;

    // ======================================
    // VALIDAR INFORMAÇÕES
    // ======================================

    if (!usuario || !senha) {

        mostrarMensagem(
            "Informe seu usuário e sua senha.",
            "erro"
        );

        return;

    }

    if (!/^[a-z0-9._-]{3,40}$/.test(usuario)) {

        mostrarMensagem(
            "Informe um nome de usuário válido.",
            "erro"
        );

        usuarioInput.focus();

        return;

    }

    carregando(true);

    let autenticado = false;

    try {

        // ==================================
        // GERAR IDENTIFICAÇÃO INTERNA
        // ==================================

        const matricula = gerarMatriculaInterna(usuario);

        const email = gerarEmailAluno(usuario);

        // ==================================
        // AUTENTICAR NO SUPABASE
        // ==================================

        const { data, error } = await db.auth

            .signInWithPassword({

                email: email,

                password: senha

            });

        if (error || !data.user) {

            mostrarMensagem(
                "Usuário ou senha incorretos.",
                "erro"
            );

            return;

        }

        autenticado = true;

        // ==================================
        // VERIFICAR TIPO DE CONTA
        // ==================================

        if (
            data.user.is_anonymous ||
            data.user.app_metadata?.tipo_conta !== "aluno"
        ) {

            await encerrarSessao();

            mostrarMensagem(
                "Conta de aluno inválida.",
                "erro"
            );

            return;

        }

        // ==================================
        // CONSULTAR ALUNO
        // ==================================

        const aluno = await consultarAluno(data.user.id);

        if (!aluno) {

            await encerrarSessao();

            mostrarMensagem(
                "Cadastro indisponível. Procure seu professor.",
                "erro"
            );

            return;

        }

        // ==================================
        // VERIFICAR IDENTIFICADOR
        // ==================================

        if (
            String(aluno.matricula || "")
                .trim()
                .toUpperCase() !== matricula
        ) {

            await encerrarSessao();

            mostrarMensagem(
                "Não foi possível validar sua conta.",
                "erro"
            );

            return;

        }

        // ==================================
        // VERIFICAR APROVAÇÃO
        // ==================================

        if (aluno.status === "pendente") {

            await encerrarSessao();

            mostrarMensagem(
                "Seu cadastro está aguardando a aprovação do professor.",
                "info"
            );

            return;

        }

        // ==================================
        // VERIFICAR CONTA ATIVA
        // ==================================

        if (
            aluno.ativo !== true ||
            aluno.status !== "aprovado"
        ) {

            await encerrarSessao();

            mostrarMensagem(
                "Sua conta não está autorizada. Procure seu professor.",
                "erro"
            );

            return;

        }

        // ==================================
        // ACESSO AUTORIZADO
        // ==================================

        acessoAutorizado = true;

        mostrarMensagem(
            `Bem-vindo(a), ${aluno.nome}!`,
            "sucesso"
        );

        btnLogin.disabled = true;

        btnLogin.textContent = "ACESSO AUTORIZADO ✓";

        senhaInput.value = "";

        // ==================================
        // REDIRECIONAR PARA O PORTAL
        // ==================================

        setTimeout(() => {

            window.location.replace("aluno.html");

        }, 1000);

    } catch (error) {

        console.error("Erro de autenticação:", error);

        if (autenticado && !acessoAutorizado) {

            await encerrarSessao();

        }

        mostrarMensagem(
            "Não foi possível acessar sua conta. Tente novamente.",
            "erro"
        );

    } finally {

        senhaInput.value = "";

        carregando(false);

    }

});

// ==========================================
// LIMPAR MENSAGENS AO DIGITAR
// ==========================================

usuarioInput.addEventListener(
    "input",
    limparMensagem
);

senhaInput.addEventListener(
    "input",
    limparMensagem
);