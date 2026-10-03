// GEM CRATE: 100 gems, always a cosmetic you do not own. The rarer the item, the fewer extras come with it.
// Loaded AFTER game.js and lootbox.js.
(function () {
    'use strict';
    const PRICE = 100;
    const ODDS = [['legendary', 0.20], ['epic', 0.50], ['rare', 0.30]];
    // extras per rarity (rare gets the most, legendary gets almost none)
    const EXTRAS = {
        rare:      { coins: 800, xp: 120, boosts: [{ kind: 'coin', mult: 2, n: 5 }, { kind: 'chest', mult: 2, n: 3 }], bonus: 'epic' },
        epic:      { coins: 300, xp: 80,  boosts: [{ kind: 'coin', mult: 2, n: 3 }], bonus: null },
        legendary: { coins: 0,   xp: 60,  boosts: [], bonus: null },
    };
    const pool = (rar, p) => [...SKINS, ...HATS, ...FACES, ...TRAILS].filter(i => i.rarity === rar && i.price > 0 && !i.premium && !i.exclusive && !i.priceLock && !p.owned.includes(i.id));

    function roll() {
        const p = prog(); let x = Math.random(), rar = 'rare';
        for (const [r, w] of ODDS) { x -= w; if (x <= 0) { rar = r; break; } }
        const order = [rar, ...['legendary', 'epic', 'rare'].filter(r => r !== rar)];     // nothing left of that rarity: the next one up or down
        for (const r of order) { const list = pool(r, p); if (list.length) return { rar: r, item: list[Math.floor(Math.random() * list.length)] }; }
        return { rar, item: null };
    }

    function open() {
        if (gemCount() < PRICE) { toast('You need ' + PRICE + ' gems'); SFX.play('fall'); return; }
        store('rr_gems', gemCount() - PRICE);
        const { rar, item } = roll(), ex = EXTRAS[rar], p = prog();
        let coins = ex.coins;
        if (item) p.owned.push(item.id); else coins += { rare: 600, epic: 1500, legendary: 3500 }[rar];       // everything owned: coins instead
        p.xp += ex.xp; saveProg(p);
        if (coins) addCoins(coins);
        ex.boosts.forEach(b => Boost.grant(b.kind, b.mult, b.n));
        const drop = { id: newLootId('gemcrate'), tier: rar, pending: false, coins, xp: ex.xp, passPoints: 0, gems: 0, cosmetic: item, boosts: ex.boosts };
        refreshMenu();
        openLootbox(drop, { fixed: true, onDone: () => {
            refreshMenu();
            if (ex.bonus) { const bonus = awardLootDrop(newLootId('gemcrate'), { coins: 150, xp: 60, passPoints: 0 }, { tier: ex.bonus }); setTimeout(() => openLootbox(bonus, { onDone: () => refreshMenu() }), 250); }
        } });
    }

    function render(box) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'gc-row';
        b.innerHTML = '<span class="gc-art" style="--ic:#ffcf3f">' + icon('drop-legendary') + '</span><span class="gc-tx"><b>Gem crate</b><small>A cosmetic you do not own. Rarer items come with fewer extras.</small></span><span class="gc-price">' + icon('gem') + '<b>' + PRICE + '</b></span>';
        let armed = false, t = 0;
        b.onclick = () => {
            if (!armed) { armed = true; b.classList.add('arm'); b.querySelector('small').textContent = 'Tap again to open'; t = setTimeout(() => { armed = false; b.classList.remove('arm'); b.querySelector('small').textContent = 'A cosmetic you do not own. Rarer items come with fewer extras.'; }, 2600); return; }
            clearTimeout(t); armed = false; b.classList.remove('arm'); open();
        };
        const grid = box.querySelector('.gem-grid'); box.insertBefore(b, grid || null);
    }
    window.GemCrate = { open, render, roll, EXTRAS };
})();
