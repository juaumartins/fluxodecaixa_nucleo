/**
 * Gerenciador de Armazenamento Local (LocalStorage) - Núcleo Jardim Florido
 */

const STORAGE_KEYS = {
  TRANSACTIONS: 'njf_transactions_v1',
  FIXED_COSTS: 'njf_fixed_costs_v1',
  FIXED_CONFIRMATIONS: 'njf_fixed_confirmations_v1',
  CATEGORIES: 'njf_categories_v1',
  SETTINGS: 'njf_settings_v1'
};

const DEFAULT_CATEGORIES = [
  // Entradas
  { id: 'cat_in_1', name: 'Mensalidades / Contribuições', type: 'income', color: '#16a34a', icon: 'fa-hand-holding-dollar' },
  { id: 'cat_in_2', name: 'Doações e Apadrinhamentos', type: 'income', color: '#15803d', icon: 'fa-heart' },
  { id: 'cat_in_3', name: 'Venda de Plantas e Mudas', type: 'income', color: '#10b981', icon: 'fa-seedling' },
  { id: 'cat_in_4', name: 'Oficinas e Vivências', type: 'income', color: '#059669', icon: 'fa-chalkboard-user' },
  { id: 'cat_in_5', name: 'Bazar e Eventos', type: 'income', color: '#0d9488', icon: 'fa-store' },
  { id: 'cat_in_6', name: 'Outras Entradas', type: 'income', color: '#047857', icon: 'fa-arrow-down-long' },

  // Saídas
  { id: 'cat_out_1', name: 'Insumos, Terra e Jardinagem', type: 'expense', color: '#166534', icon: 'fa-spa' },
  { id: 'cat_out_2', name: 'Manutenção do Espaço', type: 'expense', color: '#ca8a04', icon: 'fa-hammer' },
  { id: 'cat_out_3', name: 'Água e Saneamento', type: 'expense', color: '#0284c7', icon: 'fa-droplet' },
  { id: 'cat_out_4', name: 'Energia Elétrica', type: 'expense', color: '#eab308', icon: 'fa-bolt' },
  { id: 'cat_out_5', name: 'Internet e Comunicação', type: 'expense', color: '#6366f1', icon: 'fa-wifi' },
  { id: 'cat_out_6', name: 'Alimentação e Cozinha Comunitária', type: 'expense', color: '#ea580c', icon: 'fa-utensils' },
  { id: 'cat_out_7', name: 'Materiais de Limpeza e Higiene', type: 'expense', color: '#06b6d4', icon: 'fa-soap' },
  { id: 'cat_out_8', name: 'Ferramentas e Equipamentos', type: 'expense', color: '#64748b', icon: 'fa-screwdriver-wrench' },
  { id: 'cat_out_9', name: 'Outras Saídas', type: 'expense', color: '#dc2626', icon: 'fa-arrow-up-long' }
];

const DEFAULT_FIXED_COSTS = [
  { id: 'fc_1', name: 'Conta de Água / Saneamento', amount: 85.00, dueDay: 10, type: 'expense', category: 'Água e Saneamento', active: true, notes: 'Vencimento todo dia 10' },
  { id: 'fc_2', name: 'Energia Elétrica', amount: 160.00, dueDay: 15, type: 'expense', category: 'Energia Elétrica', active: true, notes: 'Medidor do jardim e sede' },
  { id: 'fc_3', name: 'Internet / Wi-Fi', amount: 99.90, dueDay: 20, type: 'expense', category: 'Internet e Comunicação', active: true, notes: 'Fibra óptica da sede' },
  { id: 'fc_4', name: 'Manutenção Preventiva de Irrigação', amount: 75.00, dueDay: 5, type: 'expense', category: 'Manutenção do Espaço', active: true, notes: 'Revisão periódica de aspersores' }
];

const DEFAULT_SETTINGS = {
  organizationName: 'Núcleo Jardim Florido',
  currency: 'BRL',
  initialBalance: 0.00,
  createdAt: '2026-08-01'
};

const StorageManager = {
  authenticated: false,
  currentUser: null,
  supabase: null,
  ready: null,

  // Inicialização
  init() {
    if (this.ready) return this.ready;
    if (!window.SUPABASE_CONFIG || window.SUPABASE_CONFIG.url.startsWith('COLE_')) {
      this.showLogin('Configure o Supabase em js/supabase-config.js.');
      return Promise.resolve(false);
    }
    this.supabase = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
    this.ready = this.supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session) {
          this.showLogin();
          return false;
        }
        this.authenticated = true;
        this.currentUser = { username: session.user.email, role: 'manager' };
        const profile = await this.supabase.from('profiles').select('role').eq('id', session.user.id).single();
        if (profile.data) this.currentUser.role = profile.data.role;
        const result = await this.supabase.from('app_data').select('data').eq('id', 1).single();
        const hasRemoteData = Boolean(result.data && result.data.data && Object.keys(result.data.data).length);
        if (!hasRemoteData) localStorage.clear();
        if (hasRemoteData) {
          Object.entries(result.data.data).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));
        }
        this.initializeDefaults();
        if (!hasRemoteData) this.sync();
        return true;
      })
      .catch(() => {
        this.showLogin('Não foi possível conectar ao servidor.');
        return false;
      });
    return this.ready;
  },

  initializeDefaults() {
    if (!localStorage.getItem(STORAGE_KEYS.CATEGORIES)) {
      this.saveCategories(DEFAULT_CATEGORIES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.FIXED_COSTS)) {
      this.saveFixedCosts(DEFAULT_FIXED_COSTS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
      this.saveSettings(DEFAULT_SETTINGS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.TRANSACTIONS)) this.saveTransactions([]);
    if (!localStorage.getItem(STORAGE_KEYS.FIXED_CONFIRMATIONS)) {
      localStorage.setItem(STORAGE_KEYS.FIXED_CONFIRMATIONS, JSON.stringify([]));
    }
  },

  sync() {
    if (!this.authenticated || !this.supabase) return;
    const data = {};
    Object.values(STORAGE_KEYS).forEach(key => {
      const value = localStorage.getItem(key);
      if (value !== null) data[key] = JSON.parse(value);
    });
    this.supabase.from('app_data').upsert({ id: 1, data, updated_at: new Date().toISOString() });
  },

  showLogin(message = '') {
    document.body.classList.add('auth-locked');
    const overlay = document.createElement('div');
    overlay.className = 'login-screen';
    overlay.innerHTML = `<form class="login-card" id="login-form">
      <div class="login-mark"><i class="fa-solid fa-seedling"></i></div>
      <p class="login-kicker">Núcleo Jardim Florido</p><h1>Acesso ao fluxo de caixa</h1>
      <label>E-mail<input name="email" type="email" autocomplete="username" required></label>
      <label>Senha<input name="password" type="password" autocomplete="current-password" required autofocus></label>
      <p class="login-error">${message}</p><button type="submit">Entrar</button>
    </form>`;
    document.body.prepend(overlay);
    overlay.querySelector('form').addEventListener('submit', async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const values = Object.fromEntries(form);
      const { data, error } = await this.supabase.auth.signInWithPassword({ email: values.email, password: values.password });
      if (error) {
        overlay.querySelector('.login-error').textContent = error.message;
        return;
      }
      this.currentUser = { username: data.user.email, role: 'manager' };
      const profile = await this.supabase.from('profiles').select('role').eq('id', data.user.id).single();
      if (profile.data) this.currentUser.role = profile.data.role;
      overlay.remove();
      document.body.classList.remove('auth-locked');
      this.authenticated = true;
      this.ready = Promise.resolve(true);
      this.initializeDefaults();
      App.initAuthenticated();
    });
  },

  async logout() {
    await this.supabase.auth.signOut();
    window.location.reload();
  },

  async changePassword(currentPassword, newPassword) {
    const { error } = await this.supabase.auth.updateUser({ password: newPassword });
    return { ok: !error, body: { error: error ? error.message : null } };
  },

  async createUser(username, password, role) {
    const { data, error } = await this.supabase.auth.signUp({ email: username, password });
    if (!error && data.user) {
      await this.supabase.from('profiles').upsert({ id: data.user.id, email: username, role });
    }
    return { ok: !error, body: { error: error ? error.message : null } };
  },

  // Amostra inicial de dados
  seedInitialTransactions() {
    const currentYearMonth = new Date().toISOString().slice(0, 7); // '2026-08'
    const samples = [
      {
        id: 'tx_seed_1',
        description: 'Contribuição Mensal - Sócios Fundadores',
        amount: 350.00,
        type: 'income',
        category: 'Mensalidades / Contribuições',
        date: `${currentYearMonth}-02`,
        paymentMethod: 'Pix',
        status: 'completed',
        notes: 'Repasse mensal',
        createdAt: new Date().toISOString()
      },
      {
        id: 'tx_seed_2',
        description: 'Venda de Mudas de Ervas Aromáticas',
        amount: 145.00,
        type: 'income',
        category: 'Venda de Plantas e Mudas',
        date: `${currentYearMonth}-08`,
        paymentMethod: 'Dinheiro',
        status: 'completed',
        notes: 'Feirinha de sábado',
        createdAt: new Date().toISOString()
      },
      {
        id: 'tx_seed_3',
        description: 'Compra de Substrato Orgânico e Adubo',
        amount: 120.00,
        type: 'expense',
        category: 'Insumos, Terra e Jardinagem',
        date: `${currentYearMonth}-09`,
        paymentMethod: 'Pix',
        status: 'completed',
        notes: '3 sacos de 25kg',
        createdAt: new Date().toISOString()
      },
      {
        id: 'tx_seed_4',
        description: 'Conta de Água / Saneamento (Confirmado)',
        amount: 85.00,
        type: 'expense',
        category: 'Água e Saneamento',
        date: `${currentYearMonth}-10`,
        paymentMethod: 'Boleto',
        status: 'completed',
        isFixedCost: true,
        fixedCostId: 'fc_1',
        notes: 'Pago pontualmente',
        createdAt: new Date().toISOString()
      },
      {
        id: 'tx_seed_5',
        description: 'Doação para Reforma do Canteiro Central',
        amount: 200.00,
        type: 'income',
        category: 'Doações e Apadrinhamentos',
        date: `${currentYearMonth}-16`,
        paymentMethod: 'Pix',
        status: 'completed',
        notes: 'Doação anônima',
        createdAt: new Date().toISOString()
      }
    ];

    this.saveTransactions(samples);
    // Registrar confirmação de custo fixo seed
    const confs = [
      {
        id: 'conf_seed_1',
        fixedCostId: 'fc_1',
        yearMonth: currentYearMonth,
        transactionId: 'tx_seed_4',
        confirmedDate: `${currentYearMonth}-10`,
        amount: 85.00
      }
    ];
    localStorage.setItem(STORAGE_KEYS.FIXED_CONFIRMATIONS, JSON.stringify(confs));
  },

  // Transações
  getTransactions() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Erro ao ler transações:', e);
      return [];
    }
  },

  saveTransactions(transactions) {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    this.sync();
  },

  addTransaction(tx) {
    const transactions = this.getTransactions();
    const newTx = {
      ...tx,
      id: tx.id || 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      createdAt: new Date().toISOString()
    };
    transactions.unshift(newTx);
    this.saveTransactions(transactions);
    return newTx;
  },

  updateTransaction(id, updatedFields) {
    const transactions = this.getTransactions();
    const index = transactions.findIndex(t => t.id === id);
    if (index !== -1) {
      transactions[index] = { ...transactions[index], ...updatedFields };
      this.saveTransactions(transactions);
      return transactions[index];
    }
    return null;
  },

  deleteTransaction(id) {
    let transactions = this.getTransactions();
    transactions = transactions.filter(t => t.id !== id);
    this.saveTransactions(transactions);

    // Se estiver associada a uma confirmação de custo fixo, remover a confirmação
    let confs = this.getFixedCostConfirmations();
    confs = confs.filter(c => c.transactionId !== id);
    this.saveFixedCostConfirmations(confs);
  },

  // Custos Fixos
  getFixedCosts() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.FIXED_COSTS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Erro ao ler custos fixos:', e);
      return [];
    }
  },

  saveFixedCosts(fixedCosts) {
    localStorage.setItem(STORAGE_KEYS.FIXED_COSTS, JSON.stringify(fixedCosts));
    this.sync();
  },

  addFixedCost(fc) {
    const fixedCosts = this.getFixedCosts();
    const newFc = {
      ...fc,
      id: fc.id || 'fc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      active: fc.active !== false
    };
    fixedCosts.push(newFc);
    this.saveFixedCosts(fixedCosts);
    return newFc;
  },

  updateFixedCost(id, updatedFields) {
    const fixedCosts = this.getFixedCosts();
    const index = fixedCosts.findIndex(f => f.id === id);
    if (index !== -1) {
      fixedCosts[index] = { ...fixedCosts[index], ...updatedFields };
      this.saveFixedCosts(fixedCosts);
      return fixedCosts[index];
    }
    return null;
  },

  deleteFixedCost(id) {
    const fixedCosts = this.getFixedCosts().filter(f => f.id !== id);
    this.saveFixedCosts(fixedCosts);

    const transactionIds = this.getTransactions()
      .filter(t => t.fixedCostId === id)
      .map(t => t.id);
    this.saveTransactions(this.getTransactions().filter(t => t.fixedCostId !== id));
    this.saveFixedCostConfirmations(
      this.getFixedCostConfirmations().filter(c => c.fixedCostId !== id && !transactionIds.includes(c.transactionId))
    );
  },

  // Confirmações de Custos Fixos por Mês (Confirmação Manual)
  getFixedCostConfirmations() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.FIXED_CONFIRMATIONS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  saveFixedCostConfirmations(confs) {
    localStorage.setItem(STORAGE_KEYS.FIXED_CONFIRMATIONS, JSON.stringify(confs));
    this.sync();
  },

  isFixedCostConfirmed(fixedCostId, yearMonth) {
    const confs = this.getFixedCostConfirmations();
    return confs.some(c => c.fixedCostId === fixedCostId && c.yearMonth === yearMonth);
  },

  getFixedCostConfirmation(fixedCostId, yearMonth) {
    const confs = this.getFixedCostConfirmations();
    return confs.find(c => c.fixedCostId === fixedCostId && c.yearMonth === yearMonth);
  },

  confirmFixedCost(fixedCostId, yearMonth, paymentDate, actualAmount, paymentMethod = 'Pix', notes = '') {
    const fixedCosts = this.getFixedCosts();
    const fc = fixedCosts.find(f => f.id === fixedCostId);
    if (!fc) return null;

    const amount = actualAmount !== undefined ? parseFloat(actualAmount) : parseFloat(fc.amount);

    // 1. Criar transação no fluxo de caixa
    const tx = this.addTransaction({
      description: `${fc.name} (Custo Fixo)`,
      amount: amount,
      type: fc.type || 'expense',
      category: fc.category,
      date: paymentDate,
      paymentMethod: paymentMethod,
      status: 'completed',
      isFixedCost: true,
      fixedCostId: fc.id,
      notes: notes || `Confirmado para o mês de ${yearMonth}`
    });

    // 2. Gravar registro de confirmação
    const confs = this.getFixedCostConfirmations();
    confs.push({
      id: 'conf_' + Date.now(),
      fixedCostId: fc.id,
      yearMonth: yearMonth,
      transactionId: tx.id,
      confirmedDate: paymentDate,
      amount: amount
    });
    this.saveFixedCostConfirmations(confs);

    return tx;
  },

  unconfirmFixedCost(fixedCostId, yearMonth) {
    let confs = this.getFixedCostConfirmations();
    const conf = confs.find(c => c.fixedCostId === fixedCostId && c.yearMonth === yearMonth);
    if (conf) {
      // Excluir a transação gerada
      if (conf.transactionId) {
        this.deleteTransaction(conf.transactionId);
      }
      confs = confs.filter(c => !(c.fixedCostId === fixedCostId && c.yearMonth === yearMonth));
      this.saveFixedCostConfirmations(confs);
      return true;
    }
    return false;
  },

  // Categorias
  getCategories() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      return data ? JSON.parse(data) : DEFAULT_CATEGORIES;
    } catch (e) {
      return DEFAULT_CATEGORIES;
    }
  },

  saveCategories(categories) {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    this.sync();
  },

  addCategory(cat) {
    const categories = this.getCategories();
    const newCat = {
      ...cat,
      id: cat.id || 'cat_' + Date.now()
    };
    categories.push(newCat);
    this.saveCategories(categories);
    return newCat;
  },

  deleteCategory(id) {
    let categories = this.getCategories();
    categories = categories.filter(c => c.id !== id);
    this.saveCategories(categories);
  },

  // Configurações
  getSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? JSON.parse(data) : DEFAULT_SETTINGS;
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    this.sync();
  },

  // Backup e Restauração
  exportAllData() {
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      organization: 'Núcleo Jardim Florido',
      transactions: this.getTransactions(),
      fixedCosts: this.getFixedCosts(),
      fixedConfirmations: this.getFixedCostConfirmations(),
      categories: this.getCategories(),
      settings: this.getSettings()
    };
    return JSON.stringify(backup, null, 2);
  },

  importAllData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data.transactions || !data.categories) {
        throw new Error('Arquivo de backup inválido.');
      }
      if (data.transactions) this.saveTransactions(data.transactions);
      if (data.fixedCosts) this.saveFixedCosts(data.fixedCosts);
      if (data.fixedConfirmations) this.saveFixedCostConfirmations(data.fixedConfirmations);
      if (data.categories) this.saveCategories(data.categories);
      if (data.settings) this.saveSettings(data.settings);
      return true;
    } catch (e) {
      console.error('Falha na importação:', e);
      return false;
    }
  },

  async resetAllData() {
    localStorage.clear();
    const data = {
      [STORAGE_KEYS.TRANSACTIONS]: [],
      [STORAGE_KEYS.FIXED_COSTS]: DEFAULT_FIXED_COSTS,
      [STORAGE_KEYS.FIXED_CONFIRMATIONS]: [],
      [STORAGE_KEYS.CATEGORIES]: DEFAULT_CATEGORIES,
      [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS
    };
    Object.entries(data).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));
    if (this.authenticated && this.supabase) {
      const { error } = await this.supabase.from('app_data').upsert({ id: 1, data, updated_at: new Date().toISOString() });
      if (error) throw error;
    }
  }
};

// A inicialização é disparada pelo controlador da aplicação.
