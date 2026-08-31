import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface PrivacyPolicyProps {
  onClose: () => void;
  language?: string;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onClose, language = 'Türkçe' }) => {
  const isEn = language === 'English';

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        e.stopPropagation(); // Stop global handlers
      }
    };
    // Use capturing phase to intercept before global window listeners in App.tsx
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  const lastUpdated = new Date().toLocaleDateString(isEn ? 'en-US' : 'tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="privacy-overlay" onClick={onClose}>
      <div className="privacy-container" onClick={(e) => e.stopPropagation()}>
        <header className="privacy-header">
          <div>
            <h1 className="privacy-title">{isEn ? 'Privacy Policy' : 'Gizlilik Politikası'}</h1>
            <p className="privacy-date">{isEn ? 'Last Updated' : 'Son Güncelleme'}: {lastUpdated}</p>
          </div>
          <button 
            className="privacy-close-btn tool-btn" 
            onClick={onClose}
            title={isEn ? 'Close (Escape)' : 'Kapat (Escape)'}
            aria-label={isEn ? 'Close' : 'Kapat'}
          >
            <X size={24} />
          </button>
        </header>

        <div className="privacy-content">
          {isEn ? (
            <>
              <section>
                <h2>1. General Information</h2>
                <p>
                  MaliPen is a local desktop application built on user privacy. It operates directly on your device without requiring an internet connection and does not send your data to any remote cloud servers. MaliPen's goal is to provide a safe, independent drawing, annotation, and board experience.
                </p>
              </section>

              <section>
                <h2>2. Collected Information & Data Processing</h2>
                <p>
                  The MaliPen application <strong>does not collect, process, or store any personal data</strong> such as your name, email address, or location.
                </p>
                <ul>
                  <li><strong>Drawings & Board Contents:</strong> All drawings, text, and annotations made on the screen, whiteboard, or blackboard are only temporarily processed in your device's RAM memory and local disk. None of this data is transmitted externally.</li>
                  <li><strong>Screenshots:</strong> Images captured using the built-in screenshot tool are saved directly to your local clipboard or local storage folder of your choice.</li>
                  <li><strong>User Settings:</strong> Custom colors, brush sizes, favorite tools, and shortcuts are saved locally on your device in your user settings file.</li>
                </ul>
              </section>

              <section>
                <h2>3. Third-Party Services & Links</h2>
                <p>
                  MaliPen contains no background analytics, trackers, or advertising services.
                </p>
                <p>
                  External links provided in the "About" dialog (Mali Academy, Instagram, GitHub) open directly in your computer's <strong>default web browser</strong>. When visiting external sites, their respective privacy policies apply.
                </p>
              </section>

              <section>
                <h2>4. Cookies</h2>
                <p>
                  MaliPen is a native desktop application, not a web server. It does not place, read, or manage any cookies on your machine.
                </p>
              </section>

              <section>
                <h2>5. Contact</h2>
                <p>
                  If you have questions or feedback regarding this Privacy Policy, you may contact the developer via:
                </p>
                <p>
                  <a href="#" onClick={(e) => {
                    e.preventDefault();
                    window.open('https://maliyildirimtr.com/sosyal.html');
                  }} style={{ color: '#3b82f6', textDecoration: 'underline' }}>
                    maliyildirimtr.com
                  </a>
                </p>
              </section>
            </>
          ) : (
            <>
              <section>
                <h2>1. Genel Bilgiler</h2>
                <p>
                  MaliPen, kullanıcı gizliliğini temel alan yerel bir masaüstü uygulamasıdır. İnternet bağlantısına ihtiyaç duymadan cihazınızda çalışır ve verilerinizi hiçbir uzak sunucuya (cloud) göndermez. MaliPen'in amacı, güvenli ve bağımsız bir çizim, açıklama ve tahta deneyimi sunmaktır.
                </p>
              </section>

              <section>
                <h2>2. Toplanan Bilgiler ve Veri İşleme</h2>
                <p>
                  MaliPen uygulaması, adınız, e-posta adresiniz veya konumunuz gibi <strong>hiçbir kişisel veriyi toplamaz, işlemez veya saklamaz.</strong>
                </p>
                <ul>
                  <li><strong>Çizimler ve Tahta İçerikleri:</strong> Beyaz tahta (whiteboard), kara tahta (blackboard) veya ekran üzerinde yaptığınız tüm çizimler, metinler ve şekiller (annotation) yalnızca anlık olarak bilgisayarınızın RAM belleğinde ve lokal diskinizde işlenir. Bu veriler dışarı aktarılmaz.</li>
                  <li><strong>Ekran Görüntüleri:</strong> Uygulama içi ekran görüntüsü alma aracıyla oluşturduğunuz görseller, doğrudan panonuza (clipboard) veya bilgisayarınızın yerel depolama alanına kaydedilir.</li>
                  <li><strong>Kullanıcı Ayarları:</strong> Seçtiğiniz renkler, fırça boyutları, favori araçlarınız ve diğer uygulama içi ayarlar, bilgisayarınızda yerel bir dosyada (<code>settings.json</code>) saklanır.</li>
                </ul>
              </section>

              <section>
                <h2>3. Üçüncü Taraf Hizmetler ve Bağlantılar</h2>
                <p>
                  MaliPen, arka planda çalışan herhangi bir analiz (analytics), reklam veya izleme aracı içermez.
                </p>
                <p>
                  Uygulamanın "Hakkında" bölümünde yer alan dış bağlantılara (Mali Academy web sitesi, Instagram, GitHub) tıkladığınızda, bu sayfalar uygulamanın içinde değil, bilgisayarınızın <strong>varsayılan web tarayıcısında</strong> açılır. Bu siteleri ziyaret ettiğinizde, o platformların kendi gizlilik politikaları geçerli olacaktır.
                </p>
              </section>

              <section>
                <h2>4. Çerezler (Cookies)</h2>
                <p>
                  MaliPen bir web sitesi değil, bir masaüstü uygulamasıdır. Bu nedenle cihazınıza herhangi bir çerez (cookie) yerleştirmez veya cihazınızdan çerez okumaz.
                </p>
              </section>

              <section>
                <h2>5. İletişim</h2>
                <p>
                  Bu Gizlilik Politikası hakkında sorularınız veya görüşleriniz varsa, geliştirici ile aşağıdaki bağlantı üzerinden iletişime geçebilirsiniz:
                </p>
                <p>
                  <a href="#" onClick={(e) => {
                    e.preventDefault();
                    window.open('https://maliyildirimtr.com/sosyal.html');
                  }} style={{ color: '#3b82f6', textDecoration: 'underline' }}>
                    maliyildirimtr.com
                  </a>
                </p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
