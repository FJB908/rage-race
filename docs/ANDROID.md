# RAGE RACE als Android-app (Capacitor)

De game blijft gewoon deze map (`index.html`, `game.js`, `src/`). Capacitor pakt hem in een Android-app (`android/`). Je past de game aan zoals altijd en synct daarna.

## Eenmalig op je computer
1. Installeer **Node.js** (LTS) en **Android Studio** (met een Android SDK).
2. In deze map: `npm install`

## Elke keer als je iets aanpast
```
npm run sync        # kopieert de game naar www/ en naar de Android-app
npm run open        # opent Android Studio
```
In Android Studio: **Run** (telefoon via USB of emulator) om te testen. Voor de Play Store: *Build > Generate Signed Bundle / APK > Android App Bundle (.aab)*.
Verhoog bij **elke** release `versionCode` (+1) en `versionName` in `android/app/build.gradle`.

Houd je **keystore** (de sleutel waarmee je tekent) veilig en maak een back-up: kwijt = nooit meer updaten. Zet hem niet in git (staat al in `.gitignore`).

## Wat er al klaar staat
- `capacitor.config.json`: app-id `com.fjb908.ragerace`, naam, thema. Wil je een ander app-id? Verander het VOOR je de eerste keer uploadt (daarna kan het niet meer), in `capacitor.config.json`, `android/app/build.gradle` en `android/app/src/main/res/values/strings.xml`.
- Iconen (teal kubus), ook het 512 px-icoon voor de store: `docs/play-store-icon-512.png`. Opnieuw maken: `node tools/gen-icons.js`.
- `src/native/native.js`: doet alleen iets in de app. Koppelt **AdMob** (echte advertenties), **Google Play Billing** (gems kopen) en de **Android terugknop**.

## Advertenties (AdMob)
1. Maak een account op admob.google.com, voeg de app toe, maak een *Rewarded* en een *Interstitial* advertentie-eenheid.
2. Zet je ids in `src/native/native.js` (`NATIVE_CFG.admob`) en je **app-id** in `android/app/src/main/AndroidManifest.xml` (nu Google's testid).
3. Zet `live: true` pas als je klaar bent om echt te gaan; tot dan zie je testadvertenties.
4. Vul in AdMob ook het toestemmingsscherm (GDPR/UMP) in; de app vraagt het al.

## Gems kopen (Google Play Billing)
1. Play Console > je app > *Monetize > In-app products*: maak **consumable** producten met precies deze ids: `g80`, `g500`, `g1100`, `g2400`, `g6500`, `g14000` (zie `src/data/gems.js`) en de prijzen die je wilt.
2. Je kunt pas testen als de app (ook als intern testspoor) in de Play Console staat en je jezelf als tester toevoegt (*Settings > License testing*).
3. Let op: de aankopen worden nu op de telefoon verwerkt. Voor serieus geld hoort een **server-controle** erbij (anders kan iemand valsspelen). In `native.js` staat een TODO.

## Nog op te lossen voor de store
- Privacybeleid (URL), *Data safety*-formulier, content rating, store-teksten en screenshots (minimaal 2).
- Een Play-ontwikkelaarsaccount ($25 eenmalig). Persoonlijke accounts moeten vaak eerst ~12 testers 14 dagen laten testen.
- **Kansen in kisten tonen** (Google eist dat bij loot boxes) en een manier om je account te verwijderen.
- **Inloggen met Google**: in een WebView werkt de pop-up van Firebase meestal niet. Voeg later de plugin `@capacitor-firebase/authentication` toe (native Google-login).
- `firestore.rules` opnieuw publiceren en de Cloud Functions online zetten (zie docs/SERVER.md).
