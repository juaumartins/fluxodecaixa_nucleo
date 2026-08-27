/**
 * Módulo de Relatórios, Exportação em PDF e Compartilhamento via WhatsApp
 * Núcleo Jardim Florido
 */

const ReportsManager = {
  // Obter dados consolidados de um período (YYYY-MM)
  getPeriodData(yearMonth) {
    const transactions = StorageManager.getTransactions();
    const fixedCosts = StorageManager.getFixedCosts().filter(fc => fc.active);
    const settings = StorageManager.getSettings();

    // Filtrar transações do período
    const periodTransactions = transactions.filter(t => !yearMonth || t.date.startsWith(yearMonth));

    let totalIncome = 0;
    let totalExpense = 0;
    const categoryTotals = {};

    periodTransactions.forEach(t => {
      const amount = parseFloat(t.amount || 0);
      if (t.type === 'income') {
        totalIncome += amount;
      } else {
        totalExpense += amount;
        const cat = t.category || 'Outras Saídas';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + amount;
      }
    });

    const netPeriod = totalIncome - totalExpense;

    // Calcular saldo acumulado total histórico
    let cumulativeBalance = parseFloat(settings.initialBalance || 0);
    transactions.forEach(t => {
      const amount = parseFloat(t.amount || 0);
      if (t.type === 'income') cumulativeBalance += amount;
      else cumulativeBalance -= amount;
    });

    // Custos fixos do período (status pagos vs pendentes)
    let fixedPaidTotal = 0;
    let fixedPendingTotal = 0;
    let fixedPaidCount = 0;
    let fixedPendingCount = 0;
    const fixedDetails = [];

    fixedCosts.forEach(fc => {
      const isConfirmed = StorageManager.isFixedCostConfirmed(fc.id, yearMonth);
      const amount = parseFloat(fc.amount || 0);
      if (isConfirmed) {
        fixedPaidTotal += amount;
        fixedPaidCount++;
      } else {
        fixedPendingTotal += amount;
        fixedPendingCount++;
      }
      fixedDetails.push({
        name: fc.name,
        dueDay: fc.dueDay,
        amount: amount,
        category: fc.category,
        isConfirmed: isConfirmed
      });
    });

    // Top categorias de despesas
    const topExpenseCategories = Object.entries(categoryTotals)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);

    return {
      yearMonth,
      totalIncome,
      totalExpense,
      netPeriod,
      cumulativeBalance,
      transactions: periodTransactions,
      fixedPaidTotal,
      fixedPendingTotal,
      fixedPaidCount,
      fixedPendingCount,
      fixedDetails,
      topExpenseCategories
    };
  },

  formatCurrency(value) {
    return 'R$ ' + parseFloat(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  getMonthName(yearMonth) {
    if (!yearMonth) return 'Geral';
    const [year, month] = yearMonth.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  },

  // Gerar texto formatado para WhatsApp
  generateWhatsAppText(yearMonth) {
    const data = this.getPeriodData(yearMonth);
    const monthLabel = this.getMonthName(yearMonth).toUpperCase();

    let text = `🌿 *NÚCLEO JARDIM FLORIDO*\n`;
    text += `📊 *RELATÓRIO DE FLUXO DE CAIXA*\n`;
    text += `📅 *Período:* ${monthLabel}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    text += `💰 *RESUMO FINANCEIRO:*\n`;
    text += `• (+) *Entradas:* ${this.formatCurrency(data.totalIncome)}\n`;
    text += `• (-) *Saídas:* ${this.formatCurrency(data.totalExpense)}\n`;
    text += `• (=) *Resultado do Mês:* ${data.netPeriod >= 0 ? '+' : ''}${this.formatCurrency(data.netPeriod)}\n`;
    text += `• 🏦 *Saldo Geral em Caixa:* ${this.formatCurrency(data.cumulativeBalance)}\n\n`;

    text += `📌 *CUSTOS FIXOS:*\n`;
    text += `• ✅ Pagos: ${this.formatCurrency(data.fixedPaidTotal)} (${data.fixedPaidCount} itens)\n`;
    if (data.fixedPendingCount > 0) {
      text += `• ⏳ Pendentes: ${this.formatCurrency(data.fixedPendingTotal)} (${data.fixedPendingCount} itens)\n`;
    } else {
      text += `• ⏳ Pendentes: Nenhum pendente no mês 🎉\n`;
    }
    text += `\n`;

    if (data.topExpenseCategories.length > 0) {
      text += `🏷️ *MAIORES DESPESAS POR CATEGORIA:*\n`;
      data.topExpenseCategories.slice(0, 4).forEach(cat => {
        text += `• ${cat.name}: ${this.formatCurrency(cat.total)}\n`;
      });
      text += `\n`;
    }

    text += `📝 *Total de Lançamentos:* ${data.transactions.length} registros\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `_Gerado pelo App de Fluxo de Caixa do Núcleo Jardim Florido_`;

    return text;
  },

  // Compartilhar via WhatsApp (abre o aplicativo com o texto preenchido)
  shareViaWhatsApp(yearMonth) {
    const text = this.generateWhatsAppText(yearMonth);
    const encodedText = encodeURIComponent(text);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
  },

  // Copiar texto do WhatsApp para a área de transferência
  copyWhatsAppText(yearMonth) {
    const text = this.generateWhatsAppText(yearMonth);
    navigator.clipboard.writeText(text).then(() => {
      App.showToast('Resumo copiado para a área de transferência!', 'success');
    }).catch(err => {
      console.error('Erro ao copiar:', err);
      App.showToast('Não foi possível copiar automaticamente.', 'error');
    });
  },

  // Gerar e Exportar PDF
  exportPDFReport(yearMonth) {
    const data = this.getPeriodData(yearMonth);
    const monthLabel = this.getMonthName(yearMonth);

    const printContainer = document.getElementById('report-print-container');
    if (!printContainer) return;

    let html = `
      <div style="font-family: Arial, sans-serif; color: #1e293b; padding: 20px; max-width: 800px; margin: 0 auto; background: #ffffff;">
        <!-- Cabeçalho -->
        <div style="border-bottom: 2px solid #15803d; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h1 style="color: #15803d; font-size: 24px; margin: 0; font-weight: bold; letter-spacing: -0.5px;">🌿 Núcleo Jardim Florido</h1>
            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 14px; font-weight: 500;">Relatório Consolidado de Fluxo de Caixa</p>
          </div>
          <div style="text-align: right;">
            <span style="display: inline-block; background-color: #f0fdf4; color: #166534; padding: 4px 12px; border-radius: 8px; font-weight: bold; font-size: 13px; border: 1px solid #bbf7d0;">
              ${monthLabel.toUpperCase()}
            </span>
            <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 11px;">Emitido em: ${new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>

        <!-- Cards de Resumo -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 25px;">
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; text-align: center;">
            <span style="display: block; font-size: 11px; color: #166534; font-weight: 600;">TOTAL ENTRADAS</span>
            <span style="display: block; font-size: 16px; color: #15803d; font-weight: bold; margin-top: 4px;">${this.formatCurrency(data.totalIncome)}</span>
          </div>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; text-align: center;">
            <span style="display: block; font-size: 11px; color: #991b1b; font-weight: 600;">TOTAL SAÍDAS</span>
            <span style="display: block; font-size: 16px; color: #dc2626; font-weight: bold; margin-top: 4px;">${this.formatCurrency(data.totalExpense)}</span>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
            <span style="display: block; font-size: 11px; color: #475569; font-weight: 600;">RESULTADO DO MÊS</span>
            <span style="display: block; font-size: 16px; color: ${data.netPeriod >= 0 ? '#15803d' : '#dc2626'}; font-weight: bold; margin-top: 4px;">
              ${data.netPeriod >= 0 ? '+' : ''}${this.formatCurrency(data.netPeriod)}
            </span>
          </div>
          <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px; text-align: center;">
            <span style="display: block; font-size: 11px; color: #065f46; font-weight: 600;">SALDO EM CAIXA</span>
            <span style="display: block; font-size: 16px; color: #047857; font-weight: bold; margin-top: 4px;">${this.formatCurrency(data.cumulativeBalance)}</span>
          </div>
        </div>

        <!-- Seção de Custos Fixos -->
        <div style="margin-bottom: 25px;">
          <h2 style="font-size: 14px; color: #334155; margin: 0 0 10px 0; text-transform: uppercase; font-weight: bold; border-left: 4px solid #15803d; padding-left: 8px;">
            Acompanhamento de Custos Fixos do Mês
          </h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 1px solid #cbd5e1; text-align: left;">
                <th style="padding: 8px;">Status</th>
                <th style="padding: 8px;">Descrição do Custo</th>
                <th style="padding: 8px;">Categoria</th>
                <th style="padding: 8px; text-align: center;">Vencimento</th>
                <th style="padding: 8px; text-align: right;">Valor</th>
              </tr>
            </thead>
            <tbody>
    `;

    if (data.fixedDetails.length === 0) {
      html += `<tr><td colspan="5" style="padding: 10px; text-align: center; color: #94a3b8;">Nenhum custo fixo cadastrado.</td></tr>`;
    } else {
      data.fixedDetails.forEach(fc => {
        html += `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px;">
              <span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; ${fc.isConfirmed ? 'background: #dcfce7; color: #166534;' : 'background: #fef3c7; color: #92400e;'}">
                ${fc.isConfirmed ? 'PAGO / CONFIRMADO' : 'PENDENTE'}
              </span>
            </td>
            <td style="padding: 8px; font-weight: 500;">${fc.name}</td>
            <td style="padding: 8px; color: #64748b;">${fc.category}</td>
            <td style="padding: 8px; text-align: center; color: #64748b;">Dia ${fc.dueDay}</td>
            <td style="padding: 8px; text-align: right; font-weight: bold;">${this.formatCurrency(fc.amount)}</td>
          </tr>
        `;
      });
    }

    html += `
            </tbody>
          </table>
        </div>

        <!-- Seção de Movimentações Detalhadas -->
        <div>
          <h2 style="font-size: 14px; color: #334155; margin: 0 0 10px 0; text-transform: uppercase; font-weight: bold; border-left: 4px solid #15803d; padding-left: 8px;">
            Demonstrativo de Lançamentos (${data.transactions.length} registros)
          </h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 1px solid #cbd5e1; text-align: left;">
                <th style="padding: 6px 8px;">Data</th>
                <th style="padding: 6px 8px;">Descrição</th>
                <th style="padding: 6px 8px;">Categoria</th>
                <th style="padding: 6px 8px;">Forma</th>
                <th style="padding: 6px 8px; text-align: right;">Valor</th>
              </tr>
            </thead>
            <tbody>
    `;

    if (data.transactions.length === 0) {
      html += `<tr><td colspan="5" style="padding: 15px; text-align: center; color: #94a3b8;">Nenhuma movimentação registrada neste período.</td></tr>`;
    } else {
      // Ordenar por data crescente
      const sortedTx = [...data.transactions].sort((a, b) => a.date.localeCompare(b.date));
      sortedTx.forEach(t => {
        const isIncome = t.type === 'income';
        const [y, m, d] = t.date.split('-');
        html += `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 6px 8px; color: #64748b;">${d}/${m}/${y}</td>
            <td style="padding: 6px 8px; font-weight: 500;">
              ${t.description}
              ${t.isFixedCost ? ' <span style="font-size: 9px; color: #166534; background: #f0fdf4; padding: 1px 4px; border-radius: 3px;">(Fixo)</span>' : ''}
            </td>
            <td style="padding: 6px 8px; color: #64748b;">${t.category}</td>
            <td style="padding: 6px 8px; color: #64748b;">${t.paymentMethod || 'Pix'}</td>
            <td style="padding: 6px 8px; text-align: right; font-weight: bold; color: ${isIncome ? '#16a34a' : '#dc2626'};">
              ${isIncome ? '+' : '-'}${this.formatCurrency(t.amount)}
            </td>
          </tr>
        `;
      });
    }

    html += `
            </tbody>
          </table>
        </div>

        <!-- Rodapé do Relatório -->
        <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center;">
          Documento gerado eletronicamente para fins de prestação de contas do Núcleo Jardim Florido.
        </div>
      </div>
    `;

    printContainer.innerHTML = html;

    // Verificar se biblioteca html2pdf está disponível
    if (typeof html2pdf !== 'undefined') {
      const opt = {
        margin: 10,
        filename: `Fluxo_Caixa_NJF_${yearMonth || 'Geral'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      App.showToast('Gerando PDF...', 'info');
      html2pdf().set(opt).from(printContainer.firstElementChild).save().then(() => {
        App.showToast('Relatório PDF baixado com sucesso!', 'success');
      }).catch(err => {
        console.error('Erro html2pdf:', err);
        window.print();
      });
    } else {
      window.print();
    }
  }
};
