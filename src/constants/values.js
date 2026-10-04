// Gameplay constants (loaded as a classic script before game.js)
const GRAVITY = 2400;
const MAX_DRAG = 150;
const POWER = 9.5;              // max launch speed ~1425
let FINISH_Y = 400;
const START_Y = 13000;
let TRACK = START_Y - FINISH_Y;
const BOOST_MULT = 1.45;
const MAX_UP_VEL = 2400;   // just above a fully-charged Boost jump (~2066) alone, so a normal
const ROLL_TIME = 1.1;
const BASE_R = 12, GIANT_TIME = 8, GIANT_SCALE = 3;
const BOUNCE_TIME = 5, BOUNCE_RESTITUTION = 1.45, BOUNCE_MAXV = 3200, BOUNCE_KICK = 1500, BOUNCE_MIN_VY = 1150;
const BALL_R = 10;
const CHAIN_TIME = 5.5, CHAIN_POW = 0.8, CHAIN_GRAV = 1.25, CHAIN_LINKS = 8, CHAIN_SEG = 7;
