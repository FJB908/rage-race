// Bot username pool (loaded as a classic script before game.js)
const BOT_NAMES = [
    // English-style
    "Jake_92","liam.k","sophie_r","noah.b","emma99","Ryan_M","oliver_p","mia.t","ethan_c","ava.w",
    "lucas91","zoe_h","noahp22","kayla.b","dylan_v","mrx.tyler","chloe.m","brandon07","haley_j","jordan.k",
    "xX_Kyle_Xx","MadisonB","tyler.exe","BrookeXO","cody_1998","peyton.r","garrett07","laurenn_",
    // Spanish / Latin American
    "mateo_g","valentina.p","santi23","camila_r","alejandrooo","luciaaa","javi_m","paulinaG",
    "carlos.dev","nicolas99","danielarz","fer_lopez",
    // German
    "lukas_wr","JanaMuel","tobi.k","LenaSchmidt","MaxHoff","annika_b","finn_92","LauraW.",
    // French
    "hugo.marti","camillefr","theo_92","lea.duboisz","nathanb","juliette__",
    // Portuguese / Brazilian
    "gui_santos","biaoliveira","pedrohsc","larissaM","matheus22","juuh.costa",
    // Nordic
    "erik.lund","frejaam","oskar_99","sofie","magnus_k","emmi.laine",
    // Eastern European
    "kasia_w","dawid.nowak","irynaK","marek_92","zuzka.b","viktor.pl",
    // Asian-diaspora / mixed transliterations
    "minjun.k","yuki_t","weiwei99","hana_s","daniel.oh","aiko.m","kenji_r","seo.yeon",
    // Classic gamer-tag nonsense: leetspeak, xX...Xx, keyboard-mash, bragging, misspelled on purpose
    "xXProGamerXx","xX_Slayer_Xx","xXDarkNinjaXx","xX_Reaper_Xx","xXNoScopeXx","xX_ShadowWolf_Xx",
    "TTVxSpeedy","iiTzVortex","xXxDEMONxXx","BlazeRunner_07","pickle_enjoyer","GamerBoy2007","GamerGirl_xoxo",
    "n00b_sl4y3r","l33tHax0r","Pr0Sn1p3r","xXGodOfWarXx","YEETMASTER3000","YeetLord_99","bruhmoment123",
    "sk8rboi2004","xX_Kitty_Xx","EpicGamer_Moment","poggers_99","sadboi_xoxo","depresso_espresso",
    "jfjfjfj","kjhkjhas","asdfasdf22","qwertyuiop7","zxcvb_99","hjkhjk1","asdqwe123","ghfghfgh",
    "lofi_beats_kid","not_a_bot_123","definitely_human","ImNotARobot99","totally_legit_gamer",
    "your_mom_lol","urlocalgremlin","potato_enjoyer","chairforce1","BigChungus_Real","Skibidi_Rizzler",
    "Cr1ngeLord","MoistToast_","DoritosDust","MtnDewAddict","EnergyDrinkGoblin","4amInsomniac",
    "bored_at_3am","school_tomorrow_ugh","stillinmy_pjs","procrastinator99","exam_in_2hrs_lol",
    "toaster_bath","feralcatgirl","angryraccoon22","chaosgremlin_","unemployedwizard","brokecollegekid",
    "questionmark_?","period.period.","underscore__guy","xX_x_Xx","ayo_the_pizza_here","fortnite_dad55",
    "Grandma_Gamer","dad_of_3_kids","office_worker99","lunchbreak_grind","monday_hater_2024",
    "rngesus_hates_me","onemorematchbro","tilt_incoming","copium_supplier","hardstuck_bronze",
    "MLG_Doritos","QuickscopeQueen","noobmaster_og","the_real_noobmaster",
    "definitely_not_afk","afk_farming","ping_9999","lag_switch_lol","desync_deluxe",
    "z","xd","lol123","idk_anymore","whatusernamedoIpick","thiswasnttaken","username_taken_47",
    "guest_2847583","player_one_go","insertnamehere","temp_account_9","altaccount_02",
    "Pxx_Wolf","V1PER_","N1GHTMARE_x","Cursed_Waffle","SpicyMemeLord","DankMemeDealer99",
    "Blursed_Pigeon","Crustacean_King","Goblin_Mode_On","FeralHogRider","SwampThing_88",
    // more scraped-feeling chaos: random caps, numbers in weird spots, half-finished words
    "kK_Reece_Kk","T0aster_Strudel","x_mochi_x","Yeeted_Goose","gremlin.exe","404_user_not_found",
    "still_loading...","BuyMoreVBucks","RIPheadphones","cracked_screen_life","3am_thoughts",
    "SnackAttack247","cerealwithoutmilk","microwave_burrito","expired_yogurt","fridge_raider99",
    "wifi_password_wrong","router_reset_guy","404_wifi_not_found","ethernet_enjoyer",
    "hex_xX90Xx","_-_shadow_-_","-.-.-Vex-.-.-","~*~Luna~*~","xX~Frost~Xx","**Blaze**",
    "iiPandaii","iiFoxii_","iixMoonii","xXiiSkyiiXx","OwO_whats_this","UwU_gamer",
    "bepis_enjoyer","among_us_fan_2021","sus_crewmate","impostor_was_me","emergency_meeting_caller",
    "clout_chaser99","ratio_machine","L_taker","W_giver","touch_grass_never","basement_dweller_pro",
    "wireless_mouse_dying","keyboard_smash_kjfh","mouse2_broken","monitor_flicker_gang",
    "3_hours_of_sleep","finals_week_zombie","group_project_carrier","the_one_who_did_nothing",
    "vending_machine_stuck","printer_jam_rage","stapler_thief_99","office_chair_spinner",
    "left_on_read_again","typing_bubble_ghost","seen_2hrs_ago","last_online_never",
    "randomdude5827","player_x_47281","user9284718","guest8827364","anon_2847",
    "IIIIIIIlllIII","OOOO0OOOO","1l1l1l1l1","0O0O0O0O",
    "banana_for_scale","spoon_theory_99","fork_in_the_road","the_last_cookie_thief",
    "wrong_lobby_guy","accidentally_here","clicked_wrong_button","how_did_i_get_here",
    "pls_send_help","this_username_sucks","couldntThinkOfAName","xXNameTakenXx2",
    "the_username_gremlin","pls_no_bully","dont_report_me","report_button_broken",
    "carpal_tunnel_gang","rsi_survivor","numb_fingers_99","blister_thumb_pro",
    "static_shock_guy","cable_management_lol","rgb_doesnt_help_fps","overclocked_potato",
    "60fps_dreamer","1080p_peasant","4k_flex_account","vsync_off_chaos",
    "input_lag_excuse","connection_timeout_guy","host_migration_L","server_browser_ghost",
    "muted_mic_forever","push_to_talk_fail","discord_kicked_me","voice_chat_static",
    "the_fifth_wheel","carried_or_carrying","one_trick_pony_99","meta_slave_2024",
    "off_meta_hipster","patch_notes_reader","balance_pls_dev","nerf_this_pls",
];
