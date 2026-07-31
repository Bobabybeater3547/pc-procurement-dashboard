(() => {
  const BASE = window.PC_PROCUREMENT_DATA;
  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { storage.set(key, value); } catch {} },
    remove(key) { try { storage.remove(key); } catch {} }
  };
  const stored = storage.get('pc-procurement-import');
  let data = stored ? JSON.parse(stored) : structuredClone(BASE);
  let basket = new Set(JSON.parse(storage.get('pc-procurement-basket') || '[]'));
  let budget = Number(storage.get('pc-procurement-budget') || data.market.profile.defaultBudgetCNY || 15000);
  let fxOverride = Number(storage.get('pc-procurement-fx') || 0);

  const $ = (id) => document.getElementById(id);
  const products = () => data.catalog.products;
  const snapshots = () => data.snapshots.snapshots;
  const latestSnapshot = () => [...snapshots()].sort((a, b) => b.date.localeCompare(a.date))[0];
  const fx = () => fxOverride || latestSnapshot().fx.JPY_CNY;
  const quotes = () => latestSnapshot().quotes;
  const productById = (id) => products().find(p => p.id === id);

  function cny(value) { return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(value); }
  function localPrice(q) { return q.checkoutPrice + (q.shipping || 0); }
  function toCny(q) { return q.currency === 'JPY' ? localPrice(q) * fx() : localPrice(q); }
  function bestQuote(id) { return quotes().filter(q => q.productId === id).sort((a, b) => toCny(a) - toCny(b))[0] || null; }
  function daysOld(dateStr) { return Math.floor((new Date() - new Date(dateStr + 'T00:00:00')) / 86400000); }
  function quoteQuality(q) { return q.quality === 'verified' ? 'Verified direct/retailer quote' : 'Observed through aggregator'; }
  function channelAdvice(p, q) {
    if (p.tags.includes('buy-in-japan')) return 'Japan — warranty/logistics';
    if (p.tags.includes('china-value')) return 'China — verify official store';
    if (!q) return 'Await two-country quotes';
    return q.country + ' — current verified lead';
  }
  function showToast(text) {
    $('toast').textContent = text; $('toast').classList.add('show');
    setTimeout(() => $('toast').classList.remove('show'), 2200);
  }

  function populateCategories() {
    const categories = [...new Set(products().map(p => p.category))].sort();
    $('categorySelect').innerHTML = '<option value="all">All</option>' + categories.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  function filteredProducts() {
    const term = $('searchInput').value.trim().toLowerCase();
    const category = $('categorySelect').value;
    const status = $('statusSelect').value;
    const sort = $('sortSelect').value;
    const rows = products().filter(p => {
      const haystack = [p.model, p.brand, p.category, p.platform, ...(p.tags || [])].join(' ').toLowerCase();
      return (!term || haystack.includes(term)) && (category === 'all' || p.category === category) && (status === 'all' || p.status === status);
    });
    rows.sort((a, b) => {
      if (sort === 'price-asc') return (bestQuote(a.id) ? toCny(bestQuote(a.id)) : Infinity) - (bestQuote(b.id) ? toCny(bestQuote(b.id)) : Infinity);
      if (sort === 'release-desc') return (b.releaseDate || '').localeCompare(a.releaseDate || '');
      if (sort === 'model-asc') return a.model.localeCompare(b.model);
      return b.fitScore - a.fitScore;
    });
    return rows;
  }

  function renderMetrics() {
    const snap = latestSnapshot();
    const newCount = products().filter(p => p.status === 'new').length;
    const ages = quotes().map(q => daysOld(q.verifiedAt));
    $('fxMetric').textContent = fx().toFixed(6);
    $('fxDate').textContent = `${snap.fx.source} · ${snap.date}`;
    $('productMetric').textContent = products().length;
    $('newProductMetric').textContent = `${newCount} marked new`;
    $('quoteMetric').textContent = quotes().length;
    $('freshMetric').textContent = ages.length ? `Newest ${Math.min(...ages)} days old` : 'No quotes';
  }

  function renderProducts() {
    const rows = filteredProducts();
    $('resultCount').textContent = `${rows.length} products`;
    $('productRows').innerHTML = rows.map(p => {
      const q = bestQuote(p.id);
      const scoreClass = p.fitScore >= 88 ? 'high' : 'medium';
      const price = q ? `${cny(toCny(q))}<div class="sub">${q.currency} ${localPrice(q).toLocaleString()} · ${q.verifiedAt}</div>` : '<span class="pill warn">No verified quote</span>';
      const evidence = q ? `<a href="${q.sourceUrl}" target="_blank" rel="noreferrer">${quoteQuality(q)}</a>` : (p.officialUrl ? `<a href="${p.officialUrl}" target="_blank" rel="noreferrer">Official specifications only</a>` : 'Specification target; SKU pending');
      const statusClass = p.status === 'new' ? 'good' : p.status === 'retired' ? 'bad' : '';
      return `<tr>
        <td><div class="model">${p.brand} ${p.model}</div><div class="sub">${p.specSummary}</div><div><span class="pill ${statusClass}">${p.status}</span>${p.tags.slice(0, 3).map(t => `<span class="pill">${t}</span>`).join('')}</div></td>
        <td><span class="score ${scoreClass}">${p.fitScore}/100</span><div class="sub">${p.fitReason}</div></td>
        <td>${price}</td>
        <td>${channelAdvice(p, q)}</td>
        <td>${evidence}</td>
        <td><button type="button" class="basket-toggle" data-id="${p.id}">${basket.has(p.id) ? 'Remove' : 'Add'}</button></td>
      </tr>`;
    }).join('') || '<tr><td colspan="6" class="empty">No products match the filters.</td></tr>';
    document.querySelectorAll('.basket-toggle').forEach(button => button.addEventListener('click', () => toggleBasket(button.dataset.id)));
  }

  function renderQuotes() {
    $('quoteGrid').innerHTML = [...quotes()].sort((a, b) => toCny(a) - toCny(b)).map(q => {
      const p = productById(q.productId);
      const age = daysOld(q.verifiedAt);
      const freshness = age <= 14 ? 'good' : age <= 45 ? 'warn' : 'bad';
      return `<div class="quote">
        <div class="list-title"><span>${p.model}</span><span class="pill ${freshness}">${age}d old</span></div>
        <div class="quote-price">${cny(toCny(q))}</div>
        <div>${q.country} · ${q.platform}</div>
        <div class="quote-meta">${q.currency} ${localPrice(q).toLocaleString()} · ${q.stock} · ${quoteQuality(q)}</div>
        <div class="quote-meta"><a href="${q.sourceUrl}" target="_blank" rel="noreferrer">Open source</a></div>
      </div>`;
    }).join('') || '<div class="empty">No verified quotes in this snapshot.</div>';
  }

  function renderEvents() {
    $('eventList').innerHTML = [...data.events.events].sort((a,b) => b.date.localeCompare(a.date)).map(e => `<div class="list-item">
      <div class="list-title"><span>${e.title}</span><span class="pill ${e.type === 'market-risk' ? 'warn' : 'good'}">${e.type}</span></div>
      <div class="list-meta">${e.date}</div><div class="list-detail">${e.detail}</div>
      <div class="list-detail"><a href="${e.sourceUrl}" target="_blank" rel="noreferrer">Source</a></div>
    </div>`).join('');
  }

  function renderRules() {
    $('ruleList').innerHTML = data.market.rules.map(r => `<div class="list-item"><div class="list-title">${r.title}</div><div class="list-detail">${r.detail}</div></div>`).join('');
  }

  function renderDataStatus() {
    const snap = latestSnapshot();
    const countryCoverage = [...new Set(quotes().map(q => q.country))];
    const quotedProducts = new Set(quotes().map(q => q.productId)).size;
    $('dataStatus').innerHTML = `
      <div class="list-item"><div class="list-title"><span>Latest snapshot</span><span>${snap.date}</span></div><div class="list-detail">FX and retailer evidence are versioned together.</div></div>
      <div class="list-item"><div class="list-title"><span>Country coverage</span><span>${countryCoverage.join(', ') || 'None'}</span></div><div class="list-detail">China price extraction remains incomplete in the seed snapshot.</div></div>
      <div class="list-item"><div class="list-title"><span>Products with quotes</span><span>${quotedProducts}/${products().length}</span></div><div class="list-detail">Unquoted products are candidates, not price recommendations.</div></div>`;
  }

  function toggleBasket(id) {
    basket.has(id) ? basket.delete(id) : basket.add(id);
    storage.set('pc-procurement-basket', JSON.stringify([...basket]));
    renderProducts(); renderBasket();
  }

  function renderBasket() {
    $('budgetRange').value = budget; $('budgetValue').textContent = cny(budget); $('fxOverride').value = fx();
    const chosen = [...basket].map(productById).filter(Boolean);
    const known = chosen.map(p => ({p, q: bestQuote(p.id)})).filter(x => x.q);
    const total = known.reduce((sum, x) => sum + toCny(x.q), 0);
    const missing = chosen.length - known.length;
    const ratio = Math.min(100, (total / budget) * 100);
    $('budgetProgress').style.width = `${ratio}%`;
    $('basketSummary').textContent = chosen.length ? `${cny(total)} verified subtotal · ${missing} item(s) missing price` : 'No components selected.';
    $('basketList').innerHTML = chosen.map(p => {
      const q = bestQuote(p.id);
      return `<div class="list-item"><div class="list-title"><span>${p.category}: ${p.model}</span><span>${q ? cny(toCny(q)) : 'Unpriced'}</span></div><div class="list-detail">${q ? q.country + ' · ' + q.platform : 'Needs verified Japan and China quotes'}</div></div>`;
    }).join('') || '<div class="empty">Add candidates from the table.</div>';

    if (missing) {
      $('decisionTitle').textContent = 'Incomplete basket';
      $('decisionText').textContent = 'Do not treat the subtotal as a build total. Missing price evidence must be resolved first.';
    } else if (chosen.length && total > budget) {
      $('decisionTitle').textContent = 'Over budget';
      $('decisionText').textContent = 'Rebalance CPU/GPU tiers or wait for a verified purchase window.';
    } else if (chosen.length >= 6) {
      $('decisionTitle').textContent = 'Scenario is price-complete';
      $('decisionText').textContent = 'Compare landed cost and warranty risk before choosing purchase country.';
    } else {
      $('decisionTitle').textContent = 'Decision posture';
      $('decisionText').textContent = 'Build the candidate architecture now; lock exact SKUs closer to March 2027.';
    }
  }

  function renderAll() {
    renderMetrics(); renderProducts(); renderQuotes(); renderEvents(); renderRules(); renderDataStatus(); renderBasket();
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `pc-procurement-dashboard-${latestSnapshot().date}.json`; a.click(); URL.revokeObjectURL(url);
  }

  $('searchInput').addEventListener('input', renderProducts);
  $('categorySelect').addEventListener('change', renderProducts);
  $('statusSelect').addEventListener('change', renderProducts);
  $('sortSelect').addEventListener('change', renderProducts);
  $('budgetRange').addEventListener('input', e => { budget = Number(e.target.value); storage.set('pc-procurement-budget', budget); renderBasket(); });
  $('fxOverride').addEventListener('change', e => { fxOverride = Number(e.target.value); storage.set('pc-procurement-fx', fxOverride); renderAll(); });
  $('clearBasket').addEventListener('click', () => { basket.clear(); storage.remove('pc-procurement-basket'); renderProducts(); renderBasket(); });
  $('exportButton').addEventListener('click', exportData);
  $('themeButton').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next; storage.set('pc-procurement-theme', next);
  });
  $('importInput').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const incoming = JSON.parse(await file.text());
      if (!incoming.catalog || !incoming.snapshots || !incoming.events || !incoming.market) throw new Error('Invalid dashboard package');
      data = incoming; storage.set('pc-procurement-import', JSON.stringify(data));
      populateCategories(); renderAll(); showToast('Monthly data imported');
    } catch (error) { showToast(error.message); }
  });

  document.documentElement.dataset.theme = storage.get('pc-procurement-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  populateCategories(); renderAll();
})();
