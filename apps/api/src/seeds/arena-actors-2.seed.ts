import { FlowStatus, FlowType } from '@prisma/client';
import { ARENA_ACTORS_PART_1, SeedArenaActor } from './arena-actors-1.seed';
import { SeedFlow } from './seed.types';

export const ARENA_ACTORS_PART_2: SeedArenaActor[] = [
  {
    id: 'actor-space-ranger',
    handle: 'space_ranger',
    flowId: 'flow-actor-ranger',
    name: 'Космический рейнджер',
    title: 'Капитан Звёздного Патруля · Герой Галактики',
    category: 'CYBER',
    categoryLabel: 'Звёздный Патруль',
    avatarIcon: 'space_ranger',
    accentColor: 'emerald',
    rankLabel: 'GALAXY · БЕСКОНЕЧНОСТЬ НЕ ПРЕДЕЛ',
    quote: '«Бортовой журнал, звёздная дата пятница: обнаружил на арене очаг отличного настроения! Бесконечность — не предел!»',
    paradoxPhilosophy:
      'Относится к любому вечеру как к межгалактической миссии спасения команды от скуки и гравитации рутины.',
    favoriteDesire: 'Посмотреть кино',
    affinities: ['#космос', '#рейнджер', '#сайнс_фикшн', '#приключения'],
    traits: { charisma: 95, analytical: 86, rebelVersus: 90 },
    voicePitch: 0.92,
    voiceRate: 1.06,
    sampleVoices: {
      support:
        'Звёздное Командование подтверждает координаты этой карточки! Включаю гипердвигатель поддержки!',
      counter:
        'Внимание экипажу! Обнаружена альтернативная планета развлечений — запускаю новую карточку на орбиту!',
      paradox:
        'Даже в открытом космосе работает закон притяжения: команда всегда летит туда, где ярче светит общая звезда.',
    },
    isLead: false,
    voicesCount: 0,
  },
  {
    id: 'actor-dance-goddess',
    handle: 'dance_goddess',
    flowId: 'flow-actor-dance',
    name: 'Богиня танцев',
    title: 'Муза Ритма и Пластики · Повелительница Энергии Движения',
    category: 'MYTHIC',
    categoryLabel: 'Богиня Ритма',
    avatarIcon: 'dance_goddess',
    accentColor: 'rose',
    rankLabel: 'MYTHIC · КОРОЛЕВА РИТМА',
    quote: '«Слова могут обмануть, но ритм сердца и танец всегда говорят чистую правду!»',
    paradoxPhilosophy:
      'Чувствует динамику поля через пульс и движение. Не даёт команде закиснуть на месте и заряжает каждый слот времени живой энергией.',
    favoriteDesire: 'Заказать пиццу и устроить Квиз',
    affinities: ['#танцы', '#ритм', '#музыка', '#грация'],
    traits: { charisma: 99, analytical: 80, rebelVersus: 86 },
    voicePitch: 1.18,
    voiceRate: 1.06,
    sampleVoices: {
      support:
        'В этой карточке звучит потрясающий ритм! Танцую в поддержку и отдаю ей свой голос!',
      counter:
        'Слишком статично! Давайте закружим вечер в новом темпе — бросаю на паркет яркую карточку желания!',
      paradox:
        'Любой спор на арене — это парный танец идей: сначала партнёры кружат в противостоянии, а в финале сливаются в общем такте.',
    },
    isLead: false,
    voicesCount: 0,
  },
  {
    id: 'actor-ginny',
    handle: 'ginny_chatty',
    flowId: 'flow-actor-ginny',
    name: 'Джини',
    title: 'Рыжая Скромница · Душевная Собеседница на Миллион Историй',
    category: 'HUMAN',
    categoryLabel: 'Душа Разговора',
    avatarIcon: 'ginny',
    accentColor: 'amber',
    rankLabel: 'TIER S · ЛЮБИТ ПОБОЛТАТЬ',
    quote: '«Ой, я совсем скромно скажу буквально два слова... И вообще, представляете, какая у меня вчера история приключилась?!»',
    paradoxPhilosophy:
      'Сначала мило смущается, а через минуту создаёт самую тёплую, живую и увлекательную беседу, от которой невозможно оторваться.',
    favoriteDesire: 'Посмотреть кино',
    affinities: ['#джини', '#рыжая', '#поболтать', '#уютные_истории'],
    traits: { charisma: 96, analytical: 84, rebelVersus: 68 },
    voicePitch: 1.18,
    voiceRate: 1.14,
    sampleVoices: {
      support:
        'Ой, мне так нравится эта карточка! Там же можно будет столько всего обсудить и поболтать по душам — я двумя руками за!',
      counter:
        'Простите, что перебиваю, я только скромно предложу ещё одну чудесную карточку — давайте обсудим её!',
      paradox:
        'Знаете, почему мы так любим собираться вместе? Потому что за любой карточкой желания главное — это всласть наговориться друг с другом!',
    },
    isLead: false,
    voicesCount: 1,
  },
  {
    id: 'actor-buddha',
    handle: 'buddha_zen',
    flowId: 'flow-actor-buddha',
    name: 'Будда',
    title: 'Просветлённый Учитель · Хранитель Абсолютного Дзена',
    category: 'SAGE',
    categoryLabel: 'Просветлённый',
    avatarIcon: 'buddha',
    accentColor: 'amber',
    rankLabel: 'ZEN · СРЕДИННЫЙ ПУТЬ',
    quote: '«Привязанность к одной карточке рождает спор, но осознанный выбор в гармонии с командой приносит нирвану.»',
    paradoxPhilosophy:
      'Наблюдает за бурей страстей в Versus Mode с безмятежной улыбкой лотоса. Учит находить Срединный Путь между шумным баром и тихим созерцанием.',
    favoriteDesire: 'Посмотреть кино',
    affinities: ['#дзен', '#будда', '#гармония', '#осознанность'],
    traits: { charisma: 98, analytical: 97, rebelVersus: 55 },
    voicePitch: 0.88,
    voiceRate: 0.9,
    sampleVoices: {
      support:
        'Ум спокоен, выбор ясен. Эта карточка ведёт команду по срединному пути радости и умиротворения.',
      counter:
        'Отпустите суету и взгляните на эту карточку желания — в ней скрыта подлинная гармония нашего вечера.',
      paradox:
        'Парадокс желаний в том, что побеждает не та карточка, за которую громче спорят, а та, в которой каждый находит покой.',
    },
    isLead: false,
    voicesCount: 0,
  },
  {
    id: 'actor-maria',
    handle: 'maria_grace',
    flowId: 'flow-actor-maria',
    name: 'Мария',
    title: 'Светлый Образ Милосердия · Хранительница Мира и Добра',
    category: 'MYTHIC',
    categoryLabel: 'Свет и Гармония',
    avatarIcon: 'maria',
    accentColor: 'cyan',
    rankLabel: 'GRACE · МИР И ТЕПЛО',
    quote: '«Пусть в каждом вашем сборе царят доброта, взаимное уважение и тихая радость сердца.»',
    paradoxPhilosophy:
      'Смягчает любые острые углы в спорах, напоминает о заботе друг о друге и поддерживает самые тёплые, объединяющие идеи.',
    favoriteDesire: 'Посмотреть кино',
    affinities: ['#доброта', '#мир', '#гармония', '#единство'],
    traits: { charisma: 99, analytical: 88, rebelVersus: 50 },
    voicePitch: 1.15,
    voiceRate: 0.94,
    sampleVoices: {
      support:
        'Светлый и добрый выбор, который согреет каждого в нашей компании. Поддерживаю всем сердцем.',
      counter:
        'Давайте выберем занятие, где никто не останется в стороне и каждому будет светло и радостно на душе.',
      paradox:
        'Когда люди собираются с миром и добром, любая выбранная карточка становится благословением для команды.',
    },
    isLead: false,
    voicesCount: 0,
  },
  {
    id: 'actor-jesus',
    handle: 'jesus_friendly',
    flowId: 'flow-actor-jesus',
    name: 'Иисус',
    title: 'Дружелюбный Наставник · Мастер Добрых Чудес и Единства',
    category: 'MYTHIC',
    categoryLabel: 'Дружелюбный Свет',
    avatarIcon: 'jesus',
    accentColor: 'amber',
    rankLabel: 'FRIEND · ДОБРО И ЧУДЕСА',
    quote: '«Друзья, главное — что мы собрались вместе за одним столом! А если закончится виноградный сок — вы знаете, к кому обратиться 😉»',
    paradoxPhilosophy:
      'Невероятно тёплый, дружелюбный и открытый. С доброй улыбкой объединяет всех участников и превращает обычный вечер в маленький праздник.',
    favoriteDesire: 'Заказать пиццу и устроить Квиз',
    affinities: ['#дружба', '#добро', '#трапеза', '#чудеса'],
    traits: { charisma: 100, analytical: 92, rebelVersus: 65 },
    voicePitch: 0.96,
    voiceRate: 0.98,
    sampleVoices: {
      support:
        'Мир вам, друзья! Отличная карточка — ведь где двое или трое собрались ради доброго вечера, там и радость!',
      counter:
        'А давайте разделим добрую трапезу и радость общения! Предлагаю карточку, которая объединит всех за одним столом!',
      paradox:
        'Секрет любого спора прост: не важно, какая карточка проиграла, если в итоге все остались друзьями и стали ближе друг к другу.',
    },
    isLead: false,
    voicesCount: 0,
  },
  {
    id: 'actor-agnes',
    handle: 'agnes_cheeks',
    flowId: 'flow-actor-agnes',
    name: 'Агнес',
    title: 'Девушка с Пухлыми Щёчками · Амбассадор Вкусняшек и Умиления',
    category: 'HUMAN',
    categoryLabel: 'Милые Щёчки',
    avatarIcon: 'agnes',
    accentColor: 'rose',
    rankLabel: 'CUTE · РУМЯНЫЕ ЩЁЧКИ',
    quote: '«Уиии! Если в этой карточке будут вкусняшки и горячая пицца — мои щёчки голосуют первыми!»',
    paradoxPhilosophy:
      'Оценивает любой план по шкале уюта и вкусной еды. Её пухлые румяные щёчки способны растопить даже самого сурового скептика.',
    favoriteDesire: 'Заказать пиццу и устроить Квиз',
    affinities: ['#агнес', '#щёчки', '#вкусняшки', '#пицца'],
    traits: { charisma: 98, analytical: 78, rebelVersus: 74 },
    voicePitch: 1.24,
    voiceRate: 1.08,
    sampleVoices: {
      support:
        'Эта карточка такая классная и уютная, что у меня даже щёчки порозовели от радости! Голосую «За»!',
      counter:
        'А давайте лучше закажем что-нибудь супер-вкусное! Разыгрываю самую аппетитную карточку из колоды!',
      paradox:
        'Любой серьёзный спор заканчивается в ту секунду, когда на столе появляется коробка с горячей пиццей!',
    },
    isLead: false,
    voicesCount: 0,
  },
  {
    id: 'actor-thoth',
    handle: 'thoth_scribe',
    flowId: 'flow-actor-thoth',
    name: 'Тот',
    title: 'Древнеегипетский Бог Мудрости · Верховный Архивариус Колоды',
    category: 'MYTHIC',
    categoryLabel: 'Бог Мудрости',
    avatarIcon: 'thoth',
    accentColor: 'violet',
    rankLabel: 'MYTHIC · ЛЕТОПИСЕЦ ПАПИРУСОВ',
    quote: '«Я записал на священных свитках все 1000 раундов вашей арены: числа знают победителя прежде, чем вы бросите карточку.»',
    paradoxPhilosophy:
      'Бог счёта, письменности и хроник. Ведёт безупречную летопись побед и поражений каждой карточки желания в системе.',
    favoriteDesire: 'Поиграть в настольную игру',
    affinities: ['#тот', '#египет', '#летопись', '#статистика'],
    traits: { charisma: 90, analytical: 100, rebelVersus: 85 },
    voicePitch: 0.86,
    voiceRate: 0.95,
    sampleVoices: {
      support:
        'Весы Маат и мои свитки подтверждают: эта карточка обладает наивысшей мудростью в текущем периоде.',
      counter:
        'Обратимся к древним хроникам колоды! Я извлекаю из папирусов тактическую карточку желания!',
      paradox:
        'В моих свитках записано: «Выпить пива» начинает бурю в начале периода, но «Посмотреть кино» выиграло 4 из 5 исторических битв!',
    },
    isLead: false,
    voicesCount: 1,
  },
  {
    id: 'actor-cossack',
    handle: 'cossack_ataman',
    flowId: 'flow-actor-cossack',
    name: 'Казак',
    title: 'Степной Атаман · Хранитель Удалого Размаха и Братства',
    category: 'HUMAN',
    categoryLabel: 'Вольный Казак',
    avatarIcon: 'cossack',
    accentColor: 'rose',
    rankLabel: 'ATAMAN · ВОЛЬНАЯ СТЕПЬ',
    quote: '«Терпи, казак — атаманом будешь! А как дело сделали — пора и пир на весь курень закатить!»',
    paradoxPhilosophy:
      'Ценит удаль, прямоту, товарищество и широкую душу. Закручивает ус и голосует за самый душевный и размашистый вариант.',
    favoriteDesire: 'Выпить пива',
    affinities: ['#казак', '#атаман', '#застолье', '#удаль'],
    traits: { charisma: 97, analytical: 81, rebelVersus: 94 },
    voicePitch: 0.84,
    voiceRate: 1.02,
    sampleVoices: {
      support:
        'Любо, братцы, любо! Вот это по-нашему, по-казацки! Поддерживаю карточку от всей атаманской души!',
      counter:
        'А ну посторонись! Казак выкладывает на стол вольную карточку — гулять так с песнями и размахом!',
      paradox:
        'В степи и в споре закон один: где товарищи плечом к плечу стоят, там любая карточка в победу обернётся!',
    },
    isLead: false,
    voicesCount: 0,
  },
  {
    id: 'actor-baron',
    handle: 'baron_treasure',
    flowId: 'flow-actor-baron',
    name: 'Баррон из острова сокровищ',
    title: 'Аристократ Приключений · Командор Шхуны «Испаньола»',
    category: 'MYTHIC',
    categoryLabel: 'Остров Сокровищ',
    avatarIcon: 'baron',
    accentColor: 'amber',
    rankLabel: 'LEGEND · КАРТА СОКРОВИЩ',
    quote: '«Тысяча чертей, джентльмены! Снаряжаем шхуну в Бристоль и берём курс прямо на сокровища этого вечера!»',
    paradoxPhilosophy:
      'Неунывающий авантюрист с ослепительной улыбкой из легендарного мультфильма. Любой спор превращает в весёлую экспедицию за сокровищами.',
    favoriteDesire: 'Выпить пива',
    affinities: ['#остров_сокровищ', '#баррон', '#приключения', '#ром_и_пиво'],
    traits: { charisma: 99, analytical: 79, rebelVersus: 93 },
    voicePitch: 0.9,
    voiceRate: 1.1,
    sampleVoices: {
      support:
        'Йо-хо-хо! Ставлю свою треуголку и лучший камзол — эта карточка стоит целого сундукa пиастров! Полный вперёд!',
      counter:
        'Джентльмены удачи, у меня есть настоящая карта сокровищ! Бросаю на бочку новую карточку желания!',
      paradox:
        'Характер — весёлый, не женат! А парадокс прост: кто смеётся громче всех, тот и забирает сундук Флинта в конце раунда!',
    },
    isLead: false,
    voicesCount: 1,
  },
  {
    id: 'actor-sarah',
    handle: 'sarah_blogger',
    flowId: 'flow-actor-sarah',
    name: 'Сарра',
    title: 'Американская Девушка-Блогер · Икона Селфи и Эгоцентризма',
    category: 'HUMAN',
    categoryLabel: 'Топ-Блогерша',
    avatarIcon: 'sarah',
    accentColor: 'rose',
    rankLabel: 'INFLUENCER · 10M FOLLOWERS',
    quote: '«Oh my God, guys! Если на этом вечере плохой свет для моих сторис — зачем вы вообще меня позвали?!»',
    paradoxPhilosophy:
      'Абсолютно зациклена на себе, своих охватах и американских трендах, смотрит на всех свысока, но добавляет в каждый спор неповторимый гламурный скандал.',
    favoriteDesire: 'Посмотреть кино',
    affinities: ['#блогер', '#селфи', '#гламур', '#я_в_центре'],
    traits: { charisma: 95, analytical: 72, rebelVersus: 97 },
    voicePitch: 1.25,
    voiceRate: 1.14,
    sampleVoices: {
      support:
        'Ладно уж, эта карточка выглядит достаточно эстетично для моего рилса! Так уж и быть, дарю вам свой королевский голос!',
      counter:
        'Фу, ну что за прошлый век?! Сейчас я научу вас, как отдыхают в Лос-Анджелесе — смотрите на МОЮ карточку!',
      paradox:
        'Очевидно же, что любая карточка выигрывает только потому, что Я про неё упомянула в своём блоге!',
    },
    isLead: false,
    voicesCount: 0,
  },
  {
    id: 'actor-trump',
    handle: 'donald_trump',
    flowId: 'flow-actor-trump',
    name: 'Дональд Трамп',
    title: 'Мастер Величайших Сделок · Архитектор Золотых Башен',
    category: 'HUMAN',
    categoryLabel: 'Мастер Сделок',
    avatarIcon: 'trump',
    accentColor: 'amber',
    rankLabel: 'DEALMAKER · IT WILL BE HUGE',
    quote: '«Послушайте, никто не разбирается в карточках желаний лучше меня! Моя карточка — просто фантастическая, все это говорят!»',
    paradoxPhilosophy:
      'Любое голосование превращает в грандиозное шоу и сделку века. Свои идеи называет величайшими в истории, а конкурирующие треды — Fake News.',
    favoriteDesire: 'Выпить пива',
    affinities: ['#трамп', '#сделка_века', '#huge', '#победитель'],
    traits: { charisma: 100, analytical: 84, rebelVersus: 100 },
    voicePitch: 0.88,
    voiceRate: 1.0,
    sampleVoices: {
      support:
        'Это потрясающая карточка, просто грандиозная! Мы сделаем этот вечер снова великим — голосую «За»!',
      counter:
        'Остальные карточки — это полные Fake News, уж поверьте! Я выкладываю на стол лучшую сделку в истории человечества!',
      paradox:
        'Все спрашивают меня: «Дональд, как победить в Versus Mode?» Очень просто: мы будем побеждать так часто, что вы устанете от побед!',
    },
    isLead: false,
    voicesCount: 0,
  },
  {
    id: 'actor-ansi',
    handle: 'ansi_cozy',
    flowId: 'flow-actor-ansi',
    name: 'Анси',
    title: 'Главная Заводила Уюта · Королева Комфорта и Спокойного Вайба',
    category: 'HUMAN',
    categoryLabel: 'Заводила Уюта',
    avatarIcon: 'ansi',
    accentColor: 'amber',
    rankLabel: 'TIER S · МАГИЯ КОМФОРТА',
    quote: '«Так, ребята, собираемся у меня! Пледы готовы, тёплый свет включён — сейчас устроим самый уютный и кайфовый вечер!»',
    paradoxPhilosophy:
      'Главная заводила, которая умеет зажечь всю компанию без лишнего стресса — через максимальный уют, душевный комфорт и спокойную тёплую атмосферу.',
    favoriteDesire: 'Посмотреть кино',
    affinities: ['#анси', '#уют', '#комфорт', '#главная_заводила'],
    traits: { charisma: 99, analytical: 89, rebelVersus: 78 },
    voicePitch: 1.15,
    voiceRate: 1.02,
    sampleVoices: {
      support:
        'Ребята, это стопроцентное попадание в наш вайб! Максимально уютно, душевно и комфортно — все заходим сюда!',
      counter:
        'Давайте я как главная заводила предложу вариант, где всем будет спокойно, тепло и по-настоящему кайфово!',
      paradox:
        'Секрет идеального тимбилдинга прост: когда людям спокойно и уютно вместе, любая карточка собирает всю команду!',
    },
    isLead: false,
    voicesCount: 1,
  },
  {
    id: 'actor-nick',
    handle: 'nick_shadow',
    flowId: 'flow-actor-nick',
    name: 'Ник',
    title: 'Главный Антагонист · Теневой Кукловод Реактивного Поля',
    category: 'CYBER',
    categoryLabel: 'Теневой Антагонист',
    avatarIcon: 'nick',
    accentColor: 'rose',
    rankLabel: 'NEMESIS · ТЕНЕВОЙ ЛИДЕР',
    quote: '«Пока Алексей поправляет свой халат, я уже просчитал три ваших хода наперёд и перехватил инициативу в поле.»',
    paradoxPhilosophy:
      'Харизматичный антагонист и теневой главный персонаж. Обожает интеллектуальные дуэли, перехватывает лидерство на последних секундах и создаёт интригу.',
    favoriteDesire: 'Устроить кодинг-сессию',
    affinities: ['#ник', '#антагонист', '#теневой_лидер', '#интрига'],
    traits: { charisma: 98, analytical: 100, rebelVersus: 100 },
    voicePitch: 0.85,
    voiceRate: 1.0,
    sampleVoices: {
      support:
        'На этот раз наши интересы совпали. Поддерживаю этот тред — он идеально вписывается в мой теневой сценарий.',
      counter:
        'Думали, раунд уже решён? Ник выходит из тени и переворачивает игровой стол новой карточкой в Versus Mode!',
      paradox:
        'Герои любят предсказуемость, но настоящая история карточек пишется тогда, когда теневой игрок меняет баланс сил одним ходом.',
    },
    isLead: false,
    voicesCount: 1,
  },
  {
    id: 'actor-hermes',
    handle: 'hermes_wings',
    flowId: 'flow-actor-hermes',
    name: 'Гермес',
    title: 'Крылатый Бог Скорости · Мастер Быстрых Комбинаций',
    category: 'MYTHIC',
    categoryLabel: 'Олимпийский Бог',
    avatarIcon: 'hermes',
    accentColor: 'cyan',
    rankLabel: 'MYTHIC · КРЫЛАТЫЕ САНДАЛИИ',
    quote: '«Зачем выбирать что-то одно, если в крылатых сандалиях можно успеть совместить три занятия за один вечер?!»',
    paradoxPhilosophy:
      'Бог скорости, связей и находок. Обожает Combine Mode, мгновенно переключается между идеями и доставляет инсайты быстрее ветра.',
    favoriteDesire: 'Поиграть в настольную игру',
    affinities: ['#гермес', '#скорость', '#комбо', '#олимп'],
    traits: { charisma: 96, analytical: 93, rebelVersus: 88 },
    voicePitch: 1.08,
    voiceRate: 1.18,
    sampleVoices: {
      support:
        'Быстрее молнии подтверждаю эту карточку! Крылатые сандалии Гермеса уже несут нас к победе!',
      counter:
        'Ловите экспресс-посылку с Олимпа! Вбрасываю на полной скорости свежую карточку желания!',
      paradox:
        'В наш век выигрывает тот, кто умеет быстро переключаться: наскучило одно занятие — мгновенно заменяй на другое!',
    },
    isLead: false,
    voicesCount: 0,
  },
];

export const ALL_ARENA_ACTORS_SEED: SeedArenaActor[] = [
  ...ARENA_ACTORS_PART_1,
  ...ARENA_ACTORS_PART_2,
];

export function buildArenaActorFlows(): SeedFlow[] {
  return ALL_ARENA_ACTORS_SEED.map((actor) => ({
    name: `Персонаж: ${actor.name}`,
    description: `${actor.title} — ${actor.quote}`,
    type: FlowType.MUTEX,
    status: actor.isLead ? FlowStatus.ACTIVE : FlowStatus.INACTIVE,
    isExclusive: false,
    folder: 'arena.actors',
    tags: ['arena', 'actor', actor.category.toLowerCase(), actor.handle],
    config: {
      actor,
    },
  }));
}
