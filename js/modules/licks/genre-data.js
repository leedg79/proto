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
export const GENRE_LICK_ROWS = [
];
