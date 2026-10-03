// GEM CHEST: 100 gems. A crystal chest that always holds a cosmetic you do not own (now and then a second one) and a big pile of extras.
// The rarer the cosmetic, the smaller the pile, so you can never lose. Loaded AFTER game.js and lootbox.js.
(function () {
    'use strict';
    const PRICE = 100, SECOND_CHANCE = 0.12;
    const ODDS = [['legendary', 0.20], ['epic', 0.50], ['rare', 0.30]];
    const EXTRAS = {
        rare:      { coins: 2500, xp: 400, gems: 20, boosts: [{ kind: 'coin', mult: 2, n: 8 }, { kind: 'chest', mult: 2, n: 5 }], bonus: ['epic', 'rare'] },
        epic:      { coins: 1800, xp: 300, gems: 15, boosts: [{ kind: 'coin', mult: 2, n: 5 }, { kind: 'chest', mult: 2, n: 3 }], bonus: ['rare'] },
        legendary: { coins: 1200, xp: 250, gems: 10, boosts: [{ kind: 'coin', mult: 2, n: 3 }], bonus: [] },
    };
    const pool = (rar, p) => [...SKINS, ...HATS, ...FACES, ...TRAILS, ...(window.Finishers ? Finishers.FINISHERS : [])].filter(i => i.id !== 'f-none').filter(i => i.rarity === rar && i.price > 0 && !i.premium && !i.exclusive && !i.priceLock && !p.owned.includes(i.id));

    function roll() {
        const p = prog(); let x = Math.random(), rar = 'rare';
        for (const [r, w] of ODDS) { x -= w; if (x <= 0) { rar = r; break; } }
        const order = [rar, ...['legendary', 'epic', 'rare'].filter(r => r !== rar)];
        for (const r of order) { const list = pool(r, p); if (list.length) return { rar: r, item: list[Math.floor(Math.random() * list.length)] }; }
        return { rar, item: null };
    }

    function open() {
        if (gemCount() < PRICE) { toast('You need ' + PRICE + ' gems'); SFX.play('fall'); return; }
        store('rr_gems', gemCount() - PRICE);
        const { rar, item } = roll(), ex = EXTRAS[rar], p = prog();
        let coins = ex.coins, second = null;
        const isFin = !!(item && item.id[0] === 'f' && item.id[1] === '-');
        if (item) p.owned.push(item.id); else coins += { rare: 600, epic: 1500, legendary: 3500 }[rar];       // everything owned: coins instead
        if (item && Math.random() < SECOND_CHANCE) { const l = pool('rare', p).concat(pool('epic', p)).filter(i => i.id !== item.id && !(i.id[0] === 'f' && i.id[1] === '-')); if (l.length) { second = l[Math.floor(Math.random() * l.length)]; p.owned.push(second.id); } }
        p.xp += ex.xp; saveProg(p);
        addCoins(coins); addGems(ex.gems);
        ex.boosts.forEach(b => Boost.grant(b.kind, b.mult, b.n));
        const drop = { id: newLootId('gemcrate'), tier: rar, pending: false, coins, xp: ex.xp, passPoints: 0, gems: ex.gems, cosmetic: isFin ? null : item, finisher: isFin ? { id: item.id, name: item.name, rarity: item.rarity } : null, boosts: ex.boosts };
        refreshMenu();
        openLootbox(drop, { fixed: true, variant: 'gem', onDone: async () => {
            refreshMenu();
            if (second) await showRewardPops([{ type: 'item', item: second }], { tier: second.rarity });
            for (const t of ex.bonus) await new Promise(res => openLootbox(awardLootDrop(newLootId('gemcrate'), { coins: 200, xp: 80, passPoints: 0 }, { tier: t }), { onDone: res }));
            refreshMenu();
        } });
    }

    function render(box) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'gc-hero';
        const sub = 'A cosmetic you do not own, plus a pile of coins, boosts and bonus chests';
        b.innerHTML = '<span class="gc-chest">' + LB_GEMCHEST('s') + '</span><span class="gc-tx"><b>Gem chest</b><small>' + sub + '</small></span><span class="gc-price">' + icon('gem') + '<b>' + PRICE + '</b></span>';
        let armed = false, t = 0;
        b.onclick = () => {
            const small = b.querySelector('small');
            if (!armed) { armed = true; b.classList.add('arm'); small.textContent = 'Tap again to open'; t = setTimeout(() => { armed = false; b.classList.remove('arm'); small.textContent = sub; }, 2600); return; }
            clearTimeout(t); armed = false; b.classList.remove('arm'); open();
        };
        const grid = box.querySelector('.gem-grid'); box.insertBefore(b, grid || null);
    }
    window.GemCrate = { open, render, roll, EXTRAS };
})();
