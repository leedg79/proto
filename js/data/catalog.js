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
  none: { kind: "none", size: 0, label: "참고 기능(세션 기록 없음)" }
};

// 세션 유형
export const SESSION_TYPES = {
  finding: "찾기",
  bpm: "연속 찾기",
  play: "연주",
  block: "블록 연습",
  pattern: "패턴 연습",
  ear: "청음",
  transcribe: "채보",
  reference: "참고"
};

const CHORD_TASKS = [
  { id: "random-chord", name: "Random Chord Finding", type: "finding", unit: UNIT.mission },
  { id: "bpm-chord", name: "연속 코드 찾기 · Sequential Chord Finding", type: "bpm", unit: UNIT.mission },
  { id: "play-session", name: "Play Session", type: "play", unit: UNIT.mission },
  { id: "chord-dictionary", name: "Chord Dictionary", type: "reference", unit: UNIT.none, reference: true }
];

const SCALE_TASKS = [
  { id: "interval-finding", name: "Scale Interval Finding", type: "finding", unit: UNIT.mission },
  { id: "block-learning", name: "Block Scale Learning", type: "block", unit: UNIT.blocks5 },
  { id: "block-transition", name: "Block Transition Practice", type: "block", unit: UNIT.blocks5 },
  { id: "block-root", name: "Block + Root Memorization", type: "block", unit: UNIT.mission }
];

// S4 Modes는 블록 대신 시작음 기준 7개 포지션 단위
const MODE_TASKS = [
  { id: "interval-finding", name: "Scale Interval Finding", type: "finding", unit: UNIT.mission },
  { id: "block-learning", name: "Position Scale Learning", type: "block", unit: UNIT.positions7 },
  { id: "block-transition", name: "Position Transition Practice", type: "block", unit: UNIT.positions7 },
  { id: "block-root", name: "Position + Root Memorization", type: "block", unit: UNIT.mission }
];

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
    sub: "블록 · 도수 · 코드-스케일",
    stage: 4,
    levels: [
      { id: "s1", name: "S1 Chord Tones", desc: "코드톤과 스케일의 관계", tasks: SCALE_TASKS },
      { id: "s2", name: "S2 Pentatonic & Blues", desc: "메이저·마이너 펜타토닉, 블루스 스케일", tasks: SCALE_TASKS },
      { id: "s3", name: "S3 Major & Minor Family", desc: "메이저, 내추럴·하모닉·멜로딕 마이너", tasks: SCALE_TASKS },
      { id: "s4", name: "S4 Modes", desc: "7개 모드, 시작음 기준 7개 포지션", tasks: MODE_TASKS },
      { id: "s5", name: "S5 Chord-Scale Application", desc: "코드 진행 위 스케일 적용(반주와 함께 수행)", tasks: SCALE_TASKS }
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
  return t ? t.name : taskId;
}

export const MODULE_ORDER = MODULES.map(m => m.id);

// ── 학습 주제 (세션 시작 전 선택, 1개 이상 복수 선택 가능) ──
// 레벨 공통 주제. 과제별로 다른 경우는 TASK_TOPICS가 우선함
const tp = list => list.map(([id, name]) => ({ id, name }));

const LEVEL_TOPICS = {
  "chords/c1": tp([["open", "오픈 코드"], ["triad", "메이저·마이너 트라이어드"], ["power", "파워 코드"]]),
  "chords/c2": tp([["barre", "바레·이동형 코드"], ["dim-aug-sus", "디미니시드·어그먼티드·서스펜디드"], ["triad-inversion", "트라이어드 전위"], ["string-set-triad", "현 그룹별 트라이어드"], ["caged", "CAGED"], ["seventh", "7th 코드"]]),
  "chords/c3": tp([["seventh-inversion", "7th 코드 전위"], ["shell", "Shell Voicing"], ["drop2", "Drop 2"], ["drop3", "Drop 3"], ["tension", "텐션(9·11·13)"]]),
  "chords/c4": tp([["substitute", "대리 코드"], ["slash", "슬래시 코드"], ["open-voicing", "Open Voicing"], ["quartal", "Quartal Voicing"]]),
  "chords/c5": tp([["voice-leading", "보이스 리딩"], ["genre-comping", "장르별 컴핑"], ["chord-melody", "코드 멜로디"]]).map(t => (t.id === "voice-leading" ? t : { ...t, pending: "악보 단계에서 추가" })),
  "scales/s1": tp([["maj", "메이저"], ["min", "마이너"], ["maj7", "maj7"], ["dom7", "7"], ["m7", "m7"], ["m7b5", "m7♭5"]]),
  "scales/s2": tp([["major-penta", "메이저 펜타토닉"], ["minor-penta", "마이너 펜타토닉"], ["blues", "블루스 스케일"]]),
  "scales/s3": tp([["major", "메이저"], ["natural-minor", "내추럴 마이너"], ["harmonic-minor", "하모닉 마이너"], ["melodic-minor", "멜로딕 마이너"]]),
  "scales/s4": tp([["ionian", "Ionian"], ["dorian", "Dorian"], ["phrygian", "Phrygian"], ["lydian", "Lydian"], ["mixolydian", "Mixolydian"], ["aeolian", "Aeolian"], ["locrian", "Locrian"]]),
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
