# Shadowlords Mesa

Companheiro digital para jogar **Shadowlords™ Mini System™ (3ª Edição)** ao vivo com seu
grupo. Feito para jogar com amigos por chamada de voz (Discord, etc.) — este sistema cuida
apenas do *jogo* (fichas, dados, combate, mestre): conversa e chat ficam no Discord.

- 🎲 Fichas de personagem completas e ao vivo (todos veem PV, dados e resultados em tempo real)
- ✋ **Rolagens passam pelo Mestre**: o jogador pede, o Mestre libera ou nega — sem rolagem
  dupla nem ação fora de hora (o Mestre pode desligar isso quando quiser)
- 🎬 **Animação de dados** aparece para a mesa inteira a cada rolagem; o Mestre também tem
  rolagem secreta, que só ele enxerga
- 🗺️ **Tela de jogo** em aba separada, com zoom e navegação livres para cada um: o Mestre monta
  o mapa e arrasta ícones de personagens, NPCs, monstros e chefes; os jogadores acompanham em
  tempo real, sem poder mexer. Uma **tela de espera** cobre tudo enquanto o Mestre prepara a
  cena, e uma **biblioteca da mesa** guarda mapas e monstros favoritos para reusar depois
- 🧬 **Ancestralidades** (Anão, Elfo, Goblin, Meio-Orc, Halfling, Humano) com suas
  características próprias aplicadas automaticamente nas rolagens
- 🩹 **Condições de status** (envenenado, paralisado, etc.) que o Mestre marca em qualquer ficha
- 🧙 Painel do Mestre: cria NPCs simples do Bestiário **ou personagens completos** (aliados,
  vilões, substitutos), rastreador de combate, tabelas aleatórias, referência completa das
  regras, e edição de atributos, PV, defesa e moedas de qualquer ficha
- ⚔️ Criação de personagem escolhendo cada opção (ou sorteando nos dados), com foto de perfil
- 🛒 Loja liberada pelo Mestre: compras só acontecem quando o grupo está num lugar de comércio
- 🔗 Entrada de qualquer aparelho: jogador entra com o código da mesa + nome do personagem;
  o Mestre entra com e-mail e senha (com recuperação por e-mail)
- 💸 100% gratuito: roda no plano gratuito (Spark) do Firebase, sem cartão de crédito

Este projeto **não é comercial** — é distribuído para uso pessoal do grupo, respeitando a
licença CC-BY-NC-SA 4.0 do jogo original de Horos e Rossi (Horoscope Zine).

## Como funciona

Não há servidor próprio: o site (estático, em React) conversa diretamente com o **Firestore**
(banco de dados em tempo real do Firebase) usando o SDK do navegador. Isso significa:

- Zero custo de hospedagem (plano gratuito do Firebase cobre folgadamente um grupo de RPG)
- Sem backend para manter no ar
- Atualizações instantâneas: quando alguém rola um dado ou toma dano, todo mundo vê na hora

**Quem pode o quê:**

- O **Mestre** tem uma conta de verdade (e-mail e senha do Firebase Auth): é ela que dá o
  controle total da mesa, de qualquer computador, com recuperação de senha por e-mail.
- Os **jogadores** entram só com o código da mesa + o nome do personagem, sem cadastro. O
  código é o segredo compartilhado do grupo — adequado para jogar com amigos de confiança,
  não para dados sensíveis.
- As regras em `firestore.rules` garantem, do lado do servidor, que jogador não mexe em
  NPCs, na configuração da mesa, na tela de jogo nem enxerga as rolagens secretas do Mestre.

## Configurar seu próprio Firebase (gratuito, ~5 minutos)

1. Acesse [console.firebase.google.com](https://console.firebase.google.com/) e crie um
   projeto novo (pode desligar o Google Analytics, não é necessário).
2. No menu lateral, vá em **Build → Authentication → Get started** e habilite **dois**
   provedores em *Sign-in method*: **Anonymous** (Anônimo, usado pelos jogadores) e
   **E-mail/senha** (usado pelo Mestre).
3. Vá em **Build → Firestore Database → Create database**. Escolha qualquer região e comece
   em **modo de produção** (as regras de segurança deste projeto, em `firestore.rules`, cuidam
   do resto).
4. Vá em **Configurações do Projeto** (ícone de engrenagem) → aba **Geral** → seção
   **Seus apps** → clique no ícone `</>` (Web) para registrar um app. Não precisa configurar
   Hosting nesse passo.
5. Copie os valores de `firebaseConfig` mostrados e cole em um arquivo `.env` na raiz do
   projeto (copie `.env.example` como base):

   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```

6. Instale a [Firebase CLI](https://firebase.google.com/docs/cli) (`npm install -g firebase-tools`),
   rode `firebase login` e depois `firebase use --add` na raiz do projeto para associar seu
   projeto (isso cria um `.firebaserc`, já ignorado pelo git).
7. Publique as regras de segurança do Firestore (**importante**, sem isso ninguém consegue
   escrever nada): `firebase deploy --only firestore:rules`.

Pronto — o app já funciona localmente (`npm run dev`) contra o Firebase de verdade.

## Rodando localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:5173`. Sem o `.env` preenchido, a tela inicial mostra um aviso e os
botões de criar/entrar em mesa ficam desabilitados — isso é esperado até você configurar o
Firebase (passo acima).

### Testando sem Firebase de verdade (emuladores)

Se você tem a Firebase CLI instalada, pode testar tudo localmente sem tocar no projeto real:

```bash
firebase emulators:start --only firestore,auth
```

E em outro terminal, com um `.env.local` contendo:

```
VITE_USE_FIREBASE_EMULATOR=true
```

```bash
npm run dev
```

## Publicando para o grupo jogar (grátis)

A forma mais simples é o **Firebase Hosting** (mesmo projeto que você já configurou):

```bash
npm run build
firebase deploy --only hosting,firestore:rules
```

Isso publica em uma URL gratuita tipo `https://seu-projeto.web.app`. Compartilhe esse link
fixo com o grupo — não muda mais, mesmo que você atualize o app depois.

Alternativa: publicar a pasta `dist/` (gerada por `npm run build`) em qualquer hospedagem
estática gratuita (GitHub Pages, Cloudflare Pages, Netlify) — o Firestore continua sendo o
banco de dados em qualquer uma delas, já que tudo roda no navegador do jogador.

## Como jogar

1. O **Mestre** escolhe "Criar uma Mesa", informa seu nome, um e-mail e uma senha. Recebe um
   **código de 5 letras** e compartilha no Discord. Em qualquer outro computador ele volta
   por "Entrar como Mestre" com o mesmo e-mail e senha (ou usa "Esqueci minha senha").
2. Cada **jogador** escolhe "Entrar como Jogador", digita o código da mesa e o nome do
   personagem. Se o personagem já existe, a ficha volta exatamente como estava, em qualquer
   aparelho; se não existe, ele é levado para a criação.
3. Na **criação**, o jogador escolhe ocupação, origem e habilidades lendo as descrições (ou
   sorteia nos dados), define uma foto de perfil por URL e monta o equipamento inicial. Os
   Atributos são sempre sorteados, como manda o manual — só o Mestre pode ajustá-los depois.
4. Durante a sessão, toda rolagem do jogador vira um **pedido ao Mestre**, que libera ou nega.
   Quando liberada, os dados aparecem rolando na tela de todo mundo. Se o teste falhou por
   pouco, o jogador ainda pode gastar PV para alcançar a dificuldade (pág. 39 do manual).
5. O Mestre controla tudo pelo painel: fila de pedidos, NPCs e monstros do Bestiário, combate,
   tabelas aleatórias, loja (liberada só quando o grupo estiver num lugar de comércio) e
   rolagens secretas que ninguém mais vê.
6. A **tela de jogo** (`🗺️ Tela de jogo`, abre em outra aba) mostra o mapa e os ícones. O
   Mestre arrasta imagens para dentro — inclusive arrastando direto de outra aba do navegador,
   com Shift para virar o mapa de fundo — e move as peças; os jogadores só acompanham.

Cada navegador também "lembra" a última mesa acessada, então dá para voltar direto pelo
histórico na sessão seguinte.

## Estrutura do projeto

```
src/
  data/        tabelas do manual (armas, armaduras, feitiços, bestiário, ocupações...)
  lib/         motor de dados, mecânicas (teste/ataque/dano/feitiçaria), acesso ao Firestore
  components/  peças de UI reutilizáveis (rolador de teste, ficha, log da sessão...)
  pages/       Home, criação de personagem, ficha do jogador, painel do Mestre
firestore.rules   regras de segurança (cada jogador só edita seu próprio personagem; o
                  Mestre tem acesso total à mesa)
```

## Licença

O sistema de regras **Shadowlords™ Mini System™** é de Horos e Rossi (Horoscope Zine),
distribuído sob [CC-BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.pt_BR).
Este projeto é uma ferramenta digital não-oficial e não-comercial para jogar o sistema com
seu grupo.
