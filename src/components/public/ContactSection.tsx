import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { MapPin, Phone, Mail, MessageCircle, Send, CheckCircle2 } from 'lucide-react';

export const ContactSection: React.FC = () => {
  const { state } = useAppStore();
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    property: 'all',
    rentalType: 'daily',
    message: ''
  });

  const sectionMeta = state.contentSections.find(s => s.sectionKey === 'contact');

  if (sectionMeta && !sectionMeta.visible) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;
    setFormSubmitted(true);
    setTimeout(() => {
      setFormSubmitted(false);
      setFormData({ name: '', phone: '', property: 'all', rentalType: 'daily', message: '' });
    }, 4000);
  };

  return (
    <section id="contact" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        
        {/* Contact Info & Details */}
        <div className="space-y-6">
          <div>
            <span className="text-xs font-semibold text-[#B69A68] tracking-wider block mb-2 select-none">
              خدمة العملاء المتميزة والكونسيرج الشخصي
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold text-[#282824] tracking-tight">
              {sectionMeta?.title || 'يسعدنا دائماً خدمتك وتلبية رغباتك'}
            </h2>
            <p className="text-sm sm:text-base text-[#68675F] mt-3 leading-relaxed">
              {sectionMeta?.subtitle || 'يرحب فريق الكونسيرج وخدمة الضيوف باستفساراتك، سواء كنت ترغب في تنظيم حجز مخصص للشركات أو حجز جولة فحص فني ميداني للمباني والشقق.'}
            </p>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-start gap-3.5 p-4 rounded-xl bg-[#FFFCF6] border border-[#E3DCCD]">
              <MapPin className="w-5 h-5 text-[#B69A68] shrink-0 mt-0.5" />
              <div>
                <strong className="block text-sm text-[#282824] font-bold">العنوان البريدي الرئيسي:</strong>
                <span className="text-xs text-[#68675F]">{state.settings.address}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href={`tel:${state.settings.phone}`}
                className="flex items-center gap-3 p-3.5 rounded-xl bg-[#FFFCF6] border border-[#E3DCCD] hover:border-[#B69A68] transition-colors"
              >
                <Phone className="w-4 h-4 text-[#B69A68] shrink-0" />
                <div>
                  <span className="block text-[11px] text-[#68675F]">خدمة الضيوف والمبيعات</span>
                  <span className="text-xs font-semibold text-[#282824]" dir="ltr">{state.settings.phone}</span>
                </div>
              </a>

              <a
                href={`https://wa.me/${state.settings.whatsapp.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 p-3.5 rounded-xl bg-[#FFFCF6] border border-[#E3DCCD] hover:border-[#B69A68] transition-colors"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <span className="block text-[11px] text-[#68675F]">الواتساب المباشر ٢٤/٧</span>
                  <span className="text-xs font-semibold text-[#282824]" dir="ltr">{state.settings.whatsapp}</span>
                </div>
              </a>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#FFFCF6] border border-[#E3DCCD]">
              <Mail className="w-4 h-4 text-[#B69A68] shrink-0" />
              <div>
                <span className="block text-[11px] text-[#68675F]">البريد الإلكتروني للطلبات</span>
                <span className="text-xs font-semibold text-[#282824]">{state.settings.email}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Inquiry Form */}
        <div className="glass-ivory-card p-6 sm:p-8 rounded-3xl border border-[#E3DCCD] shadow-sm">
          <h3 className="text-lg font-bold text-[#282824] mb-2">أرسل استفسارك إلينا</h3>
          <p className="text-xs text-[#68675F] mb-6">سيتواصل معك أحد مستشاري السكن والضيافة لدينا في أقل من ١٥ دقيقة.</p>

          {formSubmitted ? (
            <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2 animate-in fade-in">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <h4 className="text-sm font-bold text-emerald-900">شكراً لتواصلك مع منزل الفخامة</h4>
              <p className="text-xs text-emerald-700">تم تسجيل طلب الاستفسار بنجاح، وسيقوم مسؤول الكونسيرج بالاتصال بك فوراً.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#68675F] mb-1">الاسم الكامل للعميل *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: فهد بن عبد الله بن محمد"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E3DCCD] rounded-xl focus:outline-none focus:border-[#B69A68]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#68675F] mb-1">رقم الهاتف الجوال *</label>
                <input
                  type="tel"
                  required
                  placeholder="05XXXXXXXX"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E3DCCD] rounded-xl focus:outline-none focus:border-[#B69A68]"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#68675F] mb-1">المجمع السكني المفضل</label>
                  <select
                    value={formData.property}
                    onChange={(e) => setFormData({ ...formData, property: e.target.value })}
                    className="w-full px-3 py-2.5 text-xs sm:text-sm bg-white border border-[#E3DCCD] rounded-xl focus:outline-none focus:border-[#B69A68]"
                  >
                    <option value="all">أي مجمع سكن متاح</option>
                    {state.properties.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#68675F] mb-1">فئة ونوع التعاقد المطلوب</label>
                  <select
                    value={formData.rentalType}
                    onChange={(e) => setFormData({ ...formData, rentalType: e.target.value })}
                    className="w-full px-3 py-2.5 text-xs sm:text-sm bg-white border border-[#E3DCCD] rounded-xl focus:outline-none focus:border-[#B69A68]"
                  >
                    <option value="daily">حجز فندقي يومي</option>
                    <option value="monthly">عقد إيجار شهري</option>
                    <option value="annual">عقد إيجار سنوي فاخر</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#68675F] mb-1">تفاصيل طلبك وملاحظاتك الإضافية</label>
                <textarea
                  rows={3}
                  placeholder="اكتب هنا أي تفاصيل تود إبلاغ الكونسيرج بها..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-[#E3DCCD] rounded-xl focus:outline-none focus:border-[#B69A68]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#282824] hover:bg-[#1a1a18] text-white text-sm font-semibold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.01]"
              >
                <Send className="w-4 h-4 text-[#B69A68]" />
                <span>إرسال طلب الاستفسار فوراً</span>
              </button>
            </form>
          )}
        </div>

      </div>
    </section>
  );
};
