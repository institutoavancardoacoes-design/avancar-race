// ==========================================
// AVANÇAR RACE
// INSTITUTO AVANÇAR
// CONEXÃO SUPABASE
// ==========================================

// CONFIGURAÇÃO DO PROJETO

const SUPABASE_URL =
  "https://mnbustwmlhvkfukkubud.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_EaKFf_FKw3XDL7w4nqXX7g_nIXZF3O2";

// ==========================================
// INICIALIZAR CLIENTE SUPABASE
// ==========================================

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  }
);

// ==========================================
// IDENTIFICAR AMBIENTE
// ==========================================

const paginaAtual =
  window.location.pathname.split("/").pop().toLowerCase();

const ambienteProfessor =
  paginaAtual === "professor.html" ||
  paginaAtual === "desempenho.html";

// ==========================================
// CONEXÃO E AUTENTICAÇÃO
// ==========================================

async function conectarSupabase() {

  try {

    const {
      data: { session: sessaoAtual },
      error: erroSessao
    } = await supabaseClient.auth.getSession();

    if (erroSessao) {
      throw erroSessao;
    }

    let session = sessaoAtual;

    // PAINEL DO PROFESSOR
    // Não criar conta anônima automaticamente.

    if (ambienteProfessor) {

      console.log(
        "AVANÇAR RACE: ambiente do professor."
      );

      return session;
    }

    // ÁREA DOS ALUNOS
    // Criar sessão anônima somente se necessário.

    if (!session) {

      const {
        data,
        error
      } = await supabaseClient.auth.signInAnonymously();

      if (error) {
        throw error;
      }

      session = data.session;
    }

    console.log(
      "AVANÇAR RACE: autenticação realizada!"
    );

    return session;

  } catch (error) {

    console.error(
      "AVANÇAR RACE: erro na autenticação:",
      error.message
    );

    return null;
  }
}

// ==========================================
// CONSULTAR USUÁRIO ATUAL
// ==========================================

async function obterUsuarioAtual() {

  const {
    data: { user },
    error
  } = await supabaseClient.auth.getUser();

  if (error) {
    console.error(
      "Erro ao consultar usuário:",
      error.message
    );

    return null;
  }

  return user;
}

// ==========================================
// VERIFICAR SE É PROFESSOR
// ==========================================

async function verificarPermissaoProfessor() {

  try {

    const usuario = await obterUsuarioAtual();

    if (!usuario || usuario.is_anonymous) {
      return false;
    }

    const {
      data,
      error
    } = await supabaseClient.rpc("eh_professor");

    if (error) {
      throw error;
    }

    return data === true;

  } catch (error) {

    console.error(
      "Erro ao verificar professor:",
      error.message
    );

    return false;
  }
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================

// Somente os alunos recebem autenticação
// anônima automaticamente.

if (!ambienteProfessor) {

  conectarSupabase();

} else {

  console.log(
    "Painel do professor pronto para login."
  );

}