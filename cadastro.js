// ==========================================
// AVANÇAR RACE 6.0
// CADASTRO AUTOMÁTICO DOS ALUNOS
// INSTITUTO AVANÇAR
// ==========================================

const db = supabaseClient;

const el = id => document.getElementById(id);

// ==========================================
// ELEMENTOS
// ==========================================

const formulario = el("cadastroForm");
const nomeInput = el("nome");
const turmaInput = el("turma");
const senhaInput = el("senha");
const confirmarSenhaInput = el("confirmarSenha");
const btnCadastro = el("btnCadastro");
const mensagem = el("mensagem");

let processando = false;
let cadastroConcluido = false;

const turmasPermitidas = [
    "matutino",
    "vespertino",
    "noturno"
];

// ==========================================
// INICIALIZAÇÃO
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    el("anoAtual").textContent = new Date().getFullYear();

    configurarEventos();

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
// CARREGAMENTO
// ==========================================

function carregando(estado) {

    processando = estado;

    btnCadastro.disabled = estado || cadastroConcluido;

    btnCadastro.textContent = estado
        ? "CRIANDO SUA CONTA..."
        : "CRIAR MINHA CONTA";

}

// ==========================================
// MOSTRAR E OCULTAR SENHA
// ==========================================

function configurarSenha(botaoId, inputId) {

    const botao = el(botaoId);

    const input = el(inputId);

    botao.addEventListener("click", () => {

        const mostrar = input.type === "password";

        input.type = mostrar ? "text" : "password";

        botao.textContent = mostrar ? "🙈" : "👁";

        botao.setAttribute(
            "aria-label",
            mostrar ? "Ocultar senha" : "Mostrar senha"
        );

    });

}

// ==========================================
// COMUNICAÇÃO COM SUPABASE
// ==========================================

async function chamarServidor(dados) {

    const { data, error } = await db.functions.invoke(
        "cadastro-alunos",
        {
            body: dados
        }
    );

    if (error) {

        let texto = "Não foi possível realizar o cadastro.";

        if (error.context instanceof Response) {

            try {

                const resposta = await error.context.json();

                texto = resposta.erro || texto;

            } catch {

                // Mantém a mensagem padrão.

            }

        }

        throw new Error(texto);

    }

    if (!data?.sucesso) {

        throw new Error(
            data?.erro || "Cadastro não concluído."
        );

    }

    return data;

}

// ==========================================
// TELA DE CADASTRO CONCLUÍDO
// ==========================================

function mostrarCadastroConcluido(resposta) {

    formulario.hidden = true;

    const welcome = document.querySelector(".welcome");

    if (welcome) {

        welcome.hidden = true;

    }

    const painel = document.createElement("div");

    painel.style.cssText = `
        background: #f0fdf4;
        border: 1px solid #86efac;
        border-radius: 18px;
        padding: 28px;
        margin: 20px 0;
        text-align: center;
        color: #166534;
    `;

    painel.innerHTML = `

        <div style="font-size: 55px;">
            🎉
        </div>

        <h2 style="margin: 12px 0;">
            Cadastro realizado!
        </h2>

        <p id="confirmacaoNome"></p>

        <p id="confirmacaoTurma"
           style="margin: 12px 0;">
        </p>

        <div style="
            background: white;
            border: 2px dashed #22c55e;
            border-radius: 12px;
            padding: 20px;
            margin: 20px 0;
        ">

            <small>
                SEU NOME DE USUÁRIO
            </small>

            <h2 id="usuarioGerado" style="
                margin: 12px 0;
                color: #15803d;
                overflow-wrap: anywhere;
            "></h2>

            <button
                type="button"
                id="copiarUsuario"
                style="
                    background: #166534;
                    color: white;
                    padding: 12px 20px;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: bold;
                "
            >
                📋 COPIAR USUÁRIO
            </button>

        </div>

        <p style="
            color: #92400e;
            background: #fef3c7;
            padding: 15px;
            border-radius: 10px;
        ">

            ⚠️ Guarde seu nome de usuário.
            Você precisará dele e da sua senha
            para acessar sua conta.

        </p>

        <p style="margin: 20px 0;">

            ⏳ Aguarde a aprovação do professor
            para acessar seu portal.

        </p>

        <a href="login.html" style="
            display: block;
            background: #15803d;
            color: white;
            padding: 15px;
            border-radius: 10px;
            text-decoration: none;
            font-weight: bold;
        ">

            IR PARA O LOGIN

        </a>

    `;

    formulario.after(painel);

    painel.querySelector("#confirmacaoNome").textContent =
        `Bem-vindo(a), ${resposta.nome}!`;

    painel.querySelector("#confirmacaoTurma").textContent =
        `Turma: ${resposta.turma}`;

    painel.querySelector("#usuarioGerado").textContent =
        resposta.usuario;

    const botaoCopiar = painel.querySelector("#copiarUsuario");

    botaoCopiar.addEventListener("click", async () => {

        try {

            await navigator.clipboard.writeText(
                resposta.usuario
            );

            botaoCopiar.textContent = "✓ USUÁRIO COPIADO";

        } catch {

            botaoCopiar.textContent =
                "Copie o usuário manualmente";

        }

    });

    painel.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

}

// ==========================================
// CADASTRAR ALUNO
// ==========================================

async function cadastrarAluno(event) {

    event.preventDefault();

    if (processando || cadastroConcluido) return;

    limparMensagem();

    const nome = nomeInput.value
        .trim()
        .replace(/\s+/g, " ");

    const turma = turmaInput.value
        .trim()
        .toLowerCase();

    const senha = senhaInput.value;

    const confirmarSenha = confirmarSenhaInput.value;

    // VALIDAR NOME

    if (nome.length < 3 || nome.length > 150) {

        mostrarMensagem(
            "Informe seu nome completo.",
            "erro"
        );

        nomeInput.focus();

        return;

    }

    // VALIDAR TURMA

    if (!turmasPermitidas.includes(turma)) {

        mostrarMensagem(
            "Selecione uma turma válida.",
            "erro"
        );

        turmaInput.focus();

        return;

    }

    // VALIDAR SENHA

    if (senha.length < 8) {

        mostrarMensagem(
            "Sua senha deve possuir pelo menos 8 caracteres.",
            "erro"
        );

        return;

    }

    if (new TextEncoder().encode(senha).length > 72) {

        mostrarMensagem(
            "Sua senha ultrapassa o tamanho permitido.",
            "erro"
        );

        return;

    }

    if (senha !== confirmarSenha) {

        mostrarMensagem(
            "As senhas informadas não são iguais.",
            "erro"
        );

        return;

    }

    // ENVIAR CADASTRO

    carregando(true);

    try {

        const resposta = await chamarServidor({

            acao: "solicitar_cadastro",

            nome: nome,

            turma: turma,

            senha: senha

        });

        cadastroConcluido = true;

        formulario.reset();

        btnCadastro.disabled = true;

        btnCadastro.textContent = "CADASTRO REALIZADO ✓";

        if (!resposta.usuario) {

            mostrarMensagem(
                "Conta criada, mas o usuário não foi exibido. Procure o professor.",
                "info"
            );

            return;

        }

        mostrarCadastroConcluido(resposta);

    } catch (error) {

        mostrarMensagem(
            cadastroConcluido
                ? "Conta criada. Procure o professor para consultar seu usuário."
                : error.message || "Não foi possível realizar o cadastro.",
            "erro"
        );

    } finally {

        senhaInput.value = "";

        confirmarSenhaInput.value = "";

        processando = false;

        if (!cadastroConcluido) {

            carregando(false);

        }

    }

}

// ==========================================
// EVENTOS
// ==========================================

function configurarEventos() {

    configurarSenha(
        "toggleSenha",
        "senha"
    );

    configurarSenha(
        "toggleConfirmarSenha",
        "confirmarSenha"
    );

    turmaInput.addEventListener(
        "change",
        limparMensagem
    );

    formulario.addEventListener(
        "submit",
        cadastrarAluno
    );

}