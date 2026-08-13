/* Prevodi SR/EN. Elementi sa data-i="kljuc" se popunjavaju automatski,
   data-i-html za one koji smeju da sadrže <b>. */
const I18N = {
  sr: {
    /* — opšte — */
    appName: 'ARENA', tagline: 'Igre gladi — uživo, na tvojoj mapi',
    continue: 'Nastavi', cancel: 'Otkaži', close: 'Zatvori', back: 'Nazad',
    yes: 'Da', no: 'Ne', ok: 'U redu', retry: 'Probaj ponovo', skip: 'Preskoči',
    loading: 'Učitavanje…', meters: 'm', seconds: 's', minutes: 'min',
    you: 'Ti', nobody: 'Niko', unknown: 'Nepoznato',

    /* — instalacija — */
    installTitle: 'Instaliraj ARENU', installBody: 'Igra radi mnogo bolje kao aplikacija: pun ekran, bez adresne trake, brže se otvara.',
    installNow: 'Instaliraj aplikaciju', continueBrowser: 'Nastavi u browseru',
    whichPhone: 'Koji telefon imaš?', android: 'Android', iphone: 'iPhone',
    androidSteps: 'Tapni dugme ispod. Ako se ne pojavi, otvori meni ⋮ u Chrome-u pa <b>Instaliraj aplikaciju</b>.',
    iphoneSteps: 'Mora <b>Safari</b>, Chrome na iPhone-u to ne ume.<br>1. Tapni <b>Podeli</b> na dnu ekrana<br>2. Skroluj i izaberi <b>Dodaj na početni ekran</b><br>3. Tapni <b>Dodaj</b>',
    installed: 'Instalirano', installUnavailable: 'Chrome još ne nudi instalaciju — probaj preko menija ⋮',

    /* — početni ekran — */
    yourName: 'Tvoje ime', createRoom: 'Napravi arenu', joinRoom: 'Uđi u arenu',
    roomCode: 'Kod sobe', enterCode: 'Upiši kod', codePh: 'KOD', or: 'ili',
    testMode: 'Test režim sa botovima', avatarTitle: 'Napravi lik',
    skin: 'Ten', hair: 'Kosa', hairColor: 'Boja kose', shirt: 'Majica', pants: 'Pantalone', body: 'Građa',
    randomize: 'Nasumično',

    /* — lobi — */
    lobby: 'Čekaonica', players: 'Igrači', tributes: 'Tributi', share: 'Podeli link', showQr: 'QR kod',
    scanQr: 'Skeniraj da uđeš', copied: 'Link kopiran',
    waitingHost: 'Domaćin podešava arenu…', youAreHost: 'Ti si domaćin',
    arena: 'Arena', yourMentor: 'tvoj mentor', arenaMap: 'Mapa arene', centerOnMe: 'Centriraj',
    tapToWalk: 'Tapni mapu da odeš tamo', testWalk: 'Test: hodanje tapom', testWalkStart: 'Test: odšetaj do startne tačke',
    arenaCenter: 'Centar arene', tapMapCenter: 'Tapni mapu da postaviš kornukopiju',
    useMyLocation: 'Moja lokacija', diameter: 'Prečnik arene', duration: 'Trajanje igre',
    itemDensity: 'Gustina predmeta', prepTime: 'Vreme za pripremu', startMode: 'Raspored igrača',
    modeCornucopia: 'Kornukopija', modeScattered: 'Rasuto',
    eventsOn: 'Događaji uključeni', botsOn: 'Botovi (test)', language: 'Jezik',
    recommended: 'preporučeno', tooFarFromRecommended: 'Daleko od preporučenog za ovaj broj igrača',
    startGame: 'Pokreni igre', needPlayers: 'Treba bar 3 igrača',
    needCenter: 'Postavi centar arene', needAllReady: 'Nisu svi spremni',
    statusLocation: 'Lokacija', statusCamera: 'Kamera', statusCompass: 'Kompas', statusPhoto: 'Slika',
    kickPlayer: 'Izbaci', leaveRoom: 'Izađi iz sobe',

    /* — priprema — */
    prepTitle: 'Priprema', step: 'Korak',
    permTitle: 'Dozvole', permBody: 'Igra ne radi bez lokacije i kamere. Kompas je potreban za slikanje protivnika.',
    grantLocation: 'Dozvoli lokaciju', grantCamera: 'Dozvoli kameru', grantCompass: 'Dozvoli kompas',
    grantNotifications: 'Dozvoli obaveštenja (opciono)', granted: 'Dozvoljeno', denied: 'Odbijeno',
    calibTitle: 'Kalibracija kompasa', calibBody: 'Okreni telefon u vazduhu u obliku osmice dok se traka ne napuni.',
    calibAccuracy: 'Tačnost', calibSkipWarn: 'Bez kompasa slikanje protivnika radi lošije.',
    gpsTitle: 'Provera GPS-a', gpsBody: 'Čekamo tačnost ispod 20 m.',
    gpsAccuracy: 'Tačnost GPS-a', gpsGoOutside: 'Izađi napolje — signal je preslab',
    faceTitle: 'Slika lica', faceBody: 'Poravnaj lice u ovalu. Slika se koristi na nebu kad neko pogine.',
    faceTake: 'Slikaj', faceRetake: 'Ponovo', faceNoFace: 'Ne vidim lice u kadru',
    readyTitle: 'Spreman si', readyBody: 'Čekamo ostale.', imReady: 'Spreman sam',
    safetyWarn: 'Gledaj u okolinu. Ne trči po ulici. Ne ulazi na privatan posed.',

    /* — PREP faza — */
    yourClass: 'Tvoja klasa', goToStart: 'Idi na svoju startnu tačku',
    arrivedBtn: 'Stigao sam', arrivedLocked: 'Priđi na 10 m', arrivedDone: 'Stigao si',
    prepCountdown: 'Do starta', allArrived: 'Svi su na mestu', startingIn: 'Počinje za',
    latePenalty: 'Kasnio si — kazna', arenaComposition: 'Sastav arene',

    /* — igra — */
    hp: 'Život', hunger: 'Glad', thirst: 'Žeđ', weapon: 'Oružje', arrows: 'Strele',
    inventory: 'Inventar', map: 'Mapa', camera: 'Kamera', feed: 'Objave', menu: 'Meni',
    emptySlot: 'Prazno', dropItem: 'Baci', useItem: 'Iskoristi', equipItem: 'Uzmi u ruku',
    swapTitle: 'Inventar je pun', swapBody: 'Tapni šta izbacuješ da bi uzeo novo.',
    pickingUp: 'Uzimaš…', pickupHold: 'Drži', pickupTap: 'Tapni da uzmeš',
    pickupMoved: 'Pomerio si se — prekinuto', pickupChallenge: 'Tapni u ritmu 5 puta',
    pickupShake: 'Protresi telefon 3 puta', itemNearby: 'Predmet u blizini',
    noPickupYet: 'Još ne može da se kupi', tooFarItem: 'Priđi bliže',
    zonePhase: 'Zona', zoneShrinking: 'Zona se skuplja', zoneWarn: 'Zona se skuplja za',
    outsideZone: 'VAN ZONE', zoneDamage: 'Gubiš život', toZone: 'U zonu',
    hungerLow: 'Gladan si', thirstLow: 'Žedan si', hungerEmpty: 'Umireš od gladi', thirstEmpty: 'Umireš od žeđi',
    setTrap: 'Postavi zamku', trapSet: 'Zamka postavljena', trapHit: 'Upao si u zamku',
    dayMode: 'Dnevni režim', nightMode: 'Noćni režim', pauseGame: 'Pauza', resumeGame: 'Nastavi',
    paused: 'PAUZIRANO', quitGame: 'Izlazim iz igre', quitConfirm: 'Sigurno? Umireš i ispadaš iz igre.',

    /* — slikanje / susret — */
    photoTitle: 'Uslikaj protivnika', photoHint: 'Uperi telefon u igrača i slikaj',
    photoShoot: 'Slikaj', photoNoPerson: 'Nema nikoga na slici',
    photoNoneInCone: 'Niko nije u tom pravcu', photoCooldown: 'Sačekaj',
    photoCandidates: 'Ko je ovo?', photoBest: 'Najverovatnije',
    actAlliance: 'Ponudi savez', actFight: 'Napadni', actBetray: 'Izdaj',
    allianceOffer: 'nudi ti savez', allianceAccepted: 'Savez sklopljen', allianceDeclined: 'Savez odbijen',
    allianceFull: 'Savez je pun', teamName: 'Tim',
    fightIncoming: 'te napada', fightAccept: 'Prihvati borbu', fightFlee: 'Beži',

    /* — borba — */
    fight: 'BORBA', round: 'Runda', distance: 'Razdaljina',
    moveApproach: 'Priđi', moveRetreat: 'Odmakni se', moveAttack: 'Napad', moveBlock: 'Blok',
    special: 'Specijal', usedSpecial: 'Specijal iskorišćen', fleeBtn: 'Pobegni',
    waitingOpponent: 'Čekamo protivnika…', outOfRange: 'Van dometa', missed: 'Promašaj',
    hpShort: 'HP', blockSub: '−60% štete',
    alreadyClosest: 'Već ste u klinču', alreadyFarthest: 'Dalje ne može',
    distHint: 'Razdaljina', distNow: 'Sad si na', fightHelp: 'Kako se bori',
    fightHelpBody: 'Svake runde biraš jedan potez i imaš 10 sekundi. Ako ne izabereš ništa, automatski braniš.\n\nRazdaljina ide od 0 (jedan drugom u lice) do 5 (svako na svom kraju). Tvoje oružje pogađa samo unutar svog dometa — narandžasti pojas na traci. Ako si van njega, prvo se primakni ili odmakni pa onda napadaj.\n\nPriđi te primiče za 1, Odmakni se te udaljava za 1, Blok skida 60% štete i kontrira izbliza.',
    blockedHit: 'Blokirano', counterHit: 'Kontra', youWon: 'POBEDIO SI', youLost: 'PORAŽEN SI',
    bothSurvive: 'Razišli ste se', droppedLoot: 'Sve njegove stvari su na zemlji',
    noArrows: 'Nemaš strela',

    /* — bekstvo — */
    chaseTitle: 'BEKSTVO', chaseGetAway: 'Izađi van 20 m', chaseHold: 'Drži razmak',
    chaseSeconds: 'Još', chaseEscaped: 'Pobegao si', chaseCaught: 'Uhvaćen si',
    chaseFreeHit: 'Dobio si besplatan udarac', chaseNoHeal: 'Dok bežiš ne možeš da se lečiš',
    chaseChasing: 'Juriš ga', chaseFleeing: 'Bežiš',

    /* — strelac na daljinu — */
    aimTitle: 'Nišani', aimHold: 'Ne pomeraj se', aimFire: 'Ispali',
    aimTooFar: 'Predaleko', aimBlocked: 'Ne može sad', aimMissed: 'Promašio si',
    incomingShot: 'Neko te gađa sa', incomingMove: 'MRDAJ!', shotHit: 'Pogodio te je strelac',

    /* — smrt, duhovi — */
    youDied: 'Poginuo si', diedFrom: 'Ubio te', diedZone: 'Zona', diedHunger: 'Glad',
    diedThirst: 'Žeđ', diedFire: 'Zid vatre', diedTrap: 'Zamka',
    cannon: 'Top', skyTitle: 'Nebo', skyBody: 'Poginuli od prošlog puta',
    ghostTitle: 'Tvorac igara', ghostBody: 'Mrtav si, ali igra se nastavlja. Kupi iskre i pravi haos.',
    sparks: 'Iskre', sparkPool: 'Zajednička kasa', buyEvent: 'Kupi događaj',
    voteNeeded: 'Treba većina glasova', gmCooldown: 'Sačekaj do sledećeg događaja',
    followPlayer: 'Prati igrača', watching: 'Gledaš', allPlayers: 'Svi igrači',

    /* — mentor — */
    mentorTitle: 'Mentor', mentorOf: 'Mentor igrača', favor: 'Naklonost publike',
    earnFavor: 'Zaradi naklonost', sendPackage: 'Pošalji paket', packageCost: 'Cena',
    packageSent: 'Paket poslat', packageCooldown: 'Sledeći paket za', spectator: 'Gledalac',
    cheer: 'Navijaj', cheered: 'Navijao si', gotPackage: 'Neko je dobio paket',
    yourPackage: 'Paket od tvog mentora',
    chReaction: 'Tapni čim pozeleni', chSimon: 'Zapamti niz', chTarget: 'Pogodi metu',
    chQuiz: 'Kviz', chRhythm: 'Tapkaj u ritmu',

    /* — kraj — */
    finalTwo: 'Ostala su dvojica', victory: 'POBEDNIK', gameOver: 'Kraj igara',
    timeline: 'Kako je ko poginuo', stats: 'Statistika',
    statSurvived: 'Preživeo', statWalked: 'Pređeno', statFights: 'Borbi',
    statDamage: 'Šteta', statItems: 'Predmeta', statKills: 'Eliminacija',
    awardWalker: 'Najviše pređenih metara', awardFighter: 'Najviše borbi',
    awardCoward: 'Kukavica', awardHungry: 'Najgladniji',
    awardDirtyWater: 'Najviše prljave vode', awardFirstDeath: 'Najbrže poginuo',
    playAgain: 'Igraj ponovo', backToStart: 'Nazad na početak',

    /* — mreža i greške — */
    connecting: 'Povezivanje…', connectionLost: 'Veza prekinuta — pokušavam ponovo',
    unconscious: 'Onesvešćen', unconsciousBody: 'Bio si bez veze 3 minuta',
    roomNotFound: 'Soba ne postoji', gameStarted: 'Igra je već počela',
    roomFull: 'Soba je puna', hostOnly: 'Samo domaćin', notReady: 'Nisi spreman',
    firebaseMissing: 'Firebase nije podešen',
    leaveWarning: 'Igra je u toku. Ako izađeš, umireš.',

    /* — povratak i sesija — */
    backAgainToExit: 'Pritisni nazad još jednom da izađeš',
    rejoinTitle: 'Vrati se u arenu?',
    rejoinBody: 'Već si u sobi',
    rejoinYes: 'Uđi ponovo', rejoinNo: 'Ne, izađi iz sobe',
    leaveConfirm: 'Izaći iz sobe?',
    cantGoBackInGame: 'Iz partije se izlazi kroz meni',

    /* — iskre i tvorci igara — */
    collectSpark: 'Pokupi iskru', sparkTaken: 'Iskra pokupljena',
    followBtn: 'Prati', unfollowBtn: 'Ne prati više', following: 'Pratiš',
    watchFight: 'Gledaj borbu', spectating: 'Gledaš borbu',
    hallucination: 'Ovo nije bilo stvarno',

    /* — mentor (§17) — */
    mentorWelcome: 'Ti si mentor', mentorTaken: 'Ovaj igrač već ima mentora',
    mentorLink: 'Link za mentora', copyMentorLink: 'Kopiraj mentorski link',
    yourTribute: 'Tvoj tribut', noFavorYet: 'Zaradi naklonost izazovima',
    startChallenge: 'Kreni', challengeDone: 'Zaradio si', challengeFail: 'Ništa ovaj put',
    packages: 'Paketi', packageNext: 'Sledeći paket košta',
    pkgWater: 'Voda', pkgFood: 'Hrana', pkgMedkit: 'Medkit',
    pkgBackpack: 'Ranac', pkgWeapon: 'Oružje',
    notEnoughFavor: 'Nemaš dovoljno naklonosti',
    packageLanded: 'Paket je pao 15 m od tebe',
    cheerCooldown: 'Možeš da navijaš na 10 minuta',
    tapWhenGreen: 'Tapni čim pozeleni', tooEarly: 'Prerano!',
    repeatSequence: 'Ponovi niz', hitTargets: 'Pogodi mete', tapRhythm: 'Tapkaj u ritmu',
    quizTitle: 'Kviz o Igrama gladi',
    detReady: 'Detektor spreman', detLoading: 'Detektor se učitava…',
    detOff: 'Bez detektora', detNoCompass: 'Nema kompasa', detRelative: '(nije pravi sever)',
    calibTurn: 'Okreni se polako u krug sa telefonom u ruci, dok se prsten ne popuni.',
    compassNoAcc: 'telefon ne javlja tačnost',
    compassNone: 'Telefon ne šalje podatke o smeru. Slikanje protivnika će raditi slabije.',
    testWithBots: 'Testiraj sa botovima', testStarting: 'Pravim test arenu…',
    testReady: 'Test arena je spremna', botsCount: 'Botova',

    /* — podešavanja — */
    appearance: 'Izgled', theme: 'Tema', soundVibe: 'Zvuk i vibracija',
    haptics: 'Vibracija', sound: 'Zvuk', checkPerms: 'Proveri dozvole',
    game: 'Partija', devOptions: 'Razvojne opcije', devOff: 'Isključi razvojne opcije',
    devOn: 'Razvojne opcije uključene', diagnostics: 'Dijagnostika senzora',
    about: 'O aplikaciji', version: 'Verzija',
    mapCredit: 'Mape: OpenStreetMap i CARTO',
    permsAllGood: 'Sve dozvole su u redu',

    /* — objave, ljudski — */
    fPrep: 'Priprema je počela — idi na svoju startnu tačku',
    fStart: 'GONG! Igre gladi su počele',
    fDeathBy: (a, b) => `${a} je pao od ruke ${b}`,
    fDeathZone: (a) => `${a} nije preživeo zonu`,
    fDeathHunger: (a) => `${a} je umro od gladi`,
    fDeathThirst: (a) => `${a} je umro od žeđi`,
    fDeathFire: (a) => `${a} je progutao zid vatre`,
    fDeathTrap: (a) => `${a} je upao u zamku`,
    fDeathShot: (a, b) => `${a} je pao od strele — ${b}`,
    fZone: (n, m) => `Zona se skuplja — faza ${n}, prečnik ${m} m`,
    fEvent: (n) => `${n} je počeo`,
    fFeast: 'Gozba je postavljena u kornukopiji',
    fLegend: 'Neko otvara legendarni sanduk',
    fBetray: (a, b) => `${a} je izdao ${b}`,
    fAlliance: 'Sklopio si savez',
    fPackage: 'Neko je dobio paket od sponzora',
    fFinalTwo: 'Ostala su dvojica — svi u centar arene',
    fWinner: (a) => `${a} je pobednik Igara gladi`,
    fShot: (a, b, hit) => `${a} je gađao ${b} — ${hit ? 'pogodak' : 'promašaj'}`,
    fAlarm: 'Alarm se oglasio',
  },

  en: {
    appName: 'ARENA', tagline: 'The Hunger Games — live, on your map',
    continue: 'Continue', cancel: 'Cancel', close: 'Close', back: 'Back',
    yes: 'Yes', no: 'No', ok: 'OK', retry: 'Try again', skip: 'Skip',
    loading: 'Loading…', meters: 'm', seconds: 's', minutes: 'min',
    you: 'You', nobody: 'Nobody', unknown: 'Unknown',

    installTitle: 'Install ARENA', installBody: 'The game works much better as an app: full screen, no address bar, faster to open.',
    installNow: 'Install the app', continueBrowser: 'Continue in the browser',
    whichPhone: 'Which phone do you have?', android: 'Android', iphone: 'iPhone',
    androidSteps: 'Tap the button below. If nothing appears, open the ⋮ menu in Chrome and pick <b>Install app</b>.',
    iphoneSteps: 'Must be <b>Safari</b> — Chrome on iPhone cannot do this.<br>1. Tap <b>Share</b> at the bottom<br>2. Scroll and choose <b>Add to Home Screen</b><br>3. Tap <b>Add</b>',
    installed: 'Installed', installUnavailable: 'Chrome is not offering it yet — try the ⋮ menu',

    yourName: 'Your name', createRoom: 'Create arena', joinRoom: 'Join arena',
    roomCode: 'Room code', enterCode: 'Enter code', codePh: 'CODE', or: 'or',
    testMode: 'Test mode with bots', avatarTitle: 'Build your tribute',
    skin: 'Skin', hair: 'Hair', hairColor: 'Hair colour', shirt: 'Shirt', pants: 'Trousers', body: 'Build',
    randomize: 'Randomise',

    lobby: 'Lobby', players: 'Players', tributes: 'Tributes', share: 'Share link', showQr: 'QR code',
    scanQr: 'Scan to join', copied: 'Link copied',
    waitingHost: 'The host is setting up the arena…', youAreHost: 'You are the host',
    arena: 'Arena', yourMentor: 'your mentor', arenaMap: 'Arena map', centerOnMe: 'Centre',
    tapToWalk: 'Tap the map to walk there', testWalk: 'Test: tap to walk', testWalkStart: 'Test: walk to the start point',
    arenaCenter: 'Arena centre', tapMapCenter: 'Tap the map to place the cornucopia',
    useMyLocation: 'My location', diameter: 'Arena diameter', duration: 'Game length',
    itemDensity: 'Item density', prepTime: 'Preparation time', startMode: 'Starting layout',
    modeCornucopia: 'Cornucopia', modeScattered: 'Scattered',
    eventsOn: 'Events enabled', botsOn: 'Bots (test)', language: 'Language',
    recommended: 'recommended', tooFarFromRecommended: 'Far from the recommendation for this player count',
    startGame: 'Start the games', needPlayers: 'Need at least 3 players',
    needCenter: 'Set the arena centre', needAllReady: 'Not everyone is ready',
    statusLocation: 'Location', statusCamera: 'Camera', statusCompass: 'Compass', statusPhoto: 'Photo',
    kickPlayer: 'Kick', leaveRoom: 'Leave room',

    prepTitle: 'Preparation', step: 'Step',
    permTitle: 'Permissions', permBody: 'The game needs location and camera. The compass is used to photograph opponents.',
    grantLocation: 'Allow location', grantCamera: 'Allow camera', grantCompass: 'Allow compass',
    grantNotifications: 'Allow notifications (optional)', granted: 'Granted', denied: 'Denied',
    calibTitle: 'Compass calibration', calibBody: 'Move the phone through the air in a figure of eight until the bar fills.',
    calibAccuracy: 'Accuracy', calibSkipWarn: 'Without a compass, photographing opponents works poorly.',
    gpsTitle: 'GPS check', gpsBody: 'Waiting for accuracy below 20 m.',
    gpsAccuracy: 'GPS accuracy', gpsGoOutside: 'Go outside — the signal is too weak',
    faceTitle: 'Face photo', faceBody: 'Line your face up in the oval. It is shown in the sky when someone dies.',
    faceTake: 'Take photo', faceRetake: 'Retake', faceNoFace: 'I cannot see a face',
    readyTitle: 'You are ready', readyBody: 'Waiting for the others.', imReady: 'I am ready',
    safetyWarn: 'Watch your surroundings. Do not run into traffic. Do not enter private property.',

    yourClass: 'Your class', goToStart: 'Go to your starting point',
    arrivedBtn: 'I have arrived', arrivedLocked: 'Get within 10 m', arrivedDone: 'You have arrived',
    prepCountdown: 'Until start', allArrived: 'Everyone is in place', startingIn: 'Starting in',
    latePenalty: 'You were late — penalty', arenaComposition: 'Arena composition',

    hp: 'Health', hunger: 'Hunger', thirst: 'Thirst', weapon: 'Weapon', arrows: 'Arrows',
    inventory: 'Inventory', map: 'Map', camera: 'Camera', feed: 'Broadcasts', menu: 'Menu',
    emptySlot: 'Empty', dropItem: 'Drop', useItem: 'Use', equipItem: 'Equip',
    swapTitle: 'Inventory is full', swapBody: 'Tap what you are throwing away.',
    pickingUp: 'Picking up…', pickupHold: 'Hold', pickupTap: 'Tap to take',
    pickupMoved: 'You moved — cancelled', pickupChallenge: 'Tap 5 times in rhythm',
    pickupShake: 'Shake the phone 3 times', itemNearby: 'Item nearby',
    noPickupYet: 'Cannot pick up yet', tooFarItem: 'Get closer',
    zonePhase: 'Zone', zoneShrinking: 'The zone is shrinking', zoneWarn: 'Zone shrinks in',
    outsideZone: 'OUTSIDE THE ZONE', zoneDamage: 'Losing health', toZone: 'To the zone',
    hungerLow: 'You are hungry', thirstLow: 'You are thirsty', hungerEmpty: 'Starving', thirstEmpty: 'Dying of thirst',
    setTrap: 'Set trap', trapSet: 'Trap set', trapHit: 'You hit a trap',
    dayMode: 'Day mode', nightMode: 'Night mode', pauseGame: 'Pause', resumeGame: 'Resume',
    paused: 'PAUSED', quitGame: 'Leave the game', quitConfirm: 'Sure? You die and drop out.',

    photoTitle: 'Photograph an opponent', photoHint: 'Point the phone at a player and shoot',
    photoShoot: 'Shoot', photoNoPerson: 'Nobody in the photo',
    photoNoneInCone: 'Nobody in that direction', photoCooldown: 'Wait',
    photoCandidates: 'Who is this?', photoBest: 'Most likely',
    actAlliance: 'Offer alliance', actFight: 'Attack', actBetray: 'Betray',
    allianceOffer: 'offers you an alliance', allianceAccepted: 'Alliance formed', allianceDeclined: 'Alliance declined',
    allianceFull: 'The alliance is full', teamName: 'Team',
    fightIncoming: 'is attacking you', fightAccept: 'Accept the fight', fightFlee: 'Run',

    fight: 'FIGHT', round: 'Round', distance: 'Distance',
    moveApproach: 'Approach', moveRetreat: 'Back off', moveAttack: 'Attack', moveBlock: 'Block',
    special: 'Special', usedSpecial: 'Special used', fleeBtn: 'Run',
    waitingOpponent: 'Waiting for opponent…', outOfRange: 'Out of range', missed: 'Miss',
    hpShort: 'HP', blockSub: '−60% damage',
    alreadyClosest: 'Already face to face', alreadyFarthest: 'No further',
    distHint: 'Distance', distNow: 'You are at', fightHelp: 'How fighting works',
    fightHelpBody: 'Each round you pick one move and you have 10 seconds. Pick nothing and you block automatically.\n\nDistance runs from 0 (face to face) to 5 (each at your own end). Your weapon only lands inside its own range — the orange band on the track. If you are outside it, step in or back off first, then attack.\n\nApproach moves you 1 closer, Back off moves you 1 away, Block cuts 60% of the damage and counters up close.',
    blockedHit: 'Blocked', counterHit: 'Counter', youWon: 'YOU WON', youLost: 'YOU FELL',
    bothSurvive: 'You broke apart', droppedLoot: 'All their things are on the ground',
    noArrows: 'No arrows left',

    chaseTitle: 'ESCAPE', chaseGetAway: 'Get beyond 20 m', chaseHold: 'Keep the distance',
    chaseSeconds: 'Still', chaseEscaped: 'You escaped', chaseCaught: 'You were caught',
    chaseFreeHit: 'You got a free hit', chaseNoHeal: 'You cannot heal while running',
    chaseChasing: 'Chasing', chaseFleeing: 'Running',

    aimTitle: 'Aim', aimHold: 'Do not move', aimFire: 'Fire',
    aimTooFar: 'Too far', aimBlocked: 'Not possible now', aimMissed: 'You missed',
    incomingShot: 'Someone is shooting at you from the', incomingMove: 'MOVE!', shotHit: 'An archer hit you',

    youDied: 'You died', diedFrom: 'Killed by', diedZone: 'The zone', diedHunger: 'Hunger',
    diedThirst: 'Thirst', diedFire: 'The wall of fire', diedTrap: 'A trap',
    cannon: 'Cannon', skyTitle: 'The Sky', skyBody: 'The fallen since last time',
    ghostTitle: 'Gamemaker', ghostBody: 'You are dead, but the game goes on. Collect sparks and cause chaos.',
    sparks: 'Sparks', sparkPool: 'Shared pool', buyEvent: 'Buy event',
    voteNeeded: 'A majority vote is needed', gmCooldown: 'Wait until the next event',
    followPlayer: 'Follow a player', watching: 'Watching', allPlayers: 'All players',

    mentorTitle: 'Mentor', mentorOf: 'Mentor of', favor: 'Audience favour',
    earnFavor: 'Earn favour', sendPackage: 'Send a package', packageCost: 'Cost',
    packageSent: 'Package sent', packageCooldown: 'Next package in', spectator: 'Spectator',
    cheer: 'Cheer', cheered: 'You cheered', gotPackage: 'Someone received a package',
    yourPackage: 'A package from your mentor',
    chReaction: 'Tap the moment it turns green', chSimon: 'Memorise the sequence', chTarget: 'Hit the target',
    chQuiz: 'Quiz', chRhythm: 'Tap in rhythm',

    finalTwo: 'Two remain', victory: 'VICTOR', gameOver: 'The games are over',
    timeline: 'How each of them fell', stats: 'Statistics',
    statSurvived: 'Survived', statWalked: 'Walked', statFights: 'Fights',
    statDamage: 'Damage', statItems: 'Items', statKills: 'Kills',
    awardWalker: 'Most metres walked', awardFighter: 'Most fights',
    awardCoward: 'The coward', awardHungry: 'The hungriest',
    awardDirtyWater: 'Most dirty water drunk', awardFirstDeath: 'First to fall',
    playAgain: 'Play again', backToStart: 'Back to start',

    connecting: 'Connecting…', connectionLost: 'Connection lost — retrying',
    unconscious: 'Unconscious', unconsciousBody: 'You were offline for 3 minutes',
    roomNotFound: 'Room not found', gameStarted: 'The game has already started',
    roomFull: 'The room is full', hostOnly: 'Host only', notReady: 'You are not ready',
    firebaseMissing: 'Firebase is not configured',
    leaveWarning: 'A game is running. If you leave, you die.',

    backAgainToExit: 'Press back again to exit',
    rejoinTitle: 'Return to the arena?',
    rejoinBody: 'You are already in room',
    rejoinYes: 'Rejoin', rejoinNo: 'No, leave the room',
    leaveConfirm: 'Leave the room?',
    cantGoBackInGame: 'Leave a running game from the menu',

    collectSpark: 'Collect spark', sparkTaken: 'Spark collected',
    followBtn: 'Follow', unfollowBtn: 'Stop following', following: 'Following',
    watchFight: 'Watch the fight', spectating: 'Watching a fight',
    hallucination: 'That was never there',

    mentorWelcome: 'You are the mentor', mentorTaken: 'This player already has a mentor',
    mentorLink: 'Mentor link', copyMentorLink: 'Copy mentor link',
    yourTribute: 'Your tribute', noFavorYet: 'Earn favour through challenges',
    startChallenge: 'Start', challengeDone: 'You earned', challengeFail: 'Nothing this time',
    packages: 'Packages', packageNext: 'Next package costs',
    pkgWater: 'Water', pkgFood: 'Food', pkgMedkit: 'Med kit',
    pkgBackpack: 'Backpack', pkgWeapon: 'Weapon',
    notEnoughFavor: 'Not enough favour',
    packageLanded: 'A package landed 15 m from you',
    cheerCooldown: 'You can cheer once every 10 minutes',
    tapWhenGreen: 'Tap the moment it turns green', tooEarly: 'Too early!',
    repeatSequence: 'Repeat the sequence', hitTargets: 'Hit the targets', tapRhythm: 'Tap in rhythm',
    quizTitle: 'Hunger Games quiz',
    detReady: 'Detector ready', detLoading: 'Loading detector…',
    detOff: 'No detector', detNoCompass: 'No compass', detRelative: '(not true north)',
    calibTurn: 'Turn slowly in a full circle holding the phone, until the ring fills.',
    compassNoAcc: 'phone does not report accuracy',
    compassNone: 'The phone sends no heading data. Photographing opponents will work poorly.',
    testWithBots: 'Test with bots', testStarting: 'Building a test arena…',
    testReady: 'Test arena ready', botsCount: 'Bots',

    appearance: 'Appearance', theme: 'Theme', soundVibe: 'Sound & vibration',
    haptics: 'Vibration', sound: 'Sound', checkPerms: 'Check permissions',
    game: 'Game', devOptions: 'Developer options', devOff: 'Turn off developer options',
    devOn: 'Developer options enabled', diagnostics: 'Sensor diagnostics',
    about: 'About', version: 'Version',
    mapCredit: 'Maps: OpenStreetMap and CARTO',
    permsAllGood: 'All permissions are fine',

    fPrep: 'Preparation has begun — go to your starting point',
    fStart: 'GONG! The Hunger Games have begun',
    fDeathBy: (a, b) => `${a} fell to ${b}`,
    fDeathZone: (a) => `${a} did not survive the zone`,
    fDeathHunger: (a) => `${a} starved to death`,
    fDeathThirst: (a) => `${a} died of thirst`,
    fDeathFire: (a) => `${a} was caught by the wall of fire`,
    fDeathTrap: (a) => `${a} hit a trap`,
    fDeathShot: (a, b) => `${a} fell to an arrow — ${b}`,
    fZone: (n, m) => `The zone is closing — phase ${n}, diameter ${m} m`,
    fEvent: (n) => `${n} has begun`,
    fFeast: 'A feast has been laid at the cornucopia',
    fLegend: 'Someone is opening a legendary crate',
    fBetray: (a, b) => `${a} betrayed ${b}`,
    fAlliance: 'You formed an alliance',
    fPackage: 'Someone received a sponsor package',
    fFinalTwo: 'Two remain — everyone to the arena centre',
    fWinner: (a) => `${a} is the victor of the Hunger Games`,
    fShot: (a, b, hit) => `${a} shot at ${b} — ${hit ? 'hit' : 'miss'}`,
    fAlarm: 'An alarm went off',
  },
};

/* Imena klasa, oružja i predmeta — odvojeno, jer se koriste svuda. */
const NAMES = {
  cls: {
    archer:   ['Strelac', 'Archer'],   shadow:  ['Senka', 'Shadow'],
    strong:   ['Snagator', 'Strongman'], gatherer: ['Sakupljač', 'Gatherer'],
    medic:    ['Lekar', 'Medic'],      trapper: ['Zamkar', 'Trapper'],
    runner:   ['Trkač', 'Runner'],     hunter:  ['Lovac', 'Hunter'],
    fisher:   ['Ribar', 'Fisher'],
  },
  clsDesc: {
    archer:   ['Vidi igrače na 40 m i gađa na daljinu. Slab izbliza.', 'Sees players at 40 m and shoots at range. Weak up close.'],
    shadow:   ['Nevidljiv svima. Ali ni ti ne vidiš nikoga na mapi.', 'Invisible to everyone. But you see nobody on the map either.'],
    strong:   ['130 života, zona te upola manje boli. Svi te vide.', '130 health, half zone damage. Everyone sees you.'],
    gatherer: ['Sporije gladniš i žedniš, prljava voda ti ne škodi.', 'Hunger and thirst drop slower, dirty water is safe.'],
    medic:    ['Lečenje +50%, možeš da lečiš saveznika. Samo 80 života.', 'Healing +50%, can heal allies. Only 80 health.'],
    trapper:  ['Duplo zamki i jače su. Ne možeš da bežiš iz borbe.', 'Double traps and stronger. You cannot flee a fight.'],
    runner:   ['Bežiš brzo i bez kazne, +1 slot. 85 života.', 'You flee fast and unpunished, +1 slot. 85 health.'],
    hunter:   ['Najjači na srednjoj razdaljini. Slab u kontaktu.', 'Strongest at mid range. Weak in contact.'],
    fisher:   ['Trozubac tuče na svakoj razdaljini. 90 života.', 'The trident hurts at every range. 90 health.'],
  },
  weapon: {
    fists: ['Pesnice', 'Fists'], club: ['Toljaga', 'Club'], sling: ['Praćka', 'Sling'],
    net: ['Mreža', 'Net'], spear: ['Koplje', 'Spear'], axe: ['Sekira', 'Axe'],
    bow: ['Luk', 'Bow'], knife: ['Nož', 'Knife'], trident: ['Trozubac', 'Trident'],
    blowgun: ['Duvaljka', 'Blowgun'],
  },
  special: {
    stab: ['Ubod', 'Stab'], throw: ['Bačeni trozubac', 'Thrown trident'],
    smash: ['Razbijanje', 'Smash'], aimedShot: ['Precizan hitac', 'Aimed shot'],
    entangle: ['Uplitanje', 'Entangle'], breakthrough: ['Proboj', 'Breakthrough'],
    vanish: ['Nestanak', 'Vanish'], daze: ['Omamljivanje', 'Daze'], poison: ['Otrov', 'Poison'],
  },
  item: {
    berries: ['Bobice', 'Berries'], mushrooms: ['Pečurke', 'Mushrooms'], bread: ['Hleb', 'Bread'],
    driedMeat: ['Sušeno meso', 'Dried meat'], feastMeal: ['Gozba', 'Feast'],
    supplyBelt: ['Pojas sa zalihama', 'Supply belt'],
    dirtyWater: ['Prljava voda', 'Dirty water'], waterBottle: ['Flaša vode', 'Water bottle'],
    juice: ['Sok', 'Juice'], springWater: ['Izvorska voda', 'Spring water'], thermos: ['Termos', 'Thermos'],
    herbs: ['Lekovito bilje', 'Herbs'], bandage: ['Zavoj', 'Bandage'], antidote: ['Protivotrov', 'Antidote'],
    medkit: ['Medkit', 'Med kit'], salve: ['Sponzorska mast', 'Sponsor salve'],
    smallBag: ['Mala torba', 'Small bag'], backpack: ['Ranac', 'Backpack'], bigBackpack: ['Veliki ranac', 'Big backpack'],
    trapBasic: ['Zamka', 'Snare'], trapAlarm: ['Alarm', 'Alarm trap'], trapTracker: ['Traker', 'Tracker trap'],
    trapNet: ['Mreža-zamka', 'Net trap'],
    torch: ['Baklja', 'Torch'], bigTorch: ['Velika baklja', 'Big torch'], binoculars: ['Durbin', 'Binoculars'],
    smokeBomb: ['Dimna bomba', 'Smoke bomb'], ragePotion: ['Napitak besa', 'Rage potion'],
    camoCloak: ['Kamuflažni ogrtač', 'Camo cloak'], quiver: ['Tobolac', 'Quiver'], arrows: ['Strele', 'Arrows'],
    wClub: ['Toljaga', 'Club'], wSling: ['Praćka', 'Sling'], wNet: ['Mreža', 'Net'],
    wSpear: ['Koplje', 'Spear'], wAxe: ['Sekira', 'Axe'], wBlowgun: ['Duvaljka', 'Blowgun'],
    wBow: ['Luk', 'Bow'], wKnife: ['Nož', 'Knife'], wTrident: ['Trozubac', 'Trident'],
  },
  rarity: {
    common: ['Obično', 'Common'], uncommon: ['Neobično', 'Uncommon'], rare: ['Retko', 'Rare'],
    epic: ['Epsko', 'Epic'], legendary: ['Legendarno', 'Legendary'],
  },
  event: {
    firewall: ['Zid vatre', 'Wall of fire'], wasps: ['Traker ose', 'Tracker wasps'],
    feast: ['Gozba', 'Feast'], drought: ['Suša', 'Drought'], night: ['Noć', 'Night'],
    supplyBox: ['Sanduk sa zalihama', 'Supply crate'],
  },
};

let LANG = localStorage.getItem('arena.lang') || 'sr';
const LI = () => (LANG === 'en' ? 1 : 0);

function T(k, ...a) {
  const v = (I18N[LANG] && I18N[LANG][k]) ?? I18N.sr[k] ?? k;
  return typeof v === 'function' ? v(...a) : v;
}
const nameOf = (group, id) => {
  const g = NAMES[group];
  return (g && g[id] && g[id][LI()]) || id;
};
const clsName = (id) => nameOf('cls', id);
const clsDesc = (id) => nameOf('clsDesc', id);
const weaponName = (id) => nameOf('weapon', id);
const itemName = (id) => nameOf('item', id);
const rarityName = (id) => nameOf('rarity', id);
const eventName = (id) => nameOf('event', id);
const specialName = (id) => nameOf('special', id);

function applyLang(rootEl) {
  const scope = rootEl || document;
  scope.querySelectorAll('[data-i]').forEach((el) => { el.textContent = T(el.dataset.i); });
  scope.querySelectorAll('[data-i-html]').forEach((el) => { el.innerHTML = T(el.dataset.iHtml); });
  scope.querySelectorAll('[data-i-ph]').forEach((el) => { el.placeholder = T(el.dataset.iPh); });
  scope.querySelectorAll('[data-i-aria]').forEach((el) => { el.setAttribute('aria-label', T(el.dataset.iAria)); });
  document.documentElement.lang = LANG;
}
function setLang(l) {
  LANG = l === 'en' ? 'en' : 'sr';
  localStorage.setItem('arena.lang', LANG);
  applyLang();
  window.dispatchEvent(new CustomEvent('arena:lang'));
}
const toggleLang = () => setLang(LANG === 'sr' ? 'en' : 'sr');
