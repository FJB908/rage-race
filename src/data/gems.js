// Gem packs for the shop. Prices are display text only: real billing is not connected yet.
// To connect it: set window.GEM_STORE = { buy(pack, grant) } before the shop opens; call grant(pack.gems) when the purchase succeeds.
const GEM_PACKS = [
    { id:'g80',    gems:80,    price:'€0.99',  icons:1 },
    { id:'g500',   gems:500,   price:'€4.99',  icons:2 },
    { id:'g1100',  gems:1100,  price:'€9.99',  icons:3 },
    { id:'g2400',  gems:2400,  price:'€19.99', icons:4 },
    { id:'g6500',  gems:6500,  price:'€49.99', icons:5 },
    { id:'g14000', gems:14000, price:'€99.99', icons:6 },
];
