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
  blocks5: { kind: "blocks", size: 5, label: "5개 블록 1사이클 = 1회" },
  positions7: { kind: "positions", size: 7, label: "7개 포지션 1사이클 = 1회" },
  mission: { kind: "mission", size: 1, label: "과제 미션 완료 = 1회" },
  shapeCycle: { kind: "blocks", size: 0, label: "모든 블록(모드는 포지션 7개) 1사이클 = 1회" },
  root12: { kind: "cycle", size: 12, label: "12개 근음 1순환 = 1회" },
  allDegrees: { kind: "count", size: 0, label: "스케일의 모든 음에서 1번씩 시작 = 1회" },
  modeCycle: { kind: "cycle", size: 0, label: "고른 모드 1순환 = 1회" },
  keys12: { kind: "cycle", size: 12, label: "12개 키 확인 = 1회" },
  none: { kind: "none", size: 0, label: "근음·코드 종류별 자주 쓰는 운지 검색 · 기록 없음" }
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
  reference: "사전"
};

const CHORD_TASKS = [
  { id: "random-chord", name: "Random Chord Finding", type: "finding", unit: UNIT.mission },
  { id: "bpm-chord", name: "연속 코드 찾기 · Sequential Chord Finding", type: "bpm", unit: UNIT.mission },
  { id: "play-session", name: "Play Session", type: "play", unit: UNIT.mission },
  { id: "chord-dictionary", name: "Chord Dictionary", type: "reference", unit: UNIT.none, reference: true }
];

// Scales는 단계별 숙련 순서(S1 모양 → S2 근음 이동 → S3 시작음 → S4 모드 → S5 지판 확장 → S6 화성 적용)
// 스케일 종류는 학습 주제로 고름
const SCALE_LEVEL_TASKS = {
  s1: [
    { id: "shape-learning", name: "Shape Learning · 모양 익히기", type: "scale", unit: UNIT.shapeCycle },
    { id: "shape-root", name: "Shape + Root · 모양과 근음 위치", type: "scale", unit: UNIT.keys12 }
  ],
  s2: [{ id: "root-cycle", name: "Root Cycle · 근음 순환", type: "scale", unit: UNIT.root12 }],
  s3: [{ id: "start-note", name: "Start Note · 시작음 바꿔 치기", type: "finding", unit: UNIT.allDegrees }],
  s4: [{ id: "mode-switch", name: "Mode Switch · 모드 전환", type: "scale", unit: UNIT.modeCycle }],
  s5: [{ id: "neck-transition", name: "Block Transition · 블록 전환", type: "scale", unit: UNIT.mission }],
  s6: [{ id: "chord-scale", name: "Chord-Scale · 화성 위 스케일", type: "play", unit: UNIT.mission }]
};

// 이전 구성(v1.6.x까지)의 과제 이름: 학습일지에 남은 기록 표시용
const LEGACY_SCALE_TASKS = {
  "interval-finding": "Scale Interval Finding",
  "block-learning": "Block Scale Learning",
  "block-transition": "Block Transition Practice",
  "block-root": "Block + Root Memorization"
};

const PLAY_TASKS = CHORD_TASKS.filter(t => t.id === "play-session" || t.id === "chord-dictionary");

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
      { id: "c5", name: "C5 응용", desc: "보이스 리딩, 장르별 컴핑, 코드 멜로디", tasks: PLAY_TASKS }
    ]
  },
  {
    id: "rhythm",
    name: "Rhythm",
    sub: "스트로크 · 컴핑 · 피킹",
    stage: 6,
    levels: [
      {
        id: "r1", name: "R1 Strumming", desc: "4·8·16비트, 다운·업, 뮤트, 쉼표, 악센트, 싱코페이션, 장르별 스트로크",
        tasks: [{ id: "strum-pattern", name: "스트로크 패턴 연습", type: "pattern", unit: UNIT.mission }]
      },
      {
        id: "r2", name: "R2 Comping · Fingerstyle · Percussive", desc: "코드 리듬·커팅·뮤트, 아르페지오·베이스+코드, 바디 타격·팜뮤트·스트링 히트",
        tasks: [
          { id: "comping", name: "컴핑 연습", type: "pattern", unit: UNIT.mission },
          { id: "fingerstyle", name: "핑거스타일 연습", type: "pattern", unit: UNIT.mission },
          { id: "percussive", name: "퍼커시브 연습", type: "pattern", unit: UNIT.mission }
        ]
      },
      {
        id: "r3", name: "R3 Picking", desc: "코드톤·스케일 피킹, 얼터네이트, 스트링 스킵, 포지션 이동",
        tasks: [{ id: "picking", name: "피킹 연습", type: "pattern", unit: UNIT.mission }]
      },
      {
        id: "r4", name: "R4 Rhythm Picking Phrases", desc: "리프, 싱코페이션 프레이즈, 반복·변형, 코드·스케일 기반 프레이즈, 장르별 그루브",
        tasks: [{ id: "phrase", name: "프레이즈 연습", type: "pattern", unit: UNIT.mission }]
      }
    ]
  },
  {
    id: "scales",
    name: "Scales",
    sub: "모양 · 근음 이동 · 시작음 · 모드 · 지판 · 화성",
    stage: 4,
    levels: [
      { id: "s1", name: "S1 기본 숙지", desc: "근음 기준 블록·포지션 모양 익히기(전체 음 → 근음만 → 이름만)", tasks: SCALE_LEVEL_TASKS.s1 },
      { id: "s2", name: "S2 근음 이동", desc: "같은 스케일을 근음만 바꿔 가까운 모양으로 이어 치기(4도·반음·무작위)", tasks: SCALE_LEVEL_TASKS.s2 },
      { id: "s3", name: "S3 시작음 변경", desc: "지정한 줄·음(또는 도수)에서 시작해 한 옥타브 오르내리기", tasks: SCALE_LEVEL_TASKS.s3 },
      { id: "s4", name: "S4 모드 전환", desc: "근음은 그대로 모드만 바꾸기(밝은 순서), 달라진 음 확인", tasks: SCALE_LEVEL_TASKS.s4 },
      { id: "s5", name: "S5 지판 확장", desc: "블록·포지션을 슬라이드로 이어 지판 전체로 넓히기", tasks: SCALE_LEVEL_TASKS.s5 },
      { id: "s6", name: "S6 화성 적용", desc: "코드-스케일 인지, 코드톤 겨냥, 진행 위 연주(반주 음원 단계에서 추가)", tasks: SCALE_LEVEL_TASKS.s6 }
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
        id: "e3", name: "E3 여러 음 청음·채보", desc: "선율(음높이·순서·리듬), 화성(구성음·보이싱), 코드 종류·텐션·진행",
        tasks: [
          { id: "melodic", name: "선율 채보", type: "transcribe", unit: UNIT.mission },
          { id: "harmonic", name: "화성 청음", type: "ear", unit: UNIT.mission },
          { id: "chord-ear", name: "코드 청음", type: "ear", unit: UNIT.mission }
        ]
      },
      {
        id: "e4", name: "E4 프레이즈·릭 채보", desc: "2마디부터 길이 확장, Blues·Rock·Funk·Jazz, 벤딩·슬라이드 등",
        tasks: [{ id: "phrase-transcribe", name: "프레이즈 채보", type: "transcribe", unit: UNIT.mission }]
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
  return l ? l.name : levelId;
}

export function taskName(moduleId, levelId, taskId) {
  const t = findTask(moduleId, levelId, taskId);
  if (t) return t.name;
  if (moduleId === "scales" && LEGACY_SCALE_TASKS[taskId]) return `${LEGACY_SCALE_TASKS[taskId]} (이전 구성)`;
  return taskId;
}

export const MODULE_ORDER = MODULES.map(m => m.id);

// ── 학습 주제 (세션 시작 전 선택, 1개 이상 복수 선택 가능) ──
// 레벨 공통 주제. 과제별로 다른 경우는 TASK_TOPICS가 우선함
const tp = list => list.map(([id, name]) => ({ id, name }));

const MODE_LIST = [["ionian", "Ionian"], ["dorian", "Dorian"], ["phrygian", "Phrygian"], ["lydian", "Lydian"], ["mixolydian", "Mixolydian"], ["aeolian", "Aeolian"], ["locrian", "Locrian"]];
const ALL_SCALES = tp([
  ["minor-penta", "마이너 펜타토닉"], ["major-penta", "메이저 펜타토닉"], ["blues", "블루스 스케일"],
  ["major", "메이저"], ["natural-minor", "내추럴 마이너"], ["harmonic-minor", "하모닉 마이너"], ["melodic-minor", "멜로딕 마이너"],
  ...MODE_LIST,
  ["maj", "메이저 코드톤"], ["min", "마이너 코드톤"], ["maj7", "maj7 코드톤"], ["dom7", "7 코드톤"], ["m7", "m7 코드톤"], ["m7b5", "m7♭5 코드톤"]
]);

const LEVEL_TOPICS = {
  "chords/c1": tp([["open", "오픈 코드"], ["triad", "메이저·마이너 트라이어드"], ["power", "파워 코드"]]),
  "chords/c2": tp([["barre", "바레·이동형 코드"], ["dim-aug-sus", "디미니시드·어그먼티드·서스펜디드"], ["triad-inversion", "트라이어드 전위"], ["string-set-triad", "현 그룹별 트라이어드"], ["caged", "CAGED"], ["seventh", "7th 코드"]]),
  "chords/c3": tp([["seventh-inversion", "7th 코드 전위"], ["shell", "Shell Voicing"], ["drop2", "Drop 2"], ["drop3", "Drop 3"], ["tension", "텐션(9·11·13)"]]),
  "chords/c4": tp([["substitute", "대리 코드"], ["slash", "슬래시 코드"], ["open-voicing", "Open Voicing"], ["quartal", "Quartal Voicing"]]),
  "chords/c5": tp([["voice-leading", "보이스 리딩"], ["genre-comping", "장르별 컴핑"], ["chord-melody", "코드 멜로디"]]).map(t => (t.id === "voice-leading" ? t : { ...t, pending: "악보 단계에서 추가" })),
  "scales/s1": ALL_SCALES,
  "scales/s2": ALL_SCALES,
  "scales/s3": ALL_SCALES,
  "scales/s4": tp(MODE_LIST),
  "scales/s5": ALL_SCALES,
  "scales/s6": tp([["major-251", "메이저 ii–V–I"], ["minor-251", "마이너 ii–V–i"], ["blues-12", "12마디 블루스"], ["i-vi-ii-v", "I–vi–ii–V"]]).map(t => ({ ...t, pending: "반주 음원 단계에서 추가" })),
  "rhythm/r1": tp([["4beat", "4비트"], ["8beat", "8비트"], ["16beat", "16비트"]]),
  "rhythm/r3": tp([["chord-tone", "코드톤 피킹"], ["scale", "스케일 피킹"], ["alternate", "얼터네이트"], ["string-skip", "스트링 스킵"], ["position-shift", "포지션 이동"]]),
  "rhythm/r4": tp([["riff", "리프"], ["syncopation", "싱코페이션 프레이즈"], ["repeat-vary", "반복·변형"], ["chord-based", "코드 기반"], ["scale-based", "스케일 기반"]]),
  "ear/e2": tp([["2-3", "2·3도"], ["4-5", "4·5도"], ["6-7", "6·7도"], ["octave-compound", "옥타브·복합 음정"]]),
  "ear/e4": tp([["blues", "Blues"], ["rock", "Rock"], ["funk", "Funk"], ["jazz", "Jazz"]])
};

const TASK_TOPICS = {
  "rhythm/r2/comping": tp([["chord-rhythm", "코드 리듬"], ["cutting", "커팅"], ["mute", "뮤트"], ["syncopation", "싱코페이션"]]),
  "rhythm/r2/fingerstyle": tp([["arpeggio", "아르페지오"], ["bass-chord", "베이스+코드"]]),
  "rhythm/r2/percussive": tp([["body-hit", "바디 타격"], ["palm-mute", "팜뮤트"], ["string-hit", "스트링 히트"]]),
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
