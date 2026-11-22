import { motion } from 'framer-motion';
import { FileSpreadsheet, Download } from 'lucide-react';
import { getDownloadUrl, downloadFile } from '../services/api';
import { useLang } from '../context/LangContext';
import { safeDownloadUrl } from '../utils/url';

export default function ExportButtons({ mission }) {
  const { t } = useLang();
  // Only same-origin paths or http(s) URLs are ever opened.
  const excelFile = safeDownloadUrl(getDownloadUrl(mission?.excel_download));

  const handleExcelDownload = () => {
    if (excelFile) {
      downloadFile(excelFile).catch(() => { /* api client already surfaced outages/auth */ });
    }
  };

  return (
    <motion.button
      onClick={handleExcelDownload}
      disabled={!excelFile}
      className="flex items-center gap-2 px-5 py-2.5 bg-dark-card border border-dark-border rounded-xl text-sm text-text-secondary hover:text-accent-green hover:border-accent-green/30 hover:shadow-[0_0_15px_rgb(var(--brand-rgb)/0.1)] transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-text-secondary disabled:hover:border-dark-border disabled:hover:shadow-none"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.35, duration: 0.3 }}
      whileHover={excelFile ? { scale: 1.03 } : {}}
      whileTap={excelFile ? { scale: 0.97 } : {}}
    >
      <FileSpreadsheet className="w-4 h-4" />
      {t('export')}
      {excelFile && <Download className="w-3.5 h-3.5" />}
    </motion.button>
  );
}
