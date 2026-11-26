// 모듈·레벨·과제·완료 단위 정의표
// 학습 콘텐츠(문제 출제, 지판 표시 등)는 2단계 이후 각 모듈에서 구현함
// 이 파일은 세션 기록과 학습일지가 사용하는 "목록"만 정의함

// 완료 단위 종류
// cycle   : 정해진 순환을 한 바퀴 돌면 1회 (예: 12개 음 1순환)
// count   : 정해진 문제 수를 풀면 1회 (예: 24문제)
// blocks  : 정해진 블록 수를 한 사이클 돌면 1회 (예: 5개 블록)
// mission : 과제별로 정한 미션을 완료하면 1회
export const UNIT = {
  noteCycle: { kind: "cycle", size: 12, label: "12개 음 1순환 = 1회" },
  ear24: { kind: "count", size: 24, label: "24문제 = 1회" },
  ear10: { kind: "count", size: 10, label: "10문제 = 1회" },
  ear5: { kind: "count", size: 5, label: "프레이즈 5개 = 1회" },
  blocks5: { kind: "blocks", size: 5, label: "5개 블록 1사이클 = 1회" },
  positions7: { kind: "positions", size: 7, label: "7개 포지션 1사이클 = 1회" },
  mission: { kind: "mission", size: 1, label: "과제 미션 완료 = 1회" },
  shapeCycle: { kind: "blocks", size: 0, label: "모든 블록(모드는 포지션 7개) 1사이클 = 1회" },
  root12: { kind: "cycle", size: 12, label: "12개 근음 1순환 = 1회" },
  allDegrees: { kind: "count", size: 0, label: "스케일의 모든 음에서 1번씩 시작 = 1회" },
  modeCycle: { kind: "cycle", size: 0, label: "고른 모드 1순환 = 1회" },
  keys12: { kind: "cycle", size: 12, label: "12개 키 확인 = 1회" },
  none: { kind: "none", size: 0, label: "근음·코드 종류별 자주 쓰는 운지 검색 · 기록 없음" },
  listOnly: { kind: "none", size: 0, label: "목록 보기·좋음/삭제 후보 표시 · 기록 없음" },
  licks10: { kind: "count", size: 10, label: "릭 10개 = 1회" },
  pattern8: { kind: "mission", size: 1, label: "패턴 1개를 8마디(같이·혼자 치기) = 1회" },
  reading10: { kind: "count", size: 10, label: "10문제 = 1회" },
  tech3: { kind: "mission", size: 3, label: "박자 판정 통과 3회 = 1회" },
  phrase8: { kind: "mission", size: 1, label: "프레이즈 1개를 8마디(같이·혼자 치기) = 1회" }
};

// 세션 유형
export const SESSION_TYPES = {
  finding: "찾기",
  bpm: "연속 찾기",
  play: "연주",
  block: "블록 연습",
  scale: "스케일 연습",
  pattern: "패턴 연습",
  ear: "청음",
  transcribe: "채보",
  reference: "사전",
  lick: "릭 연습",
  technique: "테크닉"
};

const CHORD_TASKS = [
  { id: "random-chord", name: "Random Chord Finding", type: "finding", unit: UNIT.mission },
  { id: "bpm-chord", name: "연속 코드 찾기 · Sequential Chord Finding", type: "bpm", unit: UNIT.mission },
  { id: "play-session", name: "Play Session", type: "play", unit: UNIT.mission },
  { id: "chord-dictionary", name: "Chord Dictionary", type: "reference", unit: UNIT.none, reference: true }
];

// Scales: 레벨 = 스케일 종류, 과제 = 숙련 단계(모양 → 근음 위치(무작위·4도·반음) → 시작음 → (모드 전환) → 블록 연결 → 화성 적용)
// 구체적인 스케일은 학습 주제로 고름
function scaleTasks({ modes = false, apply = true } = {}) {
  const w = modes ? "포지션" : "블록";
  return [
    { id: "shape-learning", name: "기본 모양 익히기 · Shape Learning", type: "scale", unit: UNIT.shapeCycle },
    { id: "shape-root", name: "근음 위치 익히기 · Root Position", type: "scale", unit: UNIT.root12 },
    { id: "start-note", name: "시작음 바꿔 치기 · Start Note", type: "finding", unit: UNIT.allDegrees },
    ...(modes ? [{ id: "mode-switch", name: "모드 전환 · Mode Switch", type: "scale", unit: UNIT.modeCycle }] : []),
    { id: "neck-transition", name: `${w} 연결 · ${modes ? "Position" : "Block"} Transition`, type: "scale", unit: UNIT.mission },
    ...(apply ? [{ id: "chord-scale", name: "코드 전환하며 익히기 · Chord-Scale", type: "play", unit: { kind: "mission", size: 1, label: "진행 2바퀴 = 1회" } }] : [])
  ];
}

// 이전 구성(v1.7.0까지)의 레벨·과제 이름: 학습일지에 남은 기록 표시용
const LEGACY_SCALE_LEVELS = { s1: "S1", s2: "S2", s3: "S3", s4: "S4", s5: "S5", s6: "S6" };
// Rhythm: 예전 R3 Picking은 Technique 모듈로 옮김(기록 표시용)
const LEGACY_RHYTHM = { levels: { r3: "R3 Picking (Technique로 이동)" }, tasks: { picking: "피킹 연습 (Technique로 이동)" } };
const LEGACY_SCALE_TASKS = {
  "interval-finding": "Scale Interval Finding",
  "block-learning": "Block Scale Learning",
  "block-transition": "Block Transition Practice",
  "block-root": "Block + Root Memorization",
  "root-cycle": "근음 이동하며 익히기 · Root Cycle"
};

// Licks: 레벨 = 릭 분류, 학습 주제 = 하위 분류
export const LICK_LEVELS = [
  { id: "l1", name: "L1 Pentatonic & Blues", desc: "마이너·메이저 펜타토닉, 블루스 스케일, 메이저·마이너 혼합", subs: [["minor-penta", "마이너 펜타토닉"], ["major-penta", "메이저 펜타토닉"], ["blues", "블루스 스케일"], ["mixed", "메이저·마이너 혼합"]] },
  { id: "l2", name: "L2 Major & Minor", desc: "메이저, 내추럴 마이너, 하모닉 마이너", subs: [["major", "메이저"], ["natural-minor", "내추럴 마이너"], ["harmonic-minor", "하모닉 마이너"]] },
  { id: "l3", name: "L3 Mode Colors", desc: "도리안 6 · 믹솔리디안 ♭7 · 리디안 ♯4 · 프리지안 ♭2 색깔음", subs: [["dorian", "Dorian"], ["mixolydian", "Mixolydian"], ["lydian", "Lydian"], ["phrygian", "Phrygian"]] },
  { id: "l4", name: "L4 Progressions", desc: "메이저 ii–V–I, 마이너 ii–V–i(♭9♭13·얼터드), V7 → I", subs: [["major-251", "메이저 ii–V–I"], ["minor-251", "마이너 ii–V–i"], ["v-i", "V7 → I"]] },
  { id: "l5", name: "L5 Chord Tones", desc: "코드톤·아르페지오, 두 코드 연결", subs: [["arpeggio", "한 코드 아르페지오"], ["two-chord", "두 코드 연결"]] },
  { id: "l6", name: "L6 Blues Forms", desc: "12마디 블루스의 인트로, IV 전환, 턴어라운드, 엔딩, 셔플", subs: [["intro", "인트로"], ["iv-change", "IV 전환"], ["turnaround", "턴어라운드"], ["ending", "엔딩"], ["shuffle", "셔플 리프·필인"]] },
  { id: "l7", name: "L7 My Licks", desc: "유튜브·교재 등에서 배운 릭을 직접 입력해 같은 방식으로 연습", subs: [["my", "내 릭"]] }
];
const LICK_TASKS = [
  { id: "lick-learn", name: "릭 익히기 · Lick Learning", type: "lick", unit: UNIT.licks10 },
  { id: "lick-list", name: "릭 목록·표시 · Lick List", type: "reference", unit: UNIT.listOnly, reference: true },
  { id: "lick-move", name: "키·구간 옮기기 · Transpose", type: "finding", unit: { kind: "count", size: 10, label: "10개 = 1회" } },
  { id: "lick-backing", name: "백킹 위에 주고받기 · Call & Response", type: "play", unit: { kind: "count", size: 4, label: "릭 4개 주고받기 = 1회" } },
  { id: "lick-vary", name: "변형하기 · Variation", type: "finding", unit: { kind: "count", size: 10, label: "10개 = 1회" } }
];

const MY_LICK_TASKS = [
  { id: "my-edit", name: "릭 입력·편집 · My Lick Editor", type: "reference", unit: UNIT.listOnly, reference: true },
  ...LICK_TASKS
];

const PLAY_TASKS = [
  CHORD_TASKS.find(t => t.id === "play-session"),
  { id: "genre-comping", name: "장르별 컴핑 · Genre Comping", type: "play", unit: { kind: "mission", size: 1, label: "진행 2바퀴 = 1회" } },
  { id: "chord-melody", name: "코드 멜로디 · Chord Melody", type: "play", unit: { kind: "mission", size: 1, label: "곡 끝까지 따라 치기 = 1회" } },
  CHORD_TASKS.find(t => t.id === "chord-dictionary")
];

export const MODULES = [
  {
    id: "notes",
    name: "Notes",
    sub: "지판 음 위치 찾기",
    stage: 2,
    levels: [
      {
        id: "n1", name: "N1 무작위 3~4현", desc: "지정된 현에서 음 위치 찾기",
        tasks: [{ id: "note-finder", name: "Note Finder", type: "finding", unit: UNIT.noteCycle, implemented: true }]
      },
      {
        id: "n2", name: "N2 전체 6현", desc: "6현 전체(0~15프렛) 음 위치 찾기",
        tasks: [{ id: "note-finder", name: "Note Finder", type: "finding", unit: UNIT.noteCycle, implemented: true }]
      }
    ]
  },
  {
    id: "chords",
    name: "Chords",
    sub: "코드 형태 · 보이싱 · 진행",
    stage: 3,
    levels: [
      { id: "c1", name: "C1 초급", desc: "오픈 코드, 메이저·마이너 트라이어드, 파워 코드", tasks: CHORD_TASKS },
      { id: "c2", name: "C2 중급", desc: "바레·이동형 코드, 디미니시드·어그먼티드·서스펜디드, 트라이어드 전위, 현 그룹별 트라이어드·트라이어드 매핑, CAGED, 7th 코드", tasks: CHORD_TASKS },
      { id: "c3", name: "C3 상급", desc: "7th 코드 전위, Shell Voicing, Drop 2·Drop 3, 9th·11th·13th 텐션", tasks: CHORD_TASKS },
      { id: "c4", name: "C4 고급", desc: "대리 코드, 슬래시 코드, Open·Quartal Voicing", tasks: CHORD_TASKS },
      { id: "c5", name: "C5 응용", desc: "보이스 리딩(Play Session), 장르별 컴핑, 코드 멜로디", tasks: PLAY_TASKS }
    ]
  },
  {
    id: "rhythm",
    name: "Rhythm",
    sub: "스트로크 · 컴핑 · 핑거 · 퍼커시브 · 프레이즈",
    stage: 5,
    levels: [
      {
        id: "r1", name: "R1 Strumming", desc: "4·8·16비트, 다운·업, 악센트, 뮤트, 쉼표, 싱코페이션, 셔플, 장르별 스트로크, 리듬 읽기",
        tasks: [
          { id: "strum-pattern", name: "스트로크 패턴 · Strum Patterns", type: "pattern", unit: UNIT.pattern8 },
          { id: "rhythm-reading", name: "리듬 읽기 · Rhythm Reading", type: "finding", unit: UNIT.reading10 }
        ]
      },
      {
        id: "r2", name: "R2 Comping · Fingerstyle · Percussive", desc: "코드 리듬·커팅·뮤트·싱코페이션 컴핑, 아르페지오·베이스+코드, 바디 타격·스트링 히트·팜뮤트",
        tasks: [
          { id: "comping", name: "컴핑 리듬 · Comping", type: "pattern", unit: UNIT.pattern8 },
          { id: "fingerstyle", name: "핑거스타일 · Fingerstyle", type: "pattern", unit: UNIT.pattern8 },
          { id: "percussive", name: "퍼커시브 · Percussive", type: "pattern", unit: UNIT.pattern8 }
        ]
      },
      {
        id: "r4", name: "R3 Rhythm Phrases", desc: "리프, 싱코페이션 프레이즈, 반복·변형, 코드·스케일 기반 프레이즈",
        tasks: [{ id: "phrase", name: "리듬 프레이즈 · Rhythm Phrases", type: "pattern", unit: UNIT.phrase8 }]
      }
    ]
  },
  {
    id: "scales",
    name: "Scales",
    sub: "펜타 · 메이저/마이너 · 모드 · 코드톤",
    stage: 4,
    levels: [
      { id: "pb", name: "S1 Pentatonic & Blues", desc: "메이저·마이너 펜타토닉, 블루스 스케일", tasks: scaleTasks() },
      { id: "mm", name: "S2 Major & Minor Family", desc: "메이저, 내추럴·하모닉·멜로딕 마이너", tasks: scaleTasks() },
      { id: "md", name: "S3 Modes", desc: "7개 모드, 시작음 기준 7개 포지션", tasks: scaleTasks({ modes: true }) },
      { id: "ct", name: "S4 Chord Tones", desc: "코드톤(아르페지오)과 스케일의 관계", tasks: scaleTasks({ apply: false }) }
    ]
  },
  {
    id: "licks",
    name: "Licks",
    sub: "펜타 · 메이저/마이너 · 모드 · 진행 · 코드톤 · 블루스",
    stage: 5,
    levels: LICK_LEVELS.map(l => ({ id: l.id, name: l.name, desc: l.desc, tasks: l.id === "l7" ? MY_LICK_TASKS : LICK_TASKS }))
  },
  {
    id: "technique",
    name: "Technique",
    sub: "왼손 · 벤딩 · 피킹 · 뮤팅 · 템포 사다리",
    stage: 6,
    levels: [
      { id: "t1", name: "T1 Fretting Hand", desc: "크로매틱, 스파이더, 손가락 독립, 넓혀 짚기, 자리 옮기기", tasks: [{ id: "drill", name: "템포 사다리 · Tempo Ladder", type: "technique", unit: UNIT.tech3 }] },
      { id: "t2", name: "T2 Bending · Vibrato", desc: "반음·온음 벤딩, 벤딩 섞기, 비브라토", tasks: [{ id: "drill", name: "템포 사다리 · Tempo Ladder", type: "technique", unit: UNIT.tech3 }] },
      { id: "t3", name: "T3 Picking", desc: "얼터네이트, 줄 넘기, 스트링 스킵, 이코노미, 트레몰로, 코드톤·스케일 피킹", tasks: [{ id: "drill", name: "템포 사다리 · Tempo Ladder", type: "technique", unit: UNIT.tech3 }] },
      { id: "t4", name: "T4 Muting · Expression", desc: "팜뮤트, 스타카토, 해머·풀 레가토, 슬라이드", tasks: [{ id: "drill", name: "템포 사다리 · Tempo Ladder", type: "technique", unit: UNIT.tech3 }] },
      { id: "t5", name: "T5 Applied Etudes", desc: "벤딩·리프·시퀀스·레가토·스트링 스킵을 섞은 응용 연습곡", tasks: [{ id: "drill", name: "템포 사다리 · Tempo Ladder", type: "technique", unit: UNIT.tech3 }] }
    ]
  },
  {
    id: "ear",
    name: "Ear Lab",
    sub: "음 이름 · 음정 · 채보",
    stage: 7,
    levels: [
      {
        id: "e1", name: "E1 음 이름 찾기", desc: "단일 음, 샤프·플랫, 음역별 구분, 악기 음색",
        tasks: [{ id: "note-name", name: "음 이름 청음", type: "ear", unit: UNIT.ear24 }]
      },
      {
        id: "e2", name: "E2 음정 찾기", desc: "순차·동시, 상행·하행, 2~7도, 옥타브·복합 음정",
        tasks: [{ id: "interval", name: "음정 청음", type: "ear", unit: UNIT.ear24 }]
      },
      {
        id: "e3", name: "E3 여러 음 청음·채보", desc: "선율(음높이·순서·리듬), 화성(자리바꿈·맨 위 음), 코드 종류·텐션·진행",
        tasks: [
          { id: "melodic", name: "선율 채보", type: "transcribe", unit: UNIT.ear10 },
          { id: "harmonic", name: "화성 청음", type: "ear", unit: UNIT.ear10 },
          { id: "chord-ear", name: "코드 청음", type: "ear", unit: UNIT.ear10 }
        ]
      },
      {
        id: "e4", name: "E4 프레이즈·릭 채보", desc: "앞 4음부터 전체까지 길이 확장, Blues·Rock·Funk·Jazz 릭을 지판에 채보",
        tasks: [{ id: "phrase-transcribe", name: "프레이즈 채보", type: "transcribe", unit: UNIT.ear5 }]
      }
    ]
  }
];

export function findModule(moduleId) {
  return MODULES.find(m => m.id === moduleId) || null;
}

export function findLevel(moduleId, levelId) {
  const m = findModule(moduleId);
  return m ? m.levels.find(l => l.id === levelId) || null : null;
}

export function findTask(moduleId, levelId, taskId) {
  const l = findLevel(moduleId, levelId);
  return l ? l.tasks.find(t => t.id === taskId) || null : null;
}

// 학습일지 표시용 이름 (기록에 남은 id가 목록에서 사라져도 id를 그대로 보여줌)
export function moduleName(id) {
  const m = findModule(id);
  return m ? m.name : id;
}

export function levelName(moduleId, levelId) {
  const l = findLevel(moduleId, levelId);
  if (l) return l.name;
  if (moduleId === "scales" && LEGACY_SCALE_LEVELS[levelId]) return `${LEGACY_SCALE_LEVELS[levelId]} (이전 구성)`;
  if (moduleId === "rhythm" && LEGACY_RHYTHM.levels[levelId]) return LEGACY_RHYTHM.levels[levelId];
  return levelId;
}

export function taskName(moduleId, levelId, taskId) {
  const t = findTask(moduleId, levelId, taskId);
  if (t) return t.name;
  if (moduleId === "scales" && LEGACY_SCALE_TASKS[taskId]) return `${LEGACY_SCALE_TASKS[taskId]} (이전 구성)`;
  if (moduleId === "rhythm" && LEGACY_RHYTHM.tasks[taskId]) return LEGACY_RHYTHM.tasks[taskId];
  if (moduleId === "scales") { for (const lv of findModule("scales").levels) { const x = lv.tasks.find(t => t.id === taskId); if (x) return x.name; } }
  return taskId;
}

export const MODULE_ORDER = MODULES.map(m => m.id);

// ── 학습 주제 (세션 시작 전 선택, 1개 이상 복수 선택 가능) ──
// 레벨 공통 주제. 과제별로 다른 경우는 TASK_TOPICS가 우선함
const tp = list => list.map(([id, name]) => ({ id, name }));

const MODE_LIST = [["ionian", "Ionian"], ["dorian", "Dorian"], ["phrygian", "Phrygian"], ["lydian", "Lydian"], ["mixolydian", "Mixolydian"], ["aeolian", "Aeolian"], ["locrian", "Locrian"]];

const LEVEL_TOPICS = {
  "technique/t1": tp([["chromatic", "크로매틱"], ["spider", "스파이더"], ["independence", "손가락 독립"], ["stretch", "넓혀 짚기"], ["shift", "자리 옮기기"]]),
  "technique/t2": tp([["half-bend", "반음 벤딩"], ["whole-bend", "온음 벤딩"], ["release", "벤딩 섞기"], ["vibrato", "비브라토"]]),
  "technique/t3": tp([["alternate", "얼터네이트"], ["crossing", "줄 넘기"], ["skipping", "스트링 스킵"], ["economy", "이코노미"], ["tremolo", "트레몰로"], ["chord-tone", "코드톤 피킹"], ["scale", "스케일 피킹"]]),
  "technique/t4": tp([["palm-mute", "팜뮤트"], ["staccato", "스타카토"], ["legato", "레가토(해머·풀)"], ["slide", "슬라이드"]]),
  "technique/t5": tp([["etude", "응용 연습곡"]]),
  "chords/c1": tp([["open", "오픈 코드"], ["triad", "메이저·마이너 트라이어드"], ["power", "파워 코드"]]),
  "chords/c2": tp([["barre", "바레·이동형 코드"], ["dim-aug-sus", "디미니시드·어그먼티드·서스펜디드"], ["triad-inversion", "트라이어드 전위"], ["string-set-triad", "현 그룹별 트라이어드"], ["caged", "CAGED"], ["seventh", "7th 코드"]]),
  "chords/c3": tp([["seventh-inversion", "7th 코드 전위"], ["shell", "Shell Voicing"], ["drop2", "Drop 2"], ["drop3", "Drop 3"], ["tension", "텐션(9·11·13)"]]),
  "chords/c4": tp([["substitute", "대리 코드"], ["slash", "슬래시 코드"], ["open-voicing", "Open Voicing"], ["quartal", "Quartal Voicing"]]),
  "chords/c5": tp([["voice-leading", "보이스 리딩"]]),
  ...Object.fromEntries(LICK_LEVELS.map(l => [`licks/${l.id}`, tp(l.subs)])),
  "scales/pb": tp([["minor-penta", "마이너 펜타토닉"], ["major-penta", "메이저 펜타토닉"], ["blues", "블루스 스케일"]]),
  "scales/mm": tp([["major", "메이저"], ["natural-minor", "내추럴 마이너"], ["harmonic-minor", "하모닉 마이너"], ["melodic-minor", "멜로딕 마이너"]]),
  "scales/md": tp(MODE_LIST),
  "scales/ct": tp([["maj", "메이저 코드톤"], ["min", "마이너 코드톤"], ["maj7", "maj7 코드톤"], ["dom7", "7 코드톤"], ["m7", "m7 코드톤"], ["m7b5", "m7♭5 코드톤"]]),
  "rhythm/r1": tp([["4beat", "4비트"], ["8beat", "8비트"], ["16beat", "16비트"], ["accent", "악센트"], ["mute", "뮤트(칙)"], ["rest", "쉼표·끊어치기"], ["syncopation", "싱코페이션"], ["shuffle", "셔플"], ["genre", "장르별"]]),
  "rhythm/r4": tp([["riff", "리프"], ["syncopation", "싱코페이션 프레이즈"], ["repeat-vary", "반복·변형"], ["chord-based", "코드 기반"], ["scale-based", "스케일 기반"]]),
  "ear/e2": tp([["2-3", "2·3도"], ["4-5", "4·5도"], ["6-7", "6·7도"], ["octave-compound", "옥타브·복합 음정"]]),
  "ear/e4": tp([["blues", "Blues"], ["rock", "Rock"], ["funk", "Funk"], ["jazz", "Jazz"]])
};

const TASK_TOPICS = {
  "scales/pb/chord-scale": tp([["blues-minor", "12마디 블루스 · 마이너 펜타 유지"], ["blues-chord", "12마디 블루스 · 코드마다 메이저 펜타"], ["minor-blues", "마이너 블루스"], ["pop-major", "팝 I–V–vi–IV"]]),
  "scales/mm/chord-scale": tp([["major251", "메이저 ii–V–I"], ["1625", "I–vi–ii–V"], ["minor251", "마이너 ii–V–i(내추럴↔하모닉)"], ["minor-blues-nm", "마이너 블루스"]]),
  "scales/md/chord-scale": tp([["251-modes", "ii–V–I 모드 전환"], ["1625-modes", "I–vi–ii–V 모드 전환"], ["dorian-vamp", "도리안 뱀프"], ["mixo-vamp", "믹솔리디안 뱀프"]]),
  "chords/c5/genre-comping": tp([["blues-shuffle", "블루스 셔플"], ["rock-8", "록 8비트"], ["funk-16", "펑크 16비트"], ["jazz-charleston", "재즈 스윙(찰스턴)"], ["jazz-4", "재즈 포 투 더 바"], ["bossa", "보사노바"], ["reggae", "레게 스캥크"], ["pop-strum", "팝 스트럼"]]),
  "chords/c5/chord-melody": tp([["ode-to-joy", "환희의 송가"], ["twinkle", "반짝반짝 작은 별"], ["jingle-bells", "징글벨 후렴"], ["frere-jacques", "프레르 자크"]]),
  "rhythm/r2/comping": tp([["chord-rhythm", "코드 리듬"], ["cutting", "커팅"], ["mute", "뮤트"], ["syncopation", "싱코페이션"]]),
  "rhythm/r2/fingerstyle": tp([["arpeggio", "아르페지오"], ["bass-chord", "베이스+코드(트래비스)"]]),
  "rhythm/r2/percussive": tp([["body-hit", "바디 타격"], ["string-hit", "스트링 히트(슬랩)"], ["palm-mute", "팜뮤트"]]),
  "rhythm/r1/rhythm-reading": tp([["4beat", "4비트"], ["8beat", "8비트"], ["16beat", "16비트"], ["accent", "악센트"], ["mute", "뮤트(칙)"], ["rest", "쉼표·끊어치기"], ["syncopation", "싱코페이션"], ["shuffle", "셔플"]]),
  "ear/e3/chord-ear": tp([["triads", "트라이어드 5종"], ["sevenths", "7th 5종"], ["tensions", "텐션"], ["progressions", "코드 진행"]]),
  "ear/e3/melodic": [],
  "ear/e3/harmonic": []
};

// 과제의 선택 가능한 학습 주제 (없으면 빈 배열 → 주제 선택 없이 시작)
export function topicsFor(moduleId, levelId, taskId) {
  const t = findTask(moduleId, levelId, taskId);
  if (!t || t.reference) return [];
  const k = `${moduleId}/${levelId}/${taskId}`;
  if (k in TASK_TOPICS) return TASK_TOPICS[k];
  return LEVEL_TOPICS[`${moduleId}/${levelId}`] || [];
}

export function topicName(moduleId, levelId, taskId, topicId) {
  const t = topicsFor(moduleId, levelId, taskId).find(x => x.id === topicId);
  return t ? t.name : topicId;
}

export function topicLabel(moduleId, levelId, taskId, ids) {
  return (ids || []).map(id => topicName(moduleId, levelId, taskId, id)).join(" + ");
}
