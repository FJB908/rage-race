// Season pass UI: a tiered progression track. Loaded BEFORE game.js (defines functions only; uses game globals at call time).
(function () {
    const N = PASS_TIERS.length;
    const rar = id => (typeof RARITY !== 'undefined' && RARITY[id]) || { label:'', color:'#9aa3b5' };
    const sfx = n => { try { SFX.play(n); } catch (e) {} };
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const itemOf = t => COS_BY[t.cat].find(i => i.id === t.id);

    function state(p) {
        const pts = p.passPointsEarned || 0;
        const done = Math.min(N, Math.floor(pts / PASS_TIER_PTS));              // tiers fully earned
        const claimable = [];
        for (let i = 0; i < done; i++) if (!p.passClaimed.includes(i)) claimable.push(i);
        return { pts, done, claimable, into: done >= N ? PASS_TIER_PTS : pts % PASS_TIER_PTS };
    }

    // ---------- home card ----------
    window.renderPassHome = function (p) {
        const st = state(p), el = document.getElementById('m-pass-progress');
        if (!el) return;
        el.textContent = st.done >= N ? 'Complete' : 'Tier ' + st.done + ' / ' + N;
        document.getElementById('m-pass-meter-fill').style.width = (st.done >= N ? 100 : st.into) + '%';
        const art = document.querySelector('.m-pass-art');
        setBadge(document.getElementById('btn-pass-open'), st.claimable.length);
        if (art) { art.textContent = String(st.done).padStart(2, '0'); art.classList.toggle('has-claim', st.claimable.length > 0); }
    };

    // ---------- reward art ----------
    function art(t, tierIdx) {
        if (t.t === 'coins') return '<div class="pz-art coin">' + icon('coin') + '</div>';
        if (t.t === 'drop') return '<div class="pz-art chest" style="--c:#35e0c8;--c2:#127b6c">' + LB_CHEST_SVG + '</div>';
        return '<div class="pz-art item"><canvas width="140" height="140" data-tier="' + tierIdx + '"></canvas></div>';
    }
    function label(t) {
        if (t.t === 'coins') return R('coin', t.n);
        if (t.t === 'drop') return '<span class="pz-lbl">SUPPLY DROP</span>';
        return '<span class="pz-lbl">' + itemOf(t).name.toUpperCase() + '</span>';
    }
    function paintItem(cv, t) {
        const look = Object.assign({}, myLook(), { [t.cat]:t.id });
        try { renderLook(cv, look, { scale:.3, cy:.58 }); } catch (e) {}
    }

    // ---------- track ----------
    window.renderPassScreen = function () {
        const p = prog(), st = state(p);
        document.getElementById('pz-pts').innerHTML = R('pass', st.pts);
        document.getElementById('pz-lvl').textContent = st.done;
        document.getElementById('pz-next-txt').textContent = st.done >= N ? 'SEASON COMPLETE' : 'TIER ' + (st.done + 1) + ' IN';
        document.getElementById('pz-prog-num').innerHTML = st.done >= N ? '' : R('pass', (PASS_TIER_PTS - st.into) + ' to go');
        document.getElementById('pz-bar-fill').style.width = (st.done >= N ? 100 : st.into) + '%';
        const all = document.getElementById('pz-claimall');
        all.hidden = !st.claimable.length;
        all.innerHTML = 'CLAIM ALL <b>' + st.claimable.length + '</b>';

        const track = document.getElementById('pz-track'), keepX = track.scrollLeft;
        track.innerHTML = '<div class="pz-line"><i id="pz-line-fill"></i></div>';
        PASS_TIERS.forEach((t, i) => {
            const claimed = p.passClaimed.includes(i), ready = !claimed && i < st.done, isNext = i === st.done;
            const cos = t.t === 'item' ? itemOf(t) : null;
            const col = cos ? rar(cos.rarity).color : t.t === 'drop' ? '#35e0c8' : '#ffcf3f';
            const cls = 'pz-col' + (claimed ? ' claimed' : ready ? ' ready' : i < st.done ? '' : ' locked') + (isNext ? ' next' : '') + (cos ? ' big' : '');
            const col_el = document.createElement('div');
            col_el.className = cls; col_el.dataset.i = i; col_el.style.setProperty('--rc', col);
            col_el.innerHTML =
                '<div class="pz-node">' + (claimed ? icon('check') : (i + 1)) + '</div>' +
                '<button class="pz-card" type="button"' + (ready ? '' : ' tabindex="-1"') + '>' +
                  (cos ? '<span class="pz-rar">' + rar(cos.rarity).label.toUpperCase() + '</span>' : '') +
                  art(t, i) + '<div class="pz-name">' + label(t) + '</div>' +
                  (ready ? '<span class="pz-claim">CLAIM</span>' : claimed ? '<span class="pz-state">CLAIMED</span>' : '<span class="pz-state lock">' + (i < st.done ? '' : icon('lock')) + '</span>') +
                '</button>';
            col_el.querySelector('.pz-card').addEventListener('click', () => { if (ready) claim([i]); });
            track.appendChild(col_el);
            const cv = col_el.querySelector('canvas'); if (cv) paintItem(cv, t);
        });
        // progress line: runs from the first node to the current position (columns are equal width)
        track.scrollLeft = keepX;
        requestAnimationFrame(layoutLine);
    };
    function layoutLine() {
        const track = document.getElementById('pz-track'), first = track.querySelector('.pz-col');
        if (!first) return;
        const p = prog(), st = state(p), w = first.offsetWidth;
        const nodeX = i => first.offsetLeft + (i + .5) * w;
        const line = track.querySelector('.pz-line'), fill = document.getElementById('pz-line-fill');
        const x0 = nodeX(0), x1 = nodeX(N - 1);
        const nd = first.querySelector('.pz-node').getBoundingClientRect(), tr = track.getBoundingClientRect();
        line.style.top = (nd.top - tr.top + nd.height / 2) + 'px';
        line.style.left = x0 + 'px'; line.style.width = (x1 - x0) + 'px';
        // position of current progress on the line: tier k reached when pts = k*PTS, node k-1 sits there
        const prog01 = Math.min(N - 1, Math.max(0, (st.pts / PASS_TIER_PTS) - 1));
        fill.style.width = (prog01 * w) + 'px';
    }
    window.passScrollToNext = function () {
        const track = document.getElementById('pz-track'); if (!track) return;
        const target = track.querySelector('.pz-col.ready') || track.querySelector('.pz-col.next') || track.querySelector('.pz-col:last-child');
        if (target) track.scrollTo({ left: Math.max(0, target.offsetLeft - track.clientWidth / 2 + target.offsetWidth / 2), behavior:'auto' });
        layoutLine();
    };
    window.openPass = function () { renderPassScreen(); showScreen('pass'); setTimeout(passScrollToNext, 80); };

    // ---------- claiming ----------
    async function grant(i) {
        const t = PASS_TIERS[i], p = prog();
        if (p.passClaimed.includes(i)) return;
        p.passClaimed.push(i); saveProg(p);
        if (t.t === 'coins') {
            addCoins(t.n);
            await showRewardPops([{ type:'coin', n:t.n }]);
        } else if (t.t === 'drop') {
            const drop = awardLootDrop(newLootId('pass'), { coins:60, xp:50, passPoints:0 });
            await new Promise(res => openLootbox(drop, { title:'SEASON DROP', onDone:res }));
        } else {
            const cos = itemOf(t), q = prog(), dup = q.owned.includes(cos.id);
            if (dup) { const back = { common:100, rare:400, epic:1200, legendary:3000 }[cos.rarity] || 100; addCoins(back); await showRewardPops([{ type:'coin', n:back }], { tier:cos.rarity }); }
            else { q.owned.push(cos.id); saveProg(q); await showRewardPops([{ type:'item', item:cos }], { tier:cos.rarity }); }
        }
    }
    let busy = false;
    async function claim(list) {
        if (busy) return; busy = true;
        try { for (const i of list) { await grant(i); refreshMenu(); renderPassScreen(); } }
        finally { busy = false; }
    }
    window.claimAllPass = () => claim(state(prog()).claimable);
    window.addEventListener('resize', () => { if (document.getElementById('pz-track') && document.getElementById('s-pass').style.display !== 'none') layoutLine(); });
})();
