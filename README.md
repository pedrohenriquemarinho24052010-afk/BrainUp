# BrainUp

Plataforma demonstrativa de estudos criada com HTML, CSS e JavaScript puro, pronta para publicação no GitHub Pages.

## Arquivos

- `index.html` — estrutura das páginas pública e do painel do estudante.
- `style.css` — identidade visual, componentes e adaptação para celular.
- `script.js` — cadastro/login local, rotina, XP, grupos, mural, assistente demonstrativo, quiz, ranking e conquistas.
- `assets/brainup-ilustracao.png` — ilustração usada na página.

## Como abrir no computador

Abra `index.html` em um navegador moderno. Para testar o cadastro/login, crie uma conta com e-mail válido e senha de pelo menos 6 caracteres.

## Como publicar no GitHub Pages

1. Crie um repositório público chamado `brainup`.
2. Envie todos os arquivos e a pasta `assets` para a raiz do repositório.
3. No repositório, abra **Settings → Pages**.
4. Em **Build and deployment**, escolha **Deploy from a branch**.
5. Selecione a branch `main` e a pasta `/ (root)`, depois clique em **Save**.
6. Aguarde o endereço do site aparecer na área do GitHub Pages.

## Limites desta versão

Esta é uma demonstração front-end. Cadastro, perfil, tarefas, XP, publicações e grupos ficam salvos somente no `localStorage` do navegador e dispositivo em que foram criados. Isso não cria contas online compartilhadas entre usuários e não é adequado para dados pessoais ou senhas reais.

O assistente de dúvidas usa respostas preparadas, não uma IA conectada. O ranking usa participantes fictícios para demonstrar a interface. Para autenticação segura, sincronização entre dispositivos, grupos realmente compartilhados, ranking público e IA real, será necessário conectar um backend, banco de dados e serviços apropriados.
