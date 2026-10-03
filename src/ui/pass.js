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
        const rageClaimable = []; for (let i = 0; i < done; i++) if (!(p.rageClaimed || []).includes(i)) rageClaimable.push(i);
        return { pts, done, claimable, rageClaimable, into: done >= N ? PASS_TIER_PTS : pts % PASS_TIER_PTS };
    }

    // ---------- home card ----------
    window.renderPassHome = function (p) {
        const st = state(p), el = document.getElementById('m-pass-progress');
        if (!el) return;
        el.textContent = st.done >= N ? 'Complete' : 'Tier ' + st.done + ' / ' + N;
        document.getElementById('m-pass-meter-fill').style.width = (st.done >= N ? 100 : st.into) + '%';
        const art = document.querySelector('.m-pass-art');
        const nClaim = st.claimable.length + (p.rage ? st.rageClaimable.length : 0);
        setBadge(document.getElementById('btn-pass-open'), nClaim);
        if (art) { art.textContent = String(st.done).padStart(2, '0'); art.classList.toggle('has-claim', nClaim > 0); art.classList.toggle('rage', !!p.rage); }
    };

    // ---------- reward art ----------
    const GRAD = c => 'linear-gradient(180deg,' + c[0] + ',' + c[1] + ' 55%,' + c[2] + ')';
    const isItem = t => t.t === 'item' || t.t === 'prem';
    const finOf = t => Finishers.BY[t.id];
    const emoOf = t => Emotes.BY[t.id];
    function art(t, key) {
        if (t.t === 'coins') return '<div class="pz-art coin">' + icon('coin') + '</div>';
        if (t.t === 'gem') return '<div class="pz-art gem">' + icon('gem') + '</div>';
        if (t.t === 'drop') { const c = { rare:['#5eb4ff', '#1f5bd0'], epic:['#b3a9ff', '#5b46d6'], legendary:['#ffcf3f', '#b8651a'] }[t.tier] || ['#35e0c8', '#127b6c']; return '<div class="pz-art chest" style="--c:' + c[0] + ';--c2:' + c[1] + '">' + (window.LB_CHEST ? LB_CHEST('pz' + key, t.tier || 'common') : LB_CHEST_SVG) + '</div>'; }
        if (t.t === 'boost') return '<div class="pz-art boost">' + Boost.art(t, true) + '</div>';
        if (t.t === 'emote') { const e = emoOf(t); return '<div class="pz-art emote"><span style="background-image:' + GRAD(e.col) + '">' + e.text + '</span></div>'; }
        if (t.t === 'finisher') { const f = finOf(t), c = rar({ rare:'rare' }[f.rarity] ? f.rarity : f.rarity).color; return '<div class="pz-art fin" style="--fc:' + c + '"><i></i><i></i><i></i><i></i><i></i><i></i><b></b></div>'; }
        return '<div class="pz-art item"><canvas width="140" height="140" data-key="' + key + '"></canvas></div>';
    }
    function nameOf(t) {
        if (t.t === 'coins') return R('coin', t.n);
        if (t.t === 'gem') return R('gem', t.n);
        if (t.t === 'drop') return '<span class="pz-lbl">' + (t.tier ? t.tier.toUpperCase() + ' DROP' : 'SUPPLY DROP') + '</span>';
        if (t.t === 'boost') { const k = Boost.KINDS[t.kind]; return '<span class="pz-lbl">x' + t.mult + (t.kind === 'coin' ? ' COINS' : ' CHESTS') + '</span><small class="bo-sub">' + t.n + ' ' + (t.n === 1 ? k.unit : k.plural) + '</small>'; }
        if (t.t === 'emote') return '<span class="pz-lbl">EMOTE</span>';
        if (t.t === 'finisher') return '<span class="pz-lbl">' + finOf(t).name.toUpperCase() + '</span>';
        return '<span class="pz-lbl">' + itemOf(t).name.toUpperCase() + '</span>';
    }
    function colorOf(t) {
        if (isItem(t)) return t.t === 'prem' ? '#ff8ae6' : rar(itemOf(t).rarity).color;
        if (t.t === 'finisher') return rar(finOf(t).rarity).color;
        if (t.t === 'emote') return emoOf(t).col[1];
        if (t.t === 'drop') return { rare:'#5eb4ff', epic:'#b3a9ff', legendary:'#ffcf3f' }[t.tier] || '#35e0c8';
        if (t.t === 'boost') return Boost.KINDS[t.kind].color;
        return t.t === 'gem' ? '#ff8ae6' : '#ffcf3f';
    }
    function tagOf(t) {
        if (isItem(t)) return t.t === 'prem' ? 'PREMIUM' : rar(itemOf(t).rarity).label.toUpperCase();
        if (t.t === 'finisher') return 'FINISHER';
        if (t.t === 'emote') return 'EMOTE';
        return '';
    }
    function paintItem(cv, t) {
        const look = Object.assign({}, myLook(), { [t.cat]:t.id });
        try { renderLook(cv, look, { scale:.3, cy:.58 }); } catch (e) {}
    }

    // ---------- Rage pass banner ----------
    function renderRage(p) {
        const el = document.getElementById('pz-rage'); if (!el) return;
        if (p.rage) { el.className = 'pz-rage on'; el.innerHTML = '<span class="pzr-fire">' + icon('flame') + '</span><b>RAGE PASS ACTIVE</b><small>' + p.rageClaimed.length + ' / ' + N + ' premium rewards claimed</small>'; el.onclick = null; return; }
        el.className = 'pz-rage';
        el.innerHTML = '<span class="pzr-fire">' + icon('flame') + '</span><span class="pzr-tx"><b>RAGE PASS</b><small>' + N + ' premium rewards: exclusive cosmetics, emotes, finishers, gems and legendary drops</small></span>' +
            '<span class="pzr-buy">' + icon('gem') + '<b>' + RAGE_PASS_GEMS.toLocaleString('en-US') + '</b></span>';
        let armed = false, tm = 0; const sub = el.querySelector('small');
        el.onclick = () => {
            if (!armed) { armed = true; el.classList.add('arm'); sub.textContent = 'Tap again to unlock'; tm = setTimeout(() => { armed = false; el.classList.remove('arm'); sub.textContent = N + ' premium rewards: exclusive cosmetics, emotes, finishers, gems and legendary drops'; }, 2600); return; }
            clearTimeout(tm); buyRage();
        };
    }
    function buyRage() {
        if (gemCount() < RAGE_PASS_GEMS) { toast('You need ' + RAGE_PASS_GEMS + ' gems'); sfx('fall'); renderPassScreen(); return; }
        store('rr_gems', gemCount() - RAGE_PASS_GEMS);
        const p = prog(); p.rage = true; saveProg(p);
        sfx('finish'); toast('Rage pass unlocked'); try { buzz([40, 30, 80]); } catch (e) {}
        refreshMenu(); renderPassScreen();
    }
    window.buyRagePass = buyRage;

    // ---------- track ----------
    function card(t, key, cls, extra, onClick) {
        const tag = tagOf(t), el = document.createElement('button');
        el.type = 'button'; el.className = 'pz-card ' + cls; el.style.setProperty('--rc', colorOf(t));
        el.innerHTML = (tag ? '<span class="pz-rar">' + tag + '</span>' : '') + art(t, key) + '<div class="pz-name">' + nameOf(t) + '</div>' + extra;
        el.addEventListener('click', onClick);
        const cv = el.querySelector('canvas'); if (cv) paintItem(cv, t);
        return el;
    }
    window.renderPassScreen = function () {
        const p = prog(), st = state(p);
        document.getElementById('pz-pts').innerHTML = R('pass', st.pts);
        document.getElementById('pz-lvl').textContent = st.done;
        document.getElementById('pz-next-txt').textContent = st.done >= N ? 'SEASON COMPLETE' : 'TIER ' + (st.done + 1) + ' IN';
        document.getElementById('pz-prog-num').innerHTML = st.done >= N ? '' : R('pass', (PASS_TIER_PTS - st.into) + ' to go');
        document.getElementById('pz-bar-fill').style.width = (st.done >= N ? 100 : st.into) + '%';
        renderRage(p);
        const all = document.getElementById('pz-claimall'), n = st.claimable.length + (p.rage ? st.rageClaimable.length : 0);
        all.hidden = !n; all.innerHTML = 'CLAIM ALL <b>' + n + '</b>';

        const track = document.getElementById('pz-track'), keepX = track.scrollLeft;
        track.innerHTML = '<div class="pz-line"><i id="pz-line-fill"></i></div>';
        PASS_TIERS.forEach((t, i) => {
            const claimed = p.passClaimed.includes(i), ready = !claimed && i < st.done, isNext = i === st.done;
            const rt = RAGE_TIERS[i], rClaimed = p.rageClaimed.includes(i), rReady = p.rage && !rClaimed && i < st.done;
            const col = document.createElement('div');
            col.className = 'pz-col' + (isNext ? ' next' : '') + (i < st.done ? ' reached' : '') + (claimed && (!p.rage || rClaimed) ? ' claimed' : '') + ((ready || rReady) ? ' ready' : '');
            col.dataset.i = i;
            const fState = ready ? '<span class="pz-claim">CLAIM</span>' : claimed ? '<span class="pz-state">CLAIMED</span>' : '<span class="pz-state lock">' + (i < st.done ? '' : icon('lock')) + '</span>';
            const rState = rReady ? '<span class="pz-claim">CLAIM</span>' : rClaimed ? '<span class="pz-state">CLAIMED</span>' : '<span class="pz-state lock">' + icon('lock') + '</span>';
            const top = card(t, 'f' + i, 'free' + (claimed ? ' claimed' : ready ? ' ready' : i < st.done ? '' : ' locked'), fState, () => { if (ready) claim([['f', i]]); });
            const node = document.createElement('div'); node.className = 'pz-node'; node.innerHTML = claimed && (!p.rage || rClaimed) ? icon('check') : String(i + 1);
            const bot = card(rt, 'r' + i, 'rage' + (p.rage ? '' : ' off') + (rClaimed ? ' claimed' : rReady ? ' ready' : ''), rState, () => {
                if (rReady) claim([['r', i]]); else if (!p.rage) { toast('Unlock the Rage pass first'); const b = document.getElementById('pz-rage'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }
            });
            col.append(top, node, bot); track.appendChild(col);
        });
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
        line.style.top = (nd.top - tr.top + track.scrollTop + nd.height / 2) + 'px';
        line.style.left = x0 + 'px'; line.style.width = (x1 - x0) + 'px';
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
    async function grantReward(t) {
        if (t.t === 'coins') { addCoins(t.n); await showRewardPops([{ type:'coin', n:t.n }]); }
        else if (t.t === 'gem') { addGems(t.n); await showRewardPops([{ type:'gem', n:t.n }]); }
        else if (t.t === 'boost') await showRewardPops([Boost.pop(t)]);
        else if (t.t === 'drop') {
            const drop = awardLootDrop(newLootId('pass'), { coins:60, xp:50, passPoints:0 }, t.tier ? { tier:t.tier } : undefined);
            await new Promise(res => openLootbox(drop, { title:t.tier ? 'RAGE DROP' : 'SEASON DROP', onDone:res }));
        } else if (t.t === 'emote') {
            const e = emoOf(t), q = prog();
            if (!q.emotes.includes(e.id)) { q.emotes.push(e.id); saveProg(q); }
            await showEmoteReward(e);
        } else if (t.t === 'finisher') {
            const f = finOf(t), q = prog();
            if (!q.owned.includes(f.id)) { q.owned.push(f.id); saveProg(q); }
            await showFinisherReward(f);
        } else {
            const cos = itemOf(t), q = prog(), dup = q.owned.includes(cos.id);
            if (dup) { const back = t.t === 'prem' ? 0 : ({ common:100, rare:400, epic:1200, legendary:3000 }[cos.rarity] || 100); if (back) { addCoins(back); await showRewardPops([{ type:'coin', n:back }], { tier:cos.rarity }); } else { addGems(100); await showRewardPops([{ type:'gem', n:100 }]); } }
            else { q.owned.push(cos.id); saveProg(q); await showRewardPops([{ type:'item', item:cos }], { tier:cos.rarity }); }
        }
    }
    // emotes and finishers have no cosmetic preview in the reward pop, so they get a small card of their own
    function showEmoteReward(e) {
        return new Promise(res => {
            const o = document.createElement('div'); o.className = 'pz-pop';
            o.innerHTML = '<div class="pz-pop-in"><small>NEW EMOTE</small><span class="pz-pop-emote" style="background-image:' + GRAD(e.col) + '">' + e.text + '</span><button type="button">COLLECT</button></div>';
            document.body.appendChild(o); sfx('finish');
            o.querySelector('button').onclick = () => { o.remove(); res(); };
        });
    }
    function showFinisherReward(f) {
        return new Promise(res => {
            const o = document.createElement('div'); o.className = 'pz-pop';
            o.innerHTML = '<div class="pz-pop-in" style="--fc:' + rar(f.rarity).color + '"><small>NEW FINISHER</small><div class="pz-art fin big"><i></i><i></i><i></i><i></i><i></i><i></i><b></b></div><h3>' + f.name.toUpperCase() + '</h3><button type="button">COLLECT</button></div>';
            document.body.appendChild(o); sfx('finish');
            o.querySelector('button').onclick = () => { o.remove(); res(); };
        });
    }
    async function grant(lane, i) {
        const p = prog(), key = lane === 'r' ? 'rageClaimed' : 'passClaimed';
        if (lane === 'r' && !p.rage) return;
        if (p[key].includes(i)) return;
        p[key].push(i); saveProg(p);
        await grantReward((lane === 'r' ? RAGE_TIERS : PASS_TIERS)[i]);
    }
    let busy = false;
    async function claim(list) {
        if (busy) return; busy = true;
        try { for (const [lane, i] of list) { await grant(lane, i); refreshMenu(); renderPassScreen(); } }
        finally { busy = false; }
    }
    window.claimAllPass = () => { const p = prog(), st = state(p); claim(st.claimable.map(i => ['f', i]).concat(p.rage ? st.rageClaimable.map(i => ['r', i]) : [])); };
    window.addEventListener('resize', () => { if (document.getElementById('pz-track') && document.getElementById('s-pass').style.display !== 'none') layoutLine(); });
})();
