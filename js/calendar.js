/**
 * Módulo de Calendário Interativo - Núcleo Jardim Florido
 */

const CalendarManager = {
  currentDate: new Date(),
  selectedDateStr: null, // 'YYYY-MM-DD'

  init() {
    this.selectedDateStr = this.formatDateISO(new Date());
    this.render();
  },

  formatDateISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  parseDateISO(dateStr) {
    const parts = dateStr.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  },

  prevMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.render();
  },

  nextMonth() {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    this.render();
  },

  goToToday() {
    this.currentDate = new Date();
    this.selectedDateStr = this.formatDateISO(new Date());
    this.render();
  },

  selectDate(dateStr) {
    this.selectedDateStr = dateStr;
    this.renderGrid();
    this.renderDayDetails();
  },

  render() {
    this.renderHeader();
    this.renderGrid();
    this.renderDayDetails();
  },

  renderHeader() {
    const titleEl = document.getElementById('calendar-month-year-title');
    if (!titleEl) return;

    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const month = monthNames[this.currentDate.getMonth()];
    const year = this.currentDate.getFullYear();
    titleEl.textContent = `${month} de ${year}`;
  },

  renderGrid() {
    const gridEl = document.getElementById('calendar-grid');
    if (!gridEl) return;

    gridEl.innerHTML = '';

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const currentYearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;

    // Primeiro dia do mês e total de dias
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Domingo
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const todayStr = this.formatDateISO(new Date());
    const transactions = StorageManager.getTransactions();
    const fixedCosts = StorageManager.getFixedCosts().filter(fc => fc.active);

    // Mapear transações por data
    const txByDate = {};
    transactions.forEach(tx => {
      if (!txByDate[tx.date]) {
        txByDate[tx.date] = { income: 0, expense: 0, items: [] };
      }
      if (tx.type === 'income') {
        txByDate[tx.date].income += parseFloat(tx.amount || 0);
      } else {
        txByDate[tx.date].expense += parseFloat(tx.amount || 0);
      }
      txByDate[tx.date].items.push(tx);
    });

    // Dias do mês anterior para preenchimento
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevDayNum = daysInPrevMonth - i;
      const prevCell = document.createElement('div');
      prevCell.className = 'calendar-day-cell p-1.5 md:p-2 text-slate-300 text-center rounded-xl bg-slate-50/50 flex flex-col items-center justify-start text-xs border border-transparent';
      prevCell.innerHTML = `<span>${prevDayNum}</span>`;
      gridEl.appendChild(prevCell);
    }

    // Dias do mês atual
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${currentYearMonth}-${String(day).padStart(2, '0')}`;
      const isToday = dayStr === todayStr;
      const isSelected = dayStr === this.selectedDateStr;

      const dayData = txByDate[dayStr];
      const hasIncome = dayData && dayData.income > 0;
      const hasExpense = dayData && dayData.expense > 0;

      // Verificar custos fixos com vencimento neste dia
      const dueFixedCosts = fixedCosts.filter(fc => fc.dueDay === day);
      const hasFixedDue = dueFixedCosts.length > 0;

      const cell = document.createElement('div');
      let baseClasses = 'calendar-day-cell p-1.5 md:p-2 rounded-xl text-center flex flex-col items-center justify-between cursor-pointer border transition-all-custom select-none ';
      
      if (isSelected) {
        baseClasses += 'calendar-day-selected shadow-md border-emerald-700 ';
      } else if (isToday) {
        baseClasses += 'bg-emerald-50 border-emerald-400 text-emerald-900 font-semibold shadow-xs ';
      } else {
        baseClasses += 'bg-white border-slate-100 text-slate-700 hover:border-emerald-200 ';
      }

      cell.className = baseClasses;
      cell.onclick = () => this.selectDate(dayStr);

      // Conteúdo da célula
      let dotsHtml = '<div class="flex items-center gap-1 mt-1">';
      if (hasIncome) {
        dotsHtml += `<span class="w-2 h-2 rounded-full ${isSelected ? 'bg-emerald-200 ring-1 ring-white' : 'bg-emerald-500'}" title="Entrada"></span>`;
      }
      if (hasExpense) {
        dotsHtml += `<span class="w-2 h-2 rounded-full ${isSelected ? 'bg-rose-200 ring-1 ring-white' : 'bg-rose-500'}" title="Saída"></span>`;
      }
      if (hasFixedDue) {
        dotsHtml += `<span class="w-2 h-2 rounded-full ${isSelected ? 'bg-amber-200 ring-1 ring-white' : 'bg-amber-500'}" title="Custo Fixo"></span>`;
      }
      dotsHtml += '</div>';

      let miniBalanceHtml = '';
      if (dayData && (hasIncome || hasExpense)) {
        const net = dayData.income - dayData.expense;
        const netSign = net >= 0 ? '+' : '';
        const netColor = isSelected ? 'text-emerald-100' : (net >= 0 ? 'text-emerald-700' : 'text-rose-600');
        miniBalanceHtml = `<span class="text-[9px] font-medium leading-none ${netColor} hidden md:inline-block">${netSign}R$${Math.abs(net).toFixed(0)}</span>`;
      }

      cell.innerHTML = `
        <div class="flex items-center justify-between w-full">
          <span class="day-number text-xs md:text-sm font-medium ${isToday && !isSelected ? 'text-emerald-700 font-bold' : ''}">${day}</span>
          ${isToday && !isSelected ? '<span class="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>' : ''}
        </div>
        ${dotsHtml}
        ${miniBalanceHtml}
      `;

      gridEl.appendChild(cell);
    }

    // Dias do próximo mês para completar grid de 7 colunas
    const totalCellsSoFar = firstDayIndex + daysInMonth;
    const remainingCells = (7 - (totalCellsSoFar % 7)) % 7;
    for (let j = 1; j <= remainingCells; j++) {
      const nextCell = document.createElement('div');
      nextCell.className = 'calendar-day-cell p-1.5 md:p-2 text-slate-300 text-center rounded-xl bg-slate-50/50 flex flex-col items-center justify-start text-xs border border-transparent';
      nextCell.innerHTML = `<span>${j}</span>`;
      gridEl.appendChild(nextCell);
    }
  },

  renderDayDetails() {
    const detailsContainer = document.getElementById('calendar-day-details');
    if (!detailsContainer) return;

    if (!this.selectedDateStr) {
      detailsContainer.innerHTML = `
        <div class="p-6 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <i class="fa-regular fa-calendar-days text-3xl mb-2 text-slate-300"></i>
          <p class="text-sm">Toque em um dia do calendário para ver e registrar movimentações.</p>
        </div>
      `;
      return;
    }

    const dateObj = this.parseDateISO(this.selectedDateStr);
    const day = dateObj.getDate();
    const month = dateObj.toLocaleDateString('pt-BR', { month: 'long' });
    const year = dateObj.getFullYear();
    const weekday = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' });
    const formattedDate = `${day} de ${month} de ${year} (${weekday})`;

    const transactions = StorageManager.getTransactions().filter(t => t.date === this.selectedDateStr);
    const yearMonth = this.selectedDateStr.slice(0, 7);

    // Custos fixos deste dia
    const fixedCostsDueToday = StorageManager.getFixedCosts().filter(fc => fc.active && fc.dueDay === day);

    let totalDayIncome = 0;
    let totalDayExpense = 0;
    transactions.forEach(t => {
      if (t.type === 'income') totalDayIncome += parseFloat(t.amount || 0);
      else totalDayExpense += parseFloat(t.amount || 0);
    });
    const dayBalance = totalDayIncome - totalDayExpense;

    let html = `
      <div class="bg-white p-4 md:p-6 rounded-2xl border border-slate-100 shadow-sm animate-fade-in">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <span class="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Movimentações do Dia</span>
            <h3 class="text-base md:text-lg font-bold text-slate-800 capitalize">${formattedDate}</h3>
          </div>
          <button onclick="App.openTransactionModalWithDate('${this.selectedDateStr}')" 
                  class="inline-flex items-center justify-center gap-2 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs md:text-sm font-medium rounded-xl shadow-sm transition-all-custom">
            <i class="fa-solid fa-plus"></i>
            <span>Novo Lançamento</span>
          </button>
        </div>

        <!-- Resumo do Dia -->
        <div class="grid grid-cols-3 gap-2 my-4">
          <div class="bg-emerald-50 p-2.5 rounded-xl text-center border border-emerald-100">
            <span class="text-[11px] text-emerald-700 font-medium block">Entradas</span>
            <span class="text-xs md:text-sm font-bold text-emerald-800">R$ ${totalDayIncome.toFixed(2)}</span>
          </div>
          <div class="bg-rose-50 p-2.5 rounded-xl text-center border border-rose-100">
            <span class="text-[11px] text-rose-700 font-medium block">Saídas</span>
            <span class="text-xs md:text-sm font-bold text-rose-800">R$ ${totalDayExpense.toFixed(2)}</span>
          </div>
          <div class="bg-slate-50 p-2.5 rounded-xl text-center border border-slate-200">
            <span class="text-[11px] text-slate-600 font-medium block">Saldo do Dia</span>
            <span class="text-xs md:text-sm font-bold ${dayBalance >= 0 ? 'text-emerald-700' : 'text-rose-600'}">
              ${dayBalance >= 0 ? '+' : ''}R$ ${dayBalance.toFixed(2)}
            </span>
          </div>
        </div>
    `;

    // Seção de Custos Fixos com vencimento neste dia
    if (fixedCostsDueToday.length > 0) {
      html += `
        <div class="mb-4">
          <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <i class="fa-solid fa-bell text-amber-500"></i>
            Custos Fixos com Vencimento Hoje (${day})
          </h4>
          <div class="space-y-2">
      `;

      fixedCostsDueToday.forEach(fc => {
        const isConfirmed = StorageManager.isFixedCostConfirmed(fc.id, yearMonth);
        html += `
          <div class="flex items-center justify-between p-3 rounded-xl border ${isConfirmed ? 'bg-emerald-50/40 border-emerald-200' : 'bg-amber-50/40 border-amber-200'}">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center ${isConfirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">
                <i class="fa-solid ${isConfirmed ? 'fa-check' : 'fa-calendar-day'} text-xs"></i>
              </div>
              <div>
                <p class="text-xs md:text-sm font-semibold text-slate-800">${fc.name}</p>
                <p class="text-[11px] text-slate-500">${fc.category} • Vence dia ${fc.dueDay}</p>
              </div>
            </div>
            <div class="flex items-center gap-2 text-right">
              <span class="text-xs md:text-sm font-bold text-slate-800">R$ ${parseFloat(fc.amount).toFixed(2)}</span>
              ${isConfirmed ? `
                <span class="text-[11px] px-2 py-1 bg-emerald-100 text-emerald-800 font-medium rounded-lg">Pago</span>
              ` : `
                <button onclick="App.openConfirmFixedCostModal('${fc.id}', '${yearMonth}', '${this.selectedDateStr}')" 
                        class="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-xs">
                  Confirmar
                </button>
              `}
            </div>
          </div>
        `;
      });

      html += `</div></div>`;
    }

    // Lista de Lançamentos do Dia
    html += `
      <div>
        <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <i class="fa-solid fa-list-check text-emerald-600"></i>
          Lançamentos Registrados (${transactions.length})
        </h4>
    `;

    if (transactions.length === 0) {
      html += `
        <div class="py-6 text-center text-slate-400 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
          <p class="text-xs">Nenhum lançamento registrado nesta data.</p>
        </div>
      `;
    } else {
      html += `<div class="space-y-2">`;
      transactions.forEach(t => {
        const isIncome = t.type === 'income';
        html += `
          <div class="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 hover:border-slate-200 shadow-xs transition-all-custom">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl flex items-center justify-center ${isIncome ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">
                <i class="fa-solid ${isIncome ? 'fa-arrow-down' : 'fa-arrow-up'} text-xs"></i>
              </div>
              <div>
                <p class="text-xs md:text-sm font-semibold text-slate-800">${t.description}</p>
                <div class="flex items-center gap-2 text-[11px] text-slate-500">
                  <span>${t.category}</span>
                  <span>•</span>
                  <span>${t.paymentMethod || 'Pix'}</span>
                  ${t.isFixedCost ? '<span class="text-emerald-700 font-medium bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">Fixo</span>' : ''}
                </div>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-xs md:text-sm font-bold ${isIncome ? 'text-emerald-700' : 'text-rose-700'}">
                ${isIncome ? '+' : '-'} R$ ${parseFloat(t.amount).toFixed(2)}
              </span>
              <button onclick="App.deleteTransactionConfirm('${t.id}')" class="text-slate-400 hover:text-rose-600 p-1 transition-colors" title="Excluir">
                <i class="fa-regular fa-trash-can text-xs"></i>
              </button>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

    html += `</div></div>`;
    detailsContainer.innerHTML = html;
  }
};
