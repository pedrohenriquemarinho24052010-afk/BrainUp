/*
  BrainUp — aplicação demonstrativa para GitHub Pages.
  Cadastro, perfil, tarefas e interações ficam no localStorage deste navegador.
  Para contas reais e recursos compartilhados entre estudantes, conecte um backend.
*/
const STORAGE_USERS = 'brainup_users_v2';
const STORAGE_SESSION = 'brainup_session_v2';

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const publicSite = $('#publicSite');
const appShell = $('#appShell');
const authOverlay = $('#authOverlay');
const authForm = $('#authForm');
const authName = $('#authName');
const authEmail = $('#authEmail');
const authPassword = $('#authPassword');
const authError = $('#authError');
let authMode = 'login';
let currentUser = null;
let currentFilter = 'Todas';
let currentView = 'dashboard';
let toastTimer = null;
let quizIndex = 0;
let quizAnswered = false;
let quizScoreSession = 0;

function readUsers() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_USERS) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch (error) {
    console.warn('Não foi possível ler os dados locais do BrainUp.', error);
    return {};
  }
}

function writeUsers(users) {
  try {
    localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
    return true;
  } catch (error) {
    showToast('O navegador não conseguiu salvar os dados. Verifique o espaço disponível.');
    console.error(error);
    return false;
  }
}

function saveCurrentUser() {
  if (!currentUser) return;
  const users = readUsers();
  users[currentUser.email] = currentUser;
  writeUsers(users);
  updateTopbar();
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getDefaultTasks() {
  return [
    { id: makeId(), title: 'Revisar matemática', subject: 'Matemática', day: 'Hoje', done: false, rewarded: false },
    { id: makeId(), title: 'Ler um capítulo', subject: 'Português', day: 'Hoje', done: false, rewarded: false },
    { id: makeId(), title: 'Resolver exercícios', subject: 'Biologia', day: 'Hoje', done: false, rewarded: false },
    { id: makeId(), title: 'Revisar anotações da aula', subject: 'História', day: 'Amanhã', done: false, rewarded: false }
  ];
}

function createUser(name, email, salt, passwordHash) {
  return {
    name,
    email,
    salt,
    passwordHash,
    createdAt: new Date().toISOString(),
    xp: 0,
    tasks: getDefaultTasks(),
    groups: [],
    posts: [],
    likedPosts: [],
    quizRewards: [],
    lastLogin: new Date().toISOString()
  };
}

async function hashPassword(password, salt) {
  const value = `${salt}:${password}`;
  if (window.crypto && window.crypto.subtle && window.TextEncoder) {
    const encoded = new TextEncoder().encode(value);
    const digest = await window.crypto.subtle.digest('SHA-256', encoded);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  // Fallback apenas para permitir a demonstração em navegadores sem Web Crypto.
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `demo-${(hash >>> 0).toString(16)}`;
}

function makeSalt() {
  if (window.crypto && window.crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function showToast(message) {
  const toast = $('#toastMessage');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2800);
}

function openAuth(mode = 'login') {
  authMode = mode;
  configureAuth();
  authOverlay.classList.add('open');
  authOverlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  window.setTimeout(() => (mode === 'register' ? authName : authEmail).focus(), 50);
}

function closeAuth() {
  authOverlay.classList.remove('open');
  authOverlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  authError.textContent = '';
}

function configureAuth() {
  const registering = authMode === 'register';
  $('#authKicker').textContent = registering ? 'SEU PRIMEIRO PASSO' : 'BEM-VINDO DE VOLTA';
  $('#authTitle').textContent = registering ? 'Crie seu espaço.' : 'Entre no seu espaço.';
  $('#authDescription').textContent = registering
    ? 'Preencha seus dados para começar sua jornada.'
    : 'Continue de onde você parou.';
  $('#nameField').hidden = !registering;
  authName.required = registering;
  authPassword.autocomplete = registering ? 'new-password' : 'current-password';
  $('#authSubmit').innerHTML = registering ? 'Criar minha conta <span>→</span>' : 'Entrar na minha conta <span>→</span>';
  $('#authSwitchText').textContent = registering ? 'Já tem uma conta?' : 'Ainda não tem uma conta?';
  $('#authSwitch').textContent = registering ? 'Entrar' : 'Criar conta';
  authError.textContent = '';
  authForm.reset();
}

function setSession(email) {
  try { localStorage.setItem(STORAGE_SESSION, email); } catch (error) { console.warn(error); }
}

function enterApp(user) {
  currentUser = user;
  currentUser.lastLogin = new Date().toISOString();
  saveCurrentUser();
  closeAuth();
  publicSite.hidden = true;
  appShell.hidden = false;
  document.body.style.background = '#f5f7fb';
  renderAll();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function leaveApp() {
  currentUser = null;
  try { localStorage.removeItem(STORAGE_SESSION); } catch (error) { console.warn(error); }
  appShell.hidden = true;
  publicSite.hidden = false;
  document.body.style.background = '#fff';
  showToast('Você saiu da sua conta. Até a próxima!');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  authError.textContent = '';
  if (!authForm.checkValidity()) {
    authForm.reportValidity();
    return;
  }
  const email = authEmail.value.trim().toLowerCase();
  const password = authPassword.value;
  const users = readUsers();

  if (authMode === 'register') {
    const name = authName.value.trim();
    if (name.length < 2) {
      authError.textContent = 'Digite seu nome para continuar.';
      authName.focus();
      return;
    }
    if (users[email]) {
      authError.textContent = 'Esse e-mail já está cadastrado neste navegador. Entre na sua conta.';
      return;
    }
    const salt = makeSalt();
    const passwordHash = await hashPassword(password, salt);
    const newUser = createUser(name, email, salt, passwordHash);
    users[email] = newUser;
    if (!writeUsers(users)) return;
    setSession(email);
    enterApp(newUser);
    showToast(`Boas-vindas ao BrainUp, ${name.split(/\s+/)[0]}!`);
    return;
  }

  const user = users[email];
  if (!user) {
    authError.textContent = 'Não encontramos essa conta neste navegador. Crie uma conta primeiro.';
    return;
  }
  const attemptedHash = await hashPassword(password, user.salt || 'brainup-demo');
  if (attemptedHash !== user.passwordHash) {
    authError.textContent = 'E-mail ou senha não conferem. Tente novamente.';
    return;
  }
  setSession(email);
  enterApp(user);
  showToast(`Que bom ter você de volta, ${user.name.split(/\s+/)[0]}!`);
}

function updateTopbar() {
  if (!currentUser) return;
  const firstName = currentUser.name.trim().split(/\s+/)[0];
  $('#userChipName').textContent = firstName;
  $('#userAvatar').textContent = firstName.charAt(0).toUpperCase();
  $('#composerAvatar').textContent = firstName.charAt(0).toUpperCase();
  $('#welcomeName').textContent = firstName;
  $('#topbarXP').textContent = `${currentUser.xp} XP`;
}

function setView(viewName) {
  const target = $(`#view-${viewName}`);
  if (!target) return;
  currentView = viewName;
  $$('.app-view').forEach((view) => view.classList.toggle('active', view === target));
  $$('.side-link[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === viewName));
  $('#breadcrumbCurrent').textContent = target.dataset.title || 'Meu espaço';
  $('#sidebar').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (viewName === 'ranking') renderRanking();
  if (viewName === 'achievements') renderAchievements();
}

function getCompletedTasks() {
  return currentUser.tasks.filter((task) => task.done).length;
}

function getAchievements() {
  const completed = currentUser.tasks.filter((task) => task.done).length;
  return [
    { id: 'first', icon: '🌱', title: 'Primeiro passo', description: 'Conclua sua primeira tarefa de estudo.', unlocked: completed >= 1 },
    { id: 'planner', icon: '📘', title: 'Mente organizada', description: 'Conclua 5 tarefas da sua rotina.', unlocked: completed >= 5 },
    { id: 'focus', icon: '🎯', title: 'Foco de verdade', description: 'Conclua 10 tarefas de estudo.', unlocked: completed >= 10 },
    { id: 'curious', icon: '💡', title: 'Mente curiosa', description: 'Acerte uma pergunta do desafio.', unlocked: currentUser.quizRewards.length >= 1 },
    { id: 'together', icon: '🤝', title: 'Aprender junto', description: 'Entre em um grupo ou publique uma dica.', unlocked: currentUser.groups.length >= 1 || currentUser.posts.length >= 1 },
    { id: 'champion', icon: '🏆', title: 'Em evolução', description: 'Acumule 200 pontos de experiência.', unlocked: currentUser.xp >= 200 }
  ];
}

function getLevel() {
  const level = Math.floor(currentUser.xp / 100) + 1;
  const progress = currentUser.xp % 100;
  return { level, progress, next: level * 100 };
}

function getTodayLabel() {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
}

function renderAll() {
  updateTopbar();
  $('#todayDate').textContent = getTodayLabel();
  renderDashboard();
  renderRoutine();
  renderCommunity();
  renderGroups();
  renderRanking();
  renderAchievements();
  renderQuiz();
  $('#quizScore').textContent = `${quizScoreSession} XP`;
}

function renderDashboard() {
  const level = getLevel();
  const tasks = currentUser.tasks.slice(0, 4);
  const done = getCompletedTasks();
  const todayTotal = currentUser.tasks.length;
  const percent = todayTotal ? Math.round((done / todayTotal) * 100) : 0;
  $('#statXP').innerHTML = `${currentUser.xp} <small>XP</small>`;
  $('#statTasks').textContent = done;
  $('#statBadges').textContent = getAchievements().filter((badge) => badge.unlocked).length;
  $('#statGroups').textContent = currentUser.groups.length;
  $('#heroLevel').textContent = String(level.level).padStart(2, '0');
  $('#heroLevelName').textContent = level.level < 2 ? 'Iniciante' : level.level < 4 ? 'Em evolução' : 'Destaque';
  $('#levelNumber').textContent = String(level.level).padStart(2, '0');
  $('#levelLabel').textContent = level.level < 2 ? 'Nível iniciante' : `Nível ${level.level}`;
  $('#levelProgressBar').style.width = `${level.progress}%`;
  $('#levelXPText').textContent = `${level.progress} / 100 XP`;
  $('#nextLevelText').textContent = `Próximo nível: ${level.next} XP`;
  $('#dashboardProgressText').textContent = `${done} de ${todayTotal} tarefas concluídas`;
  $('#dashboardProgressPercent').textContent = `${percent}%`;
  $('#dashboardProgressBar').style.width = `${percent}%`;
  $('#dashboardTaskList').innerHTML = tasks.length ? tasks.map((task) => taskRowHTML(task, false)).join('') : '<div class="empty-state"><strong>Nenhuma tarefa por aqui.</strong><p>Adicione uma atividade na sua rotina.</p></div>';
  bindTaskActions($('#dashboardTaskList'));
  $('#challengeXP').textContent = Math.min(currentUser.xp, 200);
  $('#challengeBar').style.width = `${Math.min(100, currentUser.xp / 2)}%`;
}

function taskRowHTML(task, allowDelete = true) {
  const chip = task.rewarded ? 'Concluída' : '+10 XP';
  return `<div class="task-row ${task.done ? 'completed' : ''}" data-task-id="${escapeHTML(task.id)}">
    <input class="task-checkbox" type="checkbox" aria-label="Marcar ${escapeHTML(task.title)} como concluída" data-task-toggle="${escapeHTML(task.id)}" ${task.done ? 'checked' : ''}>
    <div class="task-main"><strong>${escapeHTML(task.title)}</strong><small>${escapeHTML(task.subject)} · ${escapeHTML(task.day)}</small></div>
    <span class="task-xp">${chip}</span>
    ${allowDelete ? `<button class="task-delete" type="button" data-task-delete="${escapeHTML(task.id)}" aria-label="Excluir tarefa">×</button>` : ''}
  </div>`;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function bindTaskActions(container) {
  $$('[data-task-toggle]', container).forEach((checkbox) => {
    checkbox.addEventListener('change', () => toggleTask(checkbox.dataset.taskToggle, checkbox.checked));
  });
  $$('[data-task-delete]', container).forEach((button) => {
    button.addEventListener('click', () => deleteTask(button.dataset.taskDelete));
  });
}

function toggleTask(taskId, checked) {
  const task = currentUser.tasks.find((item) => item.id === taskId);
  if (!task) return;
  task.done = checked;
  if (checked && !task.rewarded) {
    task.rewarded = true;
    currentUser.xp += 10;
    showToast('Tarefa concluída! Você ganhou +10 XP. ✦');
  } else if (!checked) {
    showToast('Tarefa voltou para sua lista de pendências.');
  }
  saveCurrentUser();
  renderDashboard();
  renderRoutine();
  renderAchievements();
}

function deleteTask(taskId) {
  const task = currentUser.tasks.find((item) => item.id === taskId);
  if (!task) return;
  currentUser.tasks = currentUser.tasks.filter((item) => item.id !== taskId);
  saveCurrentUser();
  renderDashboard();
  renderRoutine();
  showToast('Tarefa removida da sua rotina.');
}

function renderRoutine() {
  const filtered = currentUser.tasks.filter((task) => {
    if (currentFilter === 'Pendentes') return !task.done;
    if (currentFilter === 'Concluídas') return task.done;
    return true;
  });
  $('#routineCount').textContent = `${currentUser.tasks.length} ${currentUser.tasks.length === 1 ? 'tarefa' : 'tarefas'}`;
  $('#fullTaskList').innerHTML = filtered.map((task) => taskRowHTML(task, true)).join('');
  $('#emptyTasks').hidden = filtered.length > 0;
  bindTaskActions($('#fullTaskList'));
  $$('.filter-pill').forEach((button) => button.classList.toggle('active', button.dataset.filter === currentFilter));
}

$('#taskForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const title = $('#taskTitle').value.trim();
  if (title.length < 2) return;
  currentUser.tasks.unshift({
    id: makeId(), title, subject: $('#taskSubject').value, day: $('#taskDay').value,
    done: false, rewarded: false
  });
  saveCurrentUser();
  $('#taskForm').reset();
  renderDashboard();
  renderRoutine();
  showToast('Tarefa adicionada à sua rotina!');
});

function renderCommunity() {
  const examples = [
    { id: 'sample-1', name: 'Lucas Almeida', initial: 'L', time: 'Hoje · 09:20', text: 'Uma dica para quem está estudando matemática: tentem resolver alguns exercícios logo depois de revisar a teoria. Ajuda bastante a fixar o conteúdo!', likes: 12 },
    { id: 'sample-2', name: 'Marina Costa', initial: 'M', time: 'Ontem · 18:45', text: 'Comecei a dividir a redação em pequenas etapas: primeiro ideias, depois introdução e por último a revisão. Assim fica bem menos pesado. 💙', likes: 8 }
  ];
  const ownPosts = currentUser.posts.map((post) => ({ ...post, own: true }));
  const posts = [...ownPosts, ...examples];
  $('#communityFeed').innerHTML = posts.map((post) => {
    const liked = currentUser.likedPosts.includes(post.id);
    const likes = (post.likes || 0) + (liked ? 1 : 0);
    return `<article class="post-card"><div class="post-head"><span class="user-avatar">${escapeHTML(post.initial || currentUser.name.charAt(0).toUpperCase())}</span><div><strong>${escapeHTML(post.name || currentUser.name)}</strong><small>${escapeHTML(post.time || 'Agora · sua publicação')}</small></div></div><p>${escapeHTML(post.text)}</p><div class="post-actions"><button type="button" class="${liked ? 'liked' : ''}" data-like-post="${escapeHTML(post.id)}">${liked ? '♥ Curtido' : '♡ Curtir'} · ${likes}</button><button type="button" data-post-thanks="${escapeHTML(post.id)}">↗ Agradecer</button></div></article>`;
  }).join('');
  $$('[data-like-post]').forEach((button) => button.addEventListener('click', () => toggleLike(button.dataset.likePost)));
  $$('[data-post-thanks]').forEach((button) => button.addEventListener('click', () => showToast('Que tal deixar uma mensagem positiva para quem publicou?')));
}

function toggleLike(postId) {
  const liked = currentUser.likedPosts.includes(postId);
  currentUser.likedPosts = liked ? currentUser.likedPosts.filter((id) => id !== postId) : [...currentUser.likedPosts, postId];
  saveCurrentUser();
  renderCommunity();
}

$('#publishPost').addEventListener('click', () => {
  const text = $('#postText').value.trim();
  if (text.length < 5) {
    $('#postError').textContent = 'Escreva um pouco mais antes de publicar.';
    return;
  }
  currentUser.posts.unshift({ id: makeId(), name: currentUser.name, initial: currentUser.name.charAt(0).toUpperCase(), time: 'Agora · sua publicação', text, likes: 0 });
  saveCurrentUser();
  $('#postText').value = '';
  $('#postError').textContent = '';
  renderCommunity();
  renderAchievements();
  renderDashboard();
  showToast('Sua publicação foi adicionada ao feed local!');
});

const studyGroups = [
  { id: 'math', icon: '∑', name: 'Matemática sem medo', members: 'Exercícios e explicações' },
  { id: 'writing', icon: '✎', name: 'Redação na prática', members: 'Ideias, textos e repertório' },
  { id: 'science', icon: '⚗', name: 'Ciências em grupo', members: 'Biologia, química e física' },
  { id: 'exams', icon: '★', name: 'Foco nos vestibulares', members: 'Metas e preparação' }
];

function renderGroups() {
  $('#groupsList').innerHTML = studyGroups.map((group) => {
    const joined = currentUser.groups.includes(group.id);
    return `<div class="group-item"><span class="group-symbol">${group.icon}</span><div class="group-info"><strong>${group.name}</strong><small>${group.members}</small></div><button class="group-join ${joined ? 'joined' : ''}" type="button" data-group="${group.id}">${joined ? 'Participando ✓' : 'Participar +'}</button></div>`;
  }).join('');
  $$('[data-group]').forEach((button) => button.addEventListener('click', () => toggleGroup(button.dataset.group)));
}

function toggleGroup(groupId) {
  const joined = currentUser.groups.includes(groupId);
  currentUser.groups = joined ? currentUser.groups.filter((id) => id !== groupId) : [...currentUser.groups, groupId];
  saveCurrentUser();
  renderGroups();
  renderDashboard();
  renderAchievements();
  showToast(joined ? 'Você saiu do grupo.' : 'Você entrou no grupo de estudos!');
}

function addChatMessage(text, type) {
  const wrapper = document.createElement('div');
  wrapper.className = `chat-message ${type === 'user' ? 'user-message' : 'assistant-message'}`;
  const content = document.createElement('div');
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  content.appendChild(paragraph);
  const small = document.createElement('small');
  small.textContent = type === 'user' ? 'Você' : 'Assistente BrainUp';
  content.appendChild(small);
  if (type === 'assistant') {
    const avatar = document.createElement('span');
    avatar.className = 'assistant-mini';
    avatar.textContent = 'B';
    wrapper.append(avatar, content);
  } else {
    wrapper.append(content);
  }
  $('#chatMessages').appendChild(wrapper);
  $('#chatMessages').scrollTop = $('#chatMessages').scrollHeight;
}

function getStudyAnswer(question) {
  const q = question.toLocaleLowerCase('pt-BR');
  if (/porcent|percentual|\%/.test(q)) return 'Para calcular uma porcentagem, transforme o percentual em fração de 100 e multiplique pelo valor. Exemplo: 20% de 150 = 20 ÷ 100 × 150 = 30. Uma dica: 10% é só dividir por 10; 20% é o dobro de 10%.\n\nTente fazer outro exemplo para praticar!';
  if (/fotoss[ií]ntese|clorofil/.test(q)) return 'Fotossíntese é o processo em que plantas, algas e algumas bactérias usam energia da luz para produzir matéria orgânica. De forma simplificada, a planta utiliza água e gás carbônico e libera oxigênio. A clorofila ajuda a captar a luz.\n\nLembre: luz + água + gás carbônico → produção de glicose + oxigênio.';
  if (/reda[cç][aã]o|introdu[cç][aã]o|disserta/.test(q)) return 'Uma boa redação pode ser organizada em quatro momentos: introdução com tema e tese; desenvolvimento 1 com um argumento; desenvolvimento 2 com outro argumento; e conclusão com uma proposta de intervenção.\n\nAntes de escrever, faça um pequeno roteiro com sua ideia principal e dois argumentos.';
  if (/equ[aã][cç][aã]o|matem[aá]tica|fra[cç][aã]o/.test(q)) return 'Uma boa forma de resolver matemática é separar os dados, identificar o que a questão pede e escolher a operação ou fórmula. Faça uma etapa por vez e confira se a resposta faz sentido.\n\nQuando puder, envie a questão completa para organizar a resolução passo a passo.';
  if (/hist[oó]ria|feudal|absolut/.test(q)) return 'Para estudar História, tente montar uma linha do tempo e relacionar causa e consequência. Por exemplo, ao estudar o feudalismo, observe a organização da sociedade, a relação entre senhores e servos e a importância da terra.\n\nResumir o assunto com suas próprias palavras ajuda a memorizar.';
  if (/qu[ií]mica|liga[cç][aã]o|[áa]tomo/.test(q)) return 'Em Química, comece identificando as partículas e o tipo de ligação. Na ligação iônica, há transferência de elétrons; na covalente, os átomos compartilham elétrons; na metálica, os elétrons ficam deslocalizados entre os átomos do metal.\n\nTente identificar primeiro quais elementos estão participando.';
  if (/biologia|c[eé]lula|organismo/.test(q)) return 'Biologia estuda os seres vivos e suas relações. Ao revisar um conteúdo, organize em: conceito, características, função e exemplos. Isso ajuda a entender em vez de apenas decorar.\n\nQual parte específica desse assunto está gerando dúvida?';
  if (/estudar|concentra|foco|mem[oó]ria|rotina/.test(q)) return 'Experimente estudar em blocos curtos: escolha uma tarefa, deixe o celular de lado e trabalhe por 20 a 25 minutos. Depois faça uma pausa rápida. No fim, tente explicar o que aprendeu sem olhar o material.\n\nComece com uma meta pequena e possível para hoje.';
  return 'Boa pergunta! Para te ajudar melhor, tente dizer qual é a matéria e qual parte do assunto está difícil. Uma estratégia é separar o tema em três partes: o que você já entendeu, o que ainda não entendeu e um exemplo da questão.\n\nEste assistente é uma demonstração com respostas preparadas, então não consegue consultar a internet ou responder a qualquer assunto como uma IA real.';
}

function submitChatQuestion(question) {
  const text = question.trim();
  if (!text) return;
  addChatMessage(text, 'user');
  window.setTimeout(() => addChatMessage(getStudyAnswer(text), 'assistant'), 450);
}

$('#chatForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = $('#chatInput');
  submitChatQuestion(input.value);
  input.value = '';
});
$$('[data-question]').forEach((button) => button.addEventListener('click', () => submitChatQuestion(button.dataset.question)));

const quizQuestions = [
  { subject: 'MATEMÁTICA', question: 'Quanto é 20% de 150?', options: ['15', '20', '30', '45'], answer: 2, explanation: '20% de 150 é 20 ÷ 100 × 150 = 30.' },
  { subject: 'BIOLOGIA', question: 'Qual é a principal função das raízes de uma planta?', options: ['Produzir flores', 'Absorver água e sais minerais', 'Realizar a polinização', 'Produzir sementes'], answer: 1, explanation: 'As raízes fixam a planta ao solo e absorvem água e sais minerais.' },
  { subject: 'PORTUGUÊS', question: 'Qual palavra é um substantivo?', options: ['Bonito', 'Rapidamente', 'Escola', 'Correr'], answer: 2, explanation: '“Escola” é um substantivo, pois nomeia um lugar.' },
  { subject: 'HISTÓRIA', question: 'Qual sistema marcou boa parte da Europa medieval?', options: ['Feudalismo', 'Socialismo', 'Capitalismo industrial', 'Mercantilismo'], answer: 0, explanation: 'O feudalismo marcou a organização econômica, política e social de grande parte da Europa medieval.' },
  { subject: 'QUÍMICA', question: 'Qual partícula possui carga elétrica negativa?', options: ['Próton', 'Nêutron', 'Elétron', 'Núcleo'], answer: 2, explanation: 'O elétron possui carga negativa; o próton é positivo e o nêutron não possui carga.' }
];

function renderQuiz() {
  const item = quizQuestions[quizIndex];
  quizAnswered = false;
  $('#quizSubject').textContent = item.subject;
  $('#quizQuestion').textContent = item.question;
  $('#quizCounter').textContent = `PERGUNTA ${String(quizIndex + 1).padStart(2, '0')} / ${String(quizQuestions.length).padStart(2, '0')}`;
  $('#quizProgress').style.width = `${((quizIndex + 1) / quizQuestions.length) * 100}%`;
  $('#quizOptions').innerHTML = item.options.map((option, index) => `<button class="quiz-option" type="button" data-answer="${index}"><strong>${String.fromCharCode(65 + index)}.</strong> ${option}</button>`).join('');
  $('#quizFeedback').textContent = '';
  $('#quizFeedback').className = 'quiz-feedback';
  $('#nextQuestion').disabled = true;
  $('#nextQuestion').textContent = quizIndex === quizQuestions.length - 1 ? 'Ver resultado ↗' : 'Próxima pergunta →';
  $$('[data-answer]').forEach((button) => button.addEventListener('click', () => answerQuiz(Number(button.dataset.answer))));
}

function answerQuiz(selected) {
  if (quizAnswered) return;
  quizAnswered = true;
  const item = quizQuestions[quizIndex];
  const correct = selected === item.answer;
  $$('[data-answer]').forEach((button, index) => {
    button.disabled = true;
    if (index === item.answer) button.classList.add('correct');
    else if (index === selected) button.classList.add('wrong');
  });
  const feedback = $('#quizFeedback');
  if (correct) {
    feedback.textContent = `Muito bem! ${item.explanation}`;
    feedback.classList.add('good');
    const rewardId = `question-${quizIndex}`;
    if (!currentUser.quizRewards.includes(rewardId)) {
      currentUser.quizRewards.push(rewardId);
      currentUser.xp += 15;
      quizScoreSession += 15;
      saveCurrentUser();
      $('#quizScore').textContent = `${quizScoreSession} XP`;
      showToast('Resposta correta! Você ganhou +15 XP. ✦');
    } else {
      showToast('Resposta correta! Você já recebeu XP por esta pergunta.');
    }
  } else {
    feedback.textContent = `Ainda não foi dessa vez. ${item.explanation}`;
    feedback.classList.add('bad');
  }
  $('#nextQuestion').disabled = false;
  renderDashboard();
  renderAchievements();
}

$('#nextQuestion').addEventListener('click', () => {
  if (!quizAnswered) return;
  if (quizIndex < quizQuestions.length - 1) {
    quizIndex += 1;
    renderQuiz();
  } else {
    const correctCount = quizQuestions.filter((_, index) => currentUser.quizRewards.includes(`question-${index}`)).length;
    $('#quizQuestion').textContent = 'Desafio concluído!';
    $('#quizOptions').innerHTML = `<div class="quiz-result"><strong>${correctCount} de ${quizQuestions.length}</strong><p>perguntas respondidas corretamente na sua conta.</p><button class="button button-primary" id="restartQuiz">Jogar novamente ↻</button></div>`;
    $('#quizFeedback').textContent = 'Continue praticando. Cada tentativa é uma oportunidade de aprender.';
    $('#nextQuestion').disabled = true;
    $('#nextQuestion').textContent = 'Desafio finalizado';
    $('#restartQuiz').addEventListener('click', () => { quizIndex = 0; renderQuiz(); });
  }
});

function renderRanking() {
  if (!currentUser) return;
  const examples = [
    { name: 'Ana Martins', initial: 'A', xp: 280, label: 'Estudante destaque' },
    { name: 'Gabriel Souza', initial: 'G', xp: 230, label: 'Estudante ativo' },
    { name: 'Lívia Rocha', initial: 'L', xp: 185, label: 'Estudante ativa' }
  ];
  const entries = [...examples, { name: `${currentUser.name} (você)`, initial: currentUser.name.charAt(0).toUpperCase(), xp: currentUser.xp, label: 'Sua pontuação', current: true }].sort((a, b) => b.xp - a.xp);
  $('#rankingList').innerHTML = entries.map((entry, index) => `<div class="ranking-row ${entry.current ? 'current' : ''}"><span class="ranking-position">${String(index + 1).padStart(2, '0')}</span><span class="ranking-avatar">${escapeHTML(entry.initial)}</span><div class="ranking-name"><strong>${escapeHTML(entry.name)}</strong><small>${entry.label}</small></div><span class="ranking-score">${entry.xp} XP</span></div>`).join('');
  $('#challengeXP').textContent = Math.min(currentUser.xp, 200);
  $('#challengeBar').style.width = `${Math.min(100, currentUser.xp / 2)}%`;
}

function renderAchievements() {
  const badges = getAchievements();
  const unlocked = badges.filter((badge) => badge.unlocked).length;
  const percent = Math.round((unlocked / badges.length) * 100);
  $('#achievementCount').textContent = unlocked;
  $('#achievementPercent').textContent = `${percent}%`;
  $('#achievementBar').style.width = `${percent}%`;
  $('#achievementsGrid').innerHTML = badges.map((badge) => `<article class="achievement-card ${badge.unlocked ? '' : 'locked'}"><div class="achievement-icon">${badge.icon}</div><strong>${badge.title}</strong><p>${badge.description}</p><span class="achievement-status">${badge.unlocked ? '✓ DESBLOQUEADA' : '🔒 AINDA BLOQUEADA'}</span></article>`).join('');
}

$('#certificateButton').addEventListener('click', () => {
  $('#certificateName').textContent = currentUser.name;
  $('#certificateXP').textContent = `${currentUser.xp} XP acumulados`;
  $('#certificateDate').textContent = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date());
  window.print();
});

// Public navigation and authentication events.
$$('[data-open-auth]').forEach((button) => button.addEventListener('click', () => openAuth(button.dataset.openAuth)));
$('#authClose').addEventListener('click', closeAuth);
$('#authSwitch').addEventListener('click', () => { authMode = authMode === 'login' ? 'register' : 'login'; configureAuth(); });
authOverlay.addEventListener('click', (event) => { if (event.target === authOverlay) closeAuth(); });
authForm.addEventListener('submit', handleAuthSubmit);
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && authOverlay.classList.contains('open')) closeAuth(); });
$('#logoutButton').addEventListener('click', leaveApp);

// Public mobile menu.
$('#mobileMenuButton').addEventListener('click', () => {
  const nav = $('.public-nav');
  const opened = nav.classList.toggle('open');
  $('#mobileMenuButton').setAttribute('aria-expanded', String(opened));
  $('#mobileMenuButton').textContent = opened ? '×' : '☰';
});
$$('.public-nav a').forEach((link) => link.addEventListener('click', () => {
  $('.public-nav').classList.remove('open');
  $('#mobileMenuButton').setAttribute('aria-expanded', 'false');
  $('#mobileMenuButton').textContent = '☰';
}));

// App navigation.
$$('.side-link[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
$$('[data-goto]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.goto)));
$('#appMenuToggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$('#userChip').addEventListener('click', () => showToast(`Conectado como ${currentUser ? currentUser.email : ''}.`));
$$('.filter-pill').forEach((button) => button.addEventListener('click', () => { currentFilter = button.dataset.filter; renderRoutine(); }));

// Restore the last local session, if this browser has one.
(function restoreSession() {
  let email = null;
  try { email = localStorage.getItem(STORAGE_SESSION); } catch (error) { console.warn(error); }
  if (!email) return;
  const users = readUsers();
  if (users[email]) {
    currentUser = users[email];
    publicSite.hidden = true;
    appShell.hidden = false;
    document.body.style.background = '#f5f7fb';
    renderAll();
  }
})();
