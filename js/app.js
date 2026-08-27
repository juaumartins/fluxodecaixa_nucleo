/**
 * Aplicação Central - Núcleo Jardim Florido (Fluxo de Caixa)
 */

const App = {
  currentTab: 'dashboard',
  selectedYearMonth: '', // 'YYYY-MM'
  editingTransactionId: null,
  editingFixedCostId: null,

  init() {
    StorageManager.init().then(authenticated => {
      if (authenticated) this.initAuthenticated();
    });
  },

  initAuthenticated() {
    // Definir mês/ano padrão como o mês atual
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    this.selectedYearMonth = `${y}-${m}`;

    // Inicializar sub-módulos
    CalendarManager.init();

    // Configurar seletor de mês global
    this.initMonthSelector();

    // Renderizar dados iniciais
    this.switchTab('dashboard');
    this.populateCategorySelects();
    this.setupEventListeners();
    this.setupAccountControls();
  },

  setupAccountControls() {
    const controls = document.getElementById('auth-controls');
    const user = StorageManager.currentUser;
    if (!controls || !user) return;
    controls.classList.remove('hidden');
    controls.classList.add('flex');
    controls.innerHTML = `<span class="hidden lg:inline text-xs font-semibold text-slate-500">${user.username}</span>
      <button class="account-button" title="Alterar senha"><i class="fa-solid fa-key"></i></button>
      <button class="account-button" title="Sair"><i class="fa-solid fa-right-from-bracket"></i></button>`;
    const buttons = controls.querySelectorAll('button');
    buttons[0].addEventListener('click', async () => {
      const current = prompt('Digite sua senha atual:');
      const next = prompt('Digite a nova senha (mínimo de 8 caracteres):');
      if (current && next) {
        const result = await StorageManager.changePassword(current, next);
        this.showToast(result.body.error || 'Senha alterada com sucesso.', result.ok ? 'success' : 'error');
      }
    });
    buttons[buttons.length - 1].addEventListener('click', () => StorageManager.logout());
  },

  // Inicializa o dropdown de seleção de meses
  initMonthSelector() {
    const monthSelects = document.querySelectorAll('.global-month-selector');
    const now = new Date();
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    monthSelects.forEach(select => {
      select.innerHTML = '';
      
      // Criar opções dos últimos 12 meses e próximos 3 meses
      for (let i = -6; i <= 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        const opt = document.createElement('option');
        opt.value = ym;
        opt.textContent = label.charAt(0).toUpperCase() + label.slice(1);
        if (ym === this.selectedYearMonth) opt.selected = true;
        select.appendChild(opt);
      }

      select.addEventListener('change', (e) => {
        this.setYearMonth(e.target.value);
      });
    });
  },

  setYearMonth(ym) {
    this.selectedYearMonth = ym;
    document.querySelectorAll('.global-month-selector').forEach(sel => {
      sel.value = ym;
    });

    // Atualizar visualizações
    this.refreshCurrentTab();
  },

  // Alternar abas da aplicação
  switchTab(tabId) {
    this.currentTab = tabId;

    // Atualizar classes visuais nas abas e botões
    document.querySelectorAll('.tab-content').forEach(el => {
      el.classList.add('hidden');
    });

    const activeTabEl = document.getElementById(`tab-${tabId}`);
    if (activeTabEl) {
      activeTabEl.classList.remove('hidden');
      activeTabEl.classList.add('animate-fade-in');
    }

    // Atualizar barra de navegação móvel e desktop
    document.querySelectorAll('.nav-item').forEach(btn => {
      const isTarget = btn.getAttribute('data-tab') === tabId;
      if (isTarget) {
        btn.classList.add('text-emerald-700', 'font-bold');
        btn.classList.remove('text-slate-500');
        const iconBg = btn.querySelector('.nav-icon-bg');
        if (iconBg) iconBg.classList.add('bg-emerald-100', 'text-emerald-800');
      } else {
        btn.classList.remove('text-emerald-700', 'font-bold');
        btn.classList.add('text-slate-500');
        const iconBg = btn.querySelector('.nav-icon-bg');
        if (iconBg) iconBg.classList.remove('bg-emerald-100', 'text-emerald-800');
      }
    });

    // Atualizar dados da aba
    this.refreshCurrentTab();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  refreshCurrentTab() {
    switch (this.currentTab) {
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'transactions':
        this.renderTransactions();
        break;
      case 'fixed_costs':
        this.renderFixedCosts();
        break;
      case 'calendar':
        CalendarManager.render();
        break;
      case 'reports':
        this.renderReportsTab();
        break;
      case 'categories':
        this.renderCategoriesTab();
        break;
    }
  },

  // ----------------------------------------------------
  // DASHBOARD
  // ----------------------------------------------------
  renderDashboard() {
    const transactions = StorageManager.getTransactions();
    const fixedCosts = StorageManager.getFixedCosts().filter(fc => fc.active);
    const settings = StorageManager.getSettings();

    // 1. Transações do mês selecionado
    const monthTx = transactions.filter(t => t.date && t.date.startsWith(this.selectedYearMonth));

    let monthIncome = 0;
    let monthExpense = 0;

    monthTx.forEach(t => {
      const amt = parseFloat(t.amount || 0);
      if (t.type === 'income') monthIncome += amt;
      else monthExpense += amt;
    });

    const monthResult = monthIncome - monthExpense;

    // 2. Saldo Acumulado Geral
    let totalGeneralBalance = parseFloat(settings.initialBalance || 0);
    transactions.forEach(t => {
      const amt = parseFloat(t.amount || 0);
      if (t.type === 'income') totalGeneralBalance += amt;
      else totalGeneralBalance -= amt;
    });

    // 3. Custos Fixos Pendentes no Mês
    let fixedPendingTotal = 0;
    let fixedPendingCount = 0;
    fixedCosts.forEach(fc => {
      const isConfirmed = StorageManager.isFixedCostConfirmed(fc.id, this.selectedYearMonth);
      if (!isConfirmed && fc.type === 'expense') {
        fixedPendingTotal += parseFloat(fc.amount || 0);
        fixedPendingCount++;
      }
    });

    // Atualizar elementos no DOM
    const elGeneralBalance = document.getElementById('dash-general-balance');
    const elMonthIncome = document.getElementById('dash-month-income');
    const elMonthExpense = document.getElementById('dash-month-expense');
    const elMonthResult = document.getElementById('dash-month-result');
    const elPendingFixed = document.getElementById('dash-pending-fixed');

    if (elGeneralBalance) elGeneralBalance.textContent = ReportsManager.formatCurrency(totalGeneralBalance);
    if (elMonthIncome) elMonthIncome.textContent = ReportsManager.formatCurrency(monthIncome);
    if (elMonthExpense) elMonthExpense.textContent = ReportsManager.formatCurrency(monthExpense);
    if (elMonthResult) {
      elMonthResult.textContent = `${monthResult >= 0 ? '+' : ''}${ReportsManager.formatCurrency(monthResult)}`;
      elMonthResult.className = `text-lg md:text-xl font-bold ${monthResult >= 0 ? 'text-emerald-700' : 'text-rose-600'}`;
    }
    if (elPendingFixed) {
      elPendingFixed.textContent = `${ReportsManager.formatCurrency(fixedPendingTotal)} (${fixedPendingCount} pendentes)`;
    }

    // Atualizar Gráficos
    ChartsManager.updateAllCharts(this.selectedYearMonth);

    // Renderizar Lançamentos Recentes no Dashboard
    this.renderRecentTransactionsDashboard(monthTx);
  },

  renderRecentTransactionsDashboard(monthTx) {
    const container = document.getElementById('dash-recent-transactions');
    if (!container) return;

    if (monthTx.length === 0) {
      container.innerHTML = `
        <div class="py-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <i class="fa-solid fa-receipt text-3xl mb-2 text-slate-300"></i>
          <p class="text-xs md:text-sm">Nenhum lançamento no mês de ${ReportsManager.getMonthName(this.selectedYearMonth)}.</p>
          <button onclick="App.openTransactionModal()" class="mt-3 text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline">
            + Adicionar primeiro lançamento
          </button>
        </div>
      `;
      return;
    }

    // Pegar os 5 lançamentos mais recentes
    const recent = [...monthTx].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

    let html = `<div class="space-y-2.5">`;
    recent.forEach(t => {
      const isIncome = t.type === 'income';
      const [y, m, d] = t.date.split('-');
      html += `
        <div class="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 hover:border-slate-200 shadow-2xs transition-all-custom">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center ${isIncome ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">
              <i class="fa-solid ${isIncome ? 'fa-arrow-down' : 'fa-arrow-up'} text-sm"></i>
            </div>
            <div>
              <p class="text-xs md:text-sm font-semibold text-slate-800">${t.description}</p>
              <p class="text-[11px] text-slate-500">${d}/${m}/${y} • ${t.category}</p>
            </div>
          </div>
          <div class="text-right">
            <span class="text-xs md:text-sm font-bold ${isIncome ? 'text-emerald-700' : 'text-rose-700'}">
              ${isIncome ? '+' : '-'} ${ReportsManager.formatCurrency(t.amount)}
            </span>
            <span class="block text-[10px] text-slate-400">${t.paymentMethod || 'Pix'}</span>
          </div>
        </div>
      `;
    });
    html += `</div>`;

    container.innerHTML = html;
  },

  // ----------------------------------------------------
  // LANÇAMENTOS (ENTRADAS E SAÍDAS)
  // ----------------------------------------------------
  renderTransactions() {
    const listContainer = document.getElementById('transactions-list');
    if (!listContainer) return;

    const searchTerm = (document.getElementById('tx-search-input')?.value || '').toLowerCase();
    const typeFilter = document.getElementById('tx-filter-type')?.value || 'all';
    const categoryFilter = document.getElementById('tx-filter-category')?.value || 'all';

    let transactions = StorageManager.getTransactions();

    // Filtros
    transactions = transactions.filter(t => {
      const matchesMonth = !this.selectedYearMonth || (t.date && t.date.startsWith(this.selectedYearMonth));
      const matchesSearch = !searchTerm || t.description.toLowerCase().includes(searchTerm) || t.category.toLowerCase().includes(searchTerm);
      const matchesType = typeFilter === 'all' || t.type === typeFilter;
      const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
      return matchesMonth && matchesSearch && matchesType && matchesCategory;
    });

    // Ordenar por data decrescente
    transactions.sort((a, b) => b.date.localeCompare(a.date));

    // Totais do filtro atual
    let filterIncome = 0;
    let filterExpense = 0;
    transactions.forEach(t => {
      const amt = parseFloat(t.amount || 0);
      if (t.type === 'income') filterIncome += amt;
      else filterExpense += amt;
    });

    const summaryEl = document.getElementById('tx-filtered-summary');
    if (summaryEl) {
      summaryEl.innerHTML = `
        <span class="text-emerald-700 font-semibold">Entradas: ${ReportsManager.formatCurrency(filterIncome)}</span>
        <span class="text-slate-300">|</span>
        <span class="text-rose-600 font-semibold">Saídas: ${ReportsManager.formatCurrency(filterExpense)}</span>
        <span class="text-slate-300">|</span>
        <span class="text-slate-700 font-bold">Saldo: ${ReportsManager.formatCurrency(filterIncome - filterExpense)}</span>
      `;
    }

    if (transactions.length === 0) {
      listContainer.innerHTML = `
        <div class="py-12 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
          <i class="fa-solid fa-filter-circle-xmark text-4xl mb-3 text-slate-300"></i>
          <p class="text-sm font-medium">Nenhum lançamento encontrado para os filtros selecionados.</p>
          <button onclick="App.openTransactionModal()" class="mt-3 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl shadow-xs">
            + Novo Lançamento
          </button>
        </div>
      `;
      return;
    }

    let html = `<div class="space-y-2.5">`;
    transactions.forEach(t => {
      const isIncome = t.type === 'income';
      const [y, m, d] = t.date.split('-');
      html += `
        <div class="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-slate-100 hover:border-emerald-200 shadow-2xs transition-all-custom">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center ${isIncome ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">
              <i class="fa-solid ${isIncome ? 'fa-arrow-down' : 'fa-arrow-up'} text-sm"></i>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs md:text-sm font-bold text-slate-800">${t.description}</span>
                ${t.isFixedCost ? '<span class="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded-md">Custo Fixo</span>' : ''}
              </div>
              <div class="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                <span>${d}/${m}/${y}</span>
                <span>•</span>
                <span class="font-medium text-slate-600">${t.category}</span>
                <span>•</span>
                <span>${t.paymentMethod || 'Pix'}</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <div class="text-right">
              <span class="text-xs md:text-sm font-bold ${isIncome ? 'text-emerald-700' : 'text-rose-700'} block">
                ${isIncome ? '+' : '-'} ${ReportsManager.formatCurrency(t.amount)}
              </span>
              <span class="text-[10px] text-emerald-600 font-medium">${t.status === 'completed' ? 'Efetivado' : 'Pendente'}</span>
            </div>
            <div class="flex items-center gap-1">
              <button onclick="App.editTransaction('${t.id}')" class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all" title="Editar">
                <i class="fa-regular fa-pen-to-square text-xs"></i>
              </button>
              <button onclick="App.deleteTransactionConfirm('${t.id}')" class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all" title="Excluir">
                <i class="fa-regular fa-trash-can text-xs"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    });
    html += `</div>`;

    listContainer.innerHTML = html;
  },

  // ----------------------------------------------------
  // CUSTOS FIXOS & CONFIRMAÇÃO MANUAL
  // ----------------------------------------------------
  renderFixedCosts() {
    const listContainer = document.getElementById('fixed-costs-list');
    if (!listContainer) return;

    const fixedCosts = StorageManager.getFixedCosts();
    const currentYM = this.selectedYearMonth;

    let totalFixedMonth = 0;
    let totalConfirmedMonth = 0;
    let totalPendingMonth = 0;

    fixedCosts.forEach(fc => {
      if (fc.active) {
        const amt = parseFloat(fc.amount || 0);
        totalFixedMonth += amt;
        const isConfirmed = StorageManager.isFixedCostConfirmed(fc.id, currentYM);
        if (isConfirmed) totalConfirmedMonth += amt;
        else totalPendingMonth += amt;
      }
    });

    const summaryContainer = document.getElementById('fixed-costs-summary');
    if (summaryContainer) {
      summaryContainer.innerHTML = `
        <div class="grid grid-cols-3 gap-2">
          <div class="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center">
            <span class="text-[11px] text-slate-500 font-medium block">Total Previsto</span>
            <span class="text-xs md:text-sm font-bold text-slate-800">${ReportsManager.formatCurrency(totalFixedMonth)}</span>
          </div>
          <div class="bg-emerald-50 p-3 rounded-2xl border border-emerald-200 text-center">
            <span class="text-[11px] text-emerald-700 font-medium block">✅ Confirmados/Pagos</span>
            <span class="text-xs md:text-sm font-bold text-emerald-800">${ReportsManager.formatCurrency(totalConfirmedMonth)}</span>
          </div>
          <div class="bg-amber-50 p-3 rounded-2xl border border-amber-200 text-center">
            <span class="text-[11px] text-amber-700 font-medium block">⏳ Pendentes</span>
            <span class="text-xs md:text-sm font-bold text-amber-800">${ReportsManager.formatCurrency(totalPendingMonth)}</span>
          </div>
        </div>
      `;
    }

    if (fixedCosts.length === 0) {
      listContainer.innerHTML = `
        <div class="py-12 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
          <i class="fa-solid fa-list-check text-4xl mb-3 text-slate-300"></i>
          <p class="text-sm font-medium">Nenhum custo fixo cadastrado ainda.</p>
          <button onclick="App.openFixedCostModal()" class="mt-3 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl shadow-xs">
            + Cadastrar Custo Fixo
          </button>
        </div>
      `;
      return;
    }

    let html = `<div class="space-y-3">`;
    fixedCosts.forEach(fc => {
      const isConfirmed = StorageManager.isFixedCostConfirmed(fc.id, currentYM);
      const confirmation = StorageManager.getFixedCostConfirmation(fc.id, currentYM);

      html += `
        <div class="p-4 bg-white rounded-2xl border ${isConfirmed ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-100'} shadow-2xs transition-all-custom">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isConfirmed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
                <i class="fa-solid ${isConfirmed ? 'fa-check-double' : 'fa-calendar-check'} text-sm"></i>
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h4 class="text-sm md:text-base font-bold text-slate-800">${fc.name}</h4>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${isConfirmed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
                    ${isConfirmed ? 'PAGO / CONFIRMADO' : 'PENDENTE'}
                  </span>
                </div>
                <p class="text-xs text-slate-500 mt-0.5">
                  <i class="fa-regular fa-clock text-[10px] mr-1"></i> Vencimento: todo dia <strong>${fc.dueDay}</strong> • Categoria: ${fc.category}
                </p>
                ${fc.notes ? `<p class="text-[11px] text-slate-400 mt-1 italic">${fc.notes}</p>` : ''}
              </div>
            </div>

            <div class="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
              <div class="text-left sm:text-right">
                <span class="text-xs text-slate-400 block">Valor Fixo</span>
                <span class="text-sm md:text-base font-extrabold text-slate-800">${ReportsManager.formatCurrency(fc.amount)}</span>
              </div>

              <div class="flex items-center gap-2">
                ${isConfirmed ? `
                  <button onclick="App.unconfirmFixedCost('${fc.id}', '${currentYM}')" 
                          class="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-xs font-semibold rounded-xl transition-all-custom" title="Desfazer confirmação">
                    <i class="fa-solid fa-rotate-left mr-1"></i> Desfazer
                  </button>
                ` : `
                  <button onclick="App.openConfirmFixedCostModal('${fc.id}', '${currentYM}')" 
                          class="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-all-custom">
                    <i class="fa-solid fa-check mr-1"></i> Confirmar Pagamento
                  </button>
                `}
                
                <div class="relative inline-block text-left">
                  <button onclick="event.stopPropagation(); App.toggleFixedCostMenu('${fc.id}')" class="p-2 text-slate-400 hover:text-slate-600 rounded-lg" title="Mais opções do custo fixo" aria-label="Mais opções do custo fixo" aria-expanded="false">
                    <i class="fa-solid fa-ellipsis-vertical text-sm"></i>
                  </button>
                  <div id="fixed-cost-menu-${fc.id}" class="hidden absolute right-0 bottom-full mb-1 z-10 w-36 overflow-hidden bg-white rounded-xl border border-slate-200 shadow-lg">
                    <button onclick="App.openEditFixedCostModal('${fc.id}')" class="flex items-center gap-2 w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50">
                      <i class="fa-regular fa-pen-to-square text-slate-400"></i> Editar
                    </button>
                    <button onclick="App.deleteFixedCostConfirm('${fc.id}')" class="flex items-center gap-2 w-full px-3 py-2 text-left text-xs font-medium text-rose-700 hover:bg-rose-50">
                      <i class="fa-regular fa-trash-can"></i> Excluir
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    });
    html += `</div>`;

    listContainer.innerHTML = html;
  },

  // ----------------------------------------------------
  // RELATÓRIOS & COMPARTILHAMENTO
  // ----------------------------------------------------
  renderReportsTab() {
    const data = ReportsManager.getPeriodData(this.selectedYearMonth);
    const container = document.getElementById('reports-preview-container');
    if (!container) return;

    let html = `
      <div class="bg-white p-5 md:p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <span class="text-xs font-bold text-emerald-700 uppercase tracking-wider">Pré-visualização do Relatório</span>
            <h3 class="text-lg font-bold text-slate-800">${ReportsManager.getMonthName(this.selectedYearMonth)}</h3>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="ReportsManager.shareViaWhatsApp('${this.selectedYearMonth}')" 
                    class="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs md:text-sm font-semibold rounded-xl shadow-xs transition-all-custom">
              <i class="fa-brands fa-whatsapp text-base"></i>
              <span>Enviar WhatsApp</span>
            </button>
            <button onclick="ReportsManager.copyWhatsAppText('${this.selectedYearMonth}')" 
                    class="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs md:text-sm font-medium rounded-xl transition-all-custom" title="Copiar Texto">
              <i class="fa-regular fa-copy"></i>
              <span>Copiar</span>
            </button>
            <button onclick="ReportsManager.exportPDFReport('${this.selectedYearMonth}')" 
                    class="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs md:text-sm font-semibold rounded-xl shadow-xs transition-all-custom">
              <i class="fa-solid fa-file-pdf"></i>
              <span>Exportar PDF</span>
            </button>
          </div>
        </div>

        <!-- Resumo Consolidado -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-100">
            <span class="text-[11px] font-semibold text-emerald-700 block">Total de Entradas</span>
            <span class="text-base font-bold text-emerald-800">${ReportsManager.formatCurrency(data.totalIncome)}</span>
          </div>
          <div class="bg-rose-50/70 p-3.5 rounded-xl border border-rose-100">
            <span class="text-[11px] font-semibold text-rose-700 block">Total de Saídas</span>
            <span class="text-base font-bold text-rose-800">${ReportsManager.formatCurrency(data.totalExpense)}</span>
          </div>
          <div class="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span class="text-[11px] font-semibold text-slate-600 block">Resultado do Mês</span>
            <span class="text-base font-bold ${data.netPeriod >= 0 ? 'text-emerald-700' : 'text-rose-600'}">
              ${data.netPeriod >= 0 ? '+' : ''}${ReportsManager.formatCurrency(data.netPeriod)}
            </span>
          </div>
          <div class="bg-emerald-900 text-white p-3.5 rounded-xl shadow-xs">
            <span class="text-[11px] font-medium text-emerald-200 block">Saldo Geral em Caixa</span>
            <span class="text-base font-bold text-white">${ReportsManager.formatCurrency(data.cumulativeBalance)}</span>
          </div>
        </div>

        <!-- Box com texto formatado para envio direto -->
        <div>
          <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Mensagem Formatada (WhatsApp):</label>
          <pre class="bg-slate-50 p-4 rounded-xl text-xs text-slate-700 font-mono whitespace-pre-wrap border border-slate-200 select-all">${ReportsManager.generateWhatsAppText(this.selectedYearMonth)}</pre>
        </div>
      </div>
    `;

    container.innerHTML = html;
  },

  // ----------------------------------------------------
  // CATEGORIAS & CONFIGURAÇÕES
  // ----------------------------------------------------
  renderCategoriesTab() {
    const listContainer = document.getElementById('categories-list');
    if (!listContainer) return;

    const categories = StorageManager.getCategories();
    let html = `<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">`;

    categories.forEach(cat => {
      const isIncome = cat.type === 'income';
      html += `
        <div class="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-slate-100 shadow-2xs">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background-color: ${cat.color}20; color: ${cat.color};">
              <i class="fa-solid ${cat.icon || 'fa-tag'} text-xs"></i>
            </div>
            <div>
              <p class="text-xs md:text-sm font-semibold text-slate-800">${cat.name}</p>
              <span class="text-[10px] font-medium ${isIncome ? 'text-emerald-700' : 'text-rose-600'}">
                ${isIncome ? 'Entrada' : 'Saída'}
              </span>
            </div>
          </div>
          <button onclick="App.deleteCategoryConfirm('${cat.id}')" class="text-slate-300 hover:text-rose-600 p-1.5 transition-colors">
            <i class="fa-regular fa-trash-can text-xs"></i>
          </button>
        </div>
      `;
    });

    html += `</div>`;
    listContainer.innerHTML = html;
  },

  // ----------------------------------------------------
  // MODAIS E FORMULÁRIOS
  // ----------------------------------------------------
  populateCategorySelects(selectedCategory = '') {
    const selects = [
      document.getElementById('tx-category'),
      document.getElementById('tx-filter-category'),
      document.getElementById('fc-category')
    ];

    const categories = StorageManager.getCategories();

    selects.forEach(select => {
      if (!select) return;
      const isFilter = select.id === 'tx-filter-category';
      select.innerHTML = isFilter ? '<option value="all">Todas as Categorias</option>' : '';

      categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.name;
        opt.textContent = `${cat.type === 'income' ? '🟢' : '🔴'} ${cat.name}`;
        if (cat.name === selectedCategory) opt.selected = true;
        select.appendChild(opt);
      });
    });
  },

  openTransactionModal(type = 'income') {
    this.editingTransactionId = null;
    const modal = document.getElementById('modal-transaction');
    const form = document.getElementById('form-transaction');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('tx-modal-title').textContent = 'Novo Lançamento';
    document.getElementById('tx-type').value = type;
    this.updateTransactionTypeButtons(type);

    // Data padrão: hoje
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    document.getElementById('tx-date').value = today;

    this.populateCategorySelects();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  },

  openTransactionModalWithDate(dateStr) {
    this.openTransactionModal('income');
    document.getElementById('tx-date').value = dateStr;
  },

  editTransaction(id) {
    const tx = StorageManager.getTransactions().find(t => t.id === id);
    if (!tx) return;

    this.editingTransactionId = id;
    const modal = document.getElementById('modal-transaction');
    if (!modal) return;

    document.getElementById('tx-modal-title').textContent = 'Editar Lançamento';
    document.getElementById('tx-type').value = tx.type;
    this.updateTransactionTypeButtons(tx.type);

    document.getElementById('tx-description').value = tx.description;
    document.getElementById('tx-amount').value = tx.amount;
    document.getElementById('tx-date').value = tx.date;
    document.getElementById('tx-payment-method').value = tx.paymentMethod || 'Pix';
    document.getElementById('tx-notes').value = tx.notes || '';

    this.populateCategorySelects(tx.category);

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  },

  saveTransactionFromForm(e) {
    e.preventDefault();
    const description = document.getElementById('tx-description').value.trim();
    const amount = parseFloat(document.getElementById('tx-amount').value);
    const type = document.getElementById('tx-type').value;
    const date = document.getElementById('tx-date').value;
    const category = document.getElementById('tx-category').value;
    const paymentMethod = document.getElementById('tx-payment-method').value;
    const notes = document.getElementById('tx-notes').value.trim();

    if (!description || isNaN(amount) || amount <= 0 || !date || !category) {
      this.showToast('Preencha todos os campos obrigatórios.', 'warning');
      return;
    }

    if (this.editingTransactionId) {
      StorageManager.updateTransaction(this.editingTransactionId, {
        description, amount, type, date, category, paymentMethod, notes
      });
      this.showToast('Lançamento atualizado com sucesso!', 'success');
    } else {
      StorageManager.addTransaction({
        description, amount, type, date, category, paymentMethod, notes, status: 'completed'
      });
      this.showToast('Lançamento registrado com sucesso!', 'success');
    }

    this.closeModal('modal-transaction');
    this.refreshCurrentTab();
  },

  deleteTransactionConfirm(id) {
    if (confirm('Deseja realmente excluir este lançamento do fluxo de caixa?')) {
      StorageManager.deleteTransaction(id);
      this.showToast('Lançamento excluído.', 'info');
      this.refreshCurrentTab();
    }
  },

  updateTransactionTypeButtons(type) {
    const btnIncome = document.getElementById('btn-type-income');
    const btnExpense = document.getElementById('btn-type-expense');
    document.getElementById('tx-type').value = type;

    if (type === 'income') {
      btnIncome.className = 'flex-1 py-2 rounded-xl text-xs md:text-sm font-bold bg-emerald-700 text-white shadow-xs';
      btnExpense.className = 'flex-1 py-2 rounded-xl text-xs md:text-sm font-semibold bg-slate-100 text-slate-600';
    } else {
      btnExpense.className = 'flex-1 py-2 rounded-xl text-xs md:text-sm font-bold bg-rose-600 text-white shadow-xs';
      btnIncome.className = 'flex-1 py-2 rounded-xl text-xs md:text-sm font-semibold bg-slate-100 text-slate-600';
    }
  },

  // Modal de Custos Fixos
  openFixedCostModal() {
    this.editingFixedCostId = null;
    const modal = document.getElementById('modal-fixed-cost');
    const form = document.getElementById('form-fixed-cost');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('fc-modal-title').textContent = 'Novo Custo Fixo';
    this.populateCategorySelects();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  },

  openEditFixedCostModal(id) {
    const fc = StorageManager.getFixedCosts().find(f => f.id === id);
    if (!fc) return;

    this.editingFixedCostId = id;
    const modal = document.getElementById('modal-fixed-cost');
    if (!modal) return;

    document.getElementById('fc-modal-title').textContent = 'Editar Custo Fixo';
    document.getElementById('fc-name').value = fc.name;
    document.getElementById('fc-amount').value = fc.amount;
    document.getElementById('fc-due-day').value = fc.dueDay;
    document.getElementById('fc-notes').value = fc.notes || '';
    this.populateCategorySelects(fc.category);

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  },

  toggleFixedCostMenu(id) {
    document.querySelectorAll('[id^="fixed-cost-menu-"]').forEach(menu => {
      if (menu.id !== `fixed-cost-menu-${id}`) menu.classList.add('hidden');
    });
    document.getElementById(`fixed-cost-menu-${id}`)?.classList.toggle('hidden');
  },

  deleteFixedCostConfirm(id) {
    const fixedCost = StorageManager.getFixedCosts().find(fc => fc.id === id);
    if (!fixedCost) return;

    if (confirm(`Deseja excluir o custo fixo "${fixedCost.name}"? Pagamentos já confirmados dele também serão removidos do fluxo de caixa.`)) {
      StorageManager.deleteFixedCost(id);
      this.showToast('Custo fixo excluído.', 'info');
      this.refreshCurrentTab();
    }
  },

  saveFixedCostFromForm(e) {
    e.preventDefault();
    const name = document.getElementById('fc-name').value.trim();
    const amount = parseFloat(document.getElementById('fc-amount').value);
    const dueDay = parseInt(document.getElementById('fc-due-day').value);
    const category = document.getElementById('fc-category').value;
    const notes = document.getElementById('fc-notes').value.trim();

    if (!name || isNaN(amount) || amount <= 0 || isNaN(dueDay) || dueDay < 1 || dueDay > 31) {
      this.showToast('Preencha os dados do custo fixo corretamente.', 'warning');
      return;
    }

    if (this.editingFixedCostId) {
      StorageManager.updateFixedCost(this.editingFixedCostId, { name, amount, dueDay, category, notes });
      this.showToast('Custo fixo atualizado!', 'success');
    } else {
      StorageManager.addFixedCost({ name, amount, dueDay, category, notes, type: 'expense' });
      this.showToast('Custo fixo cadastrado com sucesso!', 'success');
    }

    this.closeModal('modal-fixed-cost');
    this.refreshCurrentTab();
  },

  // Confirmação Manual de Custo Fixo
  openConfirmFixedCostModal(fixedCostId, yearMonth, defaultDate = '') {
    const fc = StorageManager.getFixedCosts().find(f => f.id === fixedCostId);
    if (!fc) return;

    const modal = document.getElementById('modal-confirm-fixed-cost');
    if (!modal) return;

    document.getElementById('conf-fc-id').value = fixedCostId;
    document.getElementById('conf-fc-yearmonth').value = yearMonth;
    document.getElementById('conf-fc-name-display').textContent = fc.name;
    document.getElementById('conf-fc-amount').value = fc.amount;

    // Calcular data sugerida para pagamento
    let payDate = defaultDate;
    if (!payDate) {
      const [y, m] = yearMonth.split('-');
      const day = String(fc.dueDay).padStart(2, '0');
      payDate = `${y}-${m}-${day}`;
    }
    document.getElementById('conf-fc-date').value = payDate;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  },

  executeConfirmFixedCost(e) {
    e.preventDefault();
    const fixedCostId = document.getElementById('conf-fc-id').value;
    const yearMonth = document.getElementById('conf-fc-yearmonth').value;
    const paymentDate = document.getElementById('conf-fc-date').value;
    const actualAmount = parseFloat(document.getElementById('conf-fc-amount').value);
    const paymentMethod = document.getElementById('conf-fc-method').value;
    const notes = document.getElementById('conf-fc-notes').value.trim();

    if (!paymentDate || isNaN(actualAmount) || actualAmount <= 0) {
      this.showToast('Informe a data e o valor correto.', 'warning');
      return;
    }

    StorageManager.confirmFixedCost(fixedCostId, yearMonth, paymentDate, actualAmount, paymentMethod, notes);
    this.showToast('Custo fixo confirmado e lançado no fluxo de caixa!', 'success');
    this.closeModal('modal-confirm-fixed-cost');
    this.refreshCurrentTab();
  },

  unconfirmFixedCost(fixedCostId, yearMonth) {
    if (confirm('Deseja desfazer a confirmação deste custo fixo? A movimentação gerada será removida.')) {
      StorageManager.unconfirmFixedCost(fixedCostId, yearMonth);
      this.showToast('Confirmação desfeita.', 'info');
      this.refreshCurrentTab();
    }
  },

  // Modal de Categorias
  openCategoryModal() {
    const modal = document.getElementById('modal-category');
    const form = document.getElementById('form-category');
    if (!modal || !form) return;
    form.reset();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  },

  saveCategoryFromForm(e) {
    e.preventDefault();
    const name = document.getElementById('cat-name').value.trim();
    const type = document.getElementById('cat-type').value;
    const color = document.getElementById('cat-color').value;

    if (!name) {
      this.showToast('Informe o nome da categoria.', 'warning');
      return;
    }

    StorageManager.addCategory({ name, type, color, icon: 'fa-tag' });
    this.showToast('Categoria criada com sucesso!', 'success');
    this.closeModal('modal-category');
    this.populateCategorySelects();
    this.refreshCurrentTab();
  },

  deleteCategoryConfirm(id) {
    if (confirm('Deseja excluir esta categoria?')) {
      StorageManager.deleteCategory(id);
      this.showToast('Categoria removida.', 'info');
      this.populateCategorySelects();
      this.refreshCurrentTab();
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  },

  // Exportar / Importar Backup JSON
  exportBackupFile() {
    const json = StorageManager.exportAllData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_fluxo_caixa_njf_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Backup exportado com sucesso!', 'success');
  },

  importBackupFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const success = StorageManager.importAllData(event.target.result);
      if (success) {
        this.showToast('Dados restaurados com sucesso!', 'success');
        this.populateCategorySelects();
        this.refreshCurrentTab();
      } else {
        this.showToast('Erro ao importar arquivo de backup.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Limpar input
  },

  // Notificações Toast
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const colors = {
      success: 'bg-emerald-800 text-white',
      error: 'bg-rose-700 text-white',
      warning: 'bg-amber-700 text-white',
      info: 'bg-slate-800 text-white'
    };

    const icons = {
      success: 'fa-circle-check',
      error: 'fa-triangle-exclamation',
      warning: 'fa-circle-exclamation',
      info: 'fa-circle-info'
    };

    const toast = document.createElement('div');
    toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg text-xs md:text-sm font-medium animate-fade-in ${colors[type] || colors.info}`;
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> <span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  setupEventListeners() {
    // Busca e filtros na aba de transações
    document.getElementById('tx-search-input')?.addEventListener('input', () => this.renderTransactions());
    document.getElementById('tx-filter-type')?.addEventListener('change', () => this.renderTransactions());
    document.getElementById('tx-filter-category')?.addEventListener('change', () => this.renderTransactions());

    // Fechar modais ao clicar no backdrop
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          backdrop.classList.add('hidden');
          backdrop.classList.remove('flex');
        }
      });
    });
  }
};

// Inicializar aplicação ao carregar o DOM
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
