import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Building2, ArrowRight, Loader2, School, MapPin } from 'lucide-react';
import { searchOrganizations } from '../services/api';
import Card from '../components/ui/Card';

const FindOrganization = () => {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedOrg, setSelectedOrg] = useState<any>(null);
    const [error, setError] = useState<any>(null);

    useEffect(() => {
        const searchHandler = async () => {
            if (query.trim().length < 1) {
                setResults([]);
                return;
            }

            setLoading(true);
            try {
                const data = await searchOrganizations(query);
                // Robust parsing: handle both { colleges: [] } and raw array []
                const colleges = data.colleges || data || [];
                setResults(Array.isArray(colleges) ? colleges : []);
            } catch (err: any) {
                console.error('Search Error:', err);
                const debugInfo = {
                    message: err.message,
                    url: err.config?.url,
                    baseURL: err.config?.baseURL,
                    method: err.config?.method,
                    status: err.response?.status
                };
                setError(debugInfo);
                setResults([]);
            } finally {
                setLoading(false);
            }
        };

        const debounce = setTimeout(searchHandler, 300);
        return () => clearTimeout(debounce);
    }, [query]);

    const handleSelectOrg = (org: any) => {
        setSelectedOrg(org);
        setQuery(org.collegeName);
        setResults([]);
    };

    const handleSearch = () => {
        if (selectedOrg) {
            navigate(`/${selectedOrg.slug}/login`);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center p-6 font-sans">
            {/* Background Shapes */}
            <div className="absolute inset-0 overflow-hidden opacity-30">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-200 rounded-full blur-[128px]"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-green-200 rounded-full blur-[128px]"></div>
            </div>

            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="relative z-10 w-full max-w-2xl"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 border border-slate-100 shadow-xl"
                    >
                        <Building2 size={40} className="text-emerald-600" />
                    </motion.div>
                    <h1 className="text-4xl md:text-5xl font-extrabold mb-4 text-slate-900">Find Your Organization</h1>
                    <p className="text-lg text-slate-500 font-medium">Search for your institution to access the admin portal</p>
                </div>

                {/* Search Box */}
                <Card glass={false} className="p-8 bg-white border border-slate-100 shadow-2xl rounded-[32px]">
                    <div className="relative">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Type your organization name..."
                                className="w-full pl-12 pr-12 py-4 bg-white border border-slate-200 rounded-2xl text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all text-lg font-medium shadow-sm"
                                autoFocus
                            />
                            {loading && (
                                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-600 animate-spin" size={20} />
                            )}
                        </div>

                        <AnimatePresence>
                            {results.length > 0 && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl z-20"
                                >
                                    {results.map((org) => (
                                        <button
                                            key={org.collegeId}
                                            onClick={() => handleSelectOrg(org)}
                                            className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 text-left group"
                                        >
                                            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <School size={20} className="text-emerald-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-slate-800 group-hover:text-emerald-600 transition-colors truncate">
                                                    {org.collegeName}
                                                </h3>
                                                <p className="text-sm text-slate-500 flex items-center gap-1 font-medium">
                                                    <MapPin size={12} />
                                                    {org.slug}
                                                </p>
                                            </div>
                                            <ArrowRight size={18} className="text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Error Message for Debugging */}
                        {error && (
                            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-200 text-sm">
                                <p className="font-bold">Search Error:</p>
                                <pre className="whitespace-pre-wrap mt-1 text-xs opacity-75">{JSON.stringify(error, null, 2)}</pre>
                            </div>
                        )}

                        {/* No Results */}
                        {query.length >= 1 && !loading && results.length === 0 && !error && (
                            <div className="mt-4 text-center text-slate-500 py-8 font-medium">
                                <Building2 size={48} className="mx-auto mb-3 opacity-20" />
                                <p>No organizations found matching "{query}"</p>
                            </div>
                        )}
                    </div>

                    <motion.button
                        whileHover={{ scale: selectedOrg ? 1.02 : 1, y: selectedOrg ? -2 : 0 }}
                        whileTap={{ scale: selectedOrg ? 0.98 : 1 }}
                        onClick={handleSearch}
                        disabled={!selectedOrg}
                        className={`w-full mt-6 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg ${selectedOrg
                            ? 'btn-premium btn-primary-gradient text-white'
                            : 'bg-slate-100 text-slate-400 shadow-none cursor-not-allowed'
                            }`}
                    >
                        <span>Continue to Login</span>
                        <ArrowRight size={20} />
                    </motion.button>
                </Card>

                {/* Back Link */}
                <button
                    onClick={() => navigate('/')}
                    className="mt-6 text-slate-500 font-semibold hover:text-slate-800 transition-colors mx-auto block"
                >
                    ← Back to Home
                </button>
            </motion.div>
        </div>
    );
};

export default FindOrganization;
