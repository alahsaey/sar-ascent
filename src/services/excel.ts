import * as XLSX from 'xlsx';
import { ExcelImportSummary, ParsedEmployeeItem, ExcelColumnInfo } from '../types';

/**
 * Normalizes an employee number string:
 * - Trims whitespace
 * - Converts Arabic-Indic numerals (٠-٩) to standard (0-9)
 * - Preserves leading zeros intact!
 */
export function normalizeEmployeeNumber(raw: any): string {
  if (raw === null || raw === undefined) return '';

  let str = String(raw).trim();

  // Convert Eastern Arabic numerals to Western Arabic numerals
  const arabicIndicDigits: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
  };

  str = str.replace(/[٠-٩]/g, (char) => arabicIndicDigits[char] || char);

  // Remove invisible control characters, zero-width spaces, or carriage returns
  str = str.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

  return str;
}

// Normalized match helper
function cleanHeaderCell(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).toLowerCase().replace(/[\r\n\t_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const ID_KEYWORDS = [
  'id', 'id no', 'id_no', 'emp id', 'emp_id', 'empid', 'employee id', 'employee_id',
  'badge', 'badge no', 'badge_no', 'staff id', 'staff_id', 'job number', 'job_number',
  'emp no', 'emp_no', 'file no', 'file_no', 'number', 'emp',
  'الرقم الوظيفي', 'رقم الموظف', 'الرقم', 'رقم_الموظف', 'الرقم_الوظيفي', 'رقم الهوية',
  'رقم البطاقة', 'الرقم الخاص', 'الكود', 'كود الموظف'
];

const NAME_KEYWORDS = [
  'drivers', 'driver', 'driver name', 'name', 'employee name', 'employee_name',
  'emp name', 'emp_name', 'fullname', 'full_name', 'staff name', 'staff_name',
  'employee', 'passenger name', 'passenger', 'اسم السائق', 'السائق', 'السائقين',
  'اسم الموظف', 'اسم_الموظف', 'الاسم', 'الموظف', 'الاسم الكامل', 'اسم الموظف الرباعي',
  'اسم الموظف الثلاثي', 'الاسم بالعربي', 'الاسم بالانجليزي'
];

const ROUTE_KEYWORDS = [
  'loction', 'location', 'route', 'travel route', 'allowed route', 'destination',
  'station', 'stations', 'between', 'sector', 'area', 'zone', 'section', 'permitted route',
  'جهة السفر', 'المسار', 'خط السير', 'الموقع', 'المحطة', 'المحطات المصرح بها',
  'قطاع السفر', 'بين', 'المسارات المصرحة', 'الجهة', 'مكان العمل', 'منطقة السفر', 'خط السير المصرح'
];

/**
 * Intelligent detector that identifies the Header Row, ID Column, Name Column, and Route Column.
 */
export function detectTableStructure(rows: string[][]) {
  let bestHeaderRowIndex = -1;
  let bestScore = -1;
  let detectedIdCol = -1;
  let detectedNameCol = -1;
  let detectedRouteCol = -1;

  const maxScanRows = Math.min(20, rows.length);

  // Pass 1: Look for explicit header keywords across the top rows
  for (let r = 0; r < maxScanRows; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    let rowScore = 0;
    let tempIdCol = -1;
    let tempNameCol = -1;
    let tempRouteCol = -1;

    for (let c = 0; c < row.length; c++) {
      const cellText = cleanHeaderCell(row[c]);
      if (!cellText) continue;

      // Check ID
      if (ID_KEYWORDS.some(k => cellText === k || cellText.startsWith(k + ' ') || cellText.endsWith(' ' + k))) {
        tempIdCol = c;
        rowScore += 10;
      }

      // Check Name
      if (NAME_KEYWORDS.some(k => cellText === k || cellText.startsWith(k + ' ') || cellText.endsWith(' ' + k))) {
        tempNameCol = c;
        rowScore += 8;
      }

      // Check Route / Location
      if (ROUTE_KEYWORDS.some(k => cellText === k || cellText.startsWith(k + ' ') || cellText.endsWith(' ' + k))) {
        tempRouteCol = c;
        rowScore += 6;
      }
    }

    if (rowScore > bestScore) {
      bestScore = rowScore;
      bestHeaderRowIndex = r;
      detectedIdCol = tempIdCol;
      detectedNameCol = tempNameCol;
      detectedRouteCol = tempRouteCol;
    }
  }

  // Pass 2: If no explicit header row scored well, or columns are missing, examine data patterns
  const dataStartCandidate = bestHeaderRowIndex >= 0 ? bestHeaderRowIndex + 1 : 0;
  
  // Find the first row with actual employee data (numeric ID cell + text Name cell)
  let actualDataStartRow = -1;
  for (let r = dataStartCandidate; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const hasNumericCell = row.some(cell => {
      const clean = normalizeEmployeeNumber(cell);
      return /^\d{2,12}$/.test(clean);
    });

    if (hasNumericCell) {
      actualDataStartRow = r;
      break;
    }
  }

  if (actualDataStartRow === -1) {
    actualDataStartRow = Math.max(0, bestHeaderRowIndex + 1);
  }

  // If ID column is still missing, find the column with most numeric values in sample data
  if (detectedIdCol === -1 && actualDataStartRow < rows.length) {
    const sampleRows = rows.slice(actualDataStartRow, actualDataStartRow + 15);
    const colScores: number[] = [];

    sampleRows.forEach(row => {
      row.forEach((cell, c) => {
        const clean = normalizeEmployeeNumber(cell);
        if (/^\d{3,10}$/.test(clean)) {
          colScores[c] = (colScores[c] || 0) + 1;
        }
      });
    });

    let maxNumericScore = 0;
    colScores.forEach((score, c) => {
      if (score > maxNumericScore) {
        maxNumericScore = score;
        detectedIdCol = c;
      }
    });
  }

  // If Name column is still missing, find the text column with alphabetic characters (and not index M or ID)
  if (detectedNameCol === -1 && actualDataStartRow < rows.length) {
    const sampleRows = rows.slice(actualDataStartRow, actualDataStartRow + 15);
    const nameColScores: number[] = [];

    sampleRows.forEach(row => {
      row.forEach((cell, c) => {
        if (c === detectedIdCol || c === detectedRouteCol) return;
        const text = String(cell || '').trim();
        // Check if string contains at least 3 letters and preferably spaces (multiple words like names)
        if (text.length >= 3 && !/^\d+$/.test(text)) {
          const wordCount = text.split(/\s+/).length;
          nameColScores[c] = (nameColScores[c] || 0) + (wordCount >= 2 ? 3 : 1);
        }
      });
    });

    let maxNameScore = 0;
    nameColScores.forEach((score, c) => {
      if (score > maxNameScore) {
        maxNameScore = score;
        detectedNameCol = c;
      }
    });
  }

  // If Route column is still missing, check remaining columns for route-like content
  if (detectedRouteCol === -1 && actualDataStartRow < rows.length) {
    const sampleRows = rows.slice(actualDataStartRow, actualDataStartRow + 15);
    sampleRows.forEach(row => {
      row.forEach((cell, c) => {
        if (c === detectedIdCol || c === detectedNameCol) return;
        const text = String(cell || '').toLowerCase();
        if (
          text.includes('between') ||
          text.includes('riy') ||
          text.includes('dmm') ||
          text.includes('hufof') ||
          text.includes('الرياض') ||
          text.includes('الدمام') ||
          text.includes('الهفوف') ||
          text.includes('&')
        ) {
          detectedRouteCol = c;
        }
      });
    });
  }

  return {
    headerRowIndex: bestHeaderRowIndex,
    dataStartRowIndex: actualDataStartRow,
    idColIndex: detectedIdCol >= 0 ? detectedIdCol : 0,
    nameColIndex: detectedNameCol >= 0 ? detectedNameCol : -1,
    routeColIndex: detectedRouteCol >= 0 ? detectedRouteCol : -1,
  };
}

/**
 * Parses employee rows based on determined or selected column indices.
 */
export function reparseRowsWithColumns(
  rawRows: string[][],
  options: {
    dataStartRowIndex: number;
    idColIndex: number;
    nameColIndex?: number;
    routeColIndex?: number;
  }
): {
  validEmployeeNumbers: string[];
  validEmployees: ParsedEmployeeItem[];
  duplicateCount: number;
  emptyRowsCount: number;
  warnings: string[];
} {
  const { dataStartRowIndex, idColIndex, nameColIndex = -1, routeColIndex = -1 } = options;

  const numbersSet = new Set<string>();
  const validEmployeeNumbers: string[] = [];
  const validEmployees: ParsedEmployeeItem[] = [];
  let duplicateCount = 0;
  let emptyRowsCount = 0;
  const warnings: string[] = [];

  for (let r = Math.max(0, dataStartRowIndex); r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) {
      emptyRowsCount++;
      continue;
    }

    const rawIdVal = row[idColIndex];
    const cleanedId = normalizeEmployeeNumber(rawIdVal);

    if (!cleanedId) {
      emptyRowsCount++;
      continue;
    }

    // Check minimum validity
    if (cleanedId.length < 2) {
      warnings.push(`السطر ${r + 1}: رقم قصير جداً تم تجاهله ("${cleanedId}")`);
      continue;
    }

    // Name extraction
    let employeeName: string | undefined = undefined;
    if (nameColIndex >= 0 && row[nameColIndex]) {
      const rawName = String(row[nameColIndex]).trim();
      if (rawName && rawName.length > 1) {
        employeeName = rawName;
      }
    }

    // Route / Location extraction
    let allowedRoute: string | undefined = undefined;
    if (routeColIndex >= 0 && row[routeColIndex]) {
      const rawRoute = String(row[routeColIndex]).trim();
      if (rawRoute && rawRoute.length > 1) {
        allowedRoute = rawRoute;
      }
    }

    if (numbersSet.has(cleanedId)) {
      duplicateCount++;
    } else {
      numbersSet.add(cleanedId);
      validEmployeeNumbers.push(cleanedId);
      validEmployees.push({
        number: cleanedId,
        name: employeeName,
        allowedRoute: allowedRoute,
      });
    }
  }

  return {
    validEmployeeNumbers,
    validEmployees,
    duplicateCount,
    emptyRowsCount,
    warnings,
  };
}

/**
 * Parses an uploaded Excel (.xlsx, .xls) or CSV file.
 * Handles banners, merged cells, custom headers, and multi-column metadata.
 */
export async function parseEmployeeFile(
  file: File,
  forcedOptions?: {
    idColIndex?: number;
    nameColIndex?: number;
    routeColIndex?: number;
    dataStartRowIndex?: number;
  }
): Promise<ExcelImportSummary> {
  const isCsv = file.name.toLowerCase().endsWith('.csv');
  const buffer = await file.arrayBuffer();

  // Read workbook with raw: false to prefer formatted text representations (preserving leading zeros)
  const workbook = XLSX.read(buffer, {
    type: 'array',
    raw: false,
    cellText: true,
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('الملف فارغ ولا يحتوي على أي أوراق عمل.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  // Parse rows as raw 2D array of strings
  const rawRows: string[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    defval: '',
  });

  if (rawRows.length === 0) {
    throw new Error('الملف فارغ ولا يحتوي على بيانات.');
  }

  // Detect structure
  const structure = detectTableStructure(rawRows);

  const idColIndex = forcedOptions?.idColIndex ?? structure.idColIndex;
  const nameColIndex = forcedOptions?.nameColIndex ?? structure.nameColIndex;
  const routeColIndex = forcedOptions?.routeColIndex ?? structure.routeColIndex;
  const dataStartRowIndex = forcedOptions?.dataStartRowIndex ?? structure.dataStartRowIndex;

  // Build available columns info for manual override UI
  const maxCols = Math.max(...rawRows.slice(0, 15).map(r => r.length), 1);
  const availableColumns: ExcelColumnInfo[] = [];

  for (let c = 0; c < maxCols; c++) {
    // Column header label from header row or first row
    let headerLabel = '';
    if (structure.headerRowIndex >= 0 && rawRows[structure.headerRowIndex]?.[c]) {
      headerLabel = String(rawRows[structure.headerRowIndex][c]).trim();
    }
    if (!headerLabel && rawRows[0]?.[c]) {
      headerLabel = String(rawRows[0][c]).trim();
    }
    if (!headerLabel) {
      headerLabel = `العمود ${c + 1} (Column ${c + 1})`;
    }

    // Sample values from data rows
    const sampleValues: string[] = [];
    for (let r = dataStartRowIndex; r < Math.min(dataStartRowIndex + 5, rawRows.length); r++) {
      const val = rawRows[r]?.[c];
      if (val !== undefined && val !== null && String(val).trim()) {
        sampleValues.push(String(val).trim());
      }
    }

    availableColumns.push({
      index: c,
      label: headerLabel,
      sampleValues,
    });
  }

  // Parse records
  const parsed = reparseRowsWithColumns(rawRows, {
    dataStartRowIndex,
    idColIndex,
    nameColIndex,
    routeColIndex,
  });

  if (parsed.validEmployeeNumbers.length === 0) {
    throw new Error('لم يتم العثور على أرقام وظيفية صالحة في الملف. يرجى مراجعة محتوى الملف وتحديد الأعمدة يدوياً.');
  }

  const detectedColumnName =
    availableColumns.find(col => col.index === idColIndex)?.label || `العمود ${idColIndex + 1}`;
  const detectedNameColumnName =
    nameColIndex >= 0
      ? availableColumns.find(col => col.index === nameColIndex)?.label || `العمود ${nameColIndex + 1}`
      : undefined;
  const detectedRouteColumnName =
    routeColIndex >= 0
      ? availableColumns.find(col => col.index === routeColIndex)?.label || `العمود ${routeColIndex + 1}`
      : undefined;

  return {
    fileName: file.name,
    fileType: isCsv ? 'csv' : 'xlsx',
    totalRowsFound: rawRows.length - dataStartRowIndex,
    validEmployeeNumbers: parsed.validEmployeeNumbers,
    validEmployees: parsed.validEmployees,
    duplicateCount: parsed.duplicateCount,
    emptyRowsCount: parsed.emptyRowsCount,
    sampleData: parsed.validEmployeeNumbers.slice(0, 10),
    sampleDataWithNames: parsed.validEmployees.slice(0, 15),
    columnDetected: detectedColumnName,
    nameColumnDetected: detectedNameColumnName,
    routeColumnDetected: detectedRouteColumnName,
    headerRowIndex: structure.headerRowIndex,
    dataStartRowIndex: dataStartRowIndex,
    idColIndex,
    nameColIndex,
    routeColIndex,
    availableColumns,
    rawRows,
    warnings: parsed.warnings.slice(0, 5),
  };
}

/**
 * Generates and downloads a sample Excel (.xlsx) file with pre-formatted numbers,
 * matching SAR operations table layout (M, Drivers, ID, Loction).
 */
export function generateSampleExcelTemplate(): void {
  const data = [
    { 'M': 1, 'Drivers': 'Abdul Rahman Ahmed Al-Asiri', 'ID': '3240', 'Loction': 'Between( RIY& DMM & HUFOF )' },
    { 'M': 2, 'Drivers': 'Abdulaziz Abdullah Al-Omani', 'ID': '3612', 'Loction': 'Between( RIY& DMM & HUFOF )' },
    { 'M': 3, 'Drivers': 'Abdullah Abbas Al-Mari', 'ID': '3168', 'Loction': 'Between( RIY& DMM & HUFOF )' },
    { 'M': 4, 'Drivers': 'Abdullah Fayez Al-Subaie', 'ID': '3607', 'Loction': 'Between( RIY& DMM & HUFOF )' },
    { 'M': 5, 'Drivers': 'Ahmed Ali Al-Dossary', 'ID': '3340', 'Loction': 'Between( RIY& DMM & HUFOF )' },
    { 'M': 6, 'Drivers': 'سلطان بن عبدالله الدوسري', 'ID': '001234', 'Loction': 'Between( RIY& DMM & HUFOF )' },
  ];

  const worksheet = XLSX.utils.json_to_sheet(data);
  // Ensure the ID column cells are typed as string ('s') to preserve leading zeros
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:D7');
  for (let R = range.s.r + 1; R <= range.e.r; ++R) {
    const idCellRef = XLSX.utils.encode_cell({ c: 2, r: R });
    if (worksheet[idCellRef]) {
      worksheet[idCellRef].t = 's'; // string type
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Drivers - CDS');

  XLSX.writeFile(workbook, 'نموذج_قائمة_سار_المعتمدة.xlsx');
}

/**
 * Generates and downloads a CSV template.
 */
export function generateSampleCsvTemplate(): void {
  const csvContent =
    "\uFEFFM,Drivers,ID,Loction\n" +
    "1,Abdul Rahman Ahmed Al-Asiri,3240,Between( RIY& DMM & HUFOF )\n" +
    "2,Abdulaziz Abdullah Al-Omani,3612,Between( RIY& DMM & HUFOF )\n" +
    "3,Abdullah Abbas Al-Mari,3168,Between( RIY& DMM & HUFOF )\n" +
    "4,Abdullah Fayez Al-Subaie,3607,Between( RIY& DMM & HUFOF )\n" +
    "5,محمد بن فهد القحطاني,001234,Between( RIY& DMM & HUFOF )\n";

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', 'نموذج_قائمة_سار_المعتمدة.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
