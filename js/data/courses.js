// 단계별 코스: 입문 ~ 고급
// 항목 = 기존 과제로 가는 바로가기 + 미리 고른 학습 주제·설정(그 세션에만 적용)
// 기록은 원래 모듈·레벨·과제 기준으로 쌓임
// pending: 아직 콘텐츠가 없는 자리(메뉴만 두고 "준비 중")

export const STEPS = [
  { id: 1, name: "입문", goal: "지판 음 이름·오픈 코드와 반주·4·8비트 스트럼에 익숙해지기" },
  { id: 2, name: "초보", goal: "트라이어드·펜타토닉 모양과 위치·첫 릭과 벤딩" },
  { id: 3, name: "초급", goal: "바레·7th 코드, 컴핑·핑거스타일, 블루스 반주 위 즉흥" },
  { id: 4, name: "중급", goal: "트라이어드·보이싱, 메이저 계열·모드, ii–V–I 릭, 청음 채보" },
  { id: 5, name: "고급", goal: "텐션·대리 코드, 모드 전환, 보이스 리딩, 프레이즈 채보" }
];

// 항목 만들기: I(모듈, 레벨, 과제, 주제[], 제목, 설명, 설정{})
const I = (mod, lvl, task, topics, title, note = "", set = {}) => ({ mod, lvl, task, topics, title, note, set });
const P = (mod, title, note) => ({ mod, title, note, pending: true });

export const COURSES = {
  1: [
    I("notes", "n2", "note-finder", [], "6현 전체 음 찾기", "0~15프렛, 제한시간 8초", { "nf.time": 8 }),
    I("chords", "c1", "random-chord", ["open"], "오픈 코드 잡기", "코드 이름 보고 바로 잡기, 12초", { "rc.time": 12 }),
    I("chords", "c1", "bpm-chord", ["open"], "오픈 코드 바꾸기", "60 BPM 박에 맞춰 다음 코드", { "bpm.find": 60 }),
    I("rhythm", "r1", "strum-pattern", ["4beat", "8beat"], "4·8비트 스트럼", "다운·업 기본 패턴, 70 BPM", { "rh.strum.bpm": 70 }),
    I("chords", "c1", "play-session", ["open"], "오픈 코드 진행 반주", "진행 따라 치기, 70 BPM", { "play.bpm": 70 }),
    I("technique", "t1", "drill", ["chromatic"], "크로매틱 1234", "왼손 1손가락 1프렛, 박 판정"),
    I("ear", "e1", "note-name", [], "음 이름 듣기", "한 음 듣고 이름 고르기")
  ],
  2: [
    I("notes", "n1", "note-finder", [], "지정 줄에서 음 찾기", "무작위 순서 3~4개 줄, 제한시간 8초", { "nf.time": 8 }),
    I("chords", "c1", "random-chord", ["triad", "power"], "트라이어드·파워 코드", "메이저·마이너 트라이어드와 파워 코드", { "rc.time": 10 }),
    I("rhythm", "r1", "strum-pattern", ["16beat", "accent", "mute"], "16비트·악센트·뮤트", "칙 뮤트와 악센트 넣은 스트럼"),
    I("rhythm", "r1", "rhythm-reading", ["4beat", "8beat"], "리듬 읽기 4·8비트", "악보 보고 바로 치기", { "rhr.bpm": 70 }),
    I("scales", "pb", "shape-learning", ["minor-penta"], "마이너 펜타토닉 모양", "지판 보며 따라 치기"),
    I("scales", "pb", "shape-root", ["minor-penta", "major-penta"], "펜타토닉 근음 위치", "근음 보고 모양 떠올리기"),
    I("scales", "pb", "start-note", ["minor-penta"], "펜타토닉 시작음 바꿔 치기", "정한 음에서 시작해 한 옥타브 왕복"),
    I("licks", "l1", "lick-learn", ["minor-penta"], "첫 펜타토닉 릭", "TAB·악보 보고 따라 치기"),
    I("technique", "t2", "drill", ["half-bend", "whole-bend", "vibrato"], "벤딩·비브라토 기초", "반음·온음 벤딩 음 맞추기"),
    I("technique", "t3", "drill", ["alternate", "crossing"], "얼터네이트 피킹", "다운·업 교대, 줄 넘기"),
    I("ear", "e2", "interval", ["2-3", "4-5"], "음정 듣기 2~5도", "상행·하행")
  ],
  3: [
    I("chords", "c2", "random-chord", ["barre", "seventh"], "바레·7th 코드 잡기", "이동형 모양과 7th 코드"),
    I("chords", "c2", "bpm-chord", ["barre"], "바레 코드 바꾸기", "70 BPM", { "bpm.find": 70 }),
    I("chords", "c2", "play-session", ["barre", "seventh"], "바레·7th 진행 반주", "80 BPM", { "play.bpm": 80 }),
    I("rhythm", "r1", "strum-pattern", ["rest", "syncopation", "shuffle"], "끊어치기·싱코페이션·셔플", "쉼표와 엇박 스트럼"),
    I("rhythm", "r2", "comping", ["chord-rhythm", "cutting"], "코드 컴핑·커팅", "코드 리듬과 짧게 끊는 커팅"),
    I("rhythm", "r2", "fingerstyle", ["arpeggio"], "핑거스타일 아르페지오", "손가락으로 코드 펼치기"),
    I("scales", "pb", "neck-transition", ["minor-penta"], "펜타토닉 블록 이동", "블록 사이를 슬라이드로 넘어가기"),
    I("scales", "pb", "chord-scale", ["blues-minor"], "12마디 블루스 위 펜타토닉", "반주 위에서 스케일 경로 연습"),
    I("scales", "mm", "shape-learning", ["major", "natural-minor"], "메이저·내추럴 마이너 모양", "지판 보며 따라 치기"),
    I("licks", "l1", "lick-backing", ["minor-penta", "blues"], "블루스 릭 주고받기", "반주 위에서 릭을 듣고 따라 치기"),
    I("licks", "l2", "lick-learn", ["major", "natural-minor"], "메이저·마이너 릭", "TAB·악보 보고 따라 치기"),
    I("licks", "l6", "lick-learn", ["turnaround", "shuffle"], "블루스 턴어라운드·셔플 리프", "12마디 블루스 형식 릭"),
    I("technique", "t3", "drill", ["skipping", "economy"], "스트링 스킵·이코노미", "줄 건너뛰기와 이코노미 피킹"),
    I("technique", "t4", "drill", ["palm-mute", "legato", "slide"], "팜뮤트·레가토·슬라이드", "표현 기법 기초"),
    I("ear", "e2", "interval", ["6-7", "octave-compound"], "음정 듣기 6도~복합", "넓은 음정"),
    I("ear", "e3", "chord-ear", ["triads"], "트라이어드 종류 듣기", "메이저·마이너·dim·aug·sus")
  ],
  4: [
    I("chords", "c2", "random-chord", ["triad-inversion", "string-set-triad", "caged", "dim-aug-sus"], "트라이어드 전위·CAGED", "현 그룹별 트라이어드와 CAGED"),
    I("chords", "c3", "random-chord", ["shell", "drop2"], "Shell·Drop 2 보이싱", "재즈 보이싱 기초"),
    I("chords", "c5", "genre-comping", ["blues-shuffle", "funk-16", "bossa"], "장르별 컴핑", "블루스 셔플·펑크 16비트·보사노바"),
    I("rhythm", "r1", "strum-pattern", ["genre"], "장르별 스트로크", "장르 리듬 패턴"),
    I("rhythm", "r2", "percussive", ["body-hit", "string-hit", "palm-mute"], "퍼커시브", "바디 타격·스트링 히트·팜뮤트"),
    I("rhythm", "r4", "phrase", ["riff", "syncopation"], "리프·싱코페이션 프레이즈", "단음 리듬 프레이즈", { "rhph.bpm": 80 }),
    I("scales", "mm", "chord-scale", ["major251"], "메이저 ii–V–I 위 스케일", "진행 위에서 스케일 경로"),
    I("scales", "md", "shape-learning", ["dorian", "mixolydian"], "도리안·믹솔리디안 모양", "많이 쓰는 두 모드부터"),
    I("scales", "ct", "shape-learning", ["maj7", "dom7", "m7"], "7th 코드톤", "코드톤(아르페지오) 모양"),
    I("licks", "l1", "lick-vary", ["minor-penta", "blues"], "릭 변형", "리듬·음 바꾸기로 내 것 만들기"),
    I("licks", "l3", "lick-learn", ["dorian", "mixolydian"], "모드 색깔음 릭", "도리안 6·믹솔리디안 ♭7"),
    I("licks", "l4", "lick-learn", ["major-251", "v-i"], "ii–V–I 릭", "메이저 ii–V–I, V7 → I"),
    I("licks", "l5", "lick-learn", ["arpeggio"], "코드톤 릭", "한 코드 아르페지오"),
    I("technique", "t5", "drill", ["etude"], "응용 연습곡", "기법을 섞은 연습곡"),
    I("ear", "e3", "melodic", [], "선율 채보", "도수로 음 순서 입력"),
    I("ear", "e3", "harmonic", [], "화성 청음", "자리바꿈·맨 위 음"),
    I("ear", "e3", "chord-ear", ["sevenths"], "7th 코드 듣기", "maj7·7·m7·m7♭5·dim7"),
    P("technique", "중급 테크닉 심화", "연속 벤딩·벤딩 중 비브라토·16비트 연주 패턴"),
    P("licks", "중급 릭·변형 심화", "변형 유형 확장, 중급 난이도 릭")
  ],
  5: [
    I("chords", "c3", "random-chord", ["seventh-inversion", "drop3", "tension"], "7th 전위·Drop 3·텐션", "9·11·13 텐션 보이싱"),
    I("chords", "c4", "random-chord", ["substitute", "slash", "open-voicing", "quartal"], "대리·슬래시·Quartal", "응용 보이싱"),
    I("chords", "c5", "play-session", ["voice-leading"], "보이스 리딩", "가까운 음으로 이어지는 코드 진행"),
    I("chords", "c5", "chord-melody", [], "코드 멜로디", "멜로디와 코드를 함께"),
    I("scales", "mm", "shape-learning", ["harmonic-minor", "melodic-minor"], "하모닉·멜로딕 마이너", "모양 익히기"),
    I("scales", "md", "mode-switch", ["dorian", "phrygian", "lydian", "mixolydian"], "모드 바꾸기", "같은 근음에서 모드 전환"),
    I("scales", "md", "chord-scale", ["251-modes", "1625-modes"], "진행 위 모드 전환", "코드마다 모드 바꾸기"),
    I("scales", "ct", "neck-transition", ["maj7", "dom7", "m7", "m7b5"], "코드톤 블록 이동", "지판 전체로 코드톤 잇기"),
    I("licks", "l4", "lick-backing", ["minor-251"], "마이너 ii–V–i 릭 주고받기", "♭9♭13·얼터드"),
    I("licks", "l5", "lick-learn", ["two-chord"], "두 코드 연결 릭", "코드톤으로 코드 넘어가기"),
    I("licks", "l3", "lick-move", ["dorian", "mixolydian", "lydian", "phrygian"], "모드 릭 키 옮기기", "다른 키·구간에서 다시 치기"),
    I("ear", "e3", "chord-ear", ["tensions", "progressions"], "텐션·코드 진행 듣기", "add9·maj9·7♭9·13, 진행"),
    I("ear", "e4", "phrase-transcribe", ["blues", "rock", "funk", "jazz"], "프레이즈 채보", "릭을 듣고 지판에 옮기기"),
    P("technique", "고급 테크닉", "더블 벤딩·가속·감속 태핑·고속 피킹"),
    P("licks", "고급 릭·변형", "고급 난이도 릭과 변형"),
    P("rhythm", "고급 리듬", "16분 셋잇단·6연음·복합 리듬, 다양한 코드 진행")
  ]
};

export const courseItem = (step, idx) => (COURSES[step] || [])[idx] || null;

// 항목을 해 본 횟수: 같은 모듈·레벨·과제이고, 주제가 정해진 항목이면 그 주제 중 하나라도 포함한 세션
export function itemCount(item, records) {
  if (!item || item.pending) return 0;
  return records.filter(r => r.module === item.mod && r.level === item.lvl && r.task === item.task &&
    (!item.topics.length || (r.topics || []).some(t => item.topics.includes(t)))).length;
}
