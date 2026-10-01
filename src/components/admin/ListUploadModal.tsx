import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Download,
  Check,
  RefreshCw,
  SlidersHorizontal,
  TrainTrack,
  MapPin,
  UserCheck,
  Hash,
  Eye,
  Search,
  Copy,
  Layers
} from 'lucide-react';
import {
  parseEmployeeFile,
  reparseRowsWithColumns,
  generateSampleExcelTemplate,
  generateSampleCsvTemplate
} from '../../services/excel';
import { createEmployeeList, approveEmployeeList } from '../../services/db';
import { ExcelImportSummary, AdminUser } from '../../types';

interface ListUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onListCreated: () => void;
  currentAdmin: AdminUser;
}

export const ListUploadModal: React.FC<ListUploadModalProps> = ({
  isOpen,
  onClose,
  onListCreated,
  currentAdmin,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [summary, setSummary] = useState<ExcelImportSummary | null>(null);
  
  // Dynamic column mapping states
  const [selectedIdCol, setSelectedIdCol] = useState<number>(0);
  const [selectedNameCol, setSelectedNameCol] = useState<number>(-1);
  const [selectedRouteCol, setSelectedRouteCol] = useState<number>(-1);
  const [dataStartRow, setDataStartRow] = useState<number>(1);

  // Tab & search states for preview
  const [activeTab, setActiveTab] = useState<'valid' | 'duplicates'>('valid');
  const [previewSearch, setPreviewSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [listTitle, setListTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [archiveOtherActiveLists, setArchiveOtherActiveLists] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<'select' | 'preview'>('select');
  const [showColumnTuner, setShowColumnTuner] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (selectedFile: File) => {
    setError(null);
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls' && ext !== 'csv') {
      setError('نوع الملف غير مدعوم. يرجى رفع ملف Excel (.xlsx) أو ملف CSV (.csv).');
      return;
    }

    setFile(selectedFile);
    setParsing(true);

    try {
      const parsed = await parseEmployeeFile(selectedFile);
      setSummary(parsed);
      setSelectedIdCol(parsed.idColIndex);
      setSelectedNameCol(parsed.nameColIndex);
      setSelectedRouteCol(parsed.routeColIndex);
      setDataStartRow(parsed.dataStartRowIndex + 1); // 1-indexed for user UI
      setListTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
      setActiveTab('valid');
      setStep('preview');
    } catch (err: any) {
      setError(err.message || 'فشل في قراءة الملف ومعالجته. يرجى التأكد من محتواه.');
      setFile(null);
    } finally {
      setParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Re-run parsing when user modifies column mappings
  const handleMappingChange = (
    newIdCol: number,
    newNameCol: number,
    newRouteCol: number,
    newDataStartRow1Indexed: number
  ) => {
    if (!summary) return;

    setSelectedIdCol(newIdCol);
    setSelectedNameCol(newNameCol);
    setSelectedRouteCol(newRouteCol);
    setDataStartRow(newDataStartRow1Indexed);

    const recomputed = reparseRowsWithColumns(summary.rawRows, {
      dataStartRowIndex: Math.max(0, newDataStartRow1Indexed - 1),
      idColIndex: newIdCol,
      nameColIndex: newNameCol,
      routeColIndex: newRouteCol,
    });

    const detectedColumnName =
      summary.availableColumns.find(col => col.index === newIdCol)?.label || `العمود ${newIdCol + 1}`;
    const detectedNameColumnName =
      newNameCol >= 0
        ? summary.availableColumns.find(col => col.index === newNameCol)?.label || `العمود ${newNameCol + 1}`
        : undefined;
    const detectedRouteColumnName =
      newRouteCol >= 0
        ? summary.availableColumns.find(col => col.index === newRouteCol)?.label || `العمود ${newRouteCol + 1}`
        : undefined;

    setSummary({
      ...summary,
      totalRowsFound: summary.rawRows.length - Math.max(0, newDataStartRow1Indexed - 1),
      validEmployeeNumbers: recomputed.validEmployeeNumbers,
      validEmployees: recomputed.validEmployees,
      duplicateCount: recomputed.duplicateCount,
      duplicates: recomputed.duplicates,
      emptyRowsCount: recomputed.emptyRowsCount,
      sampleData: recomputed.validEmployeeNumbers.slice(0, 10),
      sampleDataWithNames: recomputed.validEmployees.slice(0, 15),
      columnDetected: detectedColumnName,
      nameColumnDetected: detectedNameColumnName,
      routeColumnDetected: detectedRouteColumnName,
      idColIndex: newIdCol,
      nameColIndex: newNameCol,
      routeColIndex: newRouteCol,
      dataStartRowIndex: Math.max(0, newDataStartRow1Indexed - 1),
      warnings: recomputed.warnings.slice(0, 5),
    });
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveAndApprove = async (shouldApproveDirectly: boolean) => {
    if (!summary || !file) return;

    if (!listTitle.trim()) {
      setError('يرجى كتابة عنوان أو مسمى للقائمة.');
      return;
    }

    if (summary.validEmployees.length === 0) {
      setError('لا توجد بيانات موظفين صالحة للاستيراد. يرجى ضبط الأعمدة وصف البداية.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const newList = await createEmployeeList(
        {
          title: listTitle.trim(),
          fileName: file.name,
          fileType: summary.fileType,
          uploadedBy: currentAdmin.name,
          notes: notes.trim(),
          uploadedAt: new Date().toISOString(),
          status: 'uploaded',
          totalRecords: summary.validEmployees.length,
        },
        summary.validEmployees
      );

      if (shouldApproveDirectly) {
        await approveEmployeeList(newList.id, currentAdmin.name, archiveOtherActiveLists);
      }

      onListCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ القائمة');
    } finally {
      setSubmitting(false);
    }
  };

  const resetAll = () => {
    setFile(null);
    setSummary(null);
    setError(null);
    setStep('select');
    setListTitle('');
    setNotes('');
    setShowColumnTuner(false);
    setActiveTab('valid');
    setPreviewSearch('');
  };

  const filteredValidEmployees = summary
    ? summary.validEmployees.filter((emp) => {
        if (!previewSearch.trim()) return true;
        const term = previewSearch.toLowerCase().trim();
        return (
          emp.number.toLowerCase().includes(term) ||
          (emp.name && emp.name.toLowerCase().includes(term)) ||
          (emp.allowedRoute && emp.allowedRoute.toLowerCase().includes(term))
        );
      })
    : [];

  const filteredDuplicates = summary
    ? (summary.duplicates || []).filter((dup) => {
        if (!previewSearch.trim()) return true;
        const term = previewSearch.toLowerCase().trim();
        return (
          dup.number.toLowerCase().includes(term) ||
          (dup.name && dup.name.toLowerCase().includes(term)) ||
          (dup.originalName && dup.originalName.toLowerCase().includes(term)) ||
          String(dup.rowNumber).includes(term) ||
          String(dup.originalRowNumber || '').includes(term)
        );
      })
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#002B49]/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 relative max-h-[92vh] flex flex-col overflow-hidden">
        {/* Top SAR Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#002B49] via-[#008269] to-[#D0A85C]" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 pt-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#008269]/10 border border-[#008269]/20 text-[#008269] flex items-center justify-center">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-[#002B49]">
                {step === 'select' ? 'رفع قائمة موظفين جديدة' : 'معاينة ومطابقة بيانات القائمة'}
              </h3>
              <p className="text-xs text-slate-500">
                {step === 'select'
                  ? 'رفع ملف Excel (.xlsx) أو CSV لمطابقة الأرقام والأسماء وجهة السفر المعتمدة'
                  : 'التحسس الذكي وتعيين أعمدة الرقم الوظيفي والاسم والمسار قبل الاعتماد'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="py-4 flex-1 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="font-semibold leading-relaxed">{error}</div>
            </div>
          )}

          {step === 'select' ? (
            /* STEP 1: File Selection */
            <div className="space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-[#008269] rounded-2xl p-8 sm:p-10 text-center bg-[#F4F7F9] hover:bg-[#008269]/5 transition-all cursor-pointer group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                />

                <div className="w-14 h-14 mx-auto rounded-2xl bg-white border border-slate-200 text-slate-400 group-hover:text-[#008269] group-hover:border-[#008269]/30 flex items-center justify-center mb-3 shadow-2xs transition-colors">
                  {parsing ? (
                    <RefreshCw className="w-7 h-7 text-[#008269] animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-7 h-7" />
                  )}
                </div>

                <div className="text-sm font-black text-[#002B49] mb-1">
                  {parsing ? 'جاري قراءة وتحسس أعمدة الملف...' : 'اسحب وأفلت ملف القائمة هنا، أو انقر للاختيار'}
                </div>
                <div className="text-xs text-slate-500 max-w-sm mx-auto">
                  يدعم جداول سار المعتمدة وملفات Excel (.xlsx, .xls) و CSV مع تحسس تلقائي لكافة الأعمدة والصفوف
                </div>
              </div>

              {/* Sample Download Prompt */}
              <div className="p-4 rounded-xl bg-[#F4F7F9] border border-slate-200">
                <div className="text-xs font-bold text-[#002B49] mb-2 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-[#D0A85C]" />
                  <span>تحميل نماذج معتمدة للاسترشاد بها:</span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    onClick={generateSampleExcelTemplate}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-[#008269] hover:text-[#008269] font-bold text-slate-700 shadow-2xs transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-[#008269]" />
                    <span>تحميل نموذج جدول سار (Excel .xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={generateSampleCsvTemplate}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-[#008269] hover:text-[#008269] font-bold text-slate-700 shadow-2xs transition-colors cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#002B49]" />
                    <span>تحميل نموذج CSV (.csv)</span>
                  </button>
                </div>
                <div className="text-[11px] text-slate-500 mt-2">
                  * يتضمن النموذج بنية الأعمدة المعتمدة: الرقم الوظيفي (ID)، اسم الموظف (Drivers/Name)، وجهة ومسار السفر (Loction/Route).
                </div>
              </div>
            </div>
          ) : (
            /* STEP 2: Validation Preview & Column Mapping */
            summary && (
              <div className="space-y-4">
                {/* File Meta Pill & Column Detection summary */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl bg-[#F4F7F9] border border-slate-200 gap-3">
                  <div className="flex items-center gap-2.5">
                    <FileSpreadsheet className="w-6 h-6 text-[#008269] shrink-0" />
                    <div>
                      <div className="text-xs font-black text-[#002B49] flex items-center gap-2">
                        <span>{summary.fileName}</span>
                        <span className="bg-[#008269]/10 text-[#008269] text-[10px] px-2 py-0.5 rounded-full font-bold">
                          {summary.validEmployees.length} موظف
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                        <span>الرقم: <b className="text-[#008269]">{summary.columnDetected}</b></span>
                        {summary.nameColumnDetected && (
                          <span>الاسم: <b className="text-[#002B49]">{summary.nameColumnDetected}</b></span>
                        )}
                        {summary.routeColumnDetected && (
                          <span>المسار: <b className="text-[#D0A85C]">{summary.routeColumnDetected}</b></span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => setShowColumnTuner(!showColumnTuner)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        showColumnTuner
                          ? 'bg-[#002B49] text-white border-[#002B49]'
                          : 'bg-white text-slate-700 border-slate-300 hover:border-[#008269] hover:text-[#008269]'
                      }`}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>{showColumnTuner ? 'إخفاء ضبط الأعمدة' : 'تعديل مطابقة الأعمدة'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={resetAll}
                      className="text-xs text-rose-600 hover:underline px-2 py-1 cursor-pointer"
                    >
                      تغيير الملف
                    </button>
                  </div>
                </div>

                {/* Interactive Column Mapping & Starting Row Panel */}
                {showColumnTuner && (
                  <div className="p-4 rounded-2xl bg-white border-2 border-[#008269]/30 shadow-sm space-y-4 animate-in fade-in">
                    <div className="text-xs font-black text-[#002B49] flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="flex items-center gap-1.5">
                        <SlidersHorizontal className="w-4 h-4 text-[#008269]" />
                        <span>تخصيص مطابقة أعمدة وصفوف ملف الإكسل:</span>
                      </span>
                      <span className="text-[11px] text-slate-500 font-normal">
                        يتم تحديث المعاينة فوراً عند تغيير أي عمود
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                      {/* ID Column */}
                      <div>
                        <label className="block font-bold text-[#002B49] mb-1 flex items-center gap-1">
                          <Hash className="w-3.5 h-3.5 text-[#008269]" />
                          <span>عمود الرقم الوظيفي (ID)</span>
                        </label>
                        <select
                          value={selectedIdCol}
                          onChange={(e) =>
                            handleMappingChange(
                              Number(e.target.value),
                              selectedNameCol,
                              selectedRouteCol,
                              dataStartRow
                            )
                          }
                          className="w-full h-9 px-2.5 bg-[#F4F7F9] border border-slate-300 rounded-xl font-medium text-slate-800 focus:bg-white focus:border-[#008269] focus:outline-none"
                        >
                          {summary.availableColumns.map((col) => (
                            <option key={col.index} value={col.index}>
                              {col.label} {col.sampleValues[0] ? `(${col.sampleValues[0]})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Name Column */}
                      <div>
                        <label className="block font-bold text-[#002B49] mb-1 flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-[#002B49]" />
                          <span>عمود اسم الموظف (Name)</span>
                        </label>
                        <select
                          value={selectedNameCol}
                          onChange={(e) =>
                            handleMappingChange(
                              selectedIdCol,
                              Number(e.target.value),
                              selectedRouteCol,
                              dataStartRow
                            )
                          }
                          className="w-full h-9 px-2.5 bg-[#F4F7F9] border border-slate-300 rounded-xl font-medium text-slate-800 focus:bg-white focus:border-[#008269] focus:outline-none"
                        >
                          <option value={-1}>-- بدون اسم --</option>
                          {summary.availableColumns.map((col) => (
                            <option key={col.index} value={col.index}>
                              {col.label} {col.sampleValues[0] ? `(${col.sampleValues[0]})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Route / Location Column */}
                      <div>
                        <label className="block font-bold text-[#002B49] mb-1 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-[#D0A85C]" />
                          <span>جهة ومسار السفر (Route)</span>
                        </label>
                        <select
                          value={selectedRouteCol}
                          onChange={(e) =>
                            handleMappingChange(
                              selectedIdCol,
                              selectedNameCol,
                              Number(e.target.value),
                              dataStartRow
                            )
                          }
                          className="w-full h-9 px-2.5 bg-[#F4F7F9] border border-slate-300 rounded-xl font-medium text-slate-800 focus:bg-white focus:border-[#008269] focus:outline-none"
                        >
                          <option value={-1}>-- بدون مسار محدد --</option>
                          {summary.availableColumns.map((col) => (
                            <option key={col.index} value={col.index}>
                              {col.label} {col.sampleValues[0] ? `(${col.sampleValues[0]})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Data Start Row */}
                      <div>
                        <label className="block font-bold text-[#002B49] mb-1">
                          صف بداية أول موظف (الصف)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={summary.rawRows.length}
                          value={dataStartRow}
                          onChange={(e) =>
                            handleMappingChange(
                              selectedIdCol,
                              selectedNameCol,
                              selectedRouteCol,
                              Number(e.target.value) || 1
                            )
                          }
                          className="w-full h-9 px-2.5 bg-[#F4F7F9] border border-slate-300 rounded-xl font-mono text-center font-bold text-slate-800 focus:bg-white focus:border-[#008269] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Validation Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div
                    onClick={() => setActiveTab('valid')}
                    className={`rounded-2xl p-3 text-center transition-all cursor-pointer border ${
                      activeTab === 'valid'
                        ? 'bg-[#008269]/15 border-[#008269] shadow-xs'
                        : 'bg-[#008269]/10 border-[#008269]/20 hover:border-[#008269]/50'
                    }`}
                  >
                    <div className="text-xl font-black text-[#008269] font-mono">
                      {summary.validEmployees.length.toLocaleString('ar-SA')}
                    </div>
                    <div className="text-[11px] font-bold text-[#008269] mt-0.5 flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>موظف معتمد ومطابق</span>
                    </div>
                  </div>

                  <div
                    onClick={() => summary.duplicateCount > 0 && setActiveTab('duplicates')}
                    className={`rounded-2xl p-3 text-center transition-all border ${
                      summary.duplicateCount > 0
                        ? activeTab === 'duplicates'
                          ? 'bg-amber-100/80 border-amber-500 shadow-xs cursor-pointer ring-2 ring-amber-400/30'
                          : 'bg-amber-50/80 border-amber-300 hover:border-amber-500 hover:bg-amber-100/50 cursor-pointer'
                        : 'bg-[#F4F7F9] border-slate-200 cursor-default'
                    }`}
                  >
                    <div
                      className={`text-xl font-black font-mono ${
                        summary.duplicateCount > 0 ? 'text-amber-700' : 'text-slate-700'
                      }`}
                    >
                      {summary.duplicateCount}
                    </div>
                    <div
                      className={`text-[11px] font-bold mt-0.5 flex items-center justify-center gap-1 ${
                        summary.duplicateCount > 0 ? 'text-amber-800' : 'text-slate-500'
                      }`}
                    >
                      {summary.duplicateCount > 0 && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                      <span>تكرارات مستبعدة</span>
                      {summary.duplicateCount > 0 && (
                        <span className="text-[9px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded-full font-bold">
                          انقر للمعاينة
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-[#F4F7F9] border border-slate-200 rounded-2xl p-3 text-center">
                    <div className="text-xl font-bold text-slate-700 font-mono">
                      {summary.emptyRowsCount}
                    </div>
                    <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                      صفوف فارغة / عناوين
                    </div>
                  </div>
                </div>

                {/* Duplicates Alert Box with Direct Action */}
                {summary.duplicateCount > 0 && (
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 via-amber-50/80 to-amber-100/40 border border-amber-300 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs animate-in fade-in">
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-700 mt-0.5">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-black text-amber-950 flex items-center gap-2 flex-wrap">
                          <span>تنبيه: تم رصد {summary.duplicateCount} سجل مكرر في الملف المرفوع</span>
                          <span className="bg-amber-200/90 text-amber-900 text-[10px] px-2 py-0.5 rounded-md font-bold">
                            استبعاد تلقائي لمنع الازدواجية
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-900/90 mt-0.5 leading-relaxed">
                          تم استبعاد السطور المكررة تلقائياً واعتماد أول ظهور لكل موظف. يمكنك معاينة الأسماء والسطور المكررة أدناه للتثبت مع صاحب السجل.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab(activeTab === 'duplicates' ? 'valid' : 'duplicates')}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0 self-end sm:self-center"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{activeTab === 'duplicates' ? 'عرض قائمة المعتمدين' : `معاينة الأسماء المكررة (${summary.duplicateCount})`}</span>
                    </button>
                  </div>
                )}

                {/* Segmented Tab Header & Data Preview with Search */}
                <div className="space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                    {/* Tabs */}
                    <div className="flex items-center gap-1.5 bg-[#F4F7F9] p-1 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setActiveTab('valid')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          activeTab === 'valid'
                            ? 'bg-[#008269] text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>الموظفون المعتمدون ({summary.validEmployees.length})</span>
                      </button>

                      {summary.duplicateCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('duplicates')}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            activeTab === 'duplicates'
                              ? 'bg-amber-600 text-white shadow-2xs'
                              : 'text-amber-800 hover:bg-amber-100/50'
                          }`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>الأسماء المكررة المستبعدة ({summary.duplicateCount})</span>
                        </button>
                      )}
                    </div>

                    {/* Quick Search */}
                    <div className="relative min-w-[200px]">
                      <input
                        type="text"
                        value={previewSearch}
                        onChange={(e) => setPreviewSearch(e.target.value)}
                        placeholder="بحث بالرقم أو الاسم أو السطر..."
                        className="w-full h-8 px-2.5 pr-8 text-xs bg-[#F4F7F9] border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#008269] focus:border-[#008269]"
                      />
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                      {previewSearch && (
                        <button
                          type="button"
                          onClick={() => setPreviewSearch('')}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>

                  {/* TAB 1: VALID EMPLOYEES PREVIEW */}
                  {activeTab === 'valid' && (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto shadow-2xs">
                      <table className="w-full text-xs text-right">
                        <thead className="bg-[#002B49] text-white font-bold sticky top-0 z-10">
                          <tr>
                            <th className="py-2.5 px-3 w-10 text-center">#</th>
                            <th className="py-2.5 px-3 w-28">الرقم الوظيفي (ID)</th>
                            <th className="py-2.5 px-3">اسم الموظف / السائق</th>
                            <th className="py-2.5 px-3">جهة ومسار السفر (Location)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {filteredValidEmployees.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-6 text-center text-slate-400">
                                لا توجد نتائج مطابقة للبحث "{previewSearch}"
                              </td>
                            </tr>
                          ) : (
                            filteredValidEmployees.map((emp, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                                <td className="py-2 px-3 font-mono font-bold text-[#008269] dir-ltr text-right bg-emerald-50/50">
                                  {emp.number}
                                </td>
                                <td className="py-2 px-3 font-bold text-[#002B49]">
                                  {emp.name ? (
                                    emp.name
                                  ) : (
                                    <span className="text-slate-400 font-normal italic">-- لم يحدد في الملف --</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-slate-600 font-medium">
                                  {emp.allowedRoute ? (
                                    <span className="inline-flex items-center gap-1 bg-[#D0A85C]/15 text-[#8A6A23] font-bold px-2 py-0.5 rounded-md border border-[#D0A85C]/30 text-[11px]">
                                      <MapPin className="w-3 h-3 shrink-0" />
                                      <span>{emp.allowedRoute}</span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-normal italic">كافة الخطوط</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* TAB 2: DUPLICATES INSPECTION PREVIEW */}
                  {activeTab === 'duplicates' && (
                    <div className="space-y-2">
                      <div className="border border-amber-300/80 rounded-2xl overflow-hidden max-h-60 overflow-y-auto shadow-2xs">
                        <table className="w-full text-xs text-right">
                          <thead className="bg-amber-800 text-white font-bold sticky top-0 z-10">
                            <tr>
                              <th className="py-2.5 px-3 w-10 text-center">#</th>
                              <th className="py-2.5 px-3 w-28">السطر في الملف</th>
                              <th className="py-2.5 px-3 w-32">الرقم الوظيفي (ID)</th>
                              <th className="py-2.5 px-3">الاسم في السطر المكرر</th>
                              <th className="py-2.5 px-3">مسار السفر المكرر</th>
                              <th className="py-2.5 px-3">السجل الأصلي المعتمد</th>
                              <th className="py-2.5 px-3 w-24 text-center">الحالة</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-amber-100 bg-white">
                            {filteredDuplicates.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="py-6 text-center text-slate-400">
                                  لا توجد سجلات مكررة مطابقة للبحث
                                </td>
                              </tr>
                            ) : (
                              filteredDuplicates.map((dup, idx) => (
                                <tr key={idx} className="hover:bg-amber-50/50 transition-colors bg-amber-50/20">
                                  <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                                  
                                  {/* Excel Sheet Row Number */}
                                  <td className="py-2.5 px-3">
                                    <span className="inline-flex items-center gap-1 font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md text-[11px]">
                                      <span>السطر</span>
                                      <span>{dup.rowNumber}</span>
                                    </span>
                                  </td>

                                  {/* Duplicate ID */}
                                  <td className="py-2.5 px-3 font-mono font-bold text-amber-900 dir-ltr text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleCopyId(dup.number)}
                                        title="نسخ الرقم الوظيفي"
                                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                                      >
                                        {copiedId === dup.number ? (
                                          <Check className="w-3 h-3 text-emerald-600" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                      </button>
                                      <span>{dup.number}</span>
                                    </div>
                                  </td>

                                  {/* Name in duplicate row */}
                                  <td className="py-2.5 px-3 font-bold text-slate-900">
                                    {dup.name ? (
                                      <span className="text-amber-950 font-black">{dup.name}</span>
                                    ) : (
                                      <span className="text-slate-400 font-normal italic">-- لم يحدد في السطر --</span>
                                    )}
                                  </td>

                                  {/* Route in duplicate row */}
                                  <td className="py-2.5 px-3 text-slate-600">
                                    {dup.allowedRoute ? (
                                      <span className="text-[11px] font-medium text-slate-700">
                                        {dup.allowedRoute}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 font-normal italic">كافة الخطوط</span>
                                    )}
                                  </td>

                                  {/* Comparison with Original First Occurrence */}
                                  <td className="py-2.5 px-3">
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-1.5 text-[11px] text-emerald-900">
                                      <div className="font-bold flex items-center gap-1">
                                        <span className="bg-emerald-200/80 px-1 py-0.2 rounded text-[10px]">
                                          السطر {dup.originalRowNumber || 'السابق'}
                                        </span>
                                        <span>{dup.originalName || dup.number}</span>
                                      </div>
                                      {dup.originalRoute && (
                                        <div className="text-[10px] text-emerald-700 mt-0.5 truncate max-w-[200px]" title={dup.originalRoute}>
                                          المسار: {dup.originalRoute}
                                        </div>
                                      )}
                                    </div>
                                  </td>

                                  {/* Status */}
                                  <td className="py-2.5 px-3 text-center">
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                                      <span>🚫</span>
                                      <span>مستبعد</span>
                                    </span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span>💡</span>
                          <span>
                            تم استبعاد هذه السجلات آلياً لأن الرقم الوظيفي مسجل مسبقاً بنفس القائمة في سطر أعلى، لضمان عدم وجود بيانات متطابقة أو متضاربة.
                          </span>
                        </span>
                        <span className="font-bold text-[#002B49]">
                          إجمالي المستبعد: {summary.duplicateCount}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Form fields: Title and Notes */}
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-[#002B49] mb-1">
                      عنوان أو مسمى القائمة <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={listTitle}
                      onChange={(e) => setListTitle(e.target.value)}
                      placeholder="مثال: قائمة سائقي قطارات الركاب - الشرق والغرب (سار)"
                      className="w-full h-10 px-3 text-sm bg-[#F4F7F9] border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#008269]/20 focus:border-[#008269]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#002B49] mb-1">
                      ملاحظات أو مبررات الاعتماد (اختياري)
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="أدخل أي ملاحظات إدارية متعلقة بهذه القائمة..."
                      className="w-full p-2.5 text-xs bg-[#F4F7F9] border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#008269]/20 focus:border-[#008269]"
                    />
                  </div>

                  {/* Immediate Replacement / Parallel Activation Toggle */}
                  <div className="bg-emerald-50/70 border border-[#008269]/30 rounded-xl p-3 flex items-start gap-2.5">
                    <input
                      id="chk-archive-other"
                      type="checkbox"
                      checked={archiveOtherActiveLists}
                      onChange={(e) => setArchiveOtherActiveLists(e.target.checked)}
                      className="mt-0.5 rounded text-[#008269] focus:ring-[#008269] cursor-pointer"
                    />
                    <label htmlFor="chk-archive-other" className="text-xs text-[#002B49] cursor-pointer">
                      <span className="font-bold block">استبدال وأرشفة القوائم النشطة السابقة فوراً</span>
                      <span className="text-slate-500 text-[11px] block mt-0.5">
                        عند التفعيل، يتم أرشفة القوائم القديمة فوراً والاعتماد الحصري على هذه القائمة الجديدة لمنع أي تداخل.
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl cursor-pointer"
          >
            إلغاء
          </button>

          {step === 'preview' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleSaveAndApprove(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
                title="حفظ القائمة كمسودة دون تفعيلها للجمهور حالياً"
              >
                حفظ كمعتمدة غير نشطة
              </button>

              <button
                id="btn-confirm-approve-list"
                type="button"
                disabled={submitting}
                onClick={() => handleSaveAndApprove(true)}
                className="px-5 py-2.5 rounded-xl bg-[#008269] hover:bg-[#006854] text-white text-xs font-black transition-all flex items-center gap-2 shadow-sm hover:shadow-md cursor-pointer disabled:opacity-60"
                title="اعتماد القائمة فوراً وجعلها القائمة النشطة للتحقق وأرشفة القائمة الحالية"
              >
                {submitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>اعتماد القائمة وتفعيلها الآن</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
