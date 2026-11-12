// Configurações compartilhadas entre content script e popup.
// Cada chave booleana vira um atributo `data-gr-<chave>` no <html> do GitHub,
// e todo o CSS da extensão é escopado por esses atributos. Desligar uma opção
// remove o atributo e o GitHub volta ao normal, sem recarregar a página.
const GR_DEFAULTS = {
  enabled: true,   // chave geral
  theme: true,     // paleta, tipografia e raios via tokens do Primer
  cards: true,     // listas de PR/issue como cartões com faixa de estado
  groupBots: true, // PRs de bots (dependabot, renovate, build(deps)) no fim da lista e recolhidos
  dimDrafts: true, // rascunhos esmaecidos
  readable: true,  // descrições/comentários em markdown mais legíveis
  toc: true,       // página do PR: índice flutuante da descrição
  compactSidebar: true, // página do PR: seções vazias da barra lateral em uma linha
  prNumber: true,  // página do PR: #número visível ao lado do título (clique copia)
  cockpit: true,   // página do PR: Overview vira "o que falta para o merge" (lido da própria página)
  oldModeHint: true,   // página do PR: destaca o seletor "Preview" para voltar à interface antiga
  debug: false,    // contorna os elementos que a extensão reconheceu
  accent: "violet" // violet | blue | green | orange
};

const GR_CACHE_KEY = "gr-settings-cache";
