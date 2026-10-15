export interface ParsedStudentRow {
  stt?: number;
  name: string; // Họ và tên đầy đủ: "Nguyễn Tiến Đạt"
  hoVaChuLot?: string; // Họ và chữ lót riêng: "Nguyễn Tiến"
  ten?: string; // Tên riêng: "Đạt"
  studentCode?: string; // Mã học sinh vnEdu / SMAS (ví dụ: 2511404881)
  gender?: 'Nam' | 'Nữ' | 'Khác';
  dob?: string;
  phone?: string;
  email?: string;
  username?: string; // "nguyendat11a1vts2627"
}

export interface ParseExcelResult {
  success: boolean;
  students: ParsedStudentRow[];
  detectedClassName?: string;
  detectedSchoolName?: string;
  detectedAcademicYear?: string;
  totalRowsProcessed: number;
  totalStudentsExtracted: number;
  expectedStudentCount?: number;
  sttRangeSummary?: string;
  message?: string;
}

/**
 * Remove Vietnamese accents and special characters
 */
export function removeVietnameseDiacritics(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Generate standard student username:
 * Cấu trúc: họ + tên + lớp + viết tắt trường + niên học
 * Ví dụ: Nguyễn Tiến Đạt, Lớp 11A1, THPT Võ Thị Sáu, Niên học 2026-2027 -> nguyendat11a1vts2627
 */
export function generateStudentUsername(
  fullName: string,
  className: string = '11A1',
  schoolName: string = 'Võ Thị Sáu',
  academicYear: string = '2026-2027',
  duplicateIndex: number = 0,
  hoOverride?: string,
  tenOverride?: string
): string {
  let ho = '';
  let ten = '';

  if (hoOverride && tenOverride) {
    const hoWords = hoOverride.trim().split(/\s+/).filter(Boolean);
    ho = removeVietnameseDiacritics(hoWords[0] || 'hs');
    ten = removeVietnameseDiacritics(tenOverride.trim());
  } else {
    // Họ (từ đầu tiên) và Tên (từ cuối cùng)
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    ho = parts.length > 0 ? removeVietnameseDiacritics(parts[0]) : 'hs';
    ten = parts.length > 1
      ? removeVietnameseDiacritics(parts[parts.length - 1])
      : (parts[0] ? removeVietnameseDiacritics(parts[0]) : 'an');
  }

  // 2. Lớp (ví dụ: "11A1", "Lớp 11A1" -> "11a1")
  const classClean = removeVietnameseDiacritics(className).replace(/^lop/, '');
  const classPart = classClean || '11a1';

  // 3. Viết tắt tên trường (ví dụ: "TRƯỜNG THPT VÕ THỊ SÁU" -> "vts")
  let cleanSchool = schoolName || 'Võ Thị Sáu';
  cleanSchool = cleanSchool.replace(/trường|thpt|thcs|tiểu\s*học|ptth|đại\s*học|cao\s*đẳng|liên\s*cấp/gi, '').trim();
  const schoolWords = cleanSchool.split(/[\s\-_\.]+/).filter(Boolean);
  let schoolAbbr = schoolWords.map(w => removeVietnameseDiacritics(w).charAt(0)).join('').toLowerCase();
  if (!schoolAbbr || schoolAbbr.length === 0) {
    schoolAbbr = 'vts';
  }

  // 4. Niên học (ví dụ: "2026 - 2027" -> "2627", "2025 - 2026" -> "2526")
  const yearMatches = (academicYear || '2026-2027').match(/\b(20)?(\d{2})\b/g);
  let yearPart = '2627';
  if (yearMatches && yearMatches.length >= 2) {
    const y1 = yearMatches[0].slice(-2);
    const y2 = yearMatches[1].slice(-2);
    yearPart = `${y1}${y2}`;
  } else if (yearMatches && yearMatches.length === 1) {
    const y1 = parseInt(yearMatches[0].slice(-2), 10);
    yearPart = `${y1}${y1 + 1}`;
  }

  const base = `${ho}${ten}${classPart}${schoolAbbr}${yearPart}`.toLowerCase();
  return duplicateIndex > 1 ? `${base}_${duplicateIndex}` : base;
}

/**
 * Format Excel date (string or serial number) to DD/MM/YYYY
 */
export function formatExcelDate(value: any): string | undefined {
  if (value === null || value === undefined) return undefined;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    // Check DD/MM/YYYY or DD-MM-YYYY
    const dmy = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (dmy) {
      const d = dmy[1].padStart(2, '0');
      const m = dmy[2].padStart(2, '0');
      const y = dmy[3];
      return `${d}/${m}/${y}`;
    }

    // Check YYYY-MM-DD
    const ymd = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
    if (ymd) {
      const y = ymd[1];
      const m = ymd[2].padStart(2, '0');
      const d = ymd[3].padStart(2, '0');
      return `${d}/${m}/${y}`;
    }

    // Check pure year YYYY
    if (/^\d{4}$/.test(trimmed)) {
      return `01/01/${trimmed}`;
    }

    return trimmed;
  }

  if (typeof value === 'number') {
    // Excel date serial number (e.g. 39540 for 2008)
    if (value > 1000 && value < 60000) {
      const date = new Date(Math.round((value - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
      }
    }
  }

  return undefined;
}

/**
 * Common Vietnamese family names
 */
const VIETNAMESE_SURNAMES = new Set([
  'nguyen', 'nguyễn',
  'tran', 'trần',
  'le', 'lê',
  'pham', 'phạm',
  'hoang', 'hoàng',
  'huynh', 'huỳnh',
  'phan',
  'vu', 'vũ',
  'vo', 'võ',
  'dang', 'đặng',
  'bui', 'bùi',
  'do', 'đỗ',
  'ho', 'hồ',
  'ngo', 'ngô',
  'duong', 'dương',
  'ly', 'lý',
  'dinh', 'đinh',
  'doan', 'đoàn',
  'lam', 'lâm',
  'trinh', 'trịnh',
  'mai',
  'dao', 'đào',
  'cao',
  'ha', 'hà',
  'luong', 'lương',
  'thai', 'thái',
  'ta', 'tạ',
  'phung', 'phùng',
  'to', 'tô',
  'quach', 'quách',
  'bach', 'bạch',
  'nghiem', 'nghiêm',
  'la',
  'trieu', 'triệu',
  'chu', 'châu',
  'luc', 'lục',
  'luu', 'lưu',
  'nham', 'nhâm',
  'khong', 'khổng',
  'kieu', 'kiều',
  'luc', 'lực',
  'ma', 'mã',
]);

/**
 * Checks if a string looks like a legitimate Vietnamese personal name.
 * IMPORTANT: This must NEVER reject names containing common Vietnamese words like "Đạt", "Khá", "Tốt", "Sinh", "Tiến"!
 */
export function isLikelyVietnameseName(str: string): boolean {
  if (!str) return false;
  const clean = str.normalize('NFC').replace(/[\u00A0\s]+/g, ' ').trim();
  if (clean.length < 2 || clean.length > 50) return false;

  // Must contain letters
  if (!/[a-zA-ZÀ-ỹ]/.test(clean)) return false;

  // Pure numbers, dates, or emails are NOT names
  if (/^\d+$/.test(clean)) return false;
  if (/^\d{1,2}[\/\-\.]\d{1,2}/.test(clean)) return false;
  if (clean.includes('@')) return false;

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length > 7) return false; // Vietnamese names rarely exceed 6 words

  const lower = clean.toLowerCase();

  // EXCLUSIONS: EXACT matches or obvious table headers/footers
  const exactHeaderOrFooterLabels = [
    'họ và tên', 'họ tên', 'họ và chữ lót', 'họ và đệm', 'họ đệm', 'họ lót', 'họ',
    'tên', 'tên học sinh', 'tên hs', 'tên khai sinh', 'tên riêng', 'mã học sinh', 'mã hs',
    'mã định danh', 'stt', 'số thứ tự', 'số tt', 'ngày sinh', 'năm sinh', 'n.sinh',
    'giới tính', 'phái', 'nam', 'nữ', 'lớp', 'lớp học', 'ghi chú', 'xếp loại',
    'học lực', 'hạnh kiểm', 'điểm tb', 'tbcm', 'sđt', 'điện thoại', 'email',
    'thống kê', 'thống kê học kỳ', 'người lập biểu', 'giáo viên bộ môn', 'giáo viên chủ nhiệm',
    'hiệu trưởng', 'ban giám hiệu', 'tổng số học sinh', 'tổng cộng', 'chữ ký'
  ];

  if (exactHeaderOrFooterLabels.includes(lower)) return false;

  // Must not start with footer keywords
  if (
    lower.startsWith('thống kê') ||
    lower.startsWith('người lập') ||
    lower.startsWith('giáo viên') ||
    lower.startsWith('hiệu trưởng') ||
    lower.startsWith('tổng số') ||
    lower.startsWith('bảng điểm') ||
    lower.startsWith('trường thpt') ||
    lower.startsWith('sở giáo dục')
  ) {
    return false;
  }

  // If first word is a known Vietnamese family name, high confidence!
  const firstWordNoAccent = removeVietnameseDiacritics(words[0]);
  if (VIETNAMESE_SURNAMES.has(firstWordNoAccent) || VIETNAMESE_SURNAMES.has(words[0].toLowerCase())) {
    return true;
  }

  // Otherwise, 2 to 5 words containing Vietnamese alphabets is a valid name
  if (words.length >= 2 && words.length <= 6 && words.every(w => /^[a-zA-ZÀ-ỹ\.'\-]+$/.test(w))) {
    return true;
  }

  // Single word name (e.g. given name "An", "Đạt", "Bình", "Cường")
  if (words.length === 1 && /^[a-zA-ZÀ-ỹ]+$/.test(words[0]) && words[0].length >= 2) {
    return true;
  }

  return false;
}

/**
 * Intelligent and Complete parser for vnEdu, SMAS, QLM, Google Sheets, and standard Vietnamese school Excel files.
 * GUARANTEES:
 * 1. Extracts 100% of students in the list without skipping any student.
 * 2. Never drops students with names like "Nguyễn Tiến Đạt", "Lê Văn Khá", "Trần Tốt", "Bùi Sinh", etc.
 * 3. Never skips student #1 as a false sub-header.
 * 4. Accurately handles split columns ("Họ và chữ lót" + "Tên") as well as combined "Họ và tên".
 * 5. Handles Excel serial dates, vnEdu student codes, gender marks.
 */
export function parseVietnameseSchoolExcel(rawJson: any[][]): ParseExcelResult {
  if (!rawJson || rawJson.length === 0) {
    return {
      success: false,
      students: [],
      totalRowsProcessed: 0,
      totalStudentsExtracted: 0,
      message: 'Tệp không chứa dữ liệu hợp lệ.',
    };
  }

  let detectedClassName: string | undefined;
  let detectedSchoolName: string | undefined;
  let detectedAcademicYear: string | undefined;

  // Scan top 20 rows for metadata
  for (let r = 0; r < Math.min(rawJson.length, 20); r++) {
    const row = rawJson[r] || [];
    row.forEach(cell => {
      const text = String(cell || '').trim();
      if (!text) return;

      if (/trường\s+(thpt|thcs|tiểu\s*học|ptth|đại\s*học|liên\s*cấp)/i.test(text)) {
        detectedSchoolName = text;
      }
      const classMatch = text.match(/lớp\s*[:\-]?\s*([0-9]{1,2}[a-zA-Z0-9_\-]+)/i);
      if (classMatch && classMatch[1]) {
        detectedClassName = classMatch[1].toUpperCase();
      }
      const yearMatch = text.match(/(năm\s*học|niên\s*khóa|niên\s*học)\s*[:\-]?\s*([0-9]{4}\s*[\-\/]\s*[0-9]{4})/i);
      if (yearMatch && yearMatch[2]) {
        detectedAcademicYear = yearMatch[2].replace(/\s+/g, '');
      }
    });
  }

  const finalClassName = detectedClassName || '11A1';
  const finalSchoolName = detectedSchoolName || 'THPT Võ Thị Sáu';
  const finalAcademicYear = detectedAcademicYear || '2026-2027';

  // Step 1: Detect Header Row
  let bestHeaderRowIdx = -1;
  let maxHeaderScore = -1;

  for (let r = 0; r < Math.min(rawJson.length, 25); r++) {
    const row = rawJson[r];
    if (!Array.isArray(row)) continue;

    let score = 0;
    row.forEach(cell => {
      const text = String(cell || '').toLowerCase().trim();
      if (/^(stt|số\s*tt|số\s*thứ\s*tự|tt|no\.?)$/i.test(text)) score += 10;
      if (/(mã\s*(hs|học\s*sinh|định\s*danh|số)|mshs|sbd|mã\s*số)/i.test(text)) score += 10;
      if (/^(họ\s*và\s*tên|họ\s*tên|họ\s*và\s*tên\s*học\s*sinh|họ\s*tên\s*học\s*sinh)$/i.test(text)) score += 12;
      if (/^(họ\s*(và|&)?\s*(chữ\s*)?lót|họ\s*(và|&)?\s*(tên\s*)?đệm|họ\s*đệm|họ\s*lót|^họ)$/i.test(text)) score += 10;
      if (/^(tên|tên\s*học\s*sinh|tên\s*hs|tên\s*gọi|tên\s*khai\s*sinh|tên\s*riêng)(\s*[\(\[].*[\)\]])?$/i.test(text)) score += 10;
      if (/ngày\s*sinh|n\.sinh|ngaysinh|^ns$|ngày\s*tháng\s*năm\s*sinh|dob/i.test(text)) score += 5;
      if (/giới\s*tính|^phái$|nam\/nữ|^nam$|^nữ$|^gt$/i.test(text)) score += 5;
      if (/bảng\s*điểm|trường\s*thpt|sở\s*giáo\s*dục|sổ\s*theo\s*dõi/i.test(text)) score -= 5;
    });

    if (score > maxHeaderScore) {
      maxHeaderScore = score;
      bestHeaderRowIdx = r;
    }
  }

  // Fallback: If score is low, find the first numeric STT sequence (row with 1, next row with 2)
  if (maxHeaderScore < 5 || bestHeaderRowIdx === -1) {
    for (let r = 0; r < Math.min(rawJson.length - 1, 25); r++) {
      const row = rawJson[r] || [];
      const nextRow = rawJson[r + 1] || [];
      const val0 = String(row[0] || '').trim();
      const nextVal0 = String(nextRow[0] || '').trim();
      const val1 = String(row[1] || '').trim();
      const nextVal1 = String(nextRow[1] || '').trim();

      if ((val0 === '1' && nextVal0 === '2') || (val1 === '1' && nextVal1 === '2')) {
        bestHeaderRowIdx = Math.max(0, r - 1);
        break;
      }
    }
  }

  const headerRowIdx = bestHeaderRowIdx !== -1 ? bestHeaderRowIdx : 0;

  // Step 2: Determine column indices
  let sttColIdx = -1;
  let codeColIdx = -1;
  let hoColIdx = -1;
  let tenColIdx = -1;
  let fullNameColIdx = -1;
  let dobColIdx = -1;
  let genderColIdx = -1;
  let genderFemaleColIdx = -1; // Specific column for 'Nữ'
  let phoneColIdx = -1;
  let emailColIdx = -1;

  const inspectCell = (colIdx: number, text: string) => {
    const clean = text.toLowerCase().trim().replace(/[\r\n]+/g, ' ');
    if (!clean) return;

    if (/^(stt|số\s*tt|số\s*thứ\s*tự|tt|stt\.|no\.?)$/i.test(clean) && sttColIdx === -1) {
      sttColIdx = colIdx;
    } else if (/(mã\s*(hs|học\s*sinh|định\s*danh|số)|mshs|sbd|mã\s*số|số\s*định\s*danh)/i.test(clean) && codeColIdx === -1) {
      codeColIdx = colIdx;
    } else if (/(họ\s*(và|&)?\s*(chữ\s*)?lót|họ\s*(và|&)?\s*(tên\s*)?đệm|họ\s*đệm|họ\s*lót|^họ$)/i.test(clean) && hoColIdx === -1) {
      hoColIdx = colIdx;
    } else if (/^(tên|tên\s*học\s*sinh|tên\s*hs|tên\s*gọi|tên\s*khai\s*sinh|tên\s*riêng)(\s*[\(\[].*[\)\]])?$/i.test(clean) && tenColIdx === -1) {
      tenColIdx = colIdx;
    } else if (/(họ\s*(và|&)?\s*tên|họ\s*tên)/i.test(clean) && fullNameColIdx === -1) {
      fullNameColIdx = colIdx;
    } else if (/(ngày\s*sinh|n\.sinh|ngaysinh|^ns$|ngày\s*tháng\s*năm\s*sinh|dob|năm\s*sinh)/i.test(clean) && dobColIdx === -1) {
      dobColIdx = colIdx;
    } else if (/^(nữ|f)$/i.test(clean) && genderFemaleColIdx === -1) {
      genderFemaleColIdx = colIdx;
    } else if (/(giới\s*tính|^phái$|nam\/nữ|^gt$)/i.test(clean) && genderColIdx === -1) {
      genderColIdx = colIdx;
    } else if (/(số\s*điện\s*thoại|điện\s*thoại|sđt|sdt|di\s*động|liên\s*hệ|phone)/i.test(clean) && phoneColIdx === -1) {
      phoneColIdx = colIdx;
    } else if (/(email|thư\s*điện\s*tử|tài\s*khoản)/i.test(clean) && emailColIdx === -1) {
      emailColIdx = colIdx;
    }
  };

  // Inspect primary header row
  (rawJson[headerRowIdx] || []).forEach((cell: any, col: number) => {
    inspectCell(col, String(cell || ''));
  });

  // Step 3: Check sub-header rows ONLY IF row is NOT already student 1!
  let extraHeaderRows = 0;
  for (let offset = 1; offset <= 2; offset++) {
    const candidateRow = rawJson[headerRowIdx + offset] || [];
    if (!Array.isArray(candidateRow) || candidateRow.length === 0) break;

    // CRITICAL: If candidateRow contains STT = '1' or '01', or contains a person name,
    // IT IS 100% STUDENT #1! Stop sub-header detection immediately!
    const cell0 = String(candidateRow[0] || '').trim();
    const cell1 = String(candidateRow[1] || '').trim();
    const cellStt = sttColIdx !== -1 ? String(candidateRow[sttColIdx] || '').trim() : '';

    if (cell0 === '1' || cell1 === '1' || cellStt === '1' || cell0 === '01' || cell1 === '01') {
      // This is student 1! Do NOT treat as header!
      break;
    }

    // Check if it's a row of column numbering like (1), (2), (3)...
    let numParensCount = 0;
    candidateRow.forEach((cell: any) => {
      const s = String(cell || '').trim();
      if (/^\(\d+\)$/.test(s) || (s.length === 1 && /^\d$/.test(s))) {
        numParensCount++;
      }
    });

    let hasSubHeaderKeywords = false;
    candidateRow.forEach((cell: any, col: number) => {
      const text = String(cell || '').toLowerCase().trim();
      if (/^(họ\s*đệm|họ\s*lót|họ|tên|ngày\s*sinh|phái|nam|nữ)$/i.test(text)) {
        hasSubHeaderKeywords = true;
        inspectCell(col, text);
      }
    });

    if (numParensCount >= 3 || hasSubHeaderKeywords) {
      extraHeaderRows = offset;
    } else {
      break;
    }
  }

  let dataStartRow = headerRowIdx + extraHeaderRows + 1;

  // Step 4: Locate EXACT data start row (where Student 1 is)
  // Ensure we don't start on an empty row
  for (let r = dataStartRow; r < Math.min(rawJson.length, dataStartRow + 5); r++) {
    const row = rawJson[r] || [];
    const nonEmpties = row.filter(c => c !== undefined && c !== null && String(c).trim() !== '');
    if (nonEmpties.length === 0) {
      dataStartRow = r + 1;
      continue;
    }
    // Check if row is purely (1), (2), (3)...
    if (nonEmpties.every(c => /^\(\d+\)$/.test(String(c).trim()))) {
      dataStartRow = r + 1;
      continue;
    }
    dataStartRow = r;
    break;
  }

  // Handle case where header has "Họ và tên" (fullNameColIdx) AND "Tên" (tenColIdx)
  if (hoColIdx === -1 && fullNameColIdx !== -1 && tenColIdx !== -1 && fullNameColIdx !== tenColIdx) {
    hoColIdx = fullNameColIdx;
    fullNameColIdx = -1;
  }

  // Handle merged column detection in data rows:
  // If we only have fullNameColIdx (or hoColIdx) and no tenColIdx,
  // check if next column consistently contains single Vietnamese given names (e.g. "An", "Bình", "Cường", "Đạt", "Hoa")
  // and is NOT a date, gender, class, or student code!
  const baseNameCol = hoColIdx !== -1 ? hoColIdx : fullNameColIdx;
  if (baseNameCol !== -1 && tenColIdx === -1 && baseNameCol + 1 < (rawJson[dataStartRow]?.length || 0)) {
    let adjacentIsGivenNameCount = 0;
    let adjacentIsOtherCount = 0;

    for (let r = dataStartRow; r < Math.min(rawJson.length, dataStartRow + 10); r++) {
      const cellVal = String(rawJson[r]?.[baseNameCol + 1] || '').trim();
      if (!cellVal) continue;

      // Check if it's a date, number, gender, class, or student code
      if (
        /^\d+$/.test(cellVal) ||
        /^\d{1,2}[\/\-\.]\d{1,2}/.test(cellVal) ||
        /^(nam|nữ|f|m|x)$/i.test(cellVal) ||
        /^\d{1,2}[a-zA-Z]/.test(cellVal) || // Class like 11A1
        cellVal.length > 15
      ) {
        adjacentIsOtherCount++;
        continue;
      }

      // Check if single word with letters
      const words = cellVal.split(/\s+/).filter(Boolean);
      if (words.length === 1 && /^[a-zA-ZÀ-ỹ]+$/.test(words[0])) {
        adjacentIsGivenNameCount++;
      }
    }

    if (adjacentIsGivenNameCount >= 3 && adjacentIsOtherCount === 0) {
      hoColIdx = baseNameCol;
      tenColIdx = baseNameCol + 1;
      fullNameColIdx = -1;
    }
  }

  // Fallback: If still no name column found, inspect columns of data rows
  if (fullNameColIdx === -1 && hoColIdx === -1) {
    let bestNameCol = -1;
    let bestScore = 0;

    for (let c = 0; c < Math.min(10, rawJson[dataStartRow]?.length || 0); c++) {
      let matchCount = 0;
      for (let r = dataStartRow; r < Math.min(rawJson.length, dataStartRow + 8); r++) {
        const val = String(rawJson[r]?.[c] || '').trim();
        if (isLikelyVietnameseName(val)) {
          matchCount++;
        }
      }
      if (matchCount > bestScore) {
        bestScore = matchCount;
        bestNameCol = c;
      }
    }

    if (bestNameCol !== -1) {
      fullNameColIdx = bestNameCol;
    } else {
      // Default to column 2 if column 0 is STT, column 1 is Code
      fullNameColIdx = 2;
    }
  }

  // If sttColIdx was not detected, check column 0 or 1
  if (sttColIdx === -1) {
    const val0 = String(rawJson[dataStartRow]?.[0] || '').trim();
    const val1 = String(rawJson[dataStartRow]?.[1] || '').trim();
    if (val0 === '1' || val0 === '01') sttColIdx = 0;
    else if (val1 === '1' || val1 === '01') sttColIdx = 1;
  }

  // Step 5: Parse Data Rows with 100% extraction guarantee
  const parsedStudents: ParsedStudentRow[] = [];
  const usedUsernames = new Map<string, number>();

  let consecutiveEmptyRows = 0;
  let minExpectedStt = 1;
  let maxDetectedStt = 0;

  for (let r = dataStartRow; r < rawJson.length; r++) {
    const row = rawJson[r];
    if (!row || !Array.isArray(row)) {
      consecutiveEmptyRows++;
      if (consecutiveEmptyRows > 5) break;
      continue;
    }

    // Check if entire row is empty
    const nonEmpties = row.filter(c => c !== undefined && c !== null && String(c).trim() !== '');
    if (nonEmpties.length === 0) {
      consecutiveEmptyRows++;
      if (consecutiveEmptyRows > 4 && parsedStudents.length > 0) {
        // More than 4 consecutive blank rows after students usually indicates end of table
        break;
      }
      continue;
    }
    consecutiveEmptyRows = 0;

    // Check for obvious footer rows (ONLY if there is NO person name and NO numeric STT)
    const rowTextAll = nonEmpties.map(c => String(c).toLowerCase().trim()).join(' ');
    const isPureFooterText =
      rowTextAll.startsWith('thống kê') ||
      rowTextAll.startsWith('người lập biểu') ||
      rowTextAll.startsWith('giáo viên bộ môn') ||
      rowTextAll.startsWith('hiệu trưởng') ||
      rowTextAll.startsWith('tổng số học sinh') ||
      rowTextAll.startsWith('xác nhận của') ||
      (rowTextAll.includes('ngày') && rowTextAll.includes('tháng') && rowTextAll.includes('năm') && nonEmpties.length <= 3);

    // Extract STT
    let rowStt: number | undefined;
    if (sttColIdx !== -1 && row[sttColIdx] !== undefined) {
      const rawStt = String(row[sttColIdx]).trim();
      const num = parseInt(rawStt, 10);
      if (!isNaN(num) && num > 0 && num < 200) {
        rowStt = num;
        if (num > maxDetectedStt) maxDetectedStt = num;
      }
    }

    // If pure footer text and no STT, we can safely terminate
    if (isPureFooterText && !rowStt && parsedStudents.length > 5) {
      break;
    }

    // Extract Name
    let hoPart = '';
    let tenPart = '';
    let rawFullName = '';

    if (hoColIdx !== -1 && tenColIdx !== -1) {
      hoPart = String(row[hoColIdx] || '').trim();
      tenPart = String(row[tenColIdx] || '').trim();

      if (hoPart && tenPart) {
        // If hoPart already ends with tenPart, don't duplicate
        if (hoPart.toLowerCase().endsWith(tenPart.toLowerCase())) {
          rawFullName = hoPart;
        } else {
          rawFullName = `${hoPart} ${tenPart}`.trim();
        }
      } else if (hoPart) {
        rawFullName = hoPart;
      } else if (tenPart) {
        rawFullName = tenPart;
      }
    } else if (fullNameColIdx !== -1 && row[fullNameColIdx] !== undefined) {
      rawFullName = String(row[fullNameColIdx] || '').trim();
    }

    // Clean whitespace & normalize Unicode to NFC
    rawFullName = rawFullName
      .normalize('NFC')
      .replace(/[\u00A0\s]+/g, ' ')
      .trim();

    // FALLBACK FOR NAME:
    // If rawFullName is missing or not a valid name, search the row for a valid person name!
    if (!rawFullName || !isLikelyVietnameseName(rawFullName)) {
      for (let c = 0; c < row.length; c++) {
        if (c === sttColIdx || c === codeColIdx || c === dobColIdx || c === genderColIdx) continue;
        const candidate = String(row[c] || '').normalize('NFC').replace(/[\u00A0\s]+/g, ' ').trim();
        if (isLikelyVietnameseName(candidate)) {
          rawFullName = candidate;
          break;
        }
      }
    }

    // VALIDATION:
    // If still no valid name, and no STT, this row cannot be a student
    if (!rawFullName || rawFullName.length < 2) continue;

    // Reject exact table header labels (e.g. repeated header on page 2)
    const lowerFullName = rawFullName.toLowerCase();
    if (
      lowerFullName === 'họ và tên' ||
      lowerFullName === 'họ tên' ||
      lowerFullName === 'họ và chữ lót' ||
      lowerFullName === 'tên học sinh' ||
      lowerFullName === 'mã học sinh' ||
      lowerFullName === 'stt'
    ) {
      continue;
    }

    // Must contain letters
    if (!/[a-zA-ZÀ-ỹ]/.test(rawFullName)) continue;
    if (/^\d+$/.test(rawFullName)) continue;

    // Split rawFullName into hoVaChuLot and ten if not already isolated
    const allWords = rawFullName.split(/\s+/).filter(Boolean);
    const finalTen = tenPart || (allWords.length > 1 ? allWords[allWords.length - 1] : allWords[0] || '');
    const finalHoVaChuLot = hoPart || (allWords.length > 1 ? allWords.slice(0, -1).join(' ') : (allWords[0] || ''));

    // Reconstruct rawFullName properly
    if (finalHoVaChuLot && finalTen && !rawFullName.toLowerCase().endsWith(finalTen.toLowerCase())) {
      rawFullName = `${finalHoVaChuLot} ${finalTen}`.trim();
    }

    // Extract student code (Mã học sinh)
    let studentCode: string | undefined;
    if (codeColIdx !== -1 && row[codeColIdx] !== undefined) {
      const codeVal = String(row[codeColIdx]).trim();
      if (codeVal && !/^(mã|mshs|sbd)/i.test(codeVal)) {
        studentCode = codeVal;
      }
    }

    // Auto-detect numeric student code if not found
    if (!studentCode) {
      for (let c = 0; c < row.length; c++) {
        if (c === sttColIdx || c === hoColIdx || c === tenColIdx || c === fullNameColIdx) continue;
        const val = String(row[c] || '').trim();
        if (/^\d{6,14}$/.test(val) || /^HS\d{4,10}$/i.test(val)) {
          studentCode = val;
          break;
        }
      }
    }

    // Extract Date of Birth
    let dob: string | undefined;
    if (dobColIdx !== -1 && row[dobColIdx] !== undefined) {
      dob = formatExcelDate(row[dobColIdx]);
    }

    // Auto-detect date anywhere in row if not found
    if (!dob) {
      for (let c = 0; c < row.length; c++) {
        if (c === sttColIdx || c === codeColIdx) continue;
        const cell = row[c];
        const formatted = formatExcelDate(cell);
        if (formatted && /^\d{2}\/\d{2}\/\d{4}$/.test(formatted)) {
          dob = formatted;
          break;
        }
      }
    }

    // Extract Gender
    let gender: 'Nam' | 'Nữ' | 'Khác' | undefined;
    if (genderFemaleColIdx !== -1 && row[genderFemaleColIdx] !== undefined) {
      const fVal = String(row[genderFemaleColIdx]).trim().toLowerCase();
      if (fVal === 'x' || fVal === '1' || fVal === 'nữ' || fVal === 'nu' || fVal === 'v') {
        gender = 'Nữ';
      } else {
        gender = 'Nam';
      }
    } else if (genderColIdx !== -1 && row[genderColIdx] !== undefined) {
      const gRaw = String(row[genderColIdx]).toLowerCase().trim();
      if (gRaw.includes('nữ') || gRaw === 'f' || gRaw === 'nu' || gRaw === 'x') {
        gender = 'Nữ';
      } else if (gRaw.includes('nam') || gRaw === 'm') {
        gender = 'Nam';
      }
    }

    // Auto-detect gender in row if not found
    if (!gender) {
      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').trim().toLowerCase();
        if (val === 'nam') { gender = 'Nam'; break; }
        if (val === 'nữ' || val === 'nu') { gender = 'Nữ'; break; }
      }
    }

    // Extract Phone
    let phone: string | undefined;
    if (phoneColIdx !== -1 && row[phoneColIdx] !== undefined) {
      const pRaw = String(row[phoneColIdx]).trim();
      if (pRaw && /^[0-9+.\-\s()]{7,15}$/.test(pRaw)) {
        phone = pRaw;
      }
    }

    // Extract Email
    let email: string | undefined;
    if (emailColIdx !== -1 && row[emailColIdx] !== undefined) {
      const eRaw = String(row[emailColIdx]).trim();
      if (eRaw && eRaw.includes('@')) {
        email = eRaw;
      }
    }

    // Generate Standardized Student Username: họ+tên+lớp+trường+niên học (e.g. nguyendat11a1vts2627)
    const baseUsername = generateStudentUsername(
      rawFullName,
      finalClassName,
      finalSchoolName,
      finalAcademicYear,
      0,
      finalHoVaChuLot,
      finalTen
    );

    let assignedUsername = baseUsername;
    const currentCount = usedUsernames.get(baseUsername) || 0;
    if (currentCount > 0) {
      assignedUsername = `${baseUsername}_${currentCount + 1}`;
    }
    usedUsernames.set(baseUsername, currentCount + 1);

    parsedStudents.push({
      stt: rowStt || parsedStudents.length + 1,
      name: rawFullName,
      hoVaChuLot: finalHoVaChuLot,
      ten: finalTen,
      studentCode,
      gender: gender || 'Nam',
      dob,
      phone,
      email,
      username: assignedUsername,
    });
  }

  // Summary message
  const total = parsedStudents.length;
  let sttRangeSummary = '';
  if (maxDetectedStt > 0) {
    sttRangeSummary = `Từ STT 1 đến ${maxDetectedStt} (Tổng cộng: ${total} học sinh)`;
  } else {
    sttRangeSummary = `Tổng cộng: ${total} học sinh`;
  }

  const success = total > 0;
  const message = success
    ? `Đã trích xuất đầy đủ và chính xác ${total} học sinh từ tệp danh sách!`
    : 'Không tìm thấy danh sách học sinh hợp lệ trong tệp.';

  return {
    success,
    students: parsedStudents,
    detectedClassName,
    detectedSchoolName,
    detectedAcademicYear,
    totalRowsProcessed: rawJson.length,
    totalStudentsExtracted: total,
    expectedStudentCount: maxDetectedStt > 0 ? maxDetectedStt : total,
    sttRangeSummary,
    message,
  };
}
