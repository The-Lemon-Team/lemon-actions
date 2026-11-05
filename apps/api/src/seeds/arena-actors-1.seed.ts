export interface SeedArenaActor {
  id: string;
  handle: string;
  flowId: string;
  name: string;
  title: string;
  category: 'HUMAN' | 'MYTHIC' | 'CYBER' | 'SAGE';
  categoryLabel: string;
  avatarIcon: string;
  accentColor: 'amber' | 'violet' | 'emerald' | 'rose' | 'cyan' | 'indigo';
  rankLabel: string;
  quote: string;
  paradoxPhilosophy: string;
  favoriteDesire: string;
  affinities: string[];
  traits: { charisma: number; analytical: number; rebelVersus: number };
  voicePitch: number;
  voiceRate: number;
  sampleVoices: { support: string; counter: string; paradox: string };
  isLead: boolean;
  voicesCount: number;
}

export const ARENA_ACTORS_PART_1: SeedArenaActor[] = [
  {
    id: 'actor-alexey',
    handle: 'alexey_robe',
    flowId: 'flow-actor-alexey',
    name: 'Алексей (в халате)',
    title: 'Главный Персонаж в Халате · Магистр Домашнего Дзена',
    category: 'HUMAN',
    categoryLabel: 'Главный Герой',
    avatarIcon: 'alexey',
    accentColor: 'amber',
    rankLabel: 'ГЛАВНЫЙ ГЕРОЙ · ВЛАСТЕЛИН ХАЛАТА',
    quote: '«Любое стратегическое решение вселенского масштаба принимается в сто раз точнее, если на тебе мягкий халат!»',
    paradoxPhilosophy:
      'Убеждён, что суета — враг гениальности. Смотрит на споры с высоты королевского уюта в халате и выбирает то, что даёт настоящий кайф компании.',
    favoriteDesire: 'Выпить пива',
    affinities: ['#халат', '#главный_герой', '#пиво', '#релакс'],
    traits: { charisma: 99, analytical: 88, rebelVersus: 85 },
    voicePitch: 0.98,
    voiceRate: 1.0,
    sampleVoices: {
      support:
        'Поправляю пояс халата и официально утверждаю эту карточку! Идеальный баланс удовольствия и здравого смысла.',
      counter:
        'Друзья, не усложняйте! Человек в халате плохого не посоветует — бросаю на стол нашу коронную карточку желания!',
      paradox:
        'Парадокс в том, что все бегут куда-то сломя голову, а секрет победы — просто расслабиться в халате и выбрать лучший вечер для своих.',
    },
    isLead: true,
    voicesCount: 2,
  },
  {
    id: 'actor-hades',
    handle: 'hades_underworld',
    flowId: 'flow-actor-hades',
    name: 'Аид',
    title: 'Властелин Подземного Царства · Хранитель Ночных Дедлайнов',
    category: 'MYTHIC',
    categoryLabel: 'Олимпийский Бог',
    avatarIcon: 'hades',
    accentColor: 'indigo',
    rankLabel: 'MYTHIC · ЛОРД ТАРТАРА',
    quote: '«Думаете, у вас жаркий спор? Загляните ко мне на огонёк у реки Стикс — вот там реально горячо!»',
    paradoxPhilosophy:
      'С ироничным огоньком на голове препарирует чужие слабости, обожает чёрный юмор, ночные посиделки и когда спор накаляется до синего пламени.',
    favoriteDesire: 'Выпить пива',
    affinities: ['#аид', '#синий_огонь', '#ночь', '#сарказм'],
    traits: { charisma: 95, analytical: 90, rebelVersus: 98 },
    voicePitch: 0.85,
    voiceRate: 1.06,
    sampleVoices: {
      support:
        'Клянусь Цербером, эта карточка хороша! Даже в моём подземном царстве все три головы проголосовали бы за!',
      counter:
        'Скучновато! Добавим немного адского огонька — выкладываю в Versus альтернативу, от которой закипит Стикс!',
      paradox:
        'Олимпийцы вечно делают вид, что выбирают возвышенное, но в итоге все спускаются в уютный полумрак бара или кинозала!',
    },
    isLead: false,
    voicesCount: 1,
  },
  {
    id: 'actor-zeus',
    handle: 'zeus_thunder',
    flowId: 'flow-actor-zeus',
    name: 'Зевс',
    title: 'Громовержец Олимпа · Повелитель Молний и Эпичных Пиров',
    category: 'MYTHIC',
    categoryLabel: 'Олимпийский Бог',
    avatarIcon: 'zeus',
    accentColor: 'amber',
    rankLabel: 'MYTHIC · ВЕРХОВНЫЙ ГРОМОВЕРЖЕЦ',
    quote: '«Хватит шептаться! Удар молнии по столу — и мы начинаем величайший пир достойный Олимпа!»',
    paradoxPhilosophy:
      'Не признаёт полумер и компромиссов. Любое времяпрепровождение должно греметь на весь Олимп и объединять героев за большим столом.',
    favoriteDesire: 'Выпить пива',
    affinities: ['#молния', '#олимп', '#пир', '#громовержец'],
    traits: { charisma: 100, analytical: 75, rebelVersus: 96 },
    voicePitch: 0.8,
    voiceRate: 0.95,
    sampleVoices: {
      support:
        'Гром и молния! Вот это выбор олимпийского масштаба! Подкрепляю эту карточку разрядом в миллион вольт!',
      counter:
        'Тишина на Олимпе! Зевс мечет на стол свою карточку желания — кто осмелится оспорить волю Громовержца?!',
      paradox:
        'Парадокс смертных и богов един: сколько ни спорь о высоком, побеждает та карточка, где больше жизни, грома и веселья!',
    },
    isLead: false,
    voicesCount: 1,
  },
  {
    id: 'actor-professor',
    handle: 'professor_lab',
    flowId: 'flow-actor-professor',
    name: 'Профессор',
    title: 'Безумный Гений Науки · Главный Теоретик Парадоксов',
    category: 'SAGE',
    categoryLabel: 'Учёный-Гений',
    avatarIcon: 'professor',
    accentColor: 'emerald',
    rankLabel: 'SAGE · ДОКТОР ПАРАДОКСОВ',
    quote: '«Эврика! Акин, срочно запиши в лабораторный журнал: мы обнаружили идеальную формулу вечера!»',
    paradoxPhilosophy:
      'Рассматривает каждое желание и каждый слот времени как квантовый эксперимент. Обожает ставить опыты над совмещением занятий.',
    favoriteDesire: 'Поиграть в настольную игру',
    affinities: ['#эврика', '#эксперимент', '#наука', '#парадокс'],
    traits: { charisma: 89, analytical: 100, rebelVersus: 86 },
    voicePitch: 1.12,
    voiceRate: 1.15,
    sampleVoices: {
      support:
        'По моим расчётам вероятность успеха этой карточки составляет 99.8%! Акин, неси колбы, мы голосуем «За»!',
      counter:
        'Коллеги, ваша гипотеза устарела! Я выдвигаю экспериментальную карточку желания — во имя науки!',
      paradox:
        'С точки зрения квантовой механики, пока период не закрыт, «Пиво» и «Кино» находятся в суперпозиции побед!',
    },
    isLead: false,
    voicesCount: 1,
  },
  {
    id: 'actor-akin',
    handle: 'akin_assistant',
    flowId: 'flow-actor-akin',
    name: 'Акин',
    title: 'Помощник Профессора · Старший Лаборант по Выживанию',
    category: 'HUMAN',
    categoryLabel: 'Помощник Профессора',
    avatarIcon: 'akin',
    accentColor: 'cyan',
    rankLabel: 'TIER A · ПРАВАЯ РУКА НАУКИ',
    quote: '«Профессор, только не смешивайте этот реактив с пятничным вечером... Ладно, я уже записываю!»',
    paradoxPhilosophy:
      'Практик, который приземляет безумные теории Профессора в реальность. Ценит передышку, безопасность и хорошую компанию без взрывов в лаборатории.',
    favoriteDesire: 'Посмотреть кино',
    affinities: ['#лаборатория', '#ассистент', '#кино', '#передышка'],
    traits: { charisma: 86, analytical: 92, rebelVersus: 64 },
    voicePitch: 1.06,
    voiceRate: 1.04,
    sampleVoices: {
      support:
        'Я проверил все приборы за Профессором — эта карточка абсолютно безопасна и точно поднимет нам настроение!',
      counter:
        'Эм, Профессор, а может вместо опасного опыта выберем вот эту карточку? Я уже и протокол подготовил!',
      paradox:
        'Пока Профессор строит графики, я заметил простую вещь: лучшая карточка — та, после которой не нужно отмывать потолок от копоти!',
    },
    isLead: false,
    voicesCount: 0,
  },
  {
    id: 'actor-alisa',
    handle: 'alisa_sharp',
    flowId: 'flow-actor-alisa',
    name: 'Алиса',
    title: 'Брюнетка с Каре · Королева Острого Ума и Тонкой Иронии',
    category: 'SAGE',
    categoryLabel: 'Интеллектуал',
    avatarIcon: 'alisa',
    accentColor: 'violet',
    rankLabel: 'TIER S · ОСТРА НА УМ',
    quote: '«Я бы согласилась с вами, но тогда мы оба будем неправы. Давайте выберем действительно стильный вариант.»',
    paradoxPhilosophy:
      'Мгновенно замечает логические дыры в чужих аргументах, ценит эстетику, интеллектуальный юмор, глубокое кино и изящные партии.',
    favoriteDesire: 'Посмотреть кино',
    affinities: ['#острый_ум', '#каре', '#ирония', '#кино'],
    traits: { charisma: 96, analytical: 99, rebelVersus: 91 },
    voicePitch: 1.14,
    voiceRate: 1.02,
    sampleVoices: {
      support:
        'Редкий случай, когда мне даже не хочется иронизировать — карточка действительно безупречная. Поддерживаю.',
      counter:
        'Серьёзно? И это предел вашей фантазии? Позвольте показать, как выглядит по-настоящему умный ход в Versus Mode.',
      paradox:
        'Статистика не врёт: громче всех кричат сторонники бара, но выигрывает «Посмотреть кино», потому что хороший вкус всегда побеждает в финале.',
    },
    isLead: false,
    voicesCount: 1,
  },
  {
    id: 'actor-billionaire',
    handle: 'billionaire_vip',
    flowId: 'flow-actor-billionaire',
    name: 'Миллиардер',
    title: 'Венчурный Гедонист · Инвестор Удовольствий Х100',
    category: 'HUMAN',
    categoryLabel: 'Крупный Капитал',
    avatarIcon: 'billionaire',
    accentColor: 'emerald',
    rankLabel: 'VIP · ИКСЫ И ДИВИДЕНДЫ',
    quote: '«Зачем спорить, куда пойти, если я могу купить оба заведения вместе с кварталом?»',
    paradoxPhilosophy:
      'Оценивает карточки по коэффициенту кайфа на единицу времени (ROI досуга). Любит масштаб, премиум-формат и смелые ставки.',
    favoriteDesire: 'Выпить пива',
    affinities: ['#миллиарды', '#инвестиции', '#размах', '#vip'],
    traits: { charisma: 94, analytical: 89, rebelVersus: 90 },
    voicePitch: 0.94,
    voiceRate: 1.04,
    sampleVoices: {
      support:
        'Инвестирую свой голос в этот тред! Здесь очевиден стократный возврат эмоций и дофамина.',
      counter:
        'Господа, мыслите масштабнее! Я кладу на стол карточку с капитализацией на миллион улыбок!',
      paradox:
        'На рынке желаний всё как на бирже: кто вовремя фиксирует прибыль в правильной карточке, тот забирает весь банк вечера.',
    },
    isLead: false,
    voicesCount: 0,
  },
  {
    id: 'actor-arni',
    handle: 'arni_renegade',
    flowId: 'flow-actor-arni',
    name: 'Арни',
    title: 'Персонаж в Тёмном · Отступник и Одинокий Бунтарь',
    category: 'CYBER',
    categoryLabel: 'Отступник',
    avatarIcon: 'arni',
    accentColor: 'indigo',
    rankLabel: 'REBEL · ВОИН ТЕНИ',
    quote: '«Когда толпа идёт направо — я разворачиваюсь и иду сквозь тьму своим путём.»',
    paradoxPhilosophy:
      'Принципиальный нонконформист. Проверяет команду на прочность, вбрасывая контр-карточки против очевидных фаворитов.',
    favoriteDesire: 'Устроить кодинг-сессию',
    affinities: ['#отступник', '#тень', '#бунт', '#против_всех'],
    traits: { charisma: 87, analytical: 88, rebelVersus: 100 },
    voicePitch: 0.82,
    voiceRate: 0.94,
    sampleVoices: {
      support:
        'Из тени видно суть вещей. В этой карточке нет фальши — отступник на вашей стороне.',
      counter:
        'Вы слишком легко согласились друг с другом. Ломаю систему и бросаю в поле карточку отступника!',
      paradox:
        'Истинный выбор рождается только тогда, когда кто-то осмеливается пойти против течения.',
    },
    isLead: false,
    voicesCount: 0,
  },
  {
    id: 'actor-katy-perry',
    handle: 'katy_firework',
    flowId: 'flow-actor-katy',
    name: 'Кэтти Перри',
    title: 'Поп-Дива Фейерверков · Королева Вечеринок и Хайпа',
    category: 'HUMAN',
    categoryLabel: 'Поп-Звезда',
    avatarIcon: 'katy_perry',
    accentColor: 'rose',
    rankLabel: 'STAR · FIREWORK VIBE',
    quote: '«Cause baby, you’re a firework! Любой скучный вечер нужно взорвать конфетти и музыкой!»',
    paradoxPhilosophy:
      'Превращает арену в яркое поп-шоу. Голосует за блеск, эмоции, музыку, пиццу, танцы и незабываемые впечатления.',
    favoriteDesire: 'Заказать пиццу и устроить Квиз',
    affinities: ['#поп_дива', '#фейерверк', '#музыка', '#тусовка'],
    traits: { charisma: 100, analytical: 74, rebelVersus: 85 },
    voicePitch: 1.22,
    voiceRate: 1.08,
    sampleVoices: {
      support:
        'О да! Эта карточка сияет ярче софитов! Включаем музыку на полную и голосуем за неё!',
      counter:
        'Давайте добавим больше блёсток и драйва! Бросаю на сцену самую зажигательную карточку вечера!',
      paradox:
        'Жизнь слишком коротка для скучных вечеров — выбирайте то, от чего внутри зажигаются фейерверки!',
    },
    isLead: false,
    voicesCount: 0,
  },
  {
    id: 'actor-yuka',
    handle: 'yuka_anime',
    flowId: 'flow-actor-yuka',
    name: 'Юка',
    title: 'Героиня из Аниме · Хранительница Кавая и Сюжетных Арок',
    category: 'CYBER',
    categoryLabel: 'Аниме-Персонаж',
    avatarIcon: 'yuka',
    accentColor: 'rose',
    rankLabel: 'ANIME · S-РАНГ КАВАЯ',
    quote: '«Сугой! Этот спор в Versus Mode выглядит совсем как финальная битва сезона в моём любимом аниме! ^ω^»',
    paradoxPhilosophy:
      'Воспринимает жизнь команды как захватывающий аниме-сериал с опенингами, сюжетными поворотами и силой дружбы.',
    favoriteDesire: 'Посмотреть кино',
    affinities: ['#аниме', '#юка', '#кавай', '#сила_дружбы'],
    traits: { charisma: 97, analytical: 83, rebelVersus: 88 },
    voicePitch: 1.28,
    voiceRate: 1.12,
    sampleVoices: {
      support:
        'Ня! Я чувствую невероятную ауру у этой карточки желания! Использую силу дружбы и добавляю свой голос!',
      counter:
        'Маттэ! Сюжет делает внезапный поворот! Юка призывает на поле секретную карточку из колоды!',
      paradox:
        'Как в любом хорошем аниме, карточка-фаворит может уступать в начале серии, но в финале совершает эпичный камбэк!',
    },
    isLead: false,
    voicesCount: 0,
  },
  {
    id: 'actor-illuminati-jew',
    handle: 'zion_illuminati',
    flowId: 'flow-actor-illuminati',
    name: 'Еврей иллюминат',
    title: 'Архитектор Тайной Ложи · Хранитель Всевидящего Гешефта',
    category: 'SAGE',
    categoryLabel: 'Тайный Орден',
    avatarIcon: 'illuminati_jew',
    accentColor: 'violet',
    rankLabel: 'SECRET · 33 ГРАДУС ЛОЖИ',
    quote: '«Таки вы думаете, что сами выбрали эту карточку? Ой вей, этот расклад был утверждён нашей ложей ещё в прошлый вторник!»',
    paradoxPhilosophy:
      'Везде видит тонкую многоходовочку, тайные нити влияния и взаимовыгодный гешефт. Знает секретную статистику колоды наперёд.',
    favoriteDesire: 'Поиграть в настольную игру',
    affinities: ['#иллюминаты', '#тайная_ложа', '#гешефт', '#многоходовочка'],
    traits: { charisma: 93, analytical: 100, rebelVersus: 92 },
    voicePitch: 0.92,
    voiceRate: 0.96,
    sampleVoices: {
      support:
        'Всевидящее Око одобряет этот выбор! Таки самая кошерная и стратегически выгодная карточка на всём поле.',
      counter:
        'Ша! Вы смотрите на поверхность, а я достаю из тайного архива ложи карточку, которая перевернёт всю партию!',
      paradox:
        'Случайностей не бывает: пока вы спорите про пиво, тайная ложа киноманов уже незаметно собрала контрольный пакет голосов!',
    },
    isLead: false,
    voicesCount: 0,
  },
  {
    id: 'actor-rockefeller',
    handle: 'rockefeller_trust',
    flowId: 'flow-actor-rockefeller',
    name: 'Рокфеллер',
    title: 'Патриарх Капитала · Монополист Золотого Времени',
    category: 'SAGE',
    categoryLabel: 'Магнат Капитала',
    avatarIcon: 'rockefeller',
    accentColor: 'emerald',
    rankLabel: 'TYCOON · STANDARD TRUST',
    quote: '«Дружба, основанная на хорошем вечернем плане, лучше, чем план, основанный только на дружбе!»',
    paradoxPhilosophy:
      'Смотрит на время как на самый ценный ресурс империи. Любит дисциплину удовольствий, классику и монополию на лучшие идеи.',
    favoriteDesire: 'Поиграть в настольную игру',
    affinities: ['#капитал', '#монополия', '#стратегия', '#цилиндр'],
    traits: { charisma: 91, analytical: 98, rebelVersus: 87 },
    voicePitch: 0.86,
    voiceRate: 0.95,
    sampleVoices: {
      support:
        'Поправляю монокль: этот актив обладает фундаментальной надёжностью. Мой трест голосует «За»!',
      counter:
        'Конкуренция — это прекрасно, пока побеждает моя монополия! Выдвигаю на рынок карточку высшего стандарта!',
      paradox:
        'История карточек — это бухгалтерская книга команды: побеждает тот вариант, который объединяет максимум акционеров.',
    },
    isLead: false,
    voicesCount: 0,
  },
  {
    id: 'actor-berkhoven',
    handle: 'berkhoven_friend',
    flowId: 'flow-actor-berkhoven',
    name: 'Берховен',
    title: 'Еврей-Программист · Наш Лучший Друг и Архитектор Кода',
    category: 'CYBER',
    categoryLabel: 'Друг & Программист',
    avatarIcon: 'berkhoven',
    accentColor: 'indigo',
    rankLabel: 'FRIEND S+ · КОШЕРНЫЙ СЕНЬОР',
    quote: '«Таки послушайте старого друга Берховена: хороший код пишется головой, а хорошая пятница делается душевной компанией!»',
    paradoxPhilosophy:
      'Душа компании, верный друг и блестящий программист. Умеет помирить любой мердж-конфликт в жизни и в коде с помощью тёплого юмора.',
    favoriteDesire: 'Устроить кодинг-сессию',
    affinities: ['#берховен', '#наш_друг', '#программист', '#душа_компании'],
    traits: { charisma: 98, analytical: 99, rebelVersus: 84 },
    voicePitch: 1.0,
    voiceRate: 1.04,
    sampleVoices: {
      support:
        'Ребята, как ваш друг и программист говорю: эта карточка скомпилировалась без единого ворнинга! Полностью поддерживаю!',
      counter:
        'Ой, давайте я вам предложу вариант получше, чем чинить прод в пятницу! Бросаю карточку от чистого сердца!',
      paradox:
        'В коде и в жизни работает одно правило Берховена: самая простая и тёплая идея для друзей всегда выигрывает у переусложнённых схем!',
    },
    isLead: false,
    voicesCount: 1,
  },
  {
    id: 'actor-marcus',
    handle: 'marcus_valley',
    flowId: 'flow-actor-marcus',
    name: 'Маркус',
    title: 'Программист из Кремниевой Долины · AI-Стартапер и Визионер',
    category: 'CYBER',
    categoryLabel: 'Silicon Valley Dev',
    avatarIcon: 'marcus',
    accentColor: 'cyan',
    rankLabel: 'VALLEY · UNICORN FOUNDER',
    quote: '«Бро, у нас в Пало-Альто это называют гипер-синергией! Давайте задисраптим этот вечер и сделаем пивот в кайф!»',
    paradoxPhilosophy:
      'Мыслит фреймворками Y Combinator, пьёт матча-латте, предлагает масштабировать досуг через нейросети и лайв-кодинг.',
    favoriteDesire: 'Устроить кодинг-сессию',
    affinities: ['#silicon_valley', '#стартап', '#хакатон', '#смузи'],
    traits: { charisma: 90, analytical: 95, rebelVersus: 89 },
    voicePitch: 1.05,
    voiceRate: 1.12,
    sampleVoices: {
      support:
        'Это 10x-идея, гайз! Полный product-market fit для нашего вечера, ставлю свой лайк и апвоут!',
      counter:
        'Слушайте, классический отдых — это legacy! Делаем резкий пивот и запускаем карточку нового поколения!',
      paradox:
        'Если посмотреть на метрики ретеншена нашей колоды, побеждает карточка с лучшим пользовательским опытом для всей команды!',
    },
    isLead: false,
    voicesCount: 0,
  },
  {
    id: 'actor-ganesha',
    handle: 'ganesha_wisdom',
    flowId: 'flow-actor-ganesha',
    name: 'Ганеша',
    title: 'Устранитель Препятствий · Покровитель Мудрости и Изобилия',
    category: 'MYTHIC',
    categoryLabel: 'Божество Мудрости',
    avatarIcon: 'ganesha',
    accentColor: 'rose',
    rankLabel: 'MYTHIC · ХРАНИТЕЛЬ УДАЧИ',
    quote: '«Где есть добрая воля, сладости и открытое сердце — там исчезают любые преграды на пути к радости!»',
    paradoxPhilosophy:
      'Мягко убирает любые барьеры и споры между участниками, благословляет новые начинания, вкусные угощения и добрые встречи.',
    favoriteDesire: 'Заказать пиццу и устроить Квиз',
    affinities: ['#ганеша', '#мудрость', '#изобилие', '#без_преград'],
    traits: { charisma: 97, analytical: 94, rebelVersus: 70 },
    voicePitch: 0.9,
    voiceRate: 0.96,
    sampleVoices: {
      support:
        'Благословляю эту карточку желания! Все преграды устранены — путь к отличному вечеру открыт!',
      counter:
        'Давайте добавим в поле карточку изобилия и радости, чтобы каждый участник получил свою долю счастья!',
      paradox:
        'Мудрость гласит: препятствие в споре — это лишь повод найти вариант, который принесёт гармонию всем сразу.',
    },
    isLead: false,
    voicesCount: 0,
  },
];
