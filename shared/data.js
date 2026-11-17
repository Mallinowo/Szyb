// Szyb – baza kategorii. Każda kategoria ma 6 pokładów (od najpopularniejszych do najrzadszych).
// Warianty tej samej odpowiedzi oddzielamy znakiem "|" (pierwszy jest nazwą wyświetlaną).
(function (root) {
  const TIERS = [
    { id: 0, name: 'Piasek',   pts: 10,  color: '#c9b37e', emoji: '🟫' },
    { id: 1, name: 'Węgiel',   pts: 15,  color: '#6b6f78', emoji: '⬛' },
    { id: 2, name: 'Miedź',    pts: 30,  color: '#d07a45', emoji: '🟧' },
    { id: 3, name: 'Srebro',   pts: 60,  color: '#c8d3df', emoji: '⬜' },
    { id: 4, name: 'Złoto',    pts: 85,  color: '#f2c230', emoji: '🟨' },
    { id: 5, name: 'Diament',  pts: 100, color: '#7fe7ff', emoji: '💎' },
  ];
  const METERS_PER_POINT = 10;

  const CATEGORIES = [
    { id: 'zwierzeta-gosp', q: 'Podaj zwierzę hodowlane (gospodarskie)', tiers: [
      ['krowa|krowka', 'świnia|swinka|wieprz', 'kura|kurczak|kogut', 'koń|konik'],
      ['owca|baran', 'koza|kozioł', 'kaczka', 'gęś', 'królik'],
      ['indyk', 'osioł', 'byk', 'cielę', 'perliczka'],
      ['alpaka', 'lama', 'przepiórka', 'struś', 'pszczoła'],
      ['bawół|bawół wodny', 'muł', 'jeleń|daniel', 'nutria', 'karp', 'paw', 'jak', 'wielbłąd', 'norka', 'szynszyla', 'ślimak winniczek|winniczek'],
      ['osłomuł', 'jedwabnik'],
    ]},
    { id: 'miasta-pl', q: 'Podaj miasto w Polsce', tiers: [
      ['Warszawa', 'Kraków', 'Gdańsk', 'Wrocław', 'Poznań'],
      ['Łódź', 'Szczecin', 'Lublin', 'Katowice', 'Białystok', 'Bydgoszcz', 'Toruń', 'Gdynia', 'Sopot', 'Zakopane'],
      ['Rzeszów', 'Kielce', 'Olsztyn', 'Opole', 'Częstochowa', 'Radom', 'Legnica', 'Zielona Góra', 'Gorzów Wielkopolski|Gorzów'],
      ['Elbląg', 'Płock', 'Tarnów', 'Koszalin', 'Kalisz', 'Słupsk', 'Gniezno', 'Malbork', 'Nowy Sącz', 'Zamość', 'Jelenia Góra', 'Wałbrzych'],
      ['Sandomierz', 'Kazimierz Dolny', 'Przemyśl', 'Łomża', 'Suwałki', 'Chełm', 'Ełk', 'Biała Podlaska', 'Kłodzko', 'Cieszyn', 'Hel', 'Frombork', 'Wąchock', 'Pacanów', 'Szczebrzeszyn', 'Pcim', 'Kłaj', 'Tykocin', 'Paczków', 'Biecz', 'Opatów'],
      ['Wyśmierzyce', 'Krynki'],
    ]},
    { id: 'owoce', q: 'Podaj owoc', tiers: [
      ['jabłko', 'banan', 'gruszka', 'pomarańcza'],
      ['truskawka', 'winogrono|winogrona', 'arbuz', 'śliwka', 'wiśnia', 'czereśnia', 'cytryna', 'malina'],
      ['ananas', 'kiwi', 'mango', 'brzoskwinia', 'morela', 'mandarynka', 'borówka|jagoda', 'porzeczka', 'agrest', 'melon'],
      ['granat', 'grejpfrut', 'limonka', 'nektarynka', 'figa', 'daktyl', 'papaja', 'jeżyna', 'żurawina', 'pigwa'],
      ['liczi', 'marakuja', 'kaki|persymona', 'karambola', 'pomelo', 'kumkwat', 'mirabelka', 'aronia', 'rokitnik', 'smoczy owoc|pitaja', 'durian', 'rambutan', 'pigwowiec', 'jagoda kamczacka|kamczatka', 'jarzębina', 'czeremcha', 'kiwano', 'salak'],
      ['nieśplik', 'mangostan'],
    ]},
    { id: 'warzywa', q: 'Podaj warzywo', tiers: [
      ['marchewka|marchew', 'ziemniak|kartofel|ziemniaki', 'pomidor', 'ogórek'],
      ['cebula', 'kapusta', 'papryka', 'sałata', 'brokuł|brokuły', 'kalafior', 'buraki|burak', 'czosnek'],
      ['pietruszka', 'seler', 'por', 'cukinia', 'dynia', 'rzodkiewka', 'groszek|groch', 'fasola', 'kukurydza'],
      ['bakłażan|oberżyna', 'szpinak', 'rzepa', 'kalarepa', 'brukselka', 'szczypiorek', 'koper', 'fasolka szparagowa'],
      ['karczoch', 'szparag|szparagi', 'jarmuż', 'rabarbar', 'pasternak', 'cykoria', 'patison', 'rukola', 'topinambur', 'brukiew', 'okra', 'roszponka', 'pak choi', 'batat', 'jam', 'maniok', 'kalafior romanesco|romanesco'],
      ['kardy', 'skorzonera|wężymord'],
    ]},
    { id: 'kolory', q: 'Podaj kolor', tiers: [
      ['czerwony', 'niebieski', 'zielony', 'żółty'],
      ['czarny', 'biały', 'różowy', 'fioletowy', 'pomarańczowy', 'brązowy', 'szary'],
      ['granatowy', 'błękitny', 'beżowy', 'złoty', 'srebrny', 'turkusowy', 'bordowy'],
      ['purpurowy', 'karmazynowy', 'oliwkowy', 'khaki', 'lawendowy', 'łososiowy', 'miętowy', 'ecru'],
      ['cyjan', 'magenta', 'amarantowy', 'seledynowy', 'chabrowy', 'kremowy', 'grafitowy', 'szmaragdowy', 'indygo', 'ultramaryna', 'kobaltowy', 'cynobrowy', 'pistacjowy', 'malachitowy', 'koralowy', 'ochra', 'karminowy'],
      ['umbra', 'sjena'],
    ]},
    { id: 'sporty', q: 'Podaj dyscyplinę sportu', tiers: [
      ['piłka nożna|pilka nozna|futbol', 'siatkówka', 'koszykówka', 'tenis'],
      ['pływanie', 'skoki narciarskie', 'boks', 'hokej', 'piłka ręczna|szczypiorniak', 'kolarstwo', 'bieganie|lekkoatletyka'],
      ['żużel', 'narciarstwo', 'judo', 'szachy', 'golf', 'łyżwiarstwo', 'formuła 1|f1', 'karate', 'gimnastyka'],
      ['szermierka', 'wioślarstwo', 'kajakarstwo', 'biathlon', 'curling', 'rugby', 'baseball', 'badminton', 'snooker', 'darts|rzutki'],
      ['krykiet', 'skeleton', 'bobsleje', 'pięciobój nowoczesny', 'zapasy', 'squash', 'sumo', 'łucznictwo', 'polo', 'saneczkarstwo', 'hurling', 'korfball', 'quidditch', 'bossa|bocce', 'unihokej|floorball', 'lacrosse', 'jai alai|pelota', 'palant'],
      ['sepak takraw', 'kabaddi'],
    ]},
    { id: 'imiona-zenskie', q: 'Podaj polskie imię żeńskie', tiers: [
      ['Anna', 'Maria', 'Katarzyna', 'Agnieszka'],
      ['Małgorzata', 'Ewa', 'Magdalena', 'Joanna', 'Zofia', 'Julia', 'Barbara', 'Krystyna'],
      ['Aleksandra', 'Natalia', 'Monika', 'Dorota', 'Karolina', 'Paulina', 'Weronika', 'Hanna', 'Zuzanna'],
      ['Jadwiga', 'Halina', 'Grażyna', 'Bożena', 'Teresa', 'Danuta', 'Lena', 'Oliwia', 'Iwona', 'Beata'],
      ['Wiesława', 'Stanisława', 'Bronisława', 'Genowefa', 'Gabriela', 'Kinga', 'Jagoda', 'Marianna', 'Bogumiła', 'Dobrosława', 'Mieczysława', 'Radosława', 'Ludmiła', 'Bogna', 'Milena', 'Dąbrówka', 'Wanda'],
      ['Przybysława', 'Świętosława'],
    ]},
    { id: 'rzeki-pl', q: 'Podaj rzekę płynącą przez Polskę', tiers: [
      ['Wisła'],
      ['Odra', 'Warta', 'Bug'],
      ['San', 'Narew', 'Pilica', 'Dunajec', 'Noteć', 'Nysa Łużycka|Nysa'],
      ['Wieprz', 'Bóbr', 'Biebrza', 'Drwęca', 'Brda', 'Prosna', 'Wisłok', 'Poprad', 'Bzura', 'Liwiec'],
      ['Wkra', 'Skawa', 'Raba', 'Soła', 'Słupia', 'Rega', 'Parsęta', 'Łyna', 'Kwisa', 'Nida', 'Wieprza', 'Gwda', 'Czarna Hańcza', 'Rospuda', 'Krutynia', 'Wda', 'Ina', 'Barycz', 'Kamienna', 'Białka', 'Ner', 'Mała Panew'],
      ['Wierzyca', 'Pasłęka'],
    ]},
    { id: 'zawody', q: 'Podaj zawód', tiers: [
      ['lekarz', 'nauczyciel', 'policjant', 'strażak'],
      ['programista', 'kucharz', 'fryzjer', 'kierowca', 'sprzedawca', 'pielęgniarka', 'mechanik', 'prawnik|adwokat'],
      ['architekt', 'piekarz', 'rolnik', 'stolarz', 'elektryk', 'hydraulik', 'dentysta', 'weterynarz', 'pilot', 'aktor', 'górnik'],
      ['ratownik', 'listonosz', 'kelner', 'murarz', 'notariusz', 'farmaceuta', 'księgowy', 'dziennikarz', 'tłumacz', 'krawiec'],
      ['kowal', 'szewc', 'zegarmistrz', 'kominiarz', 'sommelier', 'bibliotekarz', 'geodeta', 'archeolog', 'introligator', 'jubiler', 'bednarz', 'garncarz', 'zdun', 'dekarz', 'flisak', 'bartnik', 'lutnik', 'kamieniarz', 'sztukator'],
      ['rymarz', 'kaletnik'],
    ]},
    { id: 'instrumenty', q: 'Podaj instrument muzyczny', tiers: [
      ['gitara', 'pianino|fortepian', 'perkusja|bębny', 'skrzypce'],
      ['flet', 'trąbka', 'saksofon', 'wiolonczela', 'gitara basowa|bas', 'akordeon|harmonia', 'keyboard|syntezator'],
      ['klarnet', 'puzon', 'harfa', 'kontrabas', 'organy', 'ukulele', 'harmonijka', 'tamburyn', 'trójkąt'],
      ['obój', 'fagot', 'waltornia', 'tuba', 'altówka', 'ksylofon', 'banjo', 'mandolina', 'kotły', 'cymbały'],
      ['klawesyn', 'dudy', 'lutnia', 'cytra', 'sitar', 'didgeridoo', 'bandżola', 'czelesta', 'marimba', 'dzwonki', 'suka biłgorajska|suka', 'teremin', 'lira korbowa|lira', 'okaryna', 'koza podhalańska|koza', 'hang', 'erhu', 'kalimba'],
      ['nyckelharpa', 'basy kaliskie'],
    ]},
    { id: 'pierwiastki', q: 'Podaj pierwiastek chemiczny', tiers: [
      ['tlen', 'wodór', 'węgiel', 'żelazo'],
      ['azot', 'złoto', 'srebro', 'miedź', 'hel', 'sód', 'wapń'],
      ['chlor', 'siarka', 'potas', 'magnez', 'fosfor', 'glin|aluminium', 'cynk', 'ołów', 'rtęć', 'uran'],
      ['krzem', 'neon', 'fluor', 'jod', 'platyna', 'nikiel', 'cyna', 'lit', 'argon', 'tytan', 'pluton', 'rad'],
      ['chrom', 'kobalt', 'mangan', 'wolfram', 'bor', 'brom', 'arsen', 'kadm', 'polon', 'ksenon', 'krypton', 'selen', 'ren', 'osm', 'iryd', 'hafn', 'ind', 'tal', 'gal', 'german', 'skand', 'lutet', 'kopernik', 'ruten'],
      ['oganeson', 'prazeodym'],
    ]},
    { id: 'potrawy-pl', q: 'Podaj potrawę kuchni polskiej', tiers: [
      ['pierogi', 'schabowy|kotlet schabowy', 'bigos', 'rosół'],
      ['żurek|żur', 'gołąbki', 'barszcz', 'placki ziemniaczane|placki', 'mielony|kotlet mielony', 'pomidorowa|zupa pomidorowa'],
      ['kopytka', 'zrazy', 'flaki', 'kluski śląskie', 'ogórkowa', 'bitki', 'leniwe|pierogi leniwe', 'gulasz', 'kaszanka'],
      ['kwaśnica', 'zupa grzybowa|grzybowa', 'pyzy', 'krokiety', 'kartacze|cepeliny', 'kotlet de volaille|de volaille', 'czernina', 'galareta|zimne nóżki'],
      ['kartoflanka', 'zalewajka', 'babka ziemniaczana', 'kiszka ziemniaczana', 'pierekaczewnik', 'szare kluski', 'prażonki', 'zupa nic', 'kugiel', 'moskole', 'kołduny', 'kulebiak', 'polewka', 'gzik', 'ślepe ryby', 'brukwiowa'],
      ['parzybroda', 'hreczanyki'],
    ]},
    { id: 'kraje-eu', q: 'Podaj państwo europejskie', tiers: [
      ['Polska', 'Niemcy', 'Francja', 'Hiszpania', 'Włochy'],
      ['Wielka Brytania|Anglia', 'Czechy', 'Ukraina', 'Rosja', 'Portugalia', 'Grecja', 'Holandia|Niderlandy'],
      ['Austria', 'Szwecja', 'Norwegia', 'Słowacja', 'Węgry', 'Belgia', 'Szwajcaria', 'Litwa', 'Dania', 'Chorwacja', 'Irlandia'],
      ['Finlandia', 'Łotwa', 'Estonia', 'Rumunia', 'Bułgaria', 'Białoruś', 'Serbia', 'Słowenia', 'Islandia'],
      ['Albania', 'Macedonia Północna|Macedonia', 'Bośnia i Hercegowina|Bośnia', 'Czarnogóra', 'Mołdawia', 'Luksemburg', 'Malta', 'Cypr', 'Andora', 'Monako', 'Liechtenstein', 'Watykan'],
      ['Kosowo', 'San Marino'],
    ]},
    { id: 'ptaki', q: 'Podaj ptaka żyjącego w Polsce', tiers: [
      ['wróbel', 'bocian', 'gołąb', 'sikorka|sikora'],
      ['wrona', 'sroka', 'kos', 'jaskółka', 'orzeł', 'łabędź', 'kruk', 'dzięcioł'],
      ['sowa', 'mewa', 'szpak', 'kukułka', 'gil', 'czapla', 'jastrząb', 'sokół', 'żuraw', 'skowronek', 'słowik'],
      ['zięba', 'kawka', 'gawron', 'puszczyk', 'myszołów', 'pustułka', 'bażant', 'kuropatwa', 'kormoran', 'zimorodek'],
      ['raniuszek', 'pliszka', 'mysikrólik', 'kowalik', 'jemiołuszka', 'dudek', 'wilga', 'czajka', 'bielik', 'puchacz', 'trznadel', 'bączek', 'derkacz', 'kraska', 'dzierzba', 'krzyżodziób', 'orlik', 'głuszec', 'cietrzew', 'remiz', 'muchołówka'],
      ['pokląskwa', 'wodniczka'],
    ]},
    { id: 'drzewa', q: 'Podaj gatunek drzewa', tiers: [
      ['dąb', 'brzoza', 'sosna', 'świerk'],
      ['klon', 'buk', 'jodła', 'lipa', 'wierzba', 'topola', 'kasztanowiec|kasztan'],
      ['jesion', 'olcha', 'grab', 'modrzew', 'jarzębina|jarząb', 'akacja|robinia', 'cis', 'jabłoń', 'wiśnia'],
      ['wiąz', 'osika', 'jawor', 'cedr', 'cyprys', 'eukaliptus', 'baobab', 'palma', 'sekwoja', 'magnolia'],
      ['platan', 'miłorząb', 'tulipanowiec', 'jałowiec', 'czeremcha', 'leszczyna', 'katalpa', 'daglezja', 'żywotnik|tuja', 'metasekwoja', 'cyprysik', 'skrzydłorzech', 'korkowiec', 'choina', 'puchowiec', 'mamutowiec', 'ambrowiec'],
      ['brekinia', 'iglicznia'],
    ]},
    { id: 'pilkarze-pl', q: 'Podaj polskiego piłkarza (nazwisko)', tiers: [
      ['Lewandowski'],
      ['Szczęsny', 'Boniek', 'Zieliński', 'Milik', 'Błaszczykowski|Kuba'],
      ['Lato', 'Deyna', 'Piszczek', 'Krychowiak', 'Glik', 'Dudek', 'Smolarek', 'Świderski', 'Fabiański', 'Grosicki'],
      ['Tomaszewski', 'Żmuda', 'Szarmach', 'Kosecki', 'Kiwior', 'Bednarek', 'Frankowski', 'Żurawski', 'Boruc', 'Zalewski'],
      ['Lubański', 'Gadocha', 'Juskowiak', 'Kowalczyk', 'Bąk', 'Hajto', 'Olisadebe', 'Krzynówek', 'Gorgoń', 'Kasperczak', 'Wilimowski', 'Cieślik', 'Pol', 'Brychczy', 'Kubiak', 'Dziekanowski', 'Furtok', 'Nawałka'],
      ['Szymanowski', 'Jałocha'],
    ]},
    { id: 'marki-aut', q: 'Podaj markę samochodu', tiers: [
      ['BMW', 'Audi', 'Mercedes', 'Toyota', 'Volkswagen|VW'],
      ['Ford', 'Opel', 'Skoda', 'Fiat', 'Tesla', 'Ferrari', 'Porsche', 'Renault', 'Kia', 'Hyundai'],
      ['Peugeot', 'Honda', 'Mazda', 'Nissan', 'Volvo', 'Lamborghini', 'Citroen', 'Dacia', 'Seat', 'Polonez'],
      ['Subaru', 'Mitsubishi', 'Suzuki', 'Jeep', 'Lexus', 'Bugatti', 'Maserati', 'Bentley', 'Jaguar', 'Syrena', 'Alfa Romeo'],
      ['Rolls-Royce|Rolls Royce', 'Aston Martin', 'McLaren', 'Lancia', 'Cupra', 'Chevrolet', 'Cadillac', 'Lada', 'Trabant', 'Warszawa', 'Saab', 'Izera', 'Koenigsegg', 'Pagani', 'Wartburg', 'Tatra', 'Zastava', 'Moskwicz', 'Lotus', 'Smart', 'Infiniti'],
      ['Arrinera', 'Rimac'],
    ]},
    { id: 'planety-kosmos', q: 'Podaj ciało niebieskie (planeta, księżyc, gwiazda…)', tiers: [
      ['Słońce', 'Księżyc', 'Ziemia', 'Mars'],
      ['Jowisz', 'Saturn', 'Wenus', 'Merkury', 'Neptun', 'Uran', 'Pluton'],
      ['Gwiazda Polarna|Polaris', 'Syriusz', 'Halley|Kometa Halleya', 'Ceres', 'Fobos', 'Deimos'],
      ['Europa', 'Io', 'Ganimedes', 'Kallisto', 'Tytan', 'Betelgeza', 'Proxima Centauri|Proxima', 'Andromeda'],
      ['Enceladus', 'Tryton', 'Charon', 'Westa', 'Eris', 'Wega', 'Rigel', 'Altair', 'Aldebaran', 'Antares', 'Sedna', 'Miranda', 'Oberon', 'Tytania', 'Mimas', 'Japet', 'Kasjopeja', 'Deneb', 'Arktur', 'Kapella'],
      ['Makemake', 'Haumea'],
    ]},
    { id: 'sprzet-kuchnia', q: 'Podaj sprzęt lub przyrząd kuchenny', tiers: [
      ['lodówka', 'garnek', 'patelnia', 'nóż'],
      ['mikrofalówka', 'czajnik', 'piekarnik', 'zmywarka', 'toster', 'widelec', 'łyżka', 'kuchenka'],
      ['mikser', 'blender', 'tarka', 'deska do krojenia|deska', 'chochla', 'durszlak', 'ekspres do kawy|ekspres', 'otwieracz'],
      ['wałek', 'trzepaczka', 'sitko', 'tłuczek', 'obieraczka', 'szpatułka', 'frytkownica', 'gofrownica', 'robot kuchenny'],
      ['moździerz', 'mandolina', 'praska do czosnku|praska', 'szybkowar', 'termomix|thermomix', 'wok', 'rondel', 'brytfanna', 'cedzak', 'tłuczek do mięsa', 'stolnica', 'radełko', 'szatkownica', 'tortownica', 'sous vide|cyrkulator', 'salamandra', 'tagine'],
      ['makutra', 'kopystka'],
    ]},
    { id: 'gory', q: 'Podaj szczyt lub pasmo górskie', tiers: [
      ['Tatry', 'Giewont', 'Rysy', 'Mount Everest|Everest'],
      ['Alpy', 'Karpaty', 'Sudety', 'Beskidy', 'Śnieżka', 'Kasprowy Wierch|Kasprowy', 'Himalaje', 'Bieszczady'],
      ['Babia Góra', 'Pieniny', 'Kilimandżaro', 'Mont Blanc', 'K2', 'Andy', 'Góry Skaliste', 'Trzy Korony', 'Tarnica'],
      ['Gorce', 'Góry Świętokrzyskie', 'Łysica', 'Śnieżnik', 'Elbrus', 'Matterhorn', 'Aconcagua', 'Ural', 'Pireneje', 'Kaukaz'],
      ['Świnica', 'Kościelec', 'Turbacz', 'Skrzyczne', 'Pilsko', 'Krywań', 'Gerlach', 'Denali', 'Annapurna', 'Nanga Parbat', 'Fudżi', 'Ślęża', 'Radziejowa', 'Wielka Sowa', 'Chełmiec', 'Łomnica', 'Kazbek', 'Ararat', 'Vinson', 'Lhotse', 'Broad Peak'],
      ['Puncak Jaya', 'Ojos del Salado'],
    ]},
    { id: 'czesci-ciala', q: 'Podaj część ciała człowieka', tiers: [
      ['ręka', 'noga', 'głowa', 'oko'],
      ['nos', 'ucho', 'usta', 'palec', 'serce', 'brzuch', 'plecy', 'włosy'],
      ['kolano', 'łokieć', 'stopa', 'szyja', 'ramię', 'język', 'ząb|zęby', 'mózg', 'płuca|płuco', 'wątroba'],
      ['nadgarstek', 'kostka', 'pięta', 'brew|brwi', 'rzęsy|rzęsa', 'pępek', 'żołądek', 'nerka|nerki', 'biodro', 'łopatka'],
      ['śledziona', 'trzustka', 'obojczyk', 'mostek', 'rzepka', 'małżowina', 'krtań', 'tchawica', 'przepona', 'grdyka', 'młoteczek', 'podniebienie', 'ślimak', 'piszczel', 'strzałka', 'kość ogonowa|kość guziczna', 'przysadka', 'wyrostek robaczkowy', 'dwunastnica'],
      ['kowadełko', 'strzemiączko'],
    ]},
    { id: 'gry-planszowe', q: 'Podaj grę planszową lub towarzyską', tiers: [
      ['szachy', 'Monopoly|Eurobiznes', 'warcaby', 'Chińczyk|Człowieku nie irytuj się'],
      ['Scrabble|Literaki', 'Uno', 'Jenga', 'Dixit', 'Catan|Osadnicy z Catanu', 'Grzybobranie', 'statki'],
      ['Wsiąść do pociągu|Ticket to Ride', 'Carcassonne', 'Kalambury', 'Taboo|Tabu', 'Dobble', 'Cluedo', 'Mafia', 'domino'],
      ['Pędzące żółwie', 'Splendor', 'Azul', 'Kolejka', '5 sekund', 'Codenames|Tajniacy', 'Pandemia', 'Ryzyko|Risk', 'młynek'],
      ['go', 'Gloomhaven', 'Terraformacja Marsa', 'Agricola', 'Wsiąść do pociągu Europa', 'mahjong', 'Neuroshima Hex', 'backgammon|tryktrak', 'Magia i Miecz', 'Robinson Crusoe', 'Brass', 'Mancala', 'Hanabi', 'Wysokie Napięcie', 'Dominion', 'Patchwork'],
      ['Mare Nostrum', 'Twilight Imperium'],
    ]},
    { id: 'pisarze-pl', q: 'Podaj polskiego pisarza lub poetę (nazwisko)', tiers: [
      ['Mickiewicz', 'Sienkiewicz', 'Słowacki'],
      ['Kochanowski', 'Prus', 'Szymborska', 'Miłosz', 'Reymont', 'Orzeszkowa', 'Żeromski', 'Tokarczuk'],
      ['Norwid', 'Krasicki', 'Sapkowski', 'Lem', 'Tuwim', 'Brzechwa', 'Gombrowicz', 'Herbert', 'Konopnicka', 'Fredro'],
      ['Wyspiański', 'Witkacy|Witkiewicz', 'Schulz', 'Mrożek', 'Kapuściński', 'Iwaszkiewicz', 'Różewicz', 'Twardowski', 'Kraszewski'],
      ['Rej', 'Morsztyn', 'Leśmian', 'Baczyński', 'Herling-Grudziński', 'Nałkowska', 'Dąbrowska', 'Konwicki', 'Białoszewski', 'Stasiuk', 'Potocki', 'Trembecki', 'Krasiński', 'Asnyk', 'Przybyszewski', 'Pawlikowska-Jasnorzewska|Jasnorzewska', 'Hłasko', 'Myśliwski', 'Dukaj', 'Twardoch'],
      ['Sęp-Szarzyński|Szarzyński', 'Naruszewicz'],
    ]},
  ];

  // Paczki tematyczne (tryb Bez limitu z wybranym tematem)
  const PACKS = [
    { id: 'polska', name: 'Polska', icon: '🇵🇱', cats: ['miasta-pl', 'rzeki-pl', 'gory', 'potrawy-pl', 'pisarze-pl', 'pilkarze-pl', 'imiona-zenskie'] },
    { id: 'przyroda', name: 'Przyroda', icon: '🌲', cats: ['zwierzeta-gosp', 'ptaki', 'drzewa', 'owoce', 'warzywa'] },
    { id: 'nauka', name: 'Nauka', icon: '🔬', cats: ['pierwiastki', 'planety-kosmos', 'czesci-ciala', 'kraje-eu', 'kolory'] },
    { id: 'rozrywka', name: 'Rozrywka i sport', icon: '🎲', cats: ['sporty', 'gry-planszowe', 'instrumenty', 'marki-aut', 'pilkarze-pl'] },
    { id: 'dom', name: 'Dom i praca', icon: '🏠', cats: ['sprzet-kuchnia', 'zawody', 'potrawy-pl', 'warzywa', 'kolory'] },
  ];

  // Dodatkowa baza kategorii (shared/cats.js). Nowe kategorie dopisuj z `since` w przyszłości,
  // żeby nie zmieniać już trwającego cyklu losowania.
  const EXTRA = (typeof module !== 'undefined' && module.exports) ? require('./cats.js') : (root.SZYB_CATS || []);
  for (const c of EXTRA) {
    // { extend: id, add: [6 pokładów] } dopisuje odpowiedzi do kategorii z tego pliku
    if (c.extend) { const b = CATEGORIES.find((x) => x.id === c.extend); if (b) c.add.forEach((t, i) => b.tiers[i].push(...t)); }
    else CATEGORIES.push(c);
  }


  const api = { TIERS, METERS_PER_POINT, CATEGORIES, PACKS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SZYB_DATA = api;
})(typeof window !== 'undefined' ? window : globalThis);
