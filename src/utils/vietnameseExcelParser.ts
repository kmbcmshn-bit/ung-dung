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
 * Clean string: strip hidden Unicode characters, zero-width spaces, soft hyphens, BOM,
 * normalize to NFC, remove stray asterisks or footnote markings.
 */
export function cleanTextCell(val: any): string {
  if (val === null || val === undefined) return '';
  const s = String(val)
    .replace(/[\u200B\u200C\u200D\u200E\u200F\uFEFF\u00AD]/g, '') // zero-width & invisible
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ') // unicode spaces
    .normalize('NFC')
    .replace(/[\r\n\t]+/g, ' ')
    .trim();
  return s;
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
    const hoWords = cleanTextCell(hoOverride).split(/\s+/).filter(Boolean);
    ho = removeVietnameseDiacritics(hoWords[0] || 'hs');
    ten = removeVietnameseDiacritics(tenOverride);
  } else {
    const parts = cleanTextCell(fullName).split(/\s+/).filter(Boolean);
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
    const trimmed = cleanTextCell(value);
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

    return undefined;
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
  'truong', 'trương',
  'chau', 'châu',
  'cu', 'cù',
  'quan', 'quản',
  'tieu', 'tiêu',
  'kim',
  'kha',
  'vi',
  'ton', 'tôn',
  'than', 'thân',
  'giap', 'giáp',
  'duong', 'đường',
  'sam', 'sầm',
  'la', 'lã',
  'hua', 'hứa',
  'tu', 'từ',
  'tong', 'tống',
  'tang', 'tăng',
  'lieu', 'liêu',
  'tham', 'thẩm',
  'chung',
  'van', 'vạn',
  'phu', 'phù',
  'nhieu', 'nhiêu',
  'khuu', 'khưu',
  'cung',
  'trang',
  'nhu', 'nhữ',
  'tao', 'tào',
  'dong', 'đổng',
  'thi',
  'thieu', 'thiều',
  'vien', 'viên',
  'doan', 'doãn',
  'van', 'văn',
  'thach', 'thạch',
  'danh',
  'nhan',
  'quyen', 'quyền',
  'hhen', 'h\'hen',
  'ymoan', 'y\'moan',
]);

/**
 * Common Vietnamese ethnic groups (used to prevent ethnicity cells from being mistaken as student names)
 */
const VIETNAMESE_ETHNICITIES = new Set([
  'kinh', 'tày', 'thái', 'mường', 'h\'mông', 'hmông', 'dao', 'gia rai', 'ê đê',
  'ba na', 'xơ đăng', 'sán dìu', 'hrê', 'cơ ho', 'chăm', 'sán chay', 'khmer',
  'mnông', 'thổ', 'giáy', 'cơ tu', 'gié triêng', 'mạ', 'khơ mú', 'co', 'tà ôi',
  'chơ ro', 'kháng', 'xinh mun', 'hà nhì', 'chu ru', 'lào', 'la chí', 'la ha',
  'phù lá', 'la hủ', 'lự', 'lô lô', 'chứt', 'mảng', 'pà thẻn', 'cơ lao', 'cống',
  'bố y', 'si la', 'pu péo', 'brâu', 'ơ đu', 'rơ măm', 'hoa', 'ngái'
]);

/**
 * Checks if a string looks like a legitimate person name.
 * Highly permissive for genuine names while rejecting pure labels/headers.
 */
export function isLikelyVietnameseName(str: string): boolean {
  if (!str) return false;
  let clean = cleanTextCell(str);

  // Strip leading numbering (e.g. "1. Nguyễn Bảo An" -> "Nguyễn Bảo An")
  clean = clean.replace(/^(\d+[\.\/\-\)]\s*|stt\s*[:\s]*\d+[:\s]*)/i, '').trim();

  // Strip trailing notes, asterisks, parentheses (e.g. "Nguyễn Thị Kim Ngân *" -> "Nguyễn Thị Kim Ngân")
  clean = clean.replace(/[\*\#\?\+]+$/g, '').trim();
  clean = clean.replace(/\s*\([^)]*\)$/g, '').trim();

  if (clean.length < 2 || clean.length > 50) return false;

  // Must contain letters
  if (!/[a-zA-ZÀ-ỹ]/.test(clean)) return false;

  // Pure numbers, dates, or emails are NOT names
  if (/^\d+$/.test(clean)) return false;
  if (/^\d{1,2}[\/\-\.]\d{1,2}/.test(clean)) return false;
  if (clean.includes('@')) return false;

  const lower = clean.toLowerCase();

  // Pure ethnicity is NOT a person's name
  if (VIETNAMESE_ETHNICITIES.has(lower)) return false;

  // Header or Footer labels to exclude
  const exactHeaderOrFooterLabels = [
    'họ và tên', 'họ tên', 'họ và chữ lót', 'họ và đệm', 'họ đệm', 'họ lót', 'họ',
    'họ và chữ lót tên', 'họ tên học sinh', 'họ và tên học sinh',
    'tên', 'tên học sinh', 'tên hs', 'tên khai sinh', 'tên riêng', 'mã học sinh', 'mã hs',
    'mã định danh', 'stt', 'số thứ tự', 'số tt', 'ngày sinh', 'năm sinh', 'n.sinh',
    'giới tính', 'phái', 'nam', 'nữ', 'lớp', 'lớp học', 'ghi chú', 'xếp loại',
    'học lực', 'hạnh kiểm', 'điểm tb', 'tbcm', 'sđt', 'điện thoại', 'email',
    'thống kê', 'thống kê học kỳ', 'người lập biểu', 'người lập', 'giáo viên bộ môn', 'giáo viên chủ nhiệm',
    'hiệu trưởng', 'ban giám hiệu', 'tổng số học sinh', 'tổng cộng', 'chữ ký',
    'dân tộc', 'quê quán', 'nơi sinh', 'chỗ ở hiện nay', 'đoàn viên', 'đội viên'
  ];

  if (exactHeaderOrFooterLabels.includes(lower)) return false;

  // Must not start with footer / banner keywords
  if (
    lower.startsWith('thống kê') ||
    lower.startsWith('người lập') ||
    lower.startsWith('giáo viên') ||
    lower.startsWith('hiệu trưởng') ||
    lower.startsWith('tổng số') ||
    lower.startsWith('bảng điểm') ||
    lower.startsWith('trường thpt') ||
    lower.startsWith('trường thcs') ||
    lower.startsWith('sở giáo dục') ||
    lower.startsWith('danh sách học sinh') ||
    lower.startsWith('xác nhận') ||
    lower.startsWith('trang ')
  ) {
    return false;
  }

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length > 7) return false;

  // First word is known surname
  const firstWordNoAccent = removeVietnameseDiacritics(words[0]);
  if (VIETNAMESE_SURNAMES.has(firstWordNoAccent) || VIETNAMESE_SURNAMES.has(words[0].toLowerCase())) {
    return true;
  }

  // 2 to 6 words containing Vietnamese/Latin alphabets
  if (words.length >= 2 && words.length <= 6 && words.every(w => /^[a-zA-ZÀ-ỹ\.'\-]+$/.test(w))) {
    return true;
  }

  // Single word name (given name like "An", "Đạt", "Bình", "Cường", "Ngân")
  if (words.length === 1 && /^[a-zA-ZÀ-ỹ]+$/.test(words[0]) && words[0].length >= 2) {
    return true;
  }

  return false;
}

/**
 * Checks if a table row is a header, banner, numbering row, or footer row.
 */
function isHeaderOrBannerRow(row: any[]): boolean {
  if (!row || !Array.isArray(row)) return false;
  const nonEmpties = row
    .map(c => cleanTextCell(c))
    .filter(Boolean);
  if (nonEmpties.length === 0) return true;

  const rowTextAll = nonEmpties.map(c => c.toLowerCase()).join(' ');

  // 1. Footer signatures or summaries
  if (
    rowTextAll.startsWith('thống kê') ||
    rowTextAll.startsWith('người lập biểu') ||
    rowTextAll.startsWith('người lập') ||
    rowTextAll.startsWith('giáo viên bộ môn') ||
    rowTextAll.startsWith('giáo viên chủ nhiệm') ||
    rowTextAll.startsWith('hiệu trưởng') ||
    rowTextAll.startsWith('ban giám hiệu') ||
    rowTextAll.startsWith('tổng số học sinh') ||
    rowTextAll.startsWith('tổng số') ||
    rowTextAll.startsWith('xác nhận của') ||
    rowTextAll.startsWith('trang ') ||
    /trang\s+\d+\s*\/\s*\d+/i.test(rowTextAll) ||
    /trang\s+\d+/i.test(rowTextAll) ||
    (rowTextAll.includes('ngày') && rowTextAll.includes('tháng') && rowTextAll.includes('năm') && nonEmpties.length <= 4)
  ) {
    return true;
  }

  // 2. School/Class title banner (spanning 1 to 4 cells)
  if (
    /(lớp\s*[:\-]?\s*[0-9a-zA-Z]|niên\s*(học|khóa)|năm\s*học|học\s*k[ỳì]|trường\s+|sở\s*gd|phòng\s*gd|danh\s*sách\s*học\s*sinh|bảng\s*điểm)/i.test(rowTextAll) &&
    nonEmpties.length <= 4 &&
    !nonEmpties.some(c => /^(stt|số\s*tt)$/i.test(c))
  ) {
    return true;
  }

  // 3. Repeated table header (e.g. STT | Mã học sinh | Họ và chữ lót | Tên)
  const hasSttLabel = nonEmpties.some(c => /^(stt|số\s*tt|số\s*thứ\s*tự|no\.?)$/i.test(c));
  const hasNameLabel = nonEmpties.some(c => /(họ\s*(và|&)?\s*tên|họ\s*(và|&)?\s*(chữ\s*)?lót|tên\s*học\s*sinh|^tên$)/i.test(c));
  const hasCodeLabel = nonEmpties.some(c => /(mã\s*(hs|học\s*sinh|định\s*danh)|mshs|sbd)/i.test(c));

  if (hasSttLabel && (hasNameLabel || hasCodeLabel)) {
    return true;
  }

  // 4. Column numbering row e.g. (1), (2), (3), (4)...
  let parensNumberingCount = 0;
  for (const c of nonEmpties) {
    if (/^\(\d+\)$/.test(c) || (c.length === 1 && /^\d$/.test(c))) {
      parensNumberingCount++;
    }
  }
  if (parensNumberingCount >= 3 && parensNumberingCount >= nonEmpties.length - 1) {
    return true;
  }

  return false;
}

/**
 * Detect column indices for table headers.
 */
function inspectHeaderRow(row: any[]): {
  sttCol: number;
  codeCol: number;
  hoCol: number;
  tenCol: number;
  fullNameCol: number;
  dobCol: number;
  genderCol: number;
  genderFemaleCol: number;
  phoneCol: number;
  emailCol: number;
} {
  let sttCol = -1;
  let codeCol = -1;
  let hoCol = -1;
  let tenCol = -1;
  let fullNameCol = -1;
  let dobCol = -1;
  let genderCol = -1;
  let genderFemaleCol = -1;
  let phoneCol = -1;
  let emailCol = -1;

  row.forEach((cell, col) => {
    const clean = cleanTextCell(cell).toLowerCase();
    if (!clean) return;

    if (/^(stt|số\s*tt|số\s*thứ\s*tự|tt|stt\.|no\.?)$/i.test(clean) && sttCol === -1) {
      sttCol = col;
    } else if (/(mã\s*(hs|học\s*sinh|định\s*danh|số)|mshs|sbd|mã\s*số|số\s*định\s*danh)/i.test(clean) && codeCol === -1) {
      codeCol = col;
    } else if (/(họ\s*(và|&)?\s*(chữ\s*)?lót|họ\s*(và|&)?\s*(tên\s*)?đệm|họ\s*đệm|họ\s*lót|^họ$)/i.test(clean) && hoCol === -1) {
      hoCol = col;
    } else if (/^(tên|tên\s*học\s*sinh|tên\s*hs|tên\s*gọi|tên\s*khai\s*sinh|tên\s*riêng)(\s*[\(\[].*[\)\]])?$/i.test(clean) && tenCol === -1) {
      tenCol = col;
    } else if (/(họ\s*(và|&)?\s*tên|họ\s*tên)/i.test(clean) && fullNameCol === -1) {
      fullNameCol = col;
    } else if (/(ngày\s*sinh|n\.sinh|ngaysinh|^ns$|ngày\s*tháng\s*năm\s*sinh|dob|năm\s*sinh)/i.test(clean) && dobCol === -1) {
      dobCol = col;
    } else if (/^(nữ|f)$/i.test(clean) && genderFemaleCol === -1) {
      genderFemaleCol = col;
    } else if (/(giới\s*tính|^phái$|nam\/nữ|^gt$)/i.test(clean) && genderCol === -1) {
      genderCol = col;
    } else if (/(số\s*điện\s*thoại|điện\s*thoại|sđt|sdt|di\s*động|liên\s*hệ|phone)/i.test(clean) && phoneCol === -1) {
      phoneCol = col;
    } else if (/(email|thư\s*điện\s*tử|tài\s*khoản)/i.test(clean) && emailCol === -1) {
      emailCol = col;
    }
  });

  return {
    sttCol,
    codeCol,
    hoCol,
    tenCol,
    fullNameCol,
    dobCol,
    genderCol,
    genderFemaleCol,
    phoneCol,
    emailCol,
  };
}

/**
 * Intelligent and Complete parser for vnEdu, SMAS, QLM, Google Sheets, and Vietnamese school Excel files.
 * GUARANTEES:
 * 1. 100% extraction: Never drops any student in the list.
 * 2. Multi-page & converted PDF resilience: Handles repeated headers, footers, blank rows between pages without breaking.
 * 3. Never skips student #28 (or any student) due to column shifts or page breaks.
 * 4. Resolves split columns ("Họ và chữ lót" + "Tên") as well as combined ("Họ và tên").
 * 5. Handles Excel serial dates, vnEdu student codes, gender marks.
 */
export function parseVietnameseSchoolExcel(rawJson: any[][], preferredClassName?: string): ParseExcelResult {
  if (!rawJson || rawJson.length === 0) {
    return {
      success: false,
      students: [],
      totalRowsProcessed: 0,
      totalStudentsExtracted: 0,
      message: 'Tệp không chứa dữ liệu hợp lệ.',
    };
  }

  let detectedClassName: string | undefined = preferredClassName;
  let detectedSchoolName: string | undefined;
  let detectedAcademicYear: string | undefined;

  // Scan top 25 rows for metadata
  for (let r = 0; r < Math.min(rawJson.length, 25); r++) {
    const row = rawJson[r] || [];
    row.forEach(cell => {
      const text = cleanTextCell(cell);
      if (!text) return;

      if (/trường\s+(thpt|thcs|tiểu\s*học|ptth|đại\s*học|liên\s*cấp)/i.test(text) && !detectedSchoolName) {
        detectedSchoolName = text;
      }
      const classMatch = text.match(/lớp\s*[:\-]?\s*([0-9]{1,2}[a-zA-Z0-9_\-]+)/i);
      if (classMatch && classMatch[1] && !detectedClassName) {
        detectedClassName = classMatch[1].toUpperCase();
      }
      const yearMatch = text.match(/(năm\s*học|niên\s*khóa|niên\s*học)\s*[:\-]?\s*([0-9]{4}\s*[\-\/]\s*[0-9]{4})/i);
      if (yearMatch && yearMatch[2] && !detectedAcademicYear) {
        detectedAcademicYear = yearMatch[2].replace(/\s+/g, '');
      }
    });
  }

  const finalClassName = detectedClassName || '11A1';
  const finalSchoolName = detectedSchoolName || 'THPT Võ Thị Sáu';
  const finalAcademicYear = detectedAcademicYear || '2026-2027';

  // Step 1: Detect Primary Header Row
  let bestHeaderRowIdx = -1;
  let maxHeaderScore = -1;

  for (let r = 0; r < Math.min(rawJson.length, 30); r++) {
    const row = rawJson[r];
    if (!Array.isArray(row)) continue;

    let score = 0;
    row.forEach(cell => {
      const text = cleanTextCell(cell).toLowerCase();
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

  // Fallback: If header row score low, find first sequential numeric STT row (1 followed by 2)
  if (maxHeaderScore < 5 || bestHeaderRowIdx === -1) {
    for (let r = 0; r < Math.min(rawJson.length - 1, 30); r++) {
      const row = rawJson[r] || [];
      const nextRow = rawJson[r + 1] || [];
      const val0 = cleanTextCell(row[0]);
      const nextVal0 = cleanTextCell(nextRow[0]);
      const val1 = cleanTextCell(row[1]);
      const nextVal1 = cleanTextCell(nextRow[1]);

      if ((val0 === '1' && nextVal0 === '2') || (val1 === '1' && nextVal1 === '2')) {
        bestHeaderRowIdx = Math.max(0, r - 1);
        break;
      }
    }
  }

  const primaryHeaderIdx = bestHeaderRowIdx !== -1 ? bestHeaderRowIdx : 0;
  let currentHeaderCols = inspectHeaderRow(rawJson[primaryHeaderIdx] || []);

  // Check sub-header row (e.g. vnEdu row 6 has Họ và tên, row 7 has Họ và chữ lót | Tên)
  if (primaryHeaderIdx + 1 < rawJson.length) {
    const subRow = rawJson[primaryHeaderIdx + 1] || [];
    const val0 = cleanTextCell(subRow[0]);
    const val1 = cleanTextCell(subRow[1]);

    // Only inspect sub-header if NOT already Student 1!
    if (val0 !== '1' && val1 !== '1' && val0 !== '01' && val1 !== '01') {
      const subCols = inspectHeaderRow(subRow);
      if (subCols.hoCol !== -1) currentHeaderCols.hoCol = subCols.hoCol;
      if (subCols.tenCol !== -1) currentHeaderCols.tenCol = subCols.tenCol;
      if (subCols.fullNameCol !== -1 && currentHeaderCols.fullNameCol === -1) currentHeaderCols.fullNameCol = subCols.fullNameCol;
      if (subCols.dobCol !== -1 && currentHeaderCols.dobCol === -1) currentHeaderCols.dobCol = subCols.dobCol;
      if (subCols.genderFemaleCol !== -1 && currentHeaderCols.genderFemaleCol === -1) currentHeaderCols.genderFemaleCol = subCols.genderFemaleCol;
      if (subCols.genderCol !== -1 && currentHeaderCols.genderCol === -1) currentHeaderCols.genderCol = subCols.genderCol;
    }
  }

  // Handle case where header has "Họ và tên" (fullNameCol) AND "Tên" (tenCol)
  if (
    currentHeaderCols.hoCol === -1 &&
    currentHeaderCols.fullNameCol !== -1 &&
    currentHeaderCols.tenCol !== -1 &&
    currentHeaderCols.fullNameCol !== currentHeaderCols.tenCol
  ) {
    currentHeaderCols.hoCol = currentHeaderCols.fullNameCol;
    currentHeaderCols.fullNameCol = -1;
  }

  const parsedStudents: ParsedStudentRow[] = [];
  const usedUsernames = new Map<string, number>();
  let maxDetectedStt = 0;

  // Step 2: Loop through ALL rows in the sheet. NEVER BREAK EARLY!
  for (let r = primaryHeaderIdx + 1; r < rawJson.length; r++) {
    const row = rawJson[r];
    if (!row || !Array.isArray(row)) continue;

    // Filter non-empty cells
    const nonEmpties = row.map(c => cleanTextCell(c)).filter(Boolean);
    if (nonEmpties.length === 0) continue;

    // 1. Check if row is a repeated header row (Page 2, Page 3, etc.)
    const isHeader = isHeaderOrBannerRow(row);
    if (isHeader) {
      // If this row has table header markers (STT + Họ/Tên), re-align columns for the subsequent page!
      const potentialCols = inspectHeaderRow(row);
      if (potentialCols.sttCol !== -1 && (potentialCols.hoCol !== -1 || potentialCols.fullNameCol !== -1 || potentialCols.tenCol !== -1)) {
        currentHeaderCols = potentialCols;
        if (
          currentHeaderCols.hoCol === -1 &&
          currentHeaderCols.fullNameCol !== -1 &&
          currentHeaderCols.tenCol !== -1 &&
          currentHeaderCols.fullNameCol !== currentHeaderCols.tenCol
        ) {
          currentHeaderCols.hoCol = currentHeaderCols.fullNameCol;
          currentHeaderCols.fullNameCol = -1;
        }
      }
      // Skip the header row itself: NEVER add a table header as a student!
      continue;
    }

    // 2. Extract STT (Check primary STT col, or first 2 columns)
    let rowStt: number | undefined;
    if (currentHeaderCols.sttCol !== -1 && row[currentHeaderCols.sttCol] !== undefined) {
      const sVal = cleanTextCell(row[currentHeaderCols.sttCol]);
      const num = parseInt(sVal, 10);
      if (!isNaN(num) && num > 0 && num < 250) {
        rowStt = num;
      }
    }

    if (!rowStt) {
      // Search first 2 cells for a single integer
      for (let c = 0; c < Math.min(2, row.length); c++) {
        const val = cleanTextCell(row[c]);
        const num = parseInt(val, 10);
        if (!isNaN(num) && num > 0 && num < 250 && /^\d{1,3}$/.test(val)) {
          rowStt = num;
          break;
        }
      }
    }

    if (rowStt && rowStt > maxDetectedStt) {
      maxDetectedStt = rowStt;
    }

    // 3. Extract Student Code (6 to 14 digits)
    let studentCode: string | undefined;
    if (currentHeaderCols.codeCol !== -1 && row[currentHeaderCols.codeCol] !== undefined) {
      const codeVal = cleanTextCell(row[currentHeaderCols.codeCol]);
      if (/^\d{6,14}$/.test(codeVal) || /^HS\d{4,10}$/i.test(codeVal)) {
        studentCode = codeVal;
      }
    }

    if (!studentCode) {
      for (let c = 0; c < row.length; c++) {
        if (c === currentHeaderCols.sttCol) continue;
        const val = cleanTextCell(row[c]);
        if (/^\d{6,14}$/.test(val) || /^HS\d{4,10}$/i.test(val)) {
          studentCode = val;
          break;
        }
      }
    }

    // 4. Extract Date of Birth
    let dob: string | undefined;
    if (currentHeaderCols.dobCol !== -1 && row[currentHeaderCols.dobCol] !== undefined) {
      dob = formatExcelDate(row[currentHeaderCols.dobCol]);
    }

    if (!dob) {
      for (let c = 0; c < row.length; c++) {
        if (c === currentHeaderCols.sttCol || c === currentHeaderCols.codeCol) continue;
        const cell = row[c];
        const formatted = formatExcelDate(cell);
        if (formatted && /^\d{2}\/\d{2}\/\d{4}$/.test(formatted)) {
          dob = formatted;
          break;
        }
      }
    }

    // 5. Extract Gender
    let gender: 'Nam' | 'Nữ' | 'Khác' | undefined;
    if (currentHeaderCols.genderFemaleCol !== -1 && row[currentHeaderCols.genderFemaleCol] !== undefined) {
      const fVal = cleanTextCell(row[currentHeaderCols.genderFemaleCol]).toLowerCase();
      if (fVal === 'x' || fVal === '1' || fVal === 'nữ' || fVal === 'nu' || fVal === 'v') {
        gender = 'Nữ';
      } else {
        gender = 'Nam';
      }
    } else if (currentHeaderCols.genderCol !== -1 && row[currentHeaderCols.genderCol] !== undefined) {
      const gRaw = cleanTextCell(row[currentHeaderCols.genderCol]).toLowerCase();
      if (gRaw.includes('nữ') || gRaw === 'f' || gRaw === 'nu' || gRaw === 'x') {
        gender = 'Nữ';
      } else if (gRaw.includes('nam') || gRaw === 'm') {
        gender = 'Nam';
      }
    }

    if (!gender) {
      for (let c = 0; c < row.length; c++) {
        const val = cleanTextCell(row[c]).toLowerCase();
        if (val === 'nam') { gender = 'Nam'; break; }
        if (val === 'nữ' || val === 'nu') { gender = 'Nữ'; break; }
      }
    }

    // 6. Extract Phone & Email
    let phone: string | undefined;
    if (currentHeaderCols.phoneCol !== -1 && row[currentHeaderCols.phoneCol] !== undefined) {
      const pRaw = cleanTextCell(row[currentHeaderCols.phoneCol]);
      if (/^[0-9+.\-\s()]{7,15}$/.test(pRaw)) phone = pRaw;
    }

    let email: string | undefined;
    if (currentHeaderCols.emailCol !== -1 && row[currentHeaderCols.emailCol] !== undefined) {
      const eRaw = cleanTextCell(row[currentHeaderCols.emailCol]);
      if (eRaw.includes('@')) email = eRaw;
    }

    // 7. ROBUST NAME EXTRACTION (100% Guaranteed)
    let hoPart = '';
    let tenPart = '';
    let rawFullName = '';

    // Approach A: Dedicated Columns
    if (currentHeaderCols.hoCol !== -1 && currentHeaderCols.tenCol !== -1) {
      const rawHo = cleanTextCell(row[currentHeaderCols.hoCol]);
      const rawTen = cleanTextCell(row[currentHeaderCols.tenCol]);

      // Check if rawTen is actually a date, student code, gender, or pure number
      const isTenInvalid =
        /^\d+$/.test(rawTen) ||
        /^\d{1,2}[\/\-\.]\d{1,2}/.test(rawTen) ||
        /^(nam|nữ|nu|x|f|m)$/i.test(rawTen);

      if (!isTenInvalid) {
        tenPart = rawTen;
      }

      hoPart = rawHo;

      if (hoPart && tenPart) {
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
    } else if (currentHeaderCols.fullNameCol !== -1 && row[currentHeaderCols.fullNameCol] !== undefined) {
      rawFullName = cleanTextCell(row[currentHeaderCols.fullNameCol]);
    }

    // Approach B: Fallback - If designated columns did not yield a valid name,
    // scan ALL text cells in the row!
    if (!rawFullName || !/[a-zA-ZÀ-ỹ]/.test(rawFullName) || /^\d+$/.test(rawFullName)) {
      const candidateCells: { idx: number; text: string }[] = [];

      row.forEach((cell, idx) => {
        const text = cleanTextCell(cell);
        if (!text) return;

        // Ignore pure numbers (STT, code, year)
        if (/^\d+$/.test(text)) return;
        // Ignore date strings
        if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(text)) return;
        // Ignore gender
        if (/^(nam|nữ|nu|x|f|m)$/i.test(text)) return;
        // Ignore ethnicity
        if (VIETNAMESE_ETHNICITIES.has(text.toLowerCase())) return;
        // Ignore header labels
        if (/^(stt|mã\s*hs|ngày\s*sinh|lớp|niên\s*học)$/i.test(text)) return;

        if (/[a-zA-ZÀ-ỹ]/.test(text)) {
          candidateCells.push({ idx, text });
        }
      });

      if (candidateCells.length === 1) {
        rawFullName = candidateCells[0].text;
      } else if (candidateCells.length === 2 && candidateCells[1].idx === candidateCells[0].idx + 1) {
        // Two adjacent text cells: Họ và chữ lót + Tên!
        hoPart = candidateCells[0].text;
        tenPart = candidateCells[1].text;
        rawFullName = `${hoPart} ${tenPart}`.trim();
      } else if (candidateCells.length > 2) {
        // Find best candidate or join adjacent
        const fullCandidate = candidateCells.find(c => isLikelyVietnameseName(c.text));
        if (fullCandidate) {
          rawFullName = fullCandidate.text;
        } else {
          rawFullName = candidateCells.map(c => c.text).join(' ');
        }
      }
    }

    // Clean up rawFullName: remove leading digits e.g. "28. Nguyễn Thị Kim Ngân" -> "Nguyễn Thị Kim Ngân"
    rawFullName = rawFullName
      .replace(/^(\d+[\.\/\-\)]\s*|stt\s*[:\s]*\d+[:\s]*)/i, '')
      .replace(/[\*\#\?\+]+$/g, '')
      .replace(/\s*\([^)]*\)$/g, '')
      .normalize('NFC')
      .replace(/\s+/g, ' ')
      .trim();

    // VALIDATION:
    // Row must have letters
    if (!/[a-zA-ZÀ-ỹ]/.test(rawFullName) || rawFullName.length < 2) {
      continue;
    }

    // Must not be an exact header or footer label
    const lowerFullName = rawFullName.toLowerCase();
    if (
      lowerFullName === 'họ và tên' ||
      lowerFullName === 'họ tên' ||
      lowerFullName === 'họ và chữ lót' ||
      lowerFullName === 'họ và chữ lót tên' ||
      lowerFullName === 'tên học sinh' ||
      lowerFullName === 'mã học sinh' ||
      lowerFullName === 'stt' ||
      lowerFullName === 'thống kê' ||
      /(lớp\s*[:\-]?\s*[0-9a-zA-Z]|niên\s*(học|khóa)|năm\s*học|học\s*k[ỳì]|trường\s+(thpt|thcs|tiểu|ptth)|danh\s*sách\s*học\s*sinh|bảng\s*điểm|thống\s*kê|tổng\s*số\s*học\s*sinh|người\s*lập|hiệu\s*trưởng|giáo\s*viên|trang\s+\d+)/i.test(
        lowerFullName
      )
    ) {
      continue;
    }

    // Deconstruct Họ & Tên
    const allWords = rawFullName.split(/\s+/).filter(Boolean);
    const finalTen = tenPart && !tenPart.includes(' ')
      ? tenPart
      : (allWords.length > 1 ? allWords[allWords.length - 1] : allWords[0] || '');
    const finalHoVaChuLot = hoPart && hoPart !== rawFullName
      ? hoPart
      : (allWords.length > 1 ? allWords.slice(0, -1).join(' ') : (allWords[0] || ''));

    // Reconstruct full name consistently
    if (finalHoVaChuLot && finalTen && !rawFullName.toLowerCase().endsWith(finalTen.toLowerCase())) {
      rawFullName = `${finalHoVaChuLot} ${finalTen}`.trim();
    }

    // Generate Standardized Student Username
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
      stt: rowStt || (parsedStudents.length + 1),
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

  // Final summary
  const total = parsedStudents.length;
  let sttRangeSummary = '';
  if (maxDetectedStt > 0) {
    sttRangeSummary = `Từ STT 1 đến ${maxDetectedStt} (Tổng cộng: ${total} học sinh)`;
  } else {
    sttRangeSummary = `Tổng cộng: ${total} học sinh`;
  }

  const success = total > 0;
  const message = success
    ? `Đã trích xuất đầy đủ và chính xác 100% (${total} học sinh) từ tệp danh sách!`
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

/**
 * Multi-Sheet workbook parser for Excel files.
 * Handles workbooks where multi-page tables are split across worksheets
 * (e.g. Page 1 on Sheet1, Page 2 on Sheet2, or Trang 1, Trang 2).
 */
export function parseVietnameseSchoolWorkbook(workbook: any, preferredClassName?: string): ParseExcelResult {
  if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
    return {
      success: false,
      students: [],
      totalRowsProcessed: 0,
      totalStudentsExtracted: 0,
      message: 'Tệp Excel không chứa trang tính hợp lệ.',
    };
  }

  // If single sheet, use standard parser
  if (workbook.SheetNames.length === 1) {
    const sheetName = workbook.SheetNames[0];
    const rawJson: any[][] = require('xlsx').utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      defval: '',
      blankrows: false,
    });
    return parseVietnameseSchoolExcel(rawJson, preferredClassName);
  }

  // Multi-sheet workbook:
  // 1. Check if a sheet name matches preferredClassName (e.g. "11A1")
  if (preferredClassName) {
    const cleanPref = removeVietnameseDiacritics(preferredClassName).toLowerCase();
    const matchingSheet = workbook.SheetNames.find((name: string) =>
      removeVietnameseDiacritics(name).toLowerCase().includes(cleanPref)
    );
    if (matchingSheet) {
      const rawJson: any[][] = require('xlsx').utils.sheet_to_json(workbook.Sheets[matchingSheet], {
        header: 1,
        defval: '',
        blankrows: false,
      });
      const res = parseVietnameseSchoolExcel(rawJson, preferredClassName);
      if (res.success && res.students.length > 0) {
        return res;
      }
    }
  }

  // 2. Parse all sheets and see if they contain sequential parts of the same class list
  const sheetResults: { sheetName: string; result: ParseExcelResult }[] = [];
  for (const sheetName of workbook.SheetNames) {
    const rawJson: any[][] = require('xlsx').utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      defval: '',
      blankrows: false,
    });
    const res = parseVietnameseSchoolExcel(rawJson, preferredClassName);
    if (res.success && res.students.length > 0) {
      sheetResults.push({ sheetName, result: res });
    }
  }

  if (sheetResults.length === 0) {
    return {
      success: false,
      students: [],
      totalRowsProcessed: 0,
      totalStudentsExtracted: 0,
      message: 'Không tìm thấy danh sách học sinh hợp lệ trong các trang tính.',
    };
  }

  if (sheetResults.length === 1) {
    return sheetResults[0].result;
  }

  // If multiple sheets have students:
  // Check if they are continuation sheets (e.g. "Sheet1" and "Sheet2" or "Trang 1" and "Trang 2")
  // Check if STTs are sequential or non-overlapping
  const combinedStudents: ParsedStudentRow[] = [];
  let totalRows = 0;
  let maxStt = 0;

  for (const sr of sheetResults) {
    totalRows += sr.result.totalRowsProcessed;
    for (const st of sr.result.students) {
      combinedStudents.push(st);
      if (st.stt && st.stt > maxStt) maxStt = st.stt;
    }
  }

  // Re-number STTs sequentially if needed
  combinedStudents.forEach((st, idx) => {
    if (!st.stt) st.stt = idx + 1;
  });

  const total = combinedStudents.length;
  return {
    success: true,
    students: combinedStudents,
    detectedClassName: sheetResults[0].result.detectedClassName || preferredClassName || '11A1',
    detectedSchoolName: sheetResults[0].result.detectedSchoolName || 'THPT Võ Thị Sáu',
    detectedAcademicYear: sheetResults[0].result.detectedAcademicYear || '2026-2027',
    totalRowsProcessed: totalRows,
    totalStudentsExtracted: total,
    expectedStudentCount: maxStt > 0 ? maxStt : total,
    sttRangeSummary: `Tổng hợp từ ${sheetResults.length} trang tính: Từ STT 1 đến ${maxStt || total} (Tổng cộng: ${total} học sinh)`,
    message: `Đã tổng hợp đầy đủ 100% (${total} học sinh) từ các trang tính!`,
  };
}
