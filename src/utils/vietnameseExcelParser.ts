export interface ParsedStudentRow {
  name: string; // Họ và tên đầy đủ hoàn chỉnh: "Trần Thái An"
  hoVaChuLot?: string; // Họ và chữ lót riêng: "Trần Thái"
  ten?: string; // Tên riêng: "An"
  studentCode?: string; // Mã học sinh vnEdu (ví dụ: 2511404881)
  gender?: 'Nam' | 'Nữ' | 'Khác';
  dob?: string;
  phone?: string;
  email?: string;
  username?: string; // "tranan11a1vts2627"
}

export interface ParseExcelResult {
  success: boolean;
  students: ParsedStudentRow[];
  detectedClassName?: string;
  detectedSchoolName?: string;
  detectedAcademicYear?: string;
  totalRowsProcessed: number;
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
 * Ví dụ: Trần Thái An, Lớp 11A1, THPT Võ Thị Sáu, Niên học 2026-2027 -> tranan11a1vts2627
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
    // 1. Họ và Tên (Từ đầu tiên là Họ, từ cuối cùng là Tên)
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
  cleanSchool = cleanSchool.replace(/trường|thpt|thcs|tiểu\s*học|ptth|đại\s*học|cao\s*đẳng/gi, '').trim();
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
 * Format Excel date serial number to DD/MM/YYYY
 */
export function formatExcelDate(value: any): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
    return undefined;
  }
  if (typeof value === 'number' && value > 1000 && value < 60000) {
    // Excel date serial
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
  return undefined;
}

/**
 * Intelligent parser for vnEdu, SMAS, QLM, and standard Vietnamese school Excel sheets.
 * Handles:
 * - Title blocks at the top (Sở GD, Trường THPT, Bảng điểm chi tiết...)
 * - Split columns: [Họ và chữ lót / Họ và đệm] và [Tên]
 * - Merged headers (Họ và tên spanning columns B & C)
 * - Columns: Mã học sinh (studentCode), Ngày sinh, Giới tính, SĐT, Email
 * - Footer statistics (Thống kê học kỳ, Tốt/Khá/Đạt, Giáo viên bộ môn...)
 * - Automatic generation of standardized username: tranan11a1vts2627
 */
export function parseVietnameseSchoolExcel(rawJson: any[][]): ParseExcelResult {
  if (!rawJson || rawJson.length === 0) {
    return {
      success: false,
      students: [],
      totalRowsProcessed: 0,
      message: 'Tệp không chứa dữ liệu.',
    };
  }

  let detectedClassName: string | undefined;
  let detectedSchoolName: string | undefined;
  let detectedAcademicYear: string | undefined;

  // Scan early rows for school name, class name, academic year
  for (let r = 0; r < Math.min(rawJson.length, 15); r++) {
    const row = rawJson[r] || [];
    row.forEach(cell => {
      const text = String(cell || '').trim();
      if (/trường\s+(thpt|thcs|tiểu\s*học)/i.test(text)) {
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

  // Step 1: Detect Table Header Row(s)
  let bestHeaderRowIdx = -1;
  let maxHeaderScore = -1;

  for (let r = 0; r < Math.min(rawJson.length, 25); r++) {
    const row = rawJson[r];
    if (!Array.isArray(row)) continue;

    let score = 0;
    row.forEach(cell => {
      const text = String(cell || '').toLowerCase().trim();
      if (/^(stt|số\s*tt|số\s*thứ\s*tự|tt)$/i.test(text)) score += 5;
      if (/(mã\s*(hs|học\s*sinh|định\s*danh|số)|mshs|sbd)/i.test(text)) score += 5;
      if (/^(họ\s*và\s*tên|họ\s*tên)$/i.test(text)) score += 6;
      if (/họ\s*(và|&)?\s*(chữ\s*)?lót|họ\s*(và|&)?\s*(tên\s*)?đệm|họ\s*đệm|họ\s*lót|^họ$/i.test(text)) score += 6;
      if (/^(tên|tên\s*học\s*sinh|tên\s*hs|tên\s*gọi|tên\s*khai\s*sinh|tên\s*riêng)(\s*[\(\[].*[\)\]])?$/i.test(text)) score += 6;
      if (/ngày\s*sinh|n\.sinh|ngaysinh|^ns$|ngày\s*tháng\s*năm\s*sinh|dob/i.test(text)) score += 3;
      if (/giới\s*tính|^phái$|nam\/nữ|^nam$|^nữ$/i.test(text)) score += 3;
      if (/bảng\s*điểm|trường\s*thpt|sở\s*giáo\s*dục|sổ\s*theo\s*dõi/i.test(text)) score -= 5;
    });

    if (score > maxHeaderScore) {
      maxHeaderScore = score;
      bestHeaderRowIdx = r;
    }
  }

  // If score is too low (< 3), search for first numeric STT sequence
  if (maxHeaderScore < 3 || bestHeaderRowIdx === -1) {
    for (let r = 0; r < Math.min(rawJson.length, 20); r++) {
      const row = rawJson[r] || [];
      const nextRow = rawJson[r + 1] || [];
      if (String(row[0]).trim() === '1' && String(nextRow[0]).trim() === '2') {
        bestHeaderRowIdx = Math.max(0, r - 1);
        break;
      }
    }
  }

  const headerRowIdx = bestHeaderRowIdx !== -1 ? bestHeaderRowIdx : 0;

  // Step 2: Determine column indices by inspecting header row and potential subheader rows
  let sttColIdx = -1;
  let codeColIdx = -1;
  let hoColIdx = -1;
  let tenColIdx = -1;
  let fullNameColIdx = -1;
  let dobColIdx = -1;
  let genderColIdx = -1;
  let phoneColIdx = -1;
  let emailColIdx = -1;

  const inspectCell = (colIdx: number, text: string) => {
    const clean = text.toLowerCase().trim().replace(/[\r\n]+/g, ' ');
    if (!clean) return;

    if (/^(stt|số\s*tt|số\s*thứ\s*tự|tt|stt\.)$/i.test(clean) && sttColIdx === -1) {
      sttColIdx = colIdx;
    } else if (/(mã\s*(hs|học\s*sinh|định\s*danh|số)|mshs|sbd|mã\s*số)/i.test(clean) && codeColIdx === -1) {
      codeColIdx = colIdx;
    } else if (/(họ\s*(và|&)?\s*(chữ\s*)?lót|họ\s*(và|&)?\s*(tên\s*)?đệm|họ\s*đệm|họ\s*lót|^họ$)/i.test(clean) && hoColIdx === -1) {
      hoColIdx = colIdx;
    } else if (/^(tên|tên\s*học\s*sinh|tên\s*hs|tên\s*gọi|tên\s*khai\s*sinh|tên\s*riêng)/i.test(clean) && !/họ/i.test(clean) && tenColIdx === -1) {
      tenColIdx = colIdx;
    } else if (/(họ\s*(và|&)?\s*tên|họ\s*tên)/i.test(clean) && fullNameColIdx === -1) {
      fullNameColIdx = colIdx;
    } else if (/(ngày\s*sinh|n\.sinh|ngaysinh|^ns$|ngày\s*tháng\s*năm\s*sinh|dob|năm\s*sinh)/i.test(clean) && dobColIdx === -1) {
      dobColIdx = colIdx;
    } else if (/(giới\s*tính|^phái$|nam\/nữ|^nam$|^nữ$|^gt$)/i.test(clean) && genderColIdx === -1) {
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

  // Check sub-header rows (row headerRowIdx + 1, row headerRowIdx + 2)
  let extraHeaderRows = 0;
  for (let offset = 1; offset <= 3; offset++) {
    const candidateRow = rawJson[headerRowIdx + offset] || [];
    let isHeaderCandidate = false;
    let isColumnNumberRow = false;

    // Check if it is a row of column numbers like (1), (2), (3)...
    let numParensCount = 0;
    candidateRow.forEach((cell: any) => {
      const s = String(cell || '').trim();
      if (/^\(\d+\)$/.test(s) || (s.length === 1 && /^\d$/.test(s))) {
        numParensCount++;
      }
    });

    if (numParensCount >= 3) {
      isColumnNumberRow = true;
    }

    candidateRow.forEach((cell: any, col: number) => {
      const text = String(cell || '').trim();
      if (text) {
        if (/họ|tên|ngày|sinh|phái|giới|stt|mã/i.test(text)) {
          isHeaderCandidate = true;
          inspectCell(col, text);
        }
      }
    });

    if (isHeaderCandidate || isColumnNumberRow) {
      extraHeaderRows = offset;
    } else {
      break;
    }
  }

  let dataStartRow = headerRowIdx + extraHeaderRows + 1;

  // Make sure dataStartRow doesn't start on an empty row or column-index row
  while (dataStartRow < rawJson.length) {
    const r = rawJson[dataStartRow] || [];
    const nonEmpties = r.filter(c => String(c || '').trim().length > 0);
    if (nonEmpties.length === 0) {
      dataStartRow++;
      continue;
    }
    // Check if this row is column numbering row like (1), (2), (3)...
    const allParens = nonEmpties.every(c => /^\(\d+\)$/.test(String(c).trim()));
    if (allParens) {
      dataStartRow++;
      continue;
    }
    break;
  }

  // CRITICAL FIX: If we found "Họ và tên" (fullNameColIdx) AND "Tên" (tenColIdx):
  // Then fullNameColIdx is actually hoColIdx (Họ và chữ lót)!
  if (hoColIdx === -1 && fullNameColIdx !== -1 && tenColIdx !== -1 && fullNameColIdx !== tenColIdx) {
    hoColIdx = fullNameColIdx;
    fullNameColIdx = -1;
  }

  // CRITICAL DETECTION FROM DATA ROWS:
  // If tenColIdx is not found, check adjacent column of hoColIdx or fullNameColIdx
  const nameBaseCol = hoColIdx !== -1 ? hoColIdx : fullNameColIdx;

  if (nameBaseCol !== -1 && tenColIdx === -1) {
    let adjacentHasNames = 0;
    for (let r = dataStartRow; r < Math.min(rawJson.length, dataStartRow + 8); r++) {
      const cellVal = String(rawJson[r]?.[nameBaseCol + 1] || '').trim();
      // First name is non-empty, 1-2 words, max 15 chars, not a number/score/date/gender
      if (
        cellVal &&
        !/^\d+(\.\d+)?$/.test(cellVal) &&
        !/^\d{1,2}\/\d{1,2}/.test(cellVal) &&
        !/^(nam|nữ|f|m)$/i.test(cellVal) &&
        cellVal.split(/\s+/).length <= 2 &&
        cellVal.length <= 15 &&
        /[a-zA-ZÀ-ỹ]/.test(cellVal)
      ) {
        adjacentHasNames++;
      }
    }

    if (adjacentHasNames >= 2) {
      hoColIdx = nameBaseCol;
      tenColIdx = nameBaseCol + 1;
      fullNameColIdx = -1;
    }
  }

  // Fallback: If still no name column found, inspect columns 1, 2, 3 of data
  if (fullNameColIdx === -1 && hoColIdx === -1) {
    if (sttColIdx === 0) {
      const sampleCol1 = String(rawJson[dataStartRow]?.[1] || '').trim();
      const sampleCol2 = String(rawJson[dataStartRow]?.[2] || '').trim();
      const sampleCol3 = String(rawJson[dataStartRow]?.[3] || '').trim();

      if (/^\d{6,}$/.test(sampleCol1)) {
        codeColIdx = 1;
        hoColIdx = 2;
        tenColIdx = 3;
      } else if (/[a-zA-ZÀ-ỹ]/.test(sampleCol1) && /[a-zA-ZÀ-ỹ]/.test(sampleCol2) && sampleCol2.split(/\s+/).length <= 2) {
        hoColIdx = 1;
        tenColIdx = 2;
      } else {
        fullNameColIdx = 1;
      }
    } else {
      fullNameColIdx = 1;
    }
  }

  // Step 3: Parse Data Rows
  const parsedStudents: ParsedStudentRow[] = [];
  const usedUsernames = new Map<string, number>();

  const forbiddenKeywords = [
    'thống kê',
    'số học sinh đạt',
    'tốt',
    'khá',
    'đạt',
    'chưa',
    'tỉ lệ',
    'tổng số',
    'tổng cộng',
    'giáo viên bộ môn',
    'giáo viên chủ nhiệm',
    'hiệu trưởng',
    'người lập',
    'bảng điểm',
    'trường thpt',
    'trường thcs',
    'tiểu học',
    'sở giáo dục',
    'phòng giáo dục',
    'khối',
    'chữ ký',
    'ngày tháng năm',
    'nhận xét',
    'mã học sinh',
    'họ và tên',
    'họ và chữ lót',
    'họ tên',
    'tên học sinh',
    'lớp học',
    'năm học',
  ];

  for (let r = dataStartRow; r < rawJson.length; r++) {
    const row = rawJson[r];
    if (!row || !Array.isArray(row)) continue;

    // Check row text for termination keywords (Footer of vnEdu)
    const rowTextAll = row.map(c => String(c || '').toLowerCase()).join(' ');
    if (
      rowTextAll.includes('thống kê học kỳ') ||
      rowTextAll.includes('số học sinh đạt') ||
      rowTextAll.includes('người lập biểu') ||
      rowTextAll.includes('giáo viên bộ môn') ||
      rowTextAll.includes('giáo viên chủ nhiệm') ||
      rowTextAll.includes('hiệu trưởng') ||
      rowTextAll.includes('tổng số học sinh')
    ) {
      break;
    }

    // Check STT if present
    if (sttColIdx !== -1) {
      const sttRaw = String(row[sttColIdx] || '').trim();
      if (sttRaw && forbiddenKeywords.some(kw => sttRaw.toLowerCase().includes(kw))) {
        break;
      }
    }

    // 1. EXTRACT HO VA CHU LOT + TEN
    let hoPart = '';
    let tenPart = '';
    let rawFullName = '';

    if (hoColIdx !== -1 && tenColIdx !== -1) {
      hoPart = String(row[hoColIdx] || '').trim();
      tenPart = String(row[tenColIdx] || '').trim();
      rawFullName = [hoPart, tenPart].filter(Boolean).join(' ').trim();
    } else if (hoColIdx !== -1) {
      hoPart = String(row[hoColIdx] || '').trim();
      const adjCell = String(row[hoColIdx + 1] || '').trim();
      if (
        adjCell &&
        !/^\d+(\.\d+)?$/.test(adjCell) &&
        !/^\d{1,2}\/\d{1,2}/.test(adjCell) &&
        !/^(nam|nữ|f|m)$/i.test(adjCell) &&
        adjCell.split(/\s+/).length <= 2 &&
        adjCell.length <= 15 &&
        /[a-zA-ZÀ-ỹ]/.test(adjCell)
      ) {
        tenPart = adjCell;
        rawFullName = `${hoPart} ${tenPart}`.trim();
      } else {
        rawFullName = hoPart;
      }
    } else if (fullNameColIdx !== -1) {
      const colVal = String(row[fullNameColIdx] || '').trim();
      const adjCell = String(row[fullNameColIdx + 1] || '').trim();
      if (
        adjCell &&
        !/^\d+(\.\d+)?$/.test(adjCell) &&
        !/^\d{1,2}\/\d{1,2}/.test(adjCell) &&
        !/^(nam|nữ|f|m)$/i.test(adjCell) &&
        adjCell.split(/\s+/).length <= 2 &&
        adjCell.length <= 15 &&
        /[a-zA-ZÀ-ỹ]/.test(adjCell)
      ) {
        hoPart = colVal;
        tenPart = adjCell;
        rawFullName = `${colVal} ${adjCell}`.trim();
      } else {
        rawFullName = colVal;
      }
    }

    // Safeguard: If rawFullName has <= 2 words (e.g. "Trần Thái") and adjacent cell has a name ("An"):
    const nameColForAdj = hoColIdx !== -1 ? hoColIdx : fullNameColIdx;
    if (nameColForAdj !== -1) {
      const adjVal = String(row[nameColForAdj + 1] || '').trim();
      const nameParts = rawFullName.split(/\s+/).filter(Boolean);
      if (
        nameParts.length <= 2 &&
        adjVal &&
        /[a-zA-ZÀ-ỹ]/.test(adjVal) &&
        !/^\d+(\.\d+)?$/.test(adjVal) &&
        !/^\d{1,2}\/\d{1,2}/.test(adjVal) &&
        !/^(nam|nữ|f|m)$/i.test(adjVal) &&
        !rawFullName.toLowerCase().endsWith(adjVal.toLowerCase())
      ) {
        hoPart = rawFullName;
        tenPart = adjVal;
        rawFullName = `${rawFullName} ${adjVal}`.trim();
      }
    }

    // Normalize whitespace
    rawFullName = rawFullName.replace(/\s+/g, ' ').trim();

    // Validate Student Name - DO NOT allow titles or purely numeric codes
    if (!rawFullName || rawFullName.length < 2) continue;
    const lowerName = rawFullName.toLowerCase();
    if (forbiddenKeywords.some(kw => lowerName === kw || lowerName.includes(kw))) continue;
    if (/^\d+$/.test(rawFullName)) continue;
    if (!/[a-zA-ZÀ-ỹ]/.test(rawFullName)) continue;

    // Split rawFullName into hoVaChuLot and ten if not already isolated
    const allWords = rawFullName.split(/\s+/).filter(Boolean);
    const finalTen = tenPart || (allWords.length > 1 ? allWords[allWords.length - 1] : allWords[0] || '');
    const finalHoVaChuLot = hoPart || (allWords.length > 1 ? allWords.slice(0, -1).join(' ') : (allWords[0] || ''));

    // Ensure rawFullName has both parts combined:
    if (finalHoVaChuLot && finalTen && !rawFullName.toLowerCase().endsWith(finalTen.toLowerCase())) {
      rawFullName = `${finalHoVaChuLot} ${finalTen}`.trim();
    }

    // Extract student code (Mã học sinh)
    let studentCode: string | undefined;
    if (codeColIdx !== -1 && row[codeColIdx]) {
      const codeVal = String(row[codeColIdx]).trim();
      if (codeVal && !forbiddenKeywords.some(kw => codeVal.toLowerCase().includes(kw))) {
        studentCode = codeVal;
      }
    }

    // Auto-detect numeric student code anywhere in the row if codeColIdx wasn't found
    if (!studentCode) {
      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').trim();
        if (/^\d{6,14}$/.test(val)) {
          studentCode = val;
          break;
        }
      }
    }

    // If rawFullName accidentally became the student code, ignore this row
    if (studentCode && rawFullName === studentCode) continue;

    // Extract Date of Birth
    let dob: string | undefined;
    if (dobColIdx !== -1 && row[dobColIdx]) {
      dob = formatExcelDate(row[dobColIdx]);
    } else {
      // Search row for date pattern DD/MM/YYYY
      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').trim();
        if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(val)) {
          dob = val;
          break;
        }
      }
    }

    // Extract Gender
    let gender: 'Nam' | 'Nữ' | 'Khác' | undefined;
    if (genderColIdx !== -1 && row[genderColIdx]) {
      const gRaw = String(row[genderColIdx]).toLowerCase().trim();
      if (gRaw.includes('nữ') || gRaw === 'f' || gRaw === 'nu' || gRaw === 'x') {
        gender = 'Nữ';
      } else if (gRaw.includes('nam') || gRaw === 'm') {
        gender = 'Nam';
      }
    } else {
      for (let c = 0; c < row.length; c++) {
        const gRaw = String(row[c] || '').toLowerCase().trim();
        if (gRaw === 'nam') { gender = 'Nam'; break; }
        if (gRaw === 'nữ' || gRaw === 'nu') { gender = 'Nữ'; break; }
      }
    }

    // Extract Phone
    let phone: string | undefined;
    if (phoneColIdx !== -1 && row[phoneColIdx]) {
      const pRaw = String(row[phoneColIdx]).trim();
      if (pRaw && /^[0-9+.\-\s()]{7,15}$/.test(pRaw)) {
        phone = pRaw;
      }
    }

    // Extract Email
    let email: string | undefined;
    if (emailColIdx !== -1 && row[emailColIdx]) {
      const eRaw = String(row[emailColIdx]).trim();
      if (eRaw && eRaw.includes('@')) {
        email = eRaw;
      }
    }

    // Generate Standardized Username: họ+tên+lớp+viết tắt trường+niên học (e.g. tranan11a1vts2627)
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
      name: rawFullName,
      hoVaChuLot: finalHoVaChuLot,
      ten: finalTen,
      studentCode,
      gender,
      dob,
      phone,
      email,
      username: assignedUsername,
    });
  }

  return {
    success: parsedStudents.length > 0,
    students: parsedStudents,
    detectedClassName,
    detectedSchoolName,
    detectedAcademicYear,
    totalRowsProcessed: rawJson.length,
    message:
      parsedStudents.length > 0
        ? `Đã nhận diện thành công ${parsedStudents.length} học sinh!`
        : 'Không tìm thấy danh sách học sinh hợp lệ.',
  };
}

