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
  mission: { kind: "mission", size: 1, label: "과제 미션 완료 = 1회" },
  none: { kind: "none", size: 0, label: "참고 기능(세션 기록 없음)" }
};

// 세션 유형
export const SESSION_TYPES = {
  finding: "찾기",
  bpm: "BPM 연습",
  play: "연주",
  block: "블록 연습",
  pattern: "패턴 연습",
  ear: "청음",
  transcribe: "채보",
  reference: "참고"
};

const CHORD_TASKS = [
  { id: "random-chord", name: "Random Chord Finding", type: "finding", unit: UNIT.mission },
  { id: "bpm-chord", name: "BPM Chord Finding", type: "bpm", unit: UNIT.mission },
  { id: "play-session", name: "Play Session", type: "play", unit: UNIT.mission },
  { id: "chord-dictionary", name: "Chord Dictionary", type: "reference", unit: UNIT.none, reference: true }
];

const SCALE_TASKS = [
  { id: "interval-finding", name: "Scale Interval Finding", type: "finding", unit: UNIT.mission },
  { id: "block-learning", name: "Block Scale Learning", type: "block", unit: UNIT.blocks5 },
  { id: "block-transition", name: "Block Transition Practice", type: "block", unit: UNIT.blocks5 },
  { id: "block-root", name: "Block + Root Memorization", type: "block", unit: UNIT.mission }
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
        tasks: [{ id: "note-finder", name: "Note Finder", type: "finding", unit: UNIT.noteCycle }]
      },
      {
        id: "n2", name: "N2 전체 6현", desc: "6현 전체(0~15프렛) 음 위치 찾기",
        tasks: [{ id: "note-finder", name: "Note Finder", type: "finding", unit: UNIT.noteCycle }]
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
      { id: "c4", name: "C4 고급", desc: "대리 코드, 슬래시 코드, 보이스 리딩, Open·Quartal Voicing, 장르별 컴핑, 코드 멜로디", tasks: CHORD_TASKS }
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
      { id: "s4", name: "S4 Modes", desc: "7개 모드", tasks: SCALE_TASKS },
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
