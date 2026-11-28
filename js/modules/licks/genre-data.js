// 장르·기타리스트별 릭 (v2.10.0 자리 마련)
// 사용자가 구한 악보를 Claude가 아래 형식으로 옮겨 GENRE_LICK_ROWS에 한 줄씩 넣으면 메뉴에 바로 나타남
//
// ── 장르·기타리스트 추가 ──
//  GENRES의 players에 { id, name, short } 를 넣음(id는 영문 소문자·숫자·하이픈, 한 장르 안에서 겹치지 않게)
//
// ── 릭 한 줄 형식 ──
//  [번호, 장르 id, 기타리스트 id, 난이도(1 초급 · 2 중급 · 3 고급), 스케일, 기준 키(pc), 용도, 리듬 느낌, 음 목록, 코드(선택), 이름(선택), 메모(선택)]
//  번호   : 장르·기타리스트 약자 + 일련번호 예) "SRV-01"  (전체 릭에서 겹치면 안 됨)
//  스케일 : minor-penta, major-penta, blues, mixed-blues, major, natural-minor, harmonic-minor, dorian, mixolydian, lydian, phrygian, altered 등
//  기준 키: 0=C 1=C# 2=D 3=Eb 4=E 5=F 6=F# 7=G 8=Ab 9=A 10=Bb 11=B
//  용도   : f 필인, i 인트로, c 클라이맥스, t 턴어라운드, e 엔딩, l 라인, r 리프, a 아르페지오
//  리듬   : straight, shuffle, triplet
//  음 목록·코드: 기본 릭(lick-data.js)과 같은 표기 — "줄-프렛:길이기법" 공백 구분, 동시음 "2-8+1-8", 쉼표 "-:q"
//    길이 w h q. q e. e s t(8분 셋잇단) · 기법 b1 b2 b3 r h p sl ~ c(경과음)
//  장르 릭은 4마디까지, 프렛 0~24까지 받음
//  메모   : 출처·참고(화면에는 작게 표시)

export const GENRES = [
  { id: "blues", name: "블루스", players: [
    { id: "srv", name: "Stevie Ray Vaughan", short: "SRV" },
    { id: "bbking", name: "B.B. King", short: "B.B. King" },
    { id: "albertking", name: "Albert King", short: "Albert King" },
    { id: "freddieking", name: "Freddie King", short: "Freddie King" },
    { id: "clapton", name: "Eric Clapton", short: "Clapton" }
  ] },
  { id: "neosoul", name: "네오소울", players: [
    { id: "sharkey", name: "Isaiah Sharkey", short: "Sharkey" },
    { id: "asato", name: "Mateus Asato", short: "Asato" },
    { id: "misch", name: "Tom Misch", short: "Tom Misch" },
    { id: "faye", name: "Melanie Faye", short: "Melanie Faye" },
    { id: "mayer", name: "John Mayer", short: "John Mayer" }
  ] },
  { id: "rnb", name: "R&B", players: [
    { id: "mayfield", name: "Curtis Mayfield", short: "Mayfield" },
    { id: "cropper", name: "Steve Cropper", short: "Cropper" },
    { id: "dupree", name: "Cornell Dupree", short: "Dupree" },
    { id: "prince", name: "Prince", short: "Prince" }
  ] },
  { id: "pop", name: "팝", players: [
    { id: "knopfler", name: "Mark Knopfler", short: "Knopfler" },
    { id: "edge", name: "The Edge", short: "The Edge" },
    { id: "summers", name: "Andy Summers", short: "Summers" },
    { id: "harrison", name: "George Harrison", short: "Harrison" }
  ] },
  { id: "funk", name: "펑크", players: [
    { id: "rodgers", name: "Nile Rodgers", short: "Nile Rodgers" },
    { id: "nolen", name: "Jimmy Nolen", short: "Jimmy Nolen" },
    { id: "wong", name: "Cory Wong", short: "Cory Wong" },
    { id: "lettieri", name: "Mark Lettieri", short: "Lettieri" }
  ] },
  { id: "rock", name: "록", players: [
    { id: "hendrix", name: "Jimi Hendrix", short: "Hendrix" },
    { id: "page", name: "Jimmy Page", short: "Jimmy Page" },
    { id: "gilmour", name: "David Gilmour", short: "Gilmour" },
    { id: "slash", name: "Slash", short: "Slash" },
    { id: "evh", name: "Eddie Van Halen", short: "EVH" }
  ] },
  { id: "metal", name: "메탈", players: [
    { id: "iommi", name: "Tony Iommi", short: "Iommi" },
    { id: "rhoads", name: "Randy Rhoads", short: "Rhoads" },
    { id: "hammett", name: "Kirk Hammett", short: "Hammett" },
    { id: "dimebag", name: "Dimebag Darrell", short: "Dimebag" },
    { id: "petrucci", name: "John Petrucci", short: "Petrucci" }
  ] },
  { id: "jazz", name: "재즈", players: [
    { id: "wes", name: "Wes Montgomery", short: "Wes" },
    { id: "pass", name: "Joe Pass", short: "Joe Pass" },
    { id: "martino", name: "Pat Martino", short: "Martino" },
    { id: "green", name: "Grant Green", short: "Grant Green" },
    { id: "benson", name: "George Benson", short: "Benson" }
  ] }
];

export const DIFF_NAMES = { 1: "초급", 2: "중급", 3: "고급" };

// 릭 (악보를 받는 대로 추가)
//  기법 추가(v2.10.1): g-1 = 한 프렛 아래에서 꾸밈음 슬라이드, k-2 = 두 프렛 아래 꾸밈음에서 해머(k2 = 위에서 풀), bq = ¼ 벤딩
//  길이 추가: x = 16분 셋잇단, u = 4분 셋잇단(12/8의 4분음표), y = 1틱(12/8 16분 셋잇단 근사), "t+h" = 이어지는 긴 음
//  12/8 블루스는 12/8 한 박(점4분)을 4분음표 한 박으로 옮겨 셋잇단 느낌(triplet)으로 둠
export const GENRE_LICK_ROWS = [
  // ── 블루스 · Stevie Ray Vaughan (2026-11-28 사용자 제공 악보 16개) ──
  ["SRV-01", "blues", "srv", 1, "mixed-blues", 4, "r", "straight", "2-3+3-4:q~g-1 2-3+3-4:q~ 2-3+3-4:q~ 2-3+3-4:q~ 2-5+3-6:q~g-1 2-5+3-6:q~ 2-5+3-6:q~ 2-5+3-6:q~ 2-8+3-9:q~g-1 2-8+3-9:q~ 2-8+3-9:q~ 2-8+3-9:q~ 2-8+3-9:q~ 2-8+3-9:q~ 2-8+3-9:q~ 2-8+3-9:q~", "", "2·3번 줄 더블 스톱 슬라이드", ""],
  ["SRV-02", "blues", "srv", 2, "mixolydian", 4, "r", "triplet", "1-11+2-11+3-12:tc 1-12+2-12+3-13:tsl 1-12+2-12+3-13:t 1-12+2-12+3-13:e 1-12+2-12+3-13:e 1-12+2-12+3-13:t 1-10+2-10+3-11:tsl 1-10+2-10+3-11:t 1-10+2-10+3-11:e 1-10+2-10+3-11:e 1-10+2-10+3-11:t 1-12+2-12+3-13:tsl 1-12+2-12+3-13:t 1-12+2-12+3-13:t 1-12+2-12+3-13:t 1-12+2-12+3-13:t 1-12+2-12+3-13:t 1-12+2-12+3-13:t 1-12+2-12+3-13:t 1-12+2-12+3-13:t 1-12+2-12+3-13:t 1-12+2-12+3-13:t 1-11+2-11+3-12:tc 1-12+2-12+3-13:tsl 1-12+2-12+3-13:t 1-12+2-12+3-13:e 1-12+2-12+3-13:e 1-12+2-12+3-13:t 1-10+2-10+3-11:tsl 1-10+2-10+3-11:t 1-10+2-10+3-11:e 1-10+2-10+3-11:e 1-11+2-11+3-12:tc 1-12+2-12+3-13:tsl 1-12+2-12+3-13:t 1-11+2-11+3-12:tc 1-12+2-12+3-13:tsl 1-12+2-12+3-13:t 1-11+2-11+3-12:tc 1-12+2-12+3-13:tsl 1-12+2-12+3-13:t 1-11+2-11+3-12:tc 1-12+2-12+3-13:tsl 1-12+2-12+3-13:t", "", "트라이어드 셋잇단 (E–D)", ""],
  ["SRV-03", "blues", "srv", 2, "mixed-blues", 4, "l", "straight", "1-15:ebq 1-15:ebq 1-12:x 2-15:x 2-12:x 3-14:eg1 3-12:x 4-14:x 4-12:x 4-14:q~", "", "¼ 벤딩·16분 셋잇단 하강", ""],
  ["SRV-04", "blues", "srv", 3, "mixed-blues", 4, "l", "triplet", "-:e 3-6:eg-2 2-5:t 3-6:t 2-5:t 1-7:t 1-6:t 1-5:t 1-3:tbq 1-0:t 2-3:tbq 1-0:t 2-3:tbq 2-0:t 3-2:tg1 3-0:tp 4-2:t 3-0:t 3-1:th 1-0+2-0:t 4-2:t 4-0:tp 5-2:t 4-0:t 5-2:t 5-1:t 5-0:s 5-1:xh 5-0:xp 6-3:x 6-0:e+e.p -:q", "", "오픈 포지션 셋잇단 하강", ""],
  ["SRV-05", "blues", "srv", 3, "mixed-blues", 4, "l", "triplet", "-:h -:q -:e 3-7:e 3-8:thc 2-7:t 1-7:t 1-9:t 1-8:tpc 1-7:tp 2-10:e.b2 1-7:s 2-10:t 2-7:tp 3-9:t 3-6:tsl 2-5:t 1-5:t 1-7:t 1-6:tp 1-5:tp 2-8:tb2 1-5:t 2-8:t 3-2:tg5 3-0:tp 4-2:t 3-0:t 3-1:th 1-0+2-0:t -:h -:q", "", "포지션 이동 셋잇단 라인", ""],
  ["SRV-06", "blues", "srv", 2, "mixed-blues", 4, "t", "triplet", "-:q 3-4:tg-2 2-3:t 1-0:t 1-4:tg-2 1-0:t 2-0:t 3-2:tg1 3-0:tp 4-2:t 3-0:t 3-1:th 5-0:t 5-1:t 5-2:th 4-1+3-2:t+h~c", "", "오픈 포지션 턴어라운드 → B7", ""],
  ["SRV-07", "blues", "srv", 2, "mixed-blues", 4, "c", "triplet", "-:h -:q -:e 3-12:e 3-14:tb2 2-12:t 1-12:t 2-15:tb2 1-12:t 2-12:t 2-15:tb2 1-12:t 2-12:t 1-15:tb1 1-12:t 2-12:t 2-15:tb2 1-12:t 2-12:t 1-15:tb1 1-12:t 2-12:t 3-14:tg1 3-12:tp 4-14:t 2-12+3-12:q~", "", "12프렛 벤딩 셋잇단 A", "끝 화음은 원본에서 3번 줄 12·13 트릴(여기서는 비브라토)"],
  ["SRV-08", "blues", "srv", 2, "mixed-blues", 4, "c", "triplet", "-:h -:q -:e 3-12:e 3-14:tb2 2-12:t 1-12:t 2-15:tb2 1-12:t 2-12:t 2-15:tb2 1-12:t 2-12:t 1-15:tb1 1-12:t 2-12:t 1-15:tb1 1-12:t 2-12:t 1-15:tb1 1-12:t 2-12:t 1-15:tb1 1-12:t 2-12:t 1-15:qb1", "", "12프렛 벤딩 셋잇단 B", ""],
  ["SRV-09", "blues", "srv", 3, "mixed-blues", 4, "c", "straight", "1-17:eb2 1-17:er 1-15:s 1-16:sb1 1-16:er 2-17:q~ 2-17:q 1-15:s 2-17:x 2-15:xp 2-12:xsl 3-14:s 1-12:t 2-15:t 2-12:t 3-14:t 2-12:t 3-14+2-15:tb1c 3-14:tr 3-12:t 4-14:t 3-12:t 3-13:th 1-12+2-12:t -:h -:q", "", "하이 포지션 벤딩·릴리스", "원본의 프리벤드 ½·벤딩 후 릴리스는 벤딩과 릴리스 두 음으로 나눠 표기"],
  ["SRV-10", "blues", "srv", 3, "mixed-blues", 4, "l", "triplet", "-:h -:e 3-12:e 3-14:tb2 2-12:t 1-12:t 2-15:eb2 1-14:qk-2 1-14:ek-2 1-12:e 1-12:ek2 2-15:t 3-14:t 2-12:t 3-15:t 3-14:tsl 3-12:t 4-14:t 3-12:t 3-14:t 2-12:t 3-14:tg1 3-12:t 3-14+2-12:uk-2 3-12:t 4-14:q 3-3:t 3-4:tsl 2-3:t 1-0:u 2-3:t 3-2:tg1 3-0:tp 4-2:t 3-0:t 3-1:th 5-0:t 5-1:t 5-2:th 4-1+3-2:t+h~c", "", "12프렛에서 오픈으로 내려오는 5마디 라인", "2마디 리듬은 원본 악보를 4박에 맞춰 조금 단순화"],
  ["SRV-11", "blues", "srv", 1, "mixed-blues", 7, "f", "triplet", "1-8:qb2 1-6:x 2-8:x+t 1-6:t+qb1", "", "12/8 벤딩 필인 A", "원본 12/8 슬로 블루스 조각 · 12/8 한 박을 4분음표 한 박으로 옮김(16분 셋잇단은 근사)"],
  ["SRV-12", "blues", "srv", 3, "mixed-blues", 7, "f", "triplet", "-:e 1-3:x 2-6:x 2-3:xp 3-6:x 3-5:ysl 3-3:yp 4-5:x 3-3:x 3-5:tb2 1-3:x 3-3:q", "", "12/8 16분 하강 필인", "원본 12/8 슬로 블루스 조각 · 12/8 한 박을 4분음표 한 박으로 옮김(16분 셋잇단은 근사)"],
  ["SRV-13", "blues", "srv", 1, "mixed-blues", 7, "f", "triplet", "-:x 3-9:x 2-8:x 1-6:eb1 2-8:q", "", "12/8 짧은 필인", "원본 12/8 슬로 블루스 조각 · 12/8 한 박을 4분음표 한 박으로 옮김(16분 셋잇단은 근사)"],
  ["SRV-14", "blues", "srv", 2, "mixed-blues", 7, "f", "triplet", "2-15:xg-2 1-15:x 2-15:x 2-18:eb2 3-17:xb2c 3-17:xr 3-15:tp 6-18:t", "", "12/8 하이 포지션 벤딩 필인", "원본 12/8 슬로 블루스 조각 · 12/8 한 박을 4분음표 한 박으로 옮김(16분 셋잇단은 근사)"],
  ["SRV-15", "blues", "srv", 2, "mixed-blues", 7, "f", "triplet", "2-3:x 2-6:x 1-3:x 1-5:eh 1-4:yc 1-3:yp 2-6:x", "", "12/8 해머·풀 필인", "원본 12/8 슬로 블루스 조각 · 12/8 한 박을 4분음표 한 박으로 옮김(16분 셋잇단은 근사)"],
  ["SRV-16", "blues", "srv", 1, "mixed-blues", 7, "f", "triplet", "2-3:x 1-3:x 2-8:qg-2", "", "12/8 슬라이드 필인", "원본 12/8 슬로 블루스 조각 · 12/8 한 박을 4분음표 한 박으로 옮김(16분 셋잇단은 근사)"]
];
