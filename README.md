# Shadowlords Mesa

Companheiro digital para jogar **Shadowlords™ Mini System™ (3ª Edição)** ao vivo com seu
grupo. Feito para jogar com amigos por chamada de voz (Discord, etc.) — este sistema cuida
apenas do *jogo* (fichas, dados, combate, mestre): conversa e chat ficam no Discord.

- 🎲 Fichas de personagem completas e ao vivo (todos veem PV, dados e resultados em tempo real)
- 🧙 Painel do Mestre: controla NPCs/monstros do Bestiário, rastreador de combate, tabelas
  aleatórias, referência completa das regras
- ⚔️ Criação de personagem seguindo o manual: atributos, ocupação, origem, habilidades,
  equipamentos, feitiçaria e maldições
- 🔗 Entrada simples: o Mestre cria uma mesa e recebe um código de 5 letras; os jogadores
  entram com o código e um apelido — sem cadastro
- 💸 100% gratuito: roda no plano gratuito (Spark) do Firebase, sem cartão de crédito

Este projeto **não é comercial** — é distribuído para uso pessoal do grupo, respeitando a
licença CC-BY-NC-SA 4.0 do jogo original de Horos e Rossi (Horoscope Zine).

## Como funciona

Não há servidor próprio: o site (estático, em React) conversa diretamente com o **Firestore**
(banco de dados em tempo real do Firebase) usando o SDK do navegador. Isso significa:

- Zero custo de hospedagem (plano gratuito do Firebase cobre folgadamente um grupo de RPG)
- Sem backend para manter no ar
- Atualizações instantâneas: quando alguém rola um dado ou toma dano, todo mundo vê na hora

O acesso é protegido apenas pelo **código da mesa** (compartilhado no Discord) — não há
senhas nem contas de e-mail. Isso é intencional e adequado para jogar com amigos de
confiança; não use para dados sensíveis.

## Configurar seu próprio Firebase (gratuito, ~5 minutos)

1. Acesse [console.firebase.google.com](https://console.firebase.google.com/) e crie um
   projeto novo (pode desligar o Google Analytics, não é necessário).
2. No menu lateral, vá em **Build → Authentication → Get started** e habilite o provedor
   **Anonymous** (Anônimo).
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

1. O **Mestre** entra na página inicial, escolhe "Criar uma Mesa", digita seu nome e
   (opcionalmente) um nome para a mesa. Recebe um **código de 5 letras**.
2. O Mestre compartilha o código no Discord.
3. Cada **jogador** entra na página inicial, escolhe "Entrar em uma Mesa", digita o código e
   um apelido, e é guiado pela criação de personagem (rolagem de atributos, ocupação, origem,
   habilidades e equipamentos — tudo seguindo o Manual de Regras).
4. Todos entram na chamada de voz do Discord para narrar e interpretar; o site cuida das
   fichas, rolagens e do estado do combate.
5. O Mestre usa o painel dele para adicionar monstros do Bestiário, rolar tabelas aleatórias,
   consultar a referência completa das regras e controlar o combate.

Cada navegador "lembra" automaticamente a última mesa/personagem acessado (usando
armazenamento local do próprio navegador) — então basta abrir o link de novo na sessão
seguinte. Se alguém trocar de aparelho, o Mestre pode reabrir o personagem dele pelo próprio
painel (aba Personagens) e continuar controlando normalmente até a pessoa recuperar acesso.

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
