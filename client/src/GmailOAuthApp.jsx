import React, { useState } from "react";
import http, { baseURL } from "./api/http";
import { motion } from "framer-motion";
import { Mail, Sparkles, Settings2, Zap, PenTool, ArrowRight, Shield, Lock } from "lucide-react";

const MailWiseLogin = () => {
  const [loading, setLoading] = useState(false);

  const startOAuthFlow = async () => {
    setLoading(true);
    try {
      const response = await http.get("/auth/url");
      const { authUrl } = response.data;
      window.location.href = authUrl;
    } catch (error) {
      console.error("OAuth Flow Error:", error);
      setLoading(false);
    }
  };

  const features = [
    {
      icon: <Sparkles className="w-6 h-6 text-indigo-500" />,
      title: "AI-Powered Categorization",
      desc: "Our intelligent engine uses Google Gemini AI to automatically sort your inbox into essential categories, cutting out the noise.",
    },
    {
      icon: <Settings2 className="w-6 h-6 text-emerald-500" />,
      title: "Customizable Workflows",
      desc: "Take full control. Create, modify, and delete your own custom categories based on your unique preferences and workflow.",
    },
    {
      icon: <Zap className="w-6 h-6 text-amber-500" />,
      title: "Instant Hover Summaries",
      desc: "Save time by previewing email contents instantly on hover. Get the gist without ever opening the full thread.",
    },
    {
      icon: <PenTool className="w-6 h-6 text-blue-500" />,
      title: "AI-Assisted Composition",
      desc: "Draft professional emails and replies effortlessly with AI assistance, and send them directly from the MailWise platform.",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-6 flex justify-between items-center relative z-10">
        <div className="flex items-center gap-2 cursor-pointer">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <Mail className="text-white w-6 h-6" />
          </div>
          <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500 tracking-tight">
            MailWise
          </span>
        </div>
        <button
          onClick={startOAuthFlow}
          className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors hidden sm:block"
        >
          Sign in
        </button>
      </nav>

      {/* Hero Section */}
      <main className="container mx-auto px-6 pt-20 pb-24 text-center relative overflow-hidden">
        {/* Background decorative blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-tr from-indigo-100 to-emerald-50 rounded-full blur-3xl -z-10 opacity-70"></div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-semibold uppercase tracking-wider mb-8">
            <Sparkles className="w-4 h-4" />
            <span>The Future of Email is Here</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 mb-8 leading-[1.1]">
            Take Control of Your <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-emerald-500">
              Inbox Experience.
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-12 leading-relaxed">
            MailWise leverages artificial intelligence to automatically categorize, summarize, and draft your emails—saving you hours every week.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <button
                onClick={startOAuthFlow}
                disabled={loading}
                className="group relative flex items-center justify-center gap-3 bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-2xl text-lg font-semibold transition-all shadow-xl shadow-slate-900/20 disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-emerald-500/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                {loading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-6 h-6 bg-white rounded-full p-1" />
                    <span>Continue with Google</span>
                  </>
                )}
              </button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <button
                onClick={() => { window.location.href = `${baseURL}/auth/demo` }}
                disabled={loading}
                className="group relative flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 px-8 py-4 rounded-2xl text-lg font-semibold transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <span>Try Demo Account</span>
                <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-slate-900 transition-colors" />
              </button>
            </motion.div>
          </div>
          
          <div className="mt-6 flex items-center justify-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-1"><Shield className="w-4 h-4 text-emerald-500"/> Secure OAuth</span>
            <span className="flex items-center gap-1"><Lock className="w-4 h-4 text-emerald-500"/> Privacy First</span>
          </div>
        </motion.div>
      </main>

      {/* Features Grid */}
      <section className="bg-white py-24 border-t border-slate-100 relative">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Why use MailWise?</h2>
            <p className="text-slate-500 max-w-2xl mx-auto">We built MailWise to solve the fundamental problem of inbox overload, turning a chaotic email list into an organized, AI-powered workspace.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="bg-slate-50 rounded-3xl p-8 border border-slate-100 hover:shadow-xl hover:shadow-indigo-500/5 transition-all group"
              >
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 mb-6 group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works / CTA Section */}
      <section className="py-24 bg-slate-900 text-white relative overflow-hidden">
         <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-3xl -z-10 translate-x-1/3 -translate-y-1/3"></div>
         <div className="container mx-auto px-6 max-w-4xl text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-12">How it works</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 text-left">
              <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                <div className="w-10 h-10 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center font-bold text-lg mb-4">1</div>
                <h3 className="text-lg font-semibold mb-2">Secure Connect</h3>
                <p className="text-slate-400 text-sm">Sign in with your Google account using official OAuth. We don't store your passwords.</p>
              </div>
              <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center font-bold text-lg mb-4">2</div>
                <h3 className="text-lg font-semibold mb-2">AI Processing</h3>
                <p className="text-slate-400 text-sm">Gemini AI analyzes your incoming emails and assigns them to your custom categories.</p>
              </div>
              <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                <div className="w-10 h-10 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center font-bold text-lg mb-4">3</div>
                <h3 className="text-lg font-semibold mb-2">Take Action</h3>
                <p className="text-slate-400 text-sm">Read summaries instantly, draft replies with AI, and manage your inbox seamlessly.</p>
              </div>
            </div>

            <button
              onClick={startOAuthFlow}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-indigo-900"
            >
              Start using MailWise today
            </button>
         </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 py-12 border-t border-slate-800">
        <div className="container mx-auto px-6 text-center text-slate-500 text-sm">
          <div className="flex justify-center items-center gap-2 mb-4">
            <Mail className="w-5 h-5 text-indigo-500" />
            <span className="font-semibold text-slate-300">MailWise</span>
          </div>
          <p>© {new Date().getFullYear()} MailWise. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default MailWiseLogin;
