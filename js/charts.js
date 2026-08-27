/**
 * Módulo de Gráficos Financeiros (Chart.js) - Núcleo Jardim Florido
 */

const ChartsManager = {
  cashflowChartInstance: null,
  expensesCategoryChartInstance: null,
  incomeCategoryChartInstance: null,

  // Inicializa ou atualiza os gráficos
  updateAllCharts(selectedYearMonth) {
    this.renderCashflowEvolutionChart(selectedYearMonth);
    this.renderExpensesCategoryChart(selectedYearMonth);
  },

  // Gráfico de Evolução / Comparativo (Entradas vs Saídas)
  renderCashflowEvolutionChart(selectedYearMonth) {
    const canvas = document.getElementById('chart-cashflow-evolution');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const transactions = StorageManager.getTransactions();

    // Obter os últimos 6 meses para histórico comparativo
    const labels = [];
    const incomeData = [];
    const expenseData = [];

    const date = new Date();
    if (selectedYearMonth) {
      const parts = selectedYearMonth.split('-');
      date.setFullYear(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
    }

    const monthNamesShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      labels.push(`${monthNamesShort[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`);

      let mIncome = 0;
      let mExpense = 0;

      transactions.forEach(t => {
        if (t.date && t.date.startsWith(ym)) {
          if (t.type === 'income') mIncome += parseFloat(t.amount || 0);
          else mExpense += parseFloat(t.amount || 0);
        }
      });

      incomeData.push(mIncome);
      expenseData.push(mExpense);
    }

    if (this.cashflowChartInstance) {
      this.cashflowChartInstance.destroy();
    }

    this.cashflowChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Entradas (R$)',
            data: incomeData,
            backgroundColor: '#16a34a',
            borderRadius: 6,
            barPercentage: 0.7,
            categoryPercentage: 0.8
          },
          {
            label: 'Saídas (R$)',
            data: expenseData,
            backgroundColor: '#ef4444',
            borderRadius: 6,
            barPercentage: 0.7,
            categoryPercentage: 0.8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 12,
              usePointStyle: true,
              font: { size: 11, family: "'Segoe UI', sans-serif" }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: R$ ${context.parsed.y.toFixed(2)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 } }
          },
          y: {
            grid: { color: '#f1f5f9' },
            ticks: {
              font: { size: 10 },
              callback: function(value) { return 'R$ ' + value; }
            }
          }
        }
      }
    });
  },

  // Gráfico de Despesas por Categoria
  renderExpensesCategoryChart(selectedYearMonth) {
    const canvas = document.getElementById('chart-expenses-category');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const transactions = StorageManager.getTransactions().filter(t => 
      t.type === 'expense' && (!selectedYearMonth || t.date.startsWith(selectedYearMonth))
    );

    const categoryTotals = {};
    transactions.forEach(t => {
      const cat = t.category || 'Outras Saídas';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + parseFloat(t.amount || 0);
    });

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);

    // Cores temáticas elegantes
    const palette = [
      '#15803d', '#ca8a04', '#0284c7', '#ea580c', '#eab308',
      '#6366f1', '#06b6d4', '#dc2626', '#10b981', '#64748b'
    ];

    if (this.expensesCategoryChartInstance) {
      this.expensesCategoryChartInstance.destroy();
    }

    if (labels.length === 0) {
      // Estado vazio
      this.expensesCategoryChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Sem despesas no período'],
          datasets: [{
            data: [1],
            backgroundColor: ['#e2e8f0']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true, position: 'bottom' },
            tooltip: { enabled: false }
          },
          cutout: '70%'
        }
      });
      return;
    }

    this.expensesCategoryChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: palette.slice(0, labels.length),
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10,
              usePointStyle: true,
              font: { size: 11 }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const val = context.parsed;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const pct = ((val / total) * 100).toFixed(1);
                return `${context.label}: R$ ${val.toFixed(2)} (${pct}%)`;
              }
            }
          }
        },
        cutout: '65%'
      }
    });
  }
};
