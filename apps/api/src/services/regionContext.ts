type RegionInfo = {
  sidoName: string;
  airKoreaSidoName: string;
  nx: number;
  ny: number;
};

const regions: RegionInfo[] = [
  { sidoName: "서울", airKoreaSidoName: "서울", nx: 60, ny: 127 },
  { sidoName: "부산", airKoreaSidoName: "부산", nx: 98, ny: 76 },
  { sidoName: "대구", airKoreaSidoName: "대구", nx: 89, ny: 90 },
  { sidoName: "인천", airKoreaSidoName: "인천", nx: 55, ny: 124 },
  { sidoName: "광주", airKoreaSidoName: "광주", nx: 58, ny: 74 },
  { sidoName: "대전", airKoreaSidoName: "대전", nx: 67, ny: 100 },
  { sidoName: "울산", airKoreaSidoName: "울산", nx: 102, ny: 84 },
  { sidoName: "세종", airKoreaSidoName: "세종", nx: 66, ny: 103 },
  { sidoName: "경기", airKoreaSidoName: "경기", nx: 60, ny: 121 },
  { sidoName: "강원", airKoreaSidoName: "강원", nx: 73, ny: 134 },
  { sidoName: "충북", airKoreaSidoName: "충북", nx: 69, ny: 106 },
  { sidoName: "충남", airKoreaSidoName: "충남", nx: 55, ny: 106 },
  { sidoName: "전북", airKoreaSidoName: "전북", nx: 63, ny: 89 },
  { sidoName: "전남", airKoreaSidoName: "전남", nx: 51, ny: 67 },
  { sidoName: "경북", airKoreaSidoName: "경북", nx: 91, ny: 106 },
  { sidoName: "경남", airKoreaSidoName: "경남", nx: 91, ny: 77 },
  { sidoName: "제주", airKoreaSidoName: "제주", nx: 52, ny: 38 },
];

const officeCodeToSido = new Map<string, string>([
  ["B10", "서울"],
  ["C10", "부산"],
  ["D10", "대구"],
  ["E10", "인천"],
  ["F10", "광주"],
  ["G10", "대전"],
  ["H10", "울산"],
  ["I10", "세종"],
  ["J10", "경기"],
  ["K10", "강원"],
  ["M10", "충북"],
  ["N10", "충남"],
  ["P10", "전북"],
  ["Q10", "전남"],
  ["R10", "경북"],
  ["S10", "경남"],
  ["T10", "제주"],
]);

const addressPrefixes: Array<[RegExp, string]> = [
  [/^서울/, "서울"],
  [/^부산/, "부산"],
  [/^대구/, "대구"],
  [/^인천/, "인천"],
  [/^광주/, "광주"],
  [/^대전/, "대전"],
  [/^울산/, "울산"],
  [/^세종/, "세종"],
  [/^경기/, "경기"],
  [/^강원/, "강원"],
  [/^충청북도|^충북/, "충북"],
  [/^충청남도|^충남/, "충남"],
  [/^전라북도|^전북/, "전북"],
  [/^전라남도|^전남/, "전남"],
  [/^경상북도|^경북/, "경북"],
  [/^경상남도|^경남/, "경남"],
  [/^제주/, "제주"],
];

export type RegionalContext = RegionInfo & {
  source: "school-address" | "neis-office-code";
};

function findRegion(sidoName: string) {
  return regions.find((region) => region.sidoName === sidoName) ?? null;
}

export function inferRegionalContext(classroom: {
  neisOfficeCode: string | null;
  neisSchoolAddress: string | null;
}): RegionalContext | null {
  const address = classroom.neisSchoolAddress?.trim() || "";

  for (const [pattern, sidoName] of addressPrefixes) {
    if (pattern.test(address)) {
      const region = findRegion(sidoName);
      return region ? { ...region, source: "school-address" } : null;
    }
  }

  const officeSido = classroom.neisOfficeCode
    ? officeCodeToSido.get(classroom.neisOfficeCode)
    : undefined;

  if (!officeSido) {
    return null;
  }

  const region = findRegion(officeSido);
  return region ? { ...region, source: "neis-office-code" } : null;
}
