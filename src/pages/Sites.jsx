import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Header from '../components/Header';
import { Globe, Loader2 } from 'lucide-react';
import { getSites } from '../services/api';
import { useLang } from '../context/LangContext';

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.3 } }),
};

export default function Sites() {
  const { t } = useLang();
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSites()
      .then((data) => setSites(data.sites || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Header breadcrumbs={[t('dashboard'), t('sites')]} />
      <div className="p-6">
        <motion.div className="mb-6" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <h2 className="text-xl font-bold text-text-primary">{t('sitesTitle')}</h2>
          <p className="text-sm text-text-secondary mt-1">{sites.length} {sites.length !== 1 ? t('sitesConfigured') : t('siteConfigured')}</p>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-12 gap-3 text-text-secondary">
            <Loader2 className="w-5 h-5 animate-spin" /> {t('loadingSites')}
          </div>
        ) : sites.length === 0 ? (
          <motion.div className="text-center py-16" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
            <Globe className="w-12 h-12 text-text-muted/40 mx-auto mb-4" />
            <p className="text-text-secondary">{t('noSitesYet')}</p>
          </motion.div>
        ) : (
          <div className="grid gap-3">
            {sites.map((site, i) => (
              <motion.a
                key={site.id}
                href={site.search_url}
                target="_blank"
                rel="noopener noreferrer"
                custom={i}
                initial="hidden"
                animate="visible"
                variants={cardVariants}
                className="bg-dark-card border border-dark-border rounded-xl p-4 flex items-center gap-3 hover:border-accent-green/20 hover:shadow-[0_0_15px_rgba(200,245,66,0.04)] transition-all duration-300 group cursor-pointer"
              >
                <div className="w-9 h-9 bg-accent-blue/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-accent-blue/20 transition-colors">
                  <Globe className="w-4 h-4 text-accent-blue" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary group-hover:text-accent-green transition-colors">{site.name}</p>
                  <p className="text-xs text-text-muted">{site.lang}</p>
                </div>
              </motion.a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
