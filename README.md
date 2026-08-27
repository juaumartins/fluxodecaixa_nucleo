# 🌿 Fluxo de Caixa - Núcleo Jardim Florido

Aplicação web completa, intuitiva e *mobile-first* para controle financeiro, gestão de custos fixos, calendário interativo e emissão de relatórios para o **Núcleo Jardim Florido**.

---

## ✨ Principais Funcionalidades

1. **Dashboard Financeiro (Resumo):**
   - Saldo Geral Acumulado, Total de Entradas, Total de Saídas e Resultado Operacional do Mês.
   - Alerta inteligente de custos fixos pendentes no mês selecionado.
   - Gráfico comparativo de Entradas vs. Saídas dos últimos 6 meses.
   - Gráfico de pizza/rosca com distribuição de despesas por categoria.

2. **Lançamentos (Entradas & Saídas):**
   - Cadastro rápido com descrição, valor, data, categoria, forma de pagamento (Pix, Dinheiro, Boleto, Cartão, Transferência) e observações.
   - Busca em tempo real e filtros combinados por tipo (Entrada/Saída), categoria e mês.
   - Edição e exclusão de lançamentos.

3. **Custos Fixos com Confirmação Manual:**
   - Cadastro de despesas fixas recorrentes com dia de vencimento mensal (ex: Água, Luz, Internet, Manutenção).
   - Acompanhamento de status no mês: **PAGO / CONFIRMADO** ou **PENDENTE**.
   - Botão **"Confirmar Pagamento"**: registra a data real de quitação, ajusta o valor efetivo se necessário e lança automaticamente no fluxo de caixa.
   - Opção de desfazer confirmação a qualquer momento.

4. **Calendário Interativo:**
   - Grid mensal com navegação de meses e marcações visuais nos dias (Entradas em verde, Saídas em vermelho, Custos Fixos em âmbar).
   - **Filtro por dia:** ao tocar em qualquer dia, exibe instantaneamente o resumo financeiro diário, lista de movimentações e contas com vencimento naquela data.
   - Atalho rápido para cadastrar um novo lançamento já com a data do dia selecionado preenchida.

5. **Prestação de Contas & Relatórios:**
   - **Compartilhamento no WhatsApp:** gera um texto estruturado, com emojis e dados consolidados do mês, com botão direto para envio no WhatsApp ou cópia para a área de transferência.
   - **Exportação em PDF:** gera um documento diagramado, limpo e pronto para download ou impressão com cabeçalho do Núcleo Jardim Florido e tabelas detalhadas.

6. **Categorias & Segurança de Dados:**
   - Gestão de categorias personalizadas de receitas e despesas com cores identificadoras.
   - **Backup e Restauração (.JSON):** exporte e guarde cópias de segurança de todos os dados do caixa com um clique.

---

## 📁 Estrutura de Arquivos

```text
fluxo-caixa-jardim-florido/
├── index.html              # Interface completa e componentizada (HTML5 + Tailwind CSS)
├── css/
│   └── styles.css          # Estilos adicionais, temas e regras de impressão PDF
├── js/
│   ├── storage.js          # Persistência no LocalStorage, dados padrão e backups JSON
│   ├── calendar.js         # Lógica do calendário mensal e detalhamento por dia
│   ├── charts.js           # Renderização e atualização dos gráficos Chart.js
│   ├── reports.js          # Geração de PDF e formatação para WhatsApp
│   └── app.js              # Controlador principal, rotas de abas e modais
└── README.md               # Documentação do projeto
```

---

## 🚀 Como Executar

### 1. Execução Local com Python
No terminal, dentro da pasta do projeto:
```bash
python server.py
```
Em seguida, acesse no navegador: `http://localhost:8000`. O servidor cria automaticamente o banco `fluxo_caixa.sqlite3` e exige login.

Credenciais iniciais:
- Usuário: `admin`
- Senha: `admin123`

Crie usuários em **Authentication > Users** no painel do Supabase. O papel padrão é `manager`; para promover alguém, execute no SQL Editor: `update public.profiles set role = 'admin' where email = 'email-do-usuario';`. O papel `manager` acessa e altera o fluxo de caixa. Cada usuário pode trocar a própria senha pelo botão de chave no cabeçalho.

Para definir uma senha inicial diferente antes da primeira execução, use a variável `NJF_ADMIN_PASSWORD`. O banco SQLite deve ser mantido em backup junto com o projeto. Para acesso de locais diferentes, publique este servidor em uma VPS ou serviço cloud com disco persistente, domínio e HTTPS; todos deverão acessar a mesma URL.

Não abra `index.html` diretamente: nesse modo não há servidor para autenticar nem API para persistir os dados.

### 2. Publicação com Vercel + Supabase

1. Crie um projeto no Supabase.
2. No SQL Editor, execute o arquivo `supabase-schema.sql`.
3. Em **Project Settings > API**, copie a URL e a chave pública `anon` para `js/supabase-config.js`.
4. Em **Authentication > Users**, crie o primeiro usuário e promova-o a `admin` usando o SQL indicado acima.
5. Suba o projeto para um repositório GitHub e importe-o na Vercel.
6. Publique o projeto como aplicação estática, sem comando de build.
7. Cadastre os demais usuários em **Authentication > Users**.

O arquivo `js/supabase-config.js` deve conter somente a chave pública `anon`. Nunca coloque a `service_role` no frontend. Todos os usuários autenticados consultarão o mesmo registro compartilhado em `app_data`.

### 3. No Celular (Android / iOS)
- Para rodar localmente no Android: utilize aplicativos como **Pydroid 3**, **Acode** ou **Termux**.
- Para instalar como aplicativo (PWA) no smartphone:
  - Abra a página no navegador do celular (ex: Google Chrome no Android ou Safari no iOS).
  - Toque no menu de opções do navegador (três pontinhos ou botão de compartilhar).
  - Selecione **"Adicionar à tela de início"** / **"Instalar aplicativo"**.
  - O ícone do **Núcleo Jardim Florido** ficará disponível na tela inicial como um app nativo.

---

## 🎨 Identidade Visual
- **Paleta de Cores:** Verde Floresta/Esmeralda (`#15803d`, `#166534`), Verde Claro (`#f0fdf4`, `#dcfce7`) e Branco.
- **Tema:** Claro (*Light Mode*), com alto contraste, fontes nítidas e navegação inferior ergonômica para polegares em telas móveis.
