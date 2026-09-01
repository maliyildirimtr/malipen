MaliPen — Kurulum ve İzin Kılavuzu
====================================
Version 1.0.0 | https://pen.maliyildirimtr.com


MaliPen, ekranınızın üzerinde çizim yapabilmek için bazı sistem izinleri
gerektirir. Aşağıdaki adımları takip ederek uygulamayı sorunsuz kullanabilirsiniz.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  MACOS — KURULUM ADIMLARI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. MaliPen.app dosyasını /Applications klasörüne taşıyın.

2. Uygulamayı ilk kez açtığınızda "Apple tarafından doğrulanamıyor" uyarısı
   alabilirsiniz. Bu normal bir güvenlik uyarısıdır.

   ÇÖZÜM A — Terminal ile (Tavsiye Edilen):
   ─────────────────────────────────────────
   Terminal'i açın (Spotlight → "Terminal") ve şu komutu çalıştırın:

     xattr -cr /Applications/MaliPen.app

   Enter tuşuna basın. Artık uygulamayı açabilirsiniz.

   ÇÖZÜM B — Sağ Tıklama ile:
   ────────────────────────────
   Finder'da MaliPen.app üzerine sağ tıklayın → "Aç" seçin →
   Uyarı penceresinde tekrar "Aç" butonuna tıklayın.

3. Uygulama açıldıktan sonra şu izinleri vermeniz gerekir:

   • EKRAN KAYDI İZNİ (Zorunlu):
     Sistem Tercihleri → Gizlilik ve Güvenlik → Ekran Kaydı →
     MaliPen'in yanındaki kutuyu işaretleyin → Uygulamayı yeniden başlatın.

   • ERİŞİLEBİLİRLİK İZNİ (Klavye kısayolları için):
     Sistem Tercihleri → Gizlilik ve Güvenlik → Erişilebilirlik →
     MaliPen'i listeden etkinleştirin.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  WINDOWS — KURULUM ADIMLARI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. MaliPen-windows.exe dosyasını indirdikten sonra çift tıklayın.

2. "Windows PC'nizi korudu" (SmartScreen) uyarısı çıkabilir.
   Bu MaliPen'in yeni bir uygulama olmasından kaynaklanır.

   ÇÖZÜM:
   ───────
   • "Daha fazla bilgi" linkine tıklayın.
   • "Yine de çalıştır" butonuna tıklayın.
   • Kurulum tamamlandıktan sonra uygulamayı başlatın.

3. Eğer uygulama başlangıçta çalışmıyorsa PowerShell (Yönetici olarak)
   açın ve şu komutu çalıştırın:

     Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

4. Gerekli izinler:
   • MaliPen başlangıçta UAC (Kullanıcı Hesabı Denetimi) izni isteyebilir.
     "Evet" seçeneğini tıklayın.
   • Güvenlik Duvarı uyarısı çıkarsa "Erişime izin ver" seçin.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SORUN GİDERME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Herhangi bir sorunla karşılaşırsanız:

  Web Sitesi   : https://pen.maliyildirimtr.com
  GitHub       : https://github.com/maliyildirimtr/MaliPen
  Kurulum Kılavuzu: https://pen.maliyildirimtr.com/setup.html

GitHub Issues üzerinden sorunuzu iletebilirsiniz:
  https://github.com/maliyildirimtr/MaliPen/issues


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  MaliPen © 2026 Mali Yıldırım — Ücretsiz & Açık Kaynak
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
