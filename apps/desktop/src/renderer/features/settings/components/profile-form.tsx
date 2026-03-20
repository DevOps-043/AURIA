import React, { useState, useEffect } from 'react';
import {
  User,
  Camera,
  Mail,
  Bell,
  Save,
  ShieldCheck,
  Globe,
  Briefcase,
  Settings2,
  Phone,
  Linkedin,
  Globe2,
  Building2,
  MapPin,
  CheckCircle2,
  XCircle,
  Fingerprint
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/shared/hooks/use-auth';
import { supabase } from '@/shared/api/supabase-client';
import { Button } from '@/shared/components/ui/button';
import { SecurityForm } from './security-form';

type FormTab = 'general' | 'professional' | 'localization' | 'notifications' | 'security';

export const ProfileForm: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [activeTab, setActiveTab] = useState<FormTab>('general');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    bio: '',
    avatar_url: '',
    country_code: '',
    city: '',
    locale: 'es',
    timezone: 'America/Mexico_City',
    company_name: '',
    job_title: '',
    industry: '',
    linkedin_url: '',
    website_url: '',
    github_username: '',
    notify_email: true,
    notify_push: true,
    marketing_consent: false,
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id || !supabase) {
        setFetching(false);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (error) throw error;
        
        if (data) {
          setFormData({
            first_name: data.first_name || '',
            last_name: data.last_name || '',
            phone: data.phone || '',
            bio: data.bio || '',
            avatar_url: data.avatar_url || '',
            country_code: data.country_code || '',
            city: data.city || '',
            locale: data.locale || 'es',
            timezone: data.timezone || 'America/Mexico_City',
            company_name: data.company_name || '',
            job_title: data.job_title || '',
            industry: data.industry || '',
            linkedin_url: data.linkedin_url || '',
            website_url: data.website_url || '',
            github_username: data.github_username || '',
            notify_email: data.notify_email ?? true,
            notify_push: data.notify_push ?? true,
            marketing_consent: data.marketing_consent ?? false,
          });
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setFetching(false);
      }
    };

    fetchProfile();
  }, [user?.id]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !user?.id) return;

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('users')
        .update({
          ...formData,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;
      setMessage({ type: 'success', text: 'Perfil actualizado correctamente' });
      
      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'La sincronizacion fallo' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  if (fetching) {
    return (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Cargando datos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Internal Sub-navigation */}
      <div className="flex flex-wrap gap-2 pb-4">
        <SubTabButton active={activeTab === 'general'} onClick={() => setActiveTab('general')} label="Perfil base" />
        <SubTabButton active={activeTab === 'professional'} onClick={() => setActiveTab('professional')} label="Profesional" />
        <SubTabButton active={activeTab === 'localization'} onClick={() => setActiveTab('localization')} label="Ubicacion" />
        <SubTabButton active={activeTab === 'notifications'} onClick={() => setActiveTab('notifications')} label="Notificaciones" />
        <SubTabButton active={activeTab === 'security'} onClick={() => setActiveTab('security')} label="Seguridad" />
      </div>

      {activeTab === 'security' ? (
        <motion.div
          key="security"
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.15 }}
        >
          <SecurityForm />
        </motion.div>
      ) : (
      <form onSubmit={handleUpdateProfile} className="space-y-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'general' && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
                {/* Avatar Section */}
                <div className="md:col-span-4 flex flex-col items-center text-center space-y-6">
                  <div className="relative group">
                    <div className="w-48 h-48 rounded-[3rem] overflow-hidden border-2 border-primary/20 bg-card/50 flex items-center justify-center relative shadow-2xl transition-transform group-hover:scale-[1.02] duration-500">
                      {formData.avatar_url ? (
                        <img src={formData.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-16 h-16 text-muted-foreground/30" />
                      )}
                      <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer backdrop-blur-sm">
                        <Camera className="w-8 h-8 text-white drop-shadow-lg" />
                      </div>
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-background border border-border rounded-2xl flex items-center justify-center shadow-lg">
                      <Fingerprint className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-foreground uppercase tracking-widest leading-none">
                      {formData.first_name} {formData.last_name}
                    </h3>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight opacity-60">
                      {user?.email}
                    </p>
                  </div>
                </div>

                {/* Info Section */}
                <div className="md:col-span-8 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <InputField 
                      label="Nombre" 
                      name="first_name" 
                      value={formData.first_name} 
                      onChange={handleChange} 
                      placeholder="Ej. Alex"
                      icon={<User className="w-4 h-4" />}
                    />
                    <InputField 
                      label="Apellido" 
                      name="last_name" 
                      value={formData.last_name} 
                      onChange={handleChange} 
                      placeholder="Ej. Kovalyov"
                      icon={<User className="w-4 h-4" />}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
                      Biografia
                    </label>
                    <textarea 
                      name="bio"
                      value={formData.bio}
                      onChange={handleChange}
                      rows={4}
                      className="w-full bg-background border border-border/60 rounded-3xl py-4 px-5 text-sm font-medium focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground/30 resize-none shadow-sm"
                      placeholder="Describe brevemente tu perfil..."
                    />
                  </div>

                  <InputField 
                    label="Sitio web" 
                    name="website_url" 
                    value={formData.website_url} 
                    onChange={handleChange} 
                    placeholder="https://..."
                    icon={<Globe2 className="w-4 h-4" />}
                  />
                </div>
              </div>
            )}

            {activeTab === 'professional' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <InputField 
                  label="Empresa" 
                  name="company_name" 
                  value={formData.company_name} 
                  onChange={handleChange} 
                  placeholder="Nombre de la empresa"
                  icon={<Building2 className="w-4 h-4" />}
                />
                <InputField 
                  label="Puesto" 
                  name="job_title" 
                  value={formData.job_title} 
                  onChange={handleChange} 
                  placeholder="Analista senior"
                  icon={<Briefcase className="w-4 h-4" />}
                />
                <InputField 
                  label="Industria" 
                  name="industry" 
                  value={formData.industry} 
                  onChange={handleChange} 
                  placeholder="Tecnologia / Finanzas / Investigacion"
                  icon={<Settings2 className="w-4 h-4" />}
                />
                <InputField 
                  label="Perfil de LinkedIn" 
                  name="linkedin_url" 
                  value={formData.linkedin_url} 
                  onChange={handleChange} 
                  placeholder="linkedin.com/in/username"
                  icon={<Linkedin className="w-4 h-4" />}
                />
                <InputField 
                  label="Usuario de GitHub" 
                  name="github_username" 
                  value={formData.github_username} 
                  onChange={handleChange} 
                  placeholder="username"
                  icon={<Globe className="w-4 h-4" />}
                />
                <InputField 
                  label="Telefono" 
                  name="phone" 
                  value={formData.phone} 
                  onChange={handleChange} 
                  placeholder="+52 555 000 0000"
                  icon={<Phone className="w-4 h-4" />}
                />
              </div>
            )}

            {activeTab === 'localization' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <InputField
                  label="Ciudad actual"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Ciudad de Mexico"
                  icon={<MapPin className="w-4 h-4" />}
                />
                <InputField
                  label="Codigo de pais (ISO)"
                  name="country_code"
                  value={formData.country_code}
                  onChange={handleChange}
                  placeholder="MX"
                  icon={<Globe2 className="w-4 h-4" />}
                />
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
                    Idioma de la interfaz
                  </label>
                  <select
                    name="locale"
                    value={formData.locale}
                    onChange={handleChange}
                    className="w-full bg-background border border-border/60 rounded-[1.2rem] h-12 px-5 text-sm font-medium focus:outline-none focus:border-primary/50 transition-all appearance-none"
                  >
                    <option value="es">Espanol (ES)</option>
                    <option value="en">Ingles (EN)</option>
                    <option value="fr">Frances (FR)</option>
                  </select>
                </div>
                <InputField
                  label="Zona horaria"
                  name="timezone"
                  value={formData.timezone}
                  onChange={handleChange}
                  placeholder="America/Mexico_City"
                  icon={<Globe className="w-4 h-4" />}
                />
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-8">
                <div className="rounded-[1.8rem] border border-primary/15 bg-primary/5 px-6 py-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">Notificaciones del sistema</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    AQELOR envia notificaciones nativas del sistema operativo cuando una ejecucion del agente se completa, falla o es abortada.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <ToggleItem
                    title="Notificaciones por correo"
                    description="Recibe eventos y reportes por correo electronico"
                    name="notify_email"
                    checked={formData.notify_email}
                    onChange={handleChange}
                    icon={<Mail className="w-4 h-4" />}
                  />
                  <ToggleItem
                    title="Alertas push"
                    description="Alertas en tiempo real del sistema"
                    name="notify_push"
                    checked={formData.notify_push}
                    onChange={handleChange}
                    icon={<Bell className="w-4 h-4" />}
                  />
                  <ToggleItem
                    title="Mejora del producto"
                    description="Permite usar datos anonimos para mejorar el sistema"
                    name="marketing_consent"
                    checked={formData.marketing_consent}
                    onChange={handleChange}
                    icon={<Settings2 className="w-4 h-4" />}
                  />
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>

        <div className="pt-8 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Button 
                type="submit" 
                disabled={loading}
                className="bg-primary text-white h-14 px-10 rounded-[1.5rem] font-black uppercase tracking-widest text-[11px] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-transform flex items-center gap-3"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  Guardar cambios
                  <Save className="w-4 h-4" />
                </>
              )}
            </Button>

            <AnimatePresence>
              {message && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full border ${
                    message.type === 'success' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-red-500/5 border-red-500/20 text-red-400'
                  }`}
                >
                  {message.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {message.text}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-3 text-muted-foreground bg-muted/30 px-5 py-3 rounded-[1.2rem] border border-border/40">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="text-[9px] font-bold uppercase tracking-widest">Tus datos de perfil se almacenan cifrados</span>
          </div>
        </div>
      </form>
      )}
    </div>
  );
};

function SubTabButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button 
      type="button"
      onClick={onClick}
      className={`px-6 py-2.5 rounded-[1.2rem] text-[10px] font-black uppercase tracking-widest transition-all ${
        active 
          ? 'bg-foreground text-background shadow-lg shadow-foreground/10' 
          : 'text-muted-foreground hover:bg-card hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}

function InputField({ label, name, value, onChange, placeholder, icon }: { 
  label: string, 
  name: string, 
  value: string, 
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, 
  placeholder: string,
  icon: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
        {label}
      </label>
      <div className="relative group">
        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within:text-primary transition-colors">
          {icon}
        </div>
        <input
          type="text"
          name={name}
          value={value}
          onChange={onChange}
          className="w-full bg-background border border-border/60 rounded-[1.4rem] h-12 pl-12 pr-5 text-sm font-medium focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground/20 shadow-sm"
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}

function ToggleItem({ title, description, name, checked, onChange, icon }: {
  title: string;
  description: string;
  name: string;
  checked: boolean;
  onChange: (e: any) => void;
  icon: React.ReactNode;
}) {
  return (
    <label className={`flex items-start gap-4 p-5 rounded-[1.8rem] border transition-all cursor-pointer select-none ${
      checked ? 'bg-primary/5 border-primary/20' : 'bg-card border-border/40 hover:border-border'
    }`}>
      <div className={`p-2.5 rounded-xl ${checked ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
        {icon}
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black text-foreground uppercase tracking-widest">{title}</span>
          <div className={`w-10 h-6 rounded-full relative transition-colors ${checked ? 'bg-primary' : 'bg-muted'}`}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${checked ? 'left-5' : 'left-1'}`} />
          </div>
        </div>
        <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-tight">{description}</p>
      </div>
      <input type="checkbox" name={name} checked={checked} onChange={onChange} className="hidden" />
    </label>
  );
}

